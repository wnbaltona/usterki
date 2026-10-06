import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-push-token','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
function allowedEndpoint(endpoint){try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(u.hostname)||/^[a-z0-9-]+\.notify\.windows\.com$/.test(u.hostname));}catch{return false;}}
export async function handlePush(req){
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 const publicKey=Deno.env.get('VAPID_PUBLIC_KEY');
 if(req.method==='GET')return publicKey?reply({publicKey}):reply({error:'Push nie jest skonfigurowany'},503);
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const token=Deno.env.get('PUSH_WEBHOOK_TOKEN');
 if(!token||req.headers.get('x-push-token')!==token)return reply({error:'Unauthorized'},401);
 const privateKey=Deno.env.get('VAPID_PRIVATE_KEY'),subject=Deno.env.get('VAPID_SUBJECT');
 if(!publicKey||!privateKey||!subject)return reply({error:'Brak konfiguracji VAPID'},503);
 const db=createClient(Deno.env.get('SUPABASE_URL'),Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
 try{
 webpush.setVapidDetails(subject,publicKey,privateKey);
 const {data:jobs,error}=await db.rpc('claim_usterki_push_jobs');if(error)throw error;
 let sent=0,skipped=0,failed=0;
 for(const job of jobs||[]){
  try{
   const {data:device,error:de}=await db.from('usterki_push_subscriptions').select('*').eq('endpoint',job.endpoint).maybeSingle();if(de)throw de;
   const {data:snapshot,error:se}=await db.from('usterki_demo_state').select('data').eq('id',1).single();if(se)throw se;
   const profile=snapshot.data.users.find(u=>u.id===job.recipient_id&&u.authUserId===device?.auth_user_id&&u.active&&!u.deletedAt);
   const ticket=snapshot.data.tickets.find(t=>t.id===job.payload.ticketId);
   const notice=snapshot.data.notifications.find(n=>n.id===job.notification_id&&n.recipientId===job.recipient_id);
   const eligible=profile&&ticket&&notice&&!notice.readAt&&(['Administrator','Koordynator'].includes(profile.role)||ticket.creatorId===profile.id||(profile.mpks||[]).includes(ticket.mpk));
   if(!device||!eligible){const {error}=await db.from('usterki_push_jobs').update({status:'sent',lease_until:null,last_error:'Pominięto: brak dostępu lub powiadomienie przeczytane'}).eq('id',job.id).eq('lease_token',job.lease_token);if(error)throw error;skipped++;continue;}
   if(!allowedEndpoint(device.endpoint))throw Error('Niedozwolony serwer push');
   await webpush.sendNotification({endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth}},JSON.stringify(job.payload),{TTL:3600,timeout:10000,urgency:'normal'});
   const {error}=await db.from('usterki_push_jobs').update({status:'sent',lease_until:null,last_error:null}).eq('id',job.id).eq('lease_token',job.lease_token);if(error)throw error;sent++;
  }catch(error){
   failed++;if([404,410].includes(error.statusCode)){await db.from('usterki_push_subscriptions').delete().eq('endpoint',job.endpoint);continue;}
   const result=await db.from('usterki_push_jobs').update({status:job.attempts>=5?'failed':'pending',next_attempt_at:new Date(Date.now()+60000*job.attempts).toISOString(),lease_until:null,last_error:String(error.statusCode||error.message||'Błąd wysyłki').slice(0,200)}).eq('id',job.id).eq('lease_token',job.lease_token);if(result.error)throw result.error;
  }
 }
 return reply({sent,skipped,failed});
 }catch{return reply({error:'Nie udało się przetworzyć kolejki push'},500);}
}
Deno.serve(handlePush);
