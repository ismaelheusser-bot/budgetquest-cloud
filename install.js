(()=>{
let deferredPrompt=null;
const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
function addInstallButton(){if(isStandalone()||document.getElementById('installAppBtn'))return;const btn=document.createElement('button');btn.id='installAppBtn';btn.className='btn';btn.textContent='⬇️ App installieren';btn.style.marginLeft='8px';btn.onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;btn.remove();return}const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);alert(ios?'Safari: Teilen öffnen und „Zum Home-Bildschirm“ wählen.':'Browser-Menü öffnen und „App installieren“ bzw. „Zum Startbildschirm hinzufügen“ wählen.')};document.querySelector('.topbar')?.appendChild(btn)}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;addInstallButton()});
window.addEventListener('appinstalled',()=>{deferredPrompt=null;document.getElementById('installAppBtn')?.remove()});
window.addEventListener('load',()=>{if(!isStandalone())addInstallButton()});
})();