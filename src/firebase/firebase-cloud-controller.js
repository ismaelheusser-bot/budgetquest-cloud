(function (global) {
  'use strict';

  const storage = global.budgetQuestStorage;
  const keys = global.BudgetQuestStorageKeys;
  const metadataKeys = new Set([
    keys.cloudSyncEnabled,
    keys.cloudHouseholdId,
    keys.cloudOwnerUserId
  ]);
  const syncKeys = Object.values(keys).filter(key => !metadataKeys.has(key));

  let activeSync = null;
  let activeUserId = null;
  let connecting = false;

  try {
    global.sessionStorage.removeItem('bq_cloud_reload_pending');
  } catch (error) {
    // Die Synchronisation funktioniert auch ohne Session-Marker.
  }

  const controls = () => document.getElementById('firebaseCloudControls');

  function setControls(html) {
    const element = controls();
    if (element) element.innerHTML = html;
  }

  function messageFor(error) {
    const code = error?.code || '';
    if (code.includes('permission-denied')) {
      return 'Cloud-Zugriff verweigert. Bitte zuerst die BudgetQuest-Firestore-Regeln veröffentlichen.';
    }
    if (code.includes('unavailable')) {
      return 'Cloud momentan nicht erreichbar. Deine lokalen Daten bleiben erhalten.';
    }
    return 'Cloud-Verbindung fehlgeschlagen. Deine lokalen Daten bleiben erhalten.';
  }

  function renderInactive() {
    setControls(`
      <div class="cloud-sync-panel">
        <b>Cloud-Synchronisation ist aus</b>
        <p class="tiny">Beim Aktivieren entscheidest du ausdrücklich, ob lokale Daten hochgeladen oder vorhandene Cloud-Daten geladen werden.</p>
        <button class="btn" type="button" onclick="budgetQuestEnableCloudSync()">Cloud-Synchronisation aktivieren</button>
      </div>
    `);
  }

  function renderConnecting() {
    setControls(`
      <div class="cloud-sync-panel">
        <b>Cloud wird verbunden …</b>
        <p class="tiny">Lokale Daten bleiben während der Prüfung unverändert.</p>
      </div>
    `);
  }

  function renderActive() {
    setControls(`
      <div class="cloud-sync-panel cloud-sync-active">
        <div class="cloud-sync-title"><span class="cloud-state-dot"></span><b>Cloud-Synchronisation aktiv</b></div>
        <p class="tiny">Änderungen werden automatisch mit deinem persönlichen Haushalt synchronisiert. Offline-Eingaben bleiben lokal verfügbar.</p>
        <button class="btn secondary" type="button" onclick="budgetQuestDisconnectCloudSync()">Dieses Gerät trennen</button>
        <p class="tiny">Die Einladung für ein weiteres Haushaltsmitglied wird nach Angabe der Gmail-Adresse freigeschaltet.</p>
      </div>
    `);
  }

  function renderError(error) {
    setControls(`
      <div class="cloud-sync-panel">
        <b class="cloud-auth-error">Cloud noch nicht verbunden</b>
        <p class="tiny cloud-auth-error" id="cloudSyncError"></p>
        <button class="btn secondary" type="button" onclick="budgetQuestEnableCloudSync()">Erneut versuchen</button>
      </div>
    `);
    const element = document.getElementById('cloudSyncError');
    if (element) element.textContent = messageFor(error);
  }

  function isEnabledFor(user) {
    return storage.get(keys.cloudSyncEnabled, null) === '1'
      && storage.get(keys.cloudOwnerUserId, null) === user.uid;
  }

  function contextFor(user) {
    return { householdId: user.uid, userId: user.uid };
  }

  function createAdapter(firebase) {
    return new global.BudgetQuestFirebaseFirestoreAdapter({
      db: firebase.db,
      firestore: firebase.firestoreApi
    });
  }

  function scheduleReload() {
    try {
      if (global.sessionStorage.getItem('bq_cloud_reload_pending') === '1') return;
      global.sessionStorage.setItem('bq_cloud_reload_pending', '1');
    } catch (error) {
      // Ein Reload bleibt auch ohne Session-Marker möglich.
    }
    global.setTimeout(() => global.location.reload(), 250);
  }

  async function startSync(user, initialStrategy = 'remote-first') {
    if (connecting) return;
    connecting = true;
    renderConnecting();
    try {
      const firebase = await global.budgetQuestFirebaseReady;
      if (activeSync) activeSync.stop();
      const adapter = createAdapter(firebase);
      activeSync = new global.BudgetQuestCloudSyncService({
        storage,
        adapter,
        keys: syncKeys,
        onError: error => renderError(error),
        onRemoteChange: scheduleReload
      });
      await activeSync.start(contextFor(user), { initialStrategy });
      activeUserId = user.uid;
      storage.set(keys.cloudSyncEnabled, '1');
      storage.set(keys.cloudHouseholdId, user.uid);
      storage.set(keys.cloudOwnerUserId, user.uid);
      renderActive();
    } catch (error) {
      console.warn('BudgetQuest Cloud-Synchronisation:', error);
      if (activeSync) activeSync.stop();
      activeSync = null;
      activeUserId = null;
      renderError(error);
      throw error;
    } finally {
      connecting = false;
    }
  }

  async function inspectRemote(user) {
    const firebase = await global.budgetQuestFirebaseReady;
    const adapter = createAdapter(firebase);
    await adapter.connect(contextFor(user));
    return adapter.pullAll();
  }

  global.budgetQuestEnableCloudSync = async () => {
    const user = global.budgetQuestCurrentUser;
    if (!user) {
      renderError({ code: 'auth/not-signed-in' });
      return;
    }
    if (!global.confirm(
      'Cloud-Synchronisation aktivieren?\n\nBudgetQuest prüft zuerst, ob für dieses Google-Konto bereits Cloud-Daten vorhanden sind. Noch wird nichts ersetzt.'
    )) return;

    renderConnecting();
    try {
      const snapshot = await inspectRemote(user);
      const hasRemoteValues = Object.keys(snapshot?.values || {}).length > 0;
      if (hasRemoteValues) {
        const loadRemote = global.confirm(
          'Für dieses Google-Konto wurden bereits BudgetQuest-Cloud-Daten gefunden.\n\nCloud-Daten auf dieses Gerät laden und die lokalen Budgetdaten ersetzen?'
        );
        if (!loadRemote) {
          renderInactive();
          return;
        }
        await startSync(user, 'remote-first');
      } else {
        const uploadLocal = global.confirm(
          'Noch keine Cloud-Daten vorhanden.\n\nDie bestehenden lokalen Budgetdaten jetzt als ersten Cloud-Stand hochladen?'
        );
        if (!uploadLocal) {
          renderInactive();
          return;
        }
        await startSync(user, 'local-first');
      }
    } catch (error) {
      renderError(error);
    }
  };

  global.budgetQuestDisconnectCloudSync = () => {
    if (!global.confirm(
      'Cloud-Synchronisation auf diesem Gerät trennen?\n\nDie Cloud-Daten werden nicht gelöscht. Lokale Daten bleiben auf diesem Gerät erhalten.'
    )) return;
    if (activeSync) activeSync.stop();
    activeSync = null;
    activeUserId = null;
    storage.remove(keys.cloudSyncEnabled);
    storage.remove(keys.cloudHouseholdId);
    storage.remove(keys.cloudOwnerUserId);
    renderInactive();
  };

  async function handleAuthChanged(user) {
    if (!user) {
      if (activeSync) activeSync.stop();
      activeSync = null;
      activeUserId = null;
      return;
    }
    if (activeUserId === user.uid && activeSync) {
      renderActive();
      return;
    }
    if (!isEnabledFor(user)) {
      renderInactive();
      return;
    }
    try {
      await startSync(user, 'remote-first');
    } catch (error) {
      // Die Fehlermeldung wird durch startSync angezeigt.
    }
  }

  global.addEventListener('budgetquest-auth-changed', event => {
    handleAuthChanged(event.detail?.user || null);
  });
})(window);
