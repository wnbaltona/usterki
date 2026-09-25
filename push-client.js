/* Powiadomienia na urządzeniu są opcjonalne i wymagają usługi send-push w Supabase. */
const PUSH_TABLE = 'usterki_push_subscriptions';
const PUSH_FUNCTION = SUPABASE_URL + '/functions/v1/send-push';
let pushBusy = false;
let pushCachedKey = null;

function pushSupported() {
  return window.isSecureContext && 'serviceWorker' in navigator &&
    'PushManager' in window && 'Notification' in window;
}

function pushKeyBytes(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
}

async function pushRegistration() {
  return navigator.serviceWorker.register('./push-sw.js', { scope: './' });
}

async function pushSubscription() {
  const registration = await pushRegistration();
  return registration.pushManager.getSubscription();
}

async function pushPublicKey() {
  const response = await fetch(PUSH_FUNCTION);
  if (!response.ok) throw Error('Powiadomienia telefonu nie są jeszcze skonfigurowane w Supabase.');
  const config = await response.json();
  if (!config.publicKey) throw Error('Brak klucza powiadomień w Supabase.');
  return config.publicKey;
}

async function savePushSubscription(subscription) {
  if (!authUser || !currentId) return;
  const keys = subscription.toJSON().keys;
  if (!keys?.p256dh || !keys?.auth) throw Error('Przeglądarka nie udostępniła kluczy powiadomień.');
  const { error } = await authClient.from(PUSH_TABLE).upsert({
    auth_user_id: authUser.id,
    profile_id: currentId,
    endpoint: subscription.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  if (error) throw Error('Nie udało się zapisać urządzenia w Supabase: ' + error.message);
}

async function removePushSubscription() {
  if (!pushSupported()) return;
  const subscription = await pushSubscription();
  if (!subscription) return;
  if (authClient && authUser) {
    const { error } = await authClient.from(PUSH_TABLE).delete().eq('endpoint', subscription.endpoint);
    if (error) throw Error('Nie udało się wyłączyć powiadomień: ' + error.message);
  }
  await subscription.unsubscribe();
}

window.removePushForLogout = async function () {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  await removePushSubscription();
};

window.refreshPushButton = async function () {
  const button = document.getElementById('push-toggle');
  const status = document.getElementById('push-status');
  if (!button || !status) return;
  if (!pushSupported()) {
    status.textContent = window.isSecureContext
      ? 'Ta przeglądarka nie obsługuje powiadomień.'
      : 'Otwórz aplikację przez bezpieczny adres HTTPS.';
    button.disabled = true;
    return;
  }
  if (Notification.permission === 'denied') {
    status.textContent = 'Powiadomienia są zablokowane w ustawieniach telefonu.';
    button.disabled = true;
    return;
  }
  if (pushBusy) { button.disabled = true; return; }
  try {
    const subscription = await pushSubscription();
    if (!status.isConnected) return;
    if (!subscription) {
      try { pushCachedKey = await pushPublicKey(); }
      catch {
        if (status.isConnected) {
          status.textContent = 'Wysyłka na telefon nie jest jeszcze skonfigurowana.';
          button.disabled = true;
        }
        return;
      }
    }
    if (!status.isConnected) return;
    status.textContent = subscription ? 'Włączone na tym urządzeniu.' : 'Otrzymuj informacje o nowych zgłoszeniach i zmianach.';
    button.textContent = subscription ? 'Wyłącz' : 'Włącz';
    button.disabled = false;
  } catch {
    if (!status.isConnected) return;
    status.textContent = 'Nie udało się sprawdzić ustawień powiadomień.';
    button.disabled = false;
  }
};

document.addEventListener('click', async event => {
  if (event.target?.id !== 'push-toggle' || pushBusy) return;
  pushBusy = true;
  const button = event.target;
  button.disabled = true;
  try {
    // Na iPhonie przeglądarka wymaga wywołania wprost po dotknięciu przycisku.
    const permissionPromise = Notification.permission === 'default'
      ? Notification.requestPermission() : null;
    const existing = await pushSubscription();
    if (existing) {
      await removePushSubscription();
      toast('Powiadomienia na tym urządzeniu są wyłączone.');
    } else {
      const permission = permissionPromise ? await permissionPromise : Notification.permission;
      if (permission !== 'granted') throw Error('Nie przyznano zgody na powiadomienia.');
      const publicKey = pushCachedKey || await pushPublicKey();
      const registration = await pushRegistration();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: pushKeyBytes(publicKey),
      });
      try { await savePushSubscription(subscription); }
      catch (error) { await subscription.unsubscribe(); throw error; }
      toast('Powiadomienia na tym urządzeniu są włączone.');
    }
  } catch (error) { toast(error.message || 'Nie udało się zmienić powiadomień.', true); }
  finally { pushBusy = false; window.refreshPushButton(); }
});

async function restorePushSubscription() {
  if (!pushSupported() || !authUser || Notification.permission !== 'granted') return;
  const subscription = await pushSubscription();
  if (subscription) await savePushSubscription(subscription);
}

function openTicketFromPush() {
  const url = new URL(location.href);
  const ticketId = url.searchParams.get('ticket');
  if (!ticketId || !authUser || !state?.tickets?.length) return;
  url.searchParams.delete('ticket');
  history.replaceState(null, '', url);
  if (currentTickets().some(ticket => ticket.id === ticketId)) {
    openTicket(ticketId).catch(error => toast(error.message, true));
  } else {
    toast('Zgłoszenie nie jest dostępne w wybranym profilu.', true);
  }
}

window.onPushAppReady = function () {
  restorePushSubscription().catch(() => {});
  openTicketFromPush();
};

window.onPushProfileChanged = function () {
  restorePushSubscription().catch(error => toast(error.message, true));
  window.refreshPushButton();
};
