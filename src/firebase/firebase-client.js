(function (global) {
  'use strict';

  const firebaseConfig = Object.freeze({
    apiKey: 'AIzaSyA1RCPtmoaiMEY3VVU8F9SSybc8xHwCYJg',
    authDomain: 'budgetquest-cloud.firebaseapp.com',
    projectId: 'budgetquest-cloud',
    storageBucket: 'budgetquest-cloud.firebasestorage.app',
    messagingSenderId: '298317424738',
    appId: '1:298317424738:web:35831ae6203fedef83093b'
  });

  const SDK_VERSION = '12.16.0';
  const sdkUrl = moduleName =>
    `https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-${moduleName}.js`;

  global.BudgetQuestFirebaseConfig = firebaseConfig;
  global.budgetQuestFirebaseReady = Promise.all([
    import(sdkUrl('app')),
    import(sdkUrl('auth')),
    import(sdkUrl('firestore'))
  ]).then(async ([appApi, authApi, firestoreApi]) => {
    const app = appApi.initializeApp(firebaseConfig);
    let auth;

    try {
      auth = authApi.initializeAuth(app, {
        persistence: [
          authApi.indexedDBLocalPersistence,
          authApi.browserLocalPersistence
        ],
        popupRedirectResolver: authApi.browserPopupRedirectResolver
      });
    } catch (error) {
      auth = authApi.getAuth(app);
      try {
        await authApi.setPersistence(auth, authApi.indexedDBLocalPersistence);
      } catch (indexedDbError) {
        await authApi.setPersistence(auth, authApi.browserLocalPersistence);
      }
    }

    await auth.authStateReady();

    return Object.freeze({
      app,
      auth,
      db: firestoreApi.getFirestore(app),
      authApi,
      firestoreApi
    });
  });

  const loadModule = (src, marker) => {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.setAttribute(marker, '1');
    document.head.appendChild(script);
  };

  loadModule('src/firebase/firebase-owner-controls.js?v=1', 'data-bq-owner-controls');
  loadModule('home-affordability-fix.js?v=1', 'data-bq-home-affordability-fix');
  loadModule('home-year-projection-fix.js?v=2', 'data-bq-home-year-projection-fix');
  loadModule('home-gross-income-separation.js?v=2', 'data-bq-home-gross-income-separation');
  loadModule('backup-export-ui.js?v=1', 'data-bq-backup-export-ui');
  loadModule('legacy-backup-import.js?v=1', 'data-bq-legacy-backup-import');
})(window);
