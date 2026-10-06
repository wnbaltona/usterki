/* Powiadomienia na urządzeniu są opcjonalne i wymagają usługi send-push w Supabase. */
const PUSH_TABLE = 'usterki_push_subscriptions';
const PUSH_FUNCTION = SUPABASE_URL + '/functions/v1/send-push';
let pushBusy = false;
let pushCachedKey = null;
let pushLastError='';
function pushTimeout(promise,message,ms=12000){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]).finally(()=>clearTimeout(timer));}
function pushSupportError(){if(!window.isSecureContext)return 'Otwórz aplikację pod adresem HTTPS.';if(!pushSupported())return 'Ta przeglądarka nie obsługuje push. Na iPhonie otwórz aplikację z ikony na ekranie początkowym. Na laptopie użyj Chrome lub Edge.';if(Notification.permission==='denied')return 'Zgoda na powiadomienia jest zablokowana. Odblokuj ją w ustawieniach tej strony lub aplikacji w przeglądarce/systemie.';return '';}


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
  await pushTimeout(navigator.serviceWorker.register('./app-sw.js', { scope: './' }),'Nie udało się uruchomić obsługi push. Sprawdź, czy app-sw.js jest wgrany na hosting.');
  return pushTimeout(navigator.serviceWorker.ready,'Obsługa push nie uruchomiła się. Odśwież aplikację i sprawdź plik app-sw.js na hostingu.');
}

async function pushSubscription() {
  const registration = await pushRegistration();
  return registration.pushManager.getSubscription();
}

async function pushPublicKey(){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(PUSH_FUNCTION,{headers:{apikey:SUPABASE_ANON_KEY},signal:controller.signal});
  if(response.status===401||response.status===403)throw Error('Funkcja send-push odrzuca dostęp. Wyłącz Verify JWT w ustawieniach tej funkcji w Supabase.');
  if(response.status===404)throw Error('Brak funkcji send-push w Supabase. Najpierw wdróż tę funkcję.');
  if(response.status===503)throw Error('W Supabase brakuje VAPID_PUBLIC_KEY. Dodaj klucze w Edge Functions → Secrets.');
  if(!response.ok)throw Error('Błąd funkcji send-push: HTTP '+response.status+'. Sprawdź jej logi w Supabase.');
  const config=await response.json();
  if(!config.publicKey)throw Error('Funkcja send-push nie zwraca klucza VAPID_PUBLIC_KEY.');
  const bytes=pushKeyBytes(config.publicKey);if(bytes.length!==65||bytes[0]!==4)throw Error('VAPID_PUBLIC_KEY jest niepoprawny. Wpisz cały klucz publiczny z generatora.');
  return config.publicKey;
 }catch(error){if(error.name==='AbortError')throw Error('Brak odpowiedzi send-push. Sprawdź połączenie i wdrożenie funkcji.');if(error instanceof TypeError)throw Error('Nie można połączyć się z send-push. Sprawdź wdrożenie funkcji i jej obsługę CORS.');throw error;}
 finally{clearTimeout(timer);}
}

