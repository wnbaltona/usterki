import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-push-token',
  'Content-Type': 'application/json; charset=utf-8',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: cors });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  if (request.method === 'GET') {
    return publicKey ? json({ publicKey }) : json({ error: 'Push is not configured' }, 503);
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const webhookToken = Deno.env.get('PUSH_WEBHOOK_TOKEN');
  if (!webhookToken || request.headers.get('x-push-token') !== webhookToken) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!publicKey || !privateKey || !subject || !serviceKey || !supabaseUrl) {
    return json({ error: 'Missing server configuration' }, 503);
  }

  let notificationId: string;
  try {
    const payload = await request.json();
    notificationId = payload?.record?.notification_id;
    if (!notificationId || typeof notificationId !== 'string') throw Error('Missing notification ID');
  } catch { return json({ error: 'Invalid webhook payload' }, 400); }

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claimed, error: claimError } = await db.rpc('claim_usterki_push_job', {
    job_id: notificationId,
  });
  if (claimError) return json({ error: claimError.message }, 500);
  const job = claimed?.[0];
  if (!job) return json({ skipped: true });

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const { data: devices, error: devicesError } = await db
      .from('usterki_push_subscriptions')
      .select('id,endpoint,p256dh,auth')
      .eq('profile_id', job.recipient_profile_id);
    if (devicesError) throw devicesError;

    const payload = JSON.stringify({
      title: job.title,
      body: 'Otwórz aplikację, aby zobaczyć szczegóły.',
      ticketId: job.ticket_id,
      tag: job.notification_id,
    });
    for (const device of devices || []) {
      try {
        await webpush.sendNotification({
          endpoint: device.endpoint,
          keys: { p256dh: device.p256dh, auth: device.auth },
        }, payload, { TTL: 3600 });
      } catch (error) {
        const code = (error as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          const { error: deleteError } = await db.from('usterki_push_subscriptions')
            .delete().eq('id', device.id);
          if (deleteError) throw deleteError;
        } else throw error;
      }
    }
    const { error: sentError } = await db.from('usterki_push_jobs')
      .update({ sent_at: new Date().toISOString(), claimed_at: null, last_error: null })
      .eq('notification_id', notificationId);
    if (sentError) throw sentError;
    return json({ sent: (devices || []).length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.from('usterki_push_jobs')
      .update({ claimed_at: null, last_error: message.slice(0, 500) })
      .eq('notification_id', notificationId);
    return json({ error: 'Push delivery failed' }, 502);
  }
});
