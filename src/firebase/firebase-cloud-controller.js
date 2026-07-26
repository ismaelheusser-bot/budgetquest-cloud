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
  let activeHouseholdId = null;
  let activeOwnerId = null;
  let connecting = false;
  let pendingInvitation = null;

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

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[character]));
  }

  function normaliseEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  async function emailHash(email) {
    const data = new TextEncoder().encode(normaliseEmail(email));
    const digest = await global.crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function messageFor(error) {
    const code = error?.code || '';
    if (code.includes('permission-denied')) {
      return 'Cloud-Zugriff verweigert. Bitte die aktuellen BudgetQuest-Firestore-Regeln veröffentlichen.';
    }
    if (code.includes('unavailable')) {
      return 'Cloud momentan nicht erreichbar. Deine lokalen Daten bleiben erhalten.';
    }
    if (code.includes('already-exists')) {
      return 'Für diese Google-Adresse besteht bereits eine Einladung.';
    }
    return 'Cloud-Verbindung fehlgeschlagen. Deine lokalen Daten bleiben erhalten.';
  }

  function renderInactive() {
    const invitation = pendingInvitation ? `
      <div class="cloud-sync-panel cloud-sync-active">
        <b>Einladung zu einem gemeinsamen Haushalt</b>
        <p class="tiny">Du wurdest von ${escapeHtml(pendingInvitation.ownerEmail || 'einem Haushaltsmitglied')} eingeladen.</p>
        <button class="btn" type="button" onclick="budgetQuestAcceptHouseholdInvitation()">Einladung annehmen</button>
      </div>
    ` : '';
    setControls(`${invitation}
      <div class="cloud-sync-panel">
        <b>Cloud-Synchronisation ist aus</b>
        <p class="tiny">Beim Aktivieren entscheidest du ausdrücklich, ob lokale Daten hochgeladen oder vorhandene Cloud-Daten geladen werden.</p>
        <button class="btn" type="button" onclick="budgetQuestEnableCloudSync()">Eigenen Cloud-Haushalt aktivieren</button>
        <button class="btn secondary" type="button" onclick="budgetQuestCheckHouseholdInvitation()">Einladung prüfen</button>
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
    const isOwner = activeOwnerId && activeOwnerId === activeUserId;
    setControls(`
      <div class="cloud-sync-panel cloud-sync-active">
        <div class="cloud-sync-title"><span class="cloud-state-dot"></span><b>Cloud-Synchronisation aktiv</b></div>
        <p class="tiny">${isOwner ? 'Dieser gemeinsame Haushalt gehört deinem Google-Konto.' : 'Du arbeitest im gemeinsam freigegebenen Haushalt.'} Änderungen werden automatisch synchronisiert.</p>
        ${isOwner ? `
          <form class="form section" onsubmit="budgetQuestInviteHouseholdMember(event)">
            <label>Google-Adresse der Partnerin oder des Partners
              <input id="cloudInviteEmail" type="email" autocomplete="email" placeholder="name@gmail.com" required>
            </label>
            <button class="btn" type="submit">Zum Haushalt einladen</button>
          </form>
          <div id="cloudInviteStatus" class="tiny"></div>
        ` : ''}
        <button class="btn secondary" type="button" onclick="budgetQuestDisconnectCloudSync()">Dieses Gerät trennen</button>
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

  function isEnabledFor() {
    return storage.get(keys.cloudSyncEnabled, null) === '1'
      && Boolean(storage.get(keys.cloudHouseholdId, null));
  }

  function contextFor(user, householdId) {
    return { householdId, userId: user.uid };
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

  async function startSync(user, initialStrategy = 'remote-first', householdId = user.uid, ownerId = user.uid) {
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
      await activeSync.start(contextFor(user, householdId), { initialStrategy });
      activeUserId = user.uid;
      activeHouseholdId = householdId;
      activeOwnerId = ownerId;
      storage.set(keys.cloudSyncEnabled, '1');
      storage.set(keys.cloudHouseholdId, householdId);
      storage.set(keys.cloudOwnerUserId, ownerId);
      pendingInvitation = null;
      renderActive();
    } catch (error) {
      console.warn('BudgetQuest Cloud-Synchronisation:', error);
      if (activeSync) activeSync.stop();
      activeSync = null;
      activeUserId = null;
      activeHouseholdId = null;
      activeOwnerId = null;
      renderError(error);
      throw error;
    } finally {
      connecting = false;
    }
  }

  async function inspectRemote(user, householdId = user.uid) {
    const firebase = await global.budgetQuestFirebaseReady;
    const adapter = createAdapter(firebase);
    await adapter.connect(contextFor(user, householdId));
    return adapter.pullAll();
  }

  async function findInvitation(user) {
    if (!user?.email) return null;
    const firebase = await global.budgetQuestFirebaseReady;
    const inviteId = await emailHash(user.email);
    const reference = firebase.firestoreApi.doc(firebase.db, 'householdInvites', inviteId);
    const snapshot = await firebase.firestoreApi.getDoc(reference);
    if (!snapshot.exists()) return null;
    const invitation = snapshot.data();
    return invitation.status === 'pending' ? { id: inviteId, ...invitation } : null;
  }

  global.budgetQuestCheckHouseholdInvitation = async () => {
    const user = global.budgetQuestCurrentUser;
    if (!user) return;
    renderConnecting();
    try {
      pendingInvitation = await findInvitation(user);
      renderInactive();
      if (!pendingInvitation) global.alert('Für diese Google-Adresse wurde keine offene Haushaltseinladung gefunden.');
    } catch (error) {
      renderError(error);
    }
  };

  global.budgetQuestInviteHouseholdMember = async event => {
    event?.preventDefault();
    const user = global.budgetQuestCurrentUser;
    const email = normaliseEmail(document.getElementById('cloudInviteEmail')?.value);
    const status = document.getElementById('cloudInviteStatus');
    if (!user || !email || activeOwnerId !== user.uid || !activeHouseholdId) return;
    if (email === normaliseEmail(user.email)) {
      if (status) status.textContent = 'Du kannst dich nicht selbst einladen.';
      return;
    }
    try {
      const firebase = await global.budgetQuestFirebaseReady;
      const inviteId = await emailHash(email);
      const inviteReference = firebase.firestoreApi.doc(firebase.db, 'householdInvites', inviteId);
      const householdReference = firebase.firestoreApi.doc(firebase.db, 'households', activeHouseholdId);
      const batch = firebase.firestoreApi.writeBatch(firebase.db);
      batch.set(inviteReference, {
        householdId: activeHouseholdId,
        ownerId: user.uid,
        ownerEmail: normaliseEmail(user.email),
        inviteeEmail: email,
        status: 'pending',
        createdAt: firebase.firestoreApi.serverTimestamp()
      });
      batch.update(householdReference, {
        invitedEmails: firebase.firestoreApi.arrayUnion(email),
        updatedAt: firebase.firestoreApi.serverTimestamp(),
        updatedBy: user.uid
      });
      await batch.commit();
      if (status) status.textContent = `Einladung für ${email} wurde erstellt. Sie kann sich nun mit dieser Google-Adresse anmelden und die Einladung annehmen.`;
      const input = document.getElementById('cloudInviteEmail');
      if (input) input.value = '';
    } catch (error) {
      if (status) status.textContent = messageFor(error);
    }
  };

  global.budgetQuestAcceptHouseholdInvitation = async () => {
    const user = global.budgetQuestCurrentUser;
    if (!user) return;
    try {
      pendingInvitation = pendingInvitation || await findInvitation(user);
      if (!pendingInvitation) {
        global.alert('Keine offene Einladung gefunden.');
        renderInactive();
        return;
      }
      if (!global.confirm('Gemeinsamen Haushalt öffnen?\n\nDie Cloud-Daten dieses Haushalts werden auf dieses Gerät geladen und ersetzen die lokalen Budgetdaten.')) return;
      renderConnecting();
      const firebase = await global.budgetQuestFirebaseReady;
      const householdReference = firebase.firestoreApi.doc(firebase.db, 'households', pendingInvitation.householdId);
      const inviteReference = firebase.firestoreApi.doc(firebase.db, 'householdInvites', pendingInvitation.id);
      await firebase.firestoreApi.runTransaction(firebase.db, async transaction => {
        const householdSnapshot = await transaction.get(householdReference);
        if (!householdSnapshot.exists()) throw new Error('Der eingeladene Haushalt wurde nicht gefunden.');
        const household = householdSnapshot.data();
        const memberIds = Array.isArray(household.memberIds) ? household.memberIds : [];
        const invitedEmails = Array.isArray(household.invitedEmails) ? household.invitedEmails : [];
        transaction.update(householdReference, {
          memberIds: memberIds.includes(user.uid) ? memberIds : [...memberIds, user.uid],
          invitedEmails: invitedEmails.filter(email => email !== normaliseEmail(user.email)),
          updatedAt: firebase.firestoreApi.serverTimestamp(),
          updatedBy: user.uid
        });
        transaction.update(inviteReference, {
          status: 'accepted',
          acceptedBy: user.uid,
          acceptedAt: firebase.firestoreApi.serverTimestamp()
        });
      });
      await startSync(user, 'remote-first', pendingInvitation.householdId, pendingInvitation.ownerId);
    } catch (error) {
      renderError(error);
    }
  };

  global.budgetQuestEnableCloudSync = async () => {
    const user = global.budgetQuestCurrentUser;
    if (!user) {
      renderError({ code: 'auth/not-signed-in' });
      return;
    }
    if (!global.confirm(
      'Eigenen Cloud-Haushalt aktivieren?\n\nBudgetQuest prüft zuerst, ob für dieses Google-Konto bereits Cloud-Daten vorhanden sind. Eine offene Einladung solltest du stattdessen über „Einladung prüfen“ annehmen.'
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
    activeHouseholdId = null;
    activeOwnerId = null;
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
      activeHouseholdId = null;
      activeOwnerId = null;
      pendingInvitation = null;
      return;
    }
    if (activeUserId === user.uid && activeSync) {
      renderActive();
      return;
    }
    if (!isEnabledFor()) {
      try {
        pendingInvitation = await findInvitation(user);
      } catch (error) {
        pendingInvitation = null;
      }
      renderInactive();
      return;
    }
    try {
      const householdId = storage.get(keys.cloudHouseholdId, user.uid);
      const ownerId = storage.get(keys.cloudOwnerUserId, user.uid);
      await startSync(user, 'remote-first', householdId, ownerId);
    } catch (error) {
      // Die Fehlermeldung wird durch startSync angezeigt.
    }
  }

  global.addEventListener('budgetquest-auth-changed', event => {
    handleAuthChanged(event.detail?.user || null);
  });
})(window);
