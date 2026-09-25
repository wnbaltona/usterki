async function startApplication() {
  try {
    await openStore();
    await initializeAuth();

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
