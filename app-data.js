'use strict';
// Zapis i synchronizacja wspólnych danych demonstracyjnych w Supabase.
const DEMO_TABLE = 'usterki_demo_state';
const DEMO_BUCKET = 'usterki-demo-files';
let demoLoaded = false;

async function openStore() {
  state = Model.initial(window.BALTONA_LOCATIONS);
  try { currentId = localStorage.getItem('baltona-demo-view-profile'); } catch {}
  currentId = user().id;
}
function savePreference() {
  try { localStorage.setItem('baltona-demo-view-profile', currentId); } catch {}
}
async function loadDemoState() {
  const { data, error } = await authClient.from(DEMO_TABLE).select('revision,data').eq('id', 1).single();
  if (error) throw Error('Nie można pobrać wspólnych danych. Najpierw uruchom supabase-demo.sql w Supabase. ' + error.message);
  if (!data.data?.version) {
    const initial = Model.initial(window.BALTONA_LOCATIONS);
    initial.revision = data.revision + 1;
    const result = await authClient.from(DEMO_TABLE).update({ data: initial, revision: initial.revision })
      .eq('id', 1).eq('revision', data.revision).select('revision').maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return loadDemoState();
    state = Model.migrate(initial);
  } else {
    state = Model.migrate(data.data);
    state.revision = data.revision;
  }
  currentId = user().id;
  demoLoaded = true;
}

async function initializeAuth() {
  if (!window.supabase) throw Error('Nie udało się załadować logowania Supabase.');
  authClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await authClient.auth.getSession();
  if (error) throw error;
  authUser = data.session?.user || null;

  authClient.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return;
    if (demoLoaded && authUser?.id && authUser.id === session?.user?.id) return;
    authUser = session?.user || null;
    if (authUser) {
      setTimeout(() => loadDemoState().then(() => {
        showApp();
        announceProfile();
        startLiveSync();
      }).catch(error => showAuth(error.message)), 0);
    } else { demoLoaded = false; showAuth(); }
  });
  if (!authUser) { showAuth(); return; }
  await loadDemoState();
}
async function persist(next, files = [], replaceFiles = false) {
  if (replaceFiles) throw Error('Wczytywanie kopii jest wyłączone we wspólnej wersji demo.');
  const revision = state.revision;
  const uploaded = [];
  const now = new Date().toISOString();
  next.revision = revision + 1;
  Model.migrate(next);
  next.events.push(...Model.ticketEvents(state, next, currentId, now));
  next.notifications.push(...Model.notificationEvents(state, next, currentId, now));
  try {
    for (const file of files) {
      const { error } = await authClient.storage.from(DEMO_BUCKET).upload(file.id, file.blob, { contentType: file.type, upsert: false });
      if (error) throw error;
      uploaded.push(file.id);
    }
    const { data, error } = await authClient.from(DEMO_TABLE)
      .update({ data: next, revision: next.revision, updated_at: now })
      .eq('id', 1).eq('revision', revision).select('revision').maybeSingle();
    if (error) throw error;
    if (!data) {
      const latest = await authClient.from(DEMO_TABLE).select('revision').eq('id', 1).maybeSingle();
      if (latest.error) throw latest.error;
      if (latest.data?.revision === revision) throw Error('Supabase odmówił zapisu. Sprawdź uprawnienie UPDATE dla zalogowanych użytkowników w tabeli usterki_demo_state.');
      throw Error('Inna osoba zapisała zmiany wcześniej. Odśwież dane i ponów zapis.');
    }
  } catch (error) {
    if (uploaded.length) await authClient.storage.from(DEMO_BUCKET).remove(uploaded);
    throw error;
  }
  state = next;
  refreshNotificationsUI();
  updatesChannel?.postMessage({ revision: next.revision });
}
async function downloadFile(id) {
  const ticket = currentTickets().find(t => t.attachments.some(f => f.id === id));
  if (!ticket) throw Error('Załącznik niedostępny w tym profilu.');
  const record = ticket.attachments.find(f => f.id === id);
  const { data, error } = await authClient.storage.from(DEMO_BUCKET).download(id);
  if (error) throw error;
  download(data, record.name);
}
async function syncFromDatabase() {
  if (!authClient || !authUser || !state || busy || syncing) return;
  syncing = true;
  try {
    const { data, error } = await authClient.from(DEMO_TABLE).select('revision,data').eq('id', 1).single();
    if (error) throw error;
    if (!busy && data.revision > state.revision) {
      const latest = Model.migrate(data.data);
      latest.revision = data.revision;
      ingestRemote(latest);
    }
    syncErrorShown = false;
  } catch {
    if (!syncErrorShown) {
      syncErrorShown = true;
      toast('Nie udało się odświeżyć danych z serwera. Sprawdź połączenie.', true);
    }
  } finally { syncing = false; }
}
function startLiveSync() {
  if (startLiveSync.started) return;
  startLiveSync.started = true;
  try {
    if ('BroadcastChannel' in window) {
      updatesChannel = new BroadcastChannel('baltona-usterki-demo-updates');
      updatesChannel.onmessage = () => syncFromDatabase();
    }
  } catch {}
  setInterval(syncFromDatabase, 5000);
  window.addEventListener('focus', syncFromDatabase);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncFromDatabase();
  });
}
async function readNotifications(ids = null) {
  const recipient = currentId;
  const selected = ids ? new Set(ids) : null;
  await mutate(next => {
    const profile = next.users.find(u => u.id === recipient);
    const allowed = new Set(Model.notificationsFor(next, profile).map(n => n.id));
    const now = new Date().toISOString();
    for (const n of next.notifications) {
      if (allowed.has(n.id) && !n.readAt && (!selected || selected.has(n.id))) n.readAt = now;
    }
  });
  refreshNotificationsUI();
}
async function backup() {
  if (!isAdmin()) throw Error('Wybierz profil administratora.');
  toast('Przygotowuję kopię danych demo i załączników…');
  const { data: snapshot, error } = await authClient.from(DEMO_TABLE).select('revision,data').eq('id', 1).single();
  if (error) throw error;
  const files = [];
  for (const ticket of snapshot.data.tickets || []) for (const meta of ticket.attachments || []) {
    const result = await authClient.storage.from(DEMO_BUCKET).download(meta.id);
    if (result.error) throw result.error;
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(result.data);
    });
    files.push({ ...meta, base64 });
  }
  const archive = { format: 'baltona-usterki-backup', version: 1, exportedAt: new Date().toISOString(), state: snapshot.data, files };
  download(new Blob([JSON.stringify(archive)], { type: 'application/json' }), 'Serwis-Lokali-demo-kopia-' + new Date().toISOString().slice(0, 10) + '.json');
  toast('Pobrano kopię danych demo.');
}

