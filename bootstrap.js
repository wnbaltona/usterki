// Zastępuje dawny worker push prostym workerem potrzebnym aplikacji instalowanej.
async function registerAppWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const scope = new URL('./', location.href).href;
  const registration = (await navigator.serviceWorker.getRegistrations())
    .find(item => item.scope === scope);
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription) {
    if (authClient && authUser) {
      await authClient.from('usterki_push_subscriptions')
        .delete().eq('endpoint', subscription.endpoint);
    }
    await subscription.unsubscribe();
  }
  await navigator.serviceWorker.register('./app-sw.js', { scope: './' });
}

async function startApplication() {
  try {
    await openStore();
    await initializeAuth();
    registerAppWorker().catch(() => {});

    if (authUser) {
      showApp();
      announceProfile();
      startLiveSync();
    }
  } catch (error) {
    showAuth(error.message);
  }
}

startApplication();