async function savePushSubscription(subscription) {
  const profile=signedInProfile();
  if(!authUser||!profile)throw Error('Najpierw administrator musi nadać dostęp do aplikacji.');
  const keys = subscription.toJSON().keys;
  if (!keys?.p256dh || !keys?.auth) throw Error('Przeglądarka nie udostępniła kluczy powiadomień.');
  const { error } = await authClient.from(PUSH_TABLE).upsert({
    auth_user_id: authUser.id,
    profile_id: profile.id,
    endpoint: subscription.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  if (error) throw Error('Nie udało się zapisać urządzenia w Supabase: ' + error.message);
}

async function removePushSubscription(){
 if(!pushSupported())return;
 const subscription=await pushSubscription();if(!subscription)return;
 let failure;
 try{if(authClient&&authUser){const {error}=await authClient.from(PUSH_TABLE).delete().eq('endpoint',subscription.endpoint);if(error)failure=error;}}
 finally{await subscription.unsubscribe();}
 if(failure)throw Error('Urządzenie wyłączono lokalnie, ale usunięcie wpisu z bazy nie powiodło się.');
}

window.removePushForLogout = async function () {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  await removePushSubscription();
};

window.refreshPushButton=async function(){
 const button=document.getElementById('push-toggle'),status=document.getElementById('push-status');if(!button||!status)return;
 button.disabled=pushBusy;if(pushBusy)return;
 if(!signedInProfile()){status.textContent='Powiadomienia wymagają aktywnego dostępu do aplikacji.';button.disabled=true;return;}
 const problem=pushSupportError();if(problem){status.textContent=problem;button.textContent='Sprawdź powiadomienia';return;}
 button.textContent='Włącz powiadomienia';
 try{const subscription=await pushSubscription();if(!status.isConnected||pushBusy)return;
 button.textContent=subscription?'Wyłącz powiadomienia':'Włącz powiadomienia';
 status.textContent=pushLastError||(subscription?'Włączone na tym urządzeniu.':'Kliknij, aby zezwolić na powiadomienia na tym urządzeniu.');
 }catch(error){if(status.isConnected)status.textContent=error.message;}
};

document.addEventListener('click', async event => {
  const clicked=event.target.closest?.('#push-toggle');if(!clicked||pushBusy)return;
  pushBusy = true;
  const button = clicked;
  const status=document.getElementById('push-status');pushLastError='';
  button.disabled = true;
  try {
    const problem=pushSupportError();if(problem)throw Error(problem);
    if(!signedInProfile())throw Error('Najpierw administrator musi nadać dostęp.');
    if(status)status.textContent='Włączanie lub wyłączanie powiadomień…';
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
  } catch (error) { pushLastError=error.message||'Nie udało się zmienić powiadomień.';if(status)status.textContent=pushLastError;toast(pushLastError,true); }
  finally { pushBusy = false; window.refreshPushButton(); }
});

async function restorePushSubscription() {
  if (!pushSupported() || !authUser || Notification.permission !== 'granted') return;
  const subscription = await pushSubscription();
  if (subscription) {try{await savePushSubscription(subscription);}catch(error){await subscription.unsubscribe();throw error;}}
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
  setTimeout(offerStartupPush,500);
};

window.onPushProfileChanged = function () {
  restorePushSubscription().catch(error => toast(error.message, true));
  window.refreshPushButton();
};

// Pierwsze uruchomienie zainstalowanej aplikacji: zgodę systemową wywołuje kliknięcie.
const startupPushShown=new Set();
function installedApp(){return window.matchMedia?.('(display-mode: standalone)').matches||window.matchMedia?.('(display-mode: fullscreen)').matches||navigator.standalone===true;}
function startupPushKey(){return 'usterki-push-welcome-'+authUser?.id;}
function rememberStartupPush(){try{localStorage.setItem(startupPushKey(),'done');}catch{}startupPushShown.add(startupPushKey());}
function shouldOfferStartupPush(){
 if(startupPushShown.has(startupPushKey())||!authUser||!signedInProfile()||previewProfileId||!installedApp()||!pushSupported()||Notification.permission!=='default')return false;
 try{if(localStorage.getItem(startupPushKey()))return false;}catch{}
 return true;
}
function offerStartupPush(){
 if(!shouldOfferStartupPush()||document.querySelector('dialog[open]'))return;
 const dialog=document.getElementById('push-welcome-dialog');if(!dialog)return;
 startupPushShown.add(startupPushKey());
 dialog.innerHTML='<div class="push-welcome-content"><h2 id="push-welcome-title">Włączyć powiadomienia?</h2><p>Otrzymasz powiadomienie, gdy pojawi się nowe zgłoszenie, komentarz lub zmiana statusu — także gdy aplikacja jest zamknięta.</p><div class="push-welcome-actions"><button type="button" class="btn" id="push-welcome-enable">Włącz powiadomienia</button><button type="button" class="btn secondary" id="push-welcome-later">Później</button></div><p id="push-welcome-status" role="status"></p><p class="hint">Ustawienie możesz zmienić w „Moim koncie”.</p></div>';
 dialog.showModal();
 document.getElementById('push-welcome-later').onclick=()=>{rememberStartupPush();dialog.close();};
 dialog.oncancel=()=>{rememberStartupPush();};
 document.getElementById('push-welcome-enable').onclick=async()=>{
  if(pushBusy)return;
  pushBusy=true;
  const button=document.getElementById('push-welcome-enable'),status=document.getElementById('push-welcome-status'),accountId=authUser?.id;
  button.disabled=true;status.textContent='Oczekiwanie na zgodę…';
  try{
   const problem=pushSupportError();if(problem)throw Error(problem);
   // Musi nastąpić bezpośrednio po kliknięciu, przed oczekiwaniem na sieć.
   const permission=await Notification.requestPermission();
   if(permission!=='granted')throw Error(permission==='denied'?'Powiadomienia zablokowano. Możesz odblokować je w ustawieniach przeglądarki lub aplikacji.':'Nie udzielono zgody. Możesz spróbować ponownie lub wybrać „Później”.');
   status.textContent='Zapisywanie urządzenia…';
   const publicKey=pushCachedKey||await pushPublicKey();pushCachedKey=publicKey;
   const registration=await pushRegistration();
   let subscription=await registration.pushManager.getSubscription();
   if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:pushKeyBytes(publicKey)});
   try{if(authUser?.id!==accountId)throw Error('Konto zmieniło się podczas włączania powiadomień. Spróbuj ponownie w „Moim koncie”.');await savePushSubscription(subscription);}catch(error){await subscription.unsubscribe();throw error;}
   rememberStartupPush();dialog.close();toast('Powiadomienia są włączone na tym urządzeniu.');
  }catch(error){status.textContent=error.message||'Nie udało się włączyć powiadomień.';}
  finally{pushBusy=false;button.disabled=false;window.refreshPushButton?.();}
 };
}
window.addEventListener('appinstalled',()=>setTimeout(offerStartupPush,500));
document.addEventListener('close',()=>setTimeout(offerStartupPush,250),true);

