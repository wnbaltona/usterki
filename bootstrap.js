// Jeden worker obsługuje instalację aplikacji i powiadomienia push.
async function registerAppWorker(){
 if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
 await navigator.serviceWorker.register('./app-sw.js',{scope:'./'});
}

async function startApplication() {
  try {
    await openStore();
    await initializeAuth();
    registerAppWorker().catch(() => {});

    if (authUser) {
      showApp();
      if(!passwordRecovery&&user()){announceProfile();startLiveSync();}
    }
  } catch (error) {
    showAuth(error.message);
  }
}

startApplication();
