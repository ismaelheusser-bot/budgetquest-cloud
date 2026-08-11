try{
  importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey:'AIzaSyA1RCPtmoaiMEY3VVU8F9SSybc8xHwCYJg',
    authDomain:'budgetquest-cloud.firebaseapp.com',
    projectId:'budgetquest-cloud',
    storageBucket:'budgetquest-cloud.firebasestorage.app',
    messagingSenderId:'298317424738',
    appId:'1:298317424738:web:35831ae6203fedef83093b'
  });
  firebase.messaging();
}catch(error){
  console.warn('BudgetQuest Push Messaging konnte im Service Worker nicht initialisiert werden',error);
}

const CACHE_NAME='budgetquest-v89';
const APP_SHELL=['./','./index.html','./style.css','./mobile-fix.css','./src/wealth/revolut-wealth.css','./src/storage/storage-service.js','./src/storage/local-storage-adapter.js','./src/storage/storage-bootstrap.js','./src/storage/cloud-sync-service.js','./src/storage/firebase-firestore-adapter.js','./src/firebase/firebase-client.js','./src/firebase/firebase-cloud-controller.js','./src/firebase/firebase-auth-ui.js','./src/firebase/firebase-owner-controls.js','./src/wealth/revolut-statement-parser.js','./src/wealth/revolut-wealth.js','./nav-six-tabs-v23.css','./app.js','./smart-import.js','./pdf-import-override.js','./receipt-learning.js','./profiles.js','./pro.js','./pro.css','./home.js','./home-affordability-fix.js','./home-year-projection-fix.js','./home-gross-income-separation.js','./home-save-controls.js','./branding.js','./backup-export-ui.js','./legacy-backup-import.js','./income-planner.js','./reset-controls.js','./install.js','./gesture-lock.js','./assistant.js','./savings-integration.js','./planning-extension.js','./dashboard2.js','./transaction-delete-safety.js','./push-reminders.js','./profile-name-migration.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))));self.clients.claim()});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html'))))});