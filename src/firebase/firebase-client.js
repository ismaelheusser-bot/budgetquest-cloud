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
    const auth = authApi.getAuth(app);

    // Safari und installierte iPhone-Web-Apps sollen die Anmeldung innerhalb
    // ihres jeweiligen App-Kontexts dauerhaft behalten.
    await authApi.setPersistence(auth, authApi.browserLocalPersistence);

    return Object.freeze({
      app,
      auth,
      db: firestoreApi.getFirestore(app),
      authApi,
      firestoreApi
    });
  });
})(window);
