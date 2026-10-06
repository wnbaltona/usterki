'use strict';
let deferredInstallPrompt=null;
function installationStandalone(){return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}
function refreshInstallButtons(){document.querySelectorAll('[data-install-app]').forEach(b=>{b.hidden=installationStandalone();b.disabled=false;});}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;refreshInstallButtons();});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;refreshInstallButtons();});
window.matchMedia('(display-mode: standalone)').addEventListener('change',refreshInstallButtons);
function installationHelp(){
 const dialog=document.getElementById('install-dialog');
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const android=/Android/.test(navigator.userAgent);
 const message=!window.isSecureContext?'Otwórz opublikowaną stronę aplikacji pod adresem HTTPS. Instalacja nie działa po otwarciu pliku z dysku.':ios?'Otwórz stronę w Safari. Wybierz Udostępnij → Dodaj do ekranu początkowego → Dodaj. Jeśli widzisz opcję „Otwieraj jako aplikację”, pozostaw ją włączoną. Następnie otwórz aplikację z nowej ikony.':android?'Otwórz stronę w Chrome, poza przeglądarką w komunikatorze. W menu ⋮ wybierz „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”. Jeśli aplikacja jest już zainstalowana, otwórz ją z ikony.':'Otwórz stronę w Chrome lub Edge. Wybierz ikonę instalacji przy pasku adresu albo opcję instalowania strony jako aplikacji w menu przeglądarki. Jeśli aplikacja jest już zainstalowana, otwórz ją z menu Start.';
 dialog.innerHTML='';const body=document.createElement('div');body.className='push-welcome-content';const title=document.createElement('h2');title.id='install-title';title.textContent='Zainstaluj aplikację';const text=document.createElement('p');text.textContent=message;const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Zamknij';button.onclick=()=>dialog.close();body.append(title,text,button);dialog.append(body);if(!dialog.open)dialog.showModal();
}
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-install-app]');if(!button)return;
 if(installationStandalone()){refreshInstallButtons();return;}
 if(!deferredInstallPrompt){installationHelp();return;}
 const prompt=deferredInstallPrompt;deferredInstallPrompt=null;button.disabled=true;
 try{await prompt.prompt();await prompt.userChoice;}catch{installationHelp();}finally{button.disabled=false;refreshInstallButtons();}
});
