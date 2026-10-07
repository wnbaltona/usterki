'use strict';

let deferredInstallPrompt = null;
function installationStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
function refreshInstallButtons() {
  document.querySelectorAll('[data-install-app]').forEach(button => {
    button.hidden = installationStandalone();
  });
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  refreshInstallButtons();
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  refreshInstallButtons();
});
window.matchMedia('(display-mode: standalone)').addEventListener('change', refreshInstallButtons);
function installationHelp() {
  const dialog = document.getElementById('install-dialog');
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const message = !window.isSecureContext ? 'Otwórz opublikowaną aplikację pod adresem HTTPS.' : ios ? 'W Safari wybierz Udostępnij → Dodaj do ekranu początkowego → Dodaj. Pozostaw włączone „Otwieraj jako aplikację”, jeśli ta opcja jest dostępna.' : /Android/.test(navigator.userAgent) ? 'Otwórz stronę w Chrome. W menu ⋮ wybierz „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”. Jeśli aplikacja jest już zainstalowana, otwórz ją z ikony.' : 'W Chrome lub Edge wybierz ikonę instalacji przy pasku adresu albo opcję instalowania strony jako aplikacji w menu. Jeśli aplikacja jest już zainstalowana, otwórz ją z menu Start.';
  dialog.innerHTML = '';
  const content = document.createElement('div');
  content.className = 'push-welcome-content';
  const title = document.createElement('h2');
  title.id = 'install-title';
  title.textContent = 'Zainstaluj aplikację';
  const text = document.createElement('p');
  text.textContent = message;
  const close = document.createElement('button');
  close.className = 'btn';
  close.type = 'button';
  close.textContent = 'Zamknij';
  close.onclick = () => dialog.close();
  content.append(title, text, close);
  dialog.append(content);
  if (!dialog.open) dialog.showModal();
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-install-app]');
  if (!button) return;
  if (installationStandalone()) {
    refreshInstallButtons();
    return;
  }
  if (!deferredInstallPrompt) {
    installationHelp();
    return;
  }
  const prompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  button.disabled = true;
  try {
    await prompt.prompt();
    await prompt.userChoice;
  } catch {
    installationHelp();
  } finally {
    button.disabled = false;
    refreshInstallButtons();
  }
});
