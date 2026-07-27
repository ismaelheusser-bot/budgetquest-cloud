(function (global) {
  'use strict';

  const storage = global.budgetQuestStorage;
  const keys = global.BudgetQuestStorageKeys;
  const metadataKeys = new Set([keys.cloudSyncEnabled, keys.cloudHouseholdId, keys.cloudOwnerUserId]);
  const syncKeys = Object.values(keys).filter(key => !metadataKeys.has(key));

  let activeSync = null;
  let activeUserId = null;
  let activeHouseholdId = null;
  let activeOwnerId = null;
  let connecting = false;
  let pendingInvitation = null;

  const controls = () => document.getElementById('firebaseCloudControls');
  const setControls = html => { const element = controls(); if (element) element.innerHTML = html; };
  const normaliseEmail = value => String(value || '').trim().toLowerCase();
  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  async function emailHash(email) {
    const data = new TextEncoder().encode(normaliseEmail(email));
    const digest = await global.crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function messageFor(error) {
    const code = error?.code || '';
    if (code.includes('permission-denied')) return 'Cloud-Zugriff verweigert. Die veröffentlichten Firestore-Regeln müssen geprüft werden.';
    if (code.includes('unavailable')) return 'Cloud momentan nicht erreichbar. Der letzte Offline-Stand bleibt verfügbar.';
    return 'Cloud-Verbindung fehlgeschlagen. Der letzte Offline-Stand bleibt verfügbar.';
  }

  function renderConnecting() {
    setControls('<div class="cloud-sync-panel"><b>Cloud-Haushalt wird geladen …</b><p class="tiny">Die Cloud ist die führende Datenquelle. Lokale Daten dienen nur als Offline-Zwischenspeicher.</p></div>');
  }

  function renderSetup() {
    const invitation = pendingInvitation?.status === 'pending' ? `
      <div class="cloud-sync-panel cloud-sync-active">
        <b>Einladung zu einem gemeinsamen Haushalt</b>
        <p class="tiny">Du wurdest von ${escapeHtml(pendingInvitation.ownerEmail || 'einem Haushaltsmitglied')} eingeladen.</p>
        <button class="btn" type="button" onclick="budgetQuestAcceptHouseholdInvitation()">Einladung annehmen</button>
      </div>` : '';
    setControls(`${invitation}<div class="cloud-sync-panel"><b>Noch kein Cloud-Haushalt vorhanden</b><p class="tiny">Nur beim erstmaligen Einrichten werden die vorhandenen lokalen Daten in deinen neuen Cloud-Haushalt übernommen.</p><button class="btn" type="button" onclick="budgetQuestEnableCloudSync()">Cloud-Haushalt einmalig erstellen</button></div>`);
  }

  function renderActive() {
    const isOwner = activeOwnerId === activeUserId;
    setControls(`<div class="cloud-sync-panel cloud-sync-active">
      <div class="cloud-sync-title"><span class="cloud-state-dot"></span><b>Cloud First aktiv</b></div>
      <p class="tiny">${isOwner ? 'Dieser gemeinsame Haushalt gehört deinem Google-Konto.' : 'Du arbeitest im freigegebenen gemeinsamen Haushalt.'} Bei jedem Start werden zuerst die Cloud-Daten geladen.</p>
      ${isOwner ? `<form class="form section" onsubmit="budgetQuestInviteHouseholdMember(event)"><label>Google-Adresse der Partnerin oder des Partners<input id="cloudInviteEmail" type="email" autocomplete="email" placeholder="name@gmail.com" required></label><button class="btn" type="submit">Zum Haushalt einladen</button></form><div id="cloudInviteStatus" class="tiny"></div>` : ''}
      <button class="btn secondary" type="button" onclick="budgetQuestDisconnectCloudSync()">Auf diesem Gerät abmelden</button>
    </div>`);
  }

  function renderError(error) {
    setControls(`<div class="cloud-sync-panel"><b class="cloud-auth-error">Cloud derzeit nicht erreichbar</b><p class="tiny cloud-auth-error">${escapeHtml(messageFor(error))}</p><button class="btn secondary" type="button" onclick="budgetQuestReconnectCloud()">Erneut verbinden</button></div>`);
  }

  function contextFor(user, householdId) { return { householdId, userId: user.uid }; }
  function createAdapter(firebase) { return new global.BudgetQuestFirebaseFirestoreAdapter({ db: firebase.db, firestore: firebase.firestoreApi }); }

  function scheduleReload() {
    try {
      if (global.sessionStorage.getItem('bq_cloud_reload_pending') === '1') return;
      global.sessionStorage.setItem('bq_cloud_reload_pending', '1');
    } catch (error) {}
    global.setTimeout(() => global.location.reload(), 250);
  }

  async function startSync(user, householdId, ownerId, initialStrategy = 'remote-first') {
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
        onError: renderError,
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
      if (activeSync) activeSync.stop();
      activeSync = null;
      renderError(error);
      throw error;
    } finally {
      connecting = false;
    }
  }

  async function invitationFor(user) {
    if (!user?.email) return null;
    const firebase = await global.budgetQuestFirebaseReady;
    const id = await emailHash(user.email);
    const reference = firebase.firestoreApi.doc(firebase.db, 'householdInvites', id);
    const snapshot = await firebase.firestoreApi.getDoc(reference);
    return snapshot.exists() ? { id, ...snapshot.data() } : null;
  }

  async function ownHouseholdFor(user) {
    const firebase = await global.budgetQuestFirebaseReady;
    const reference = firebase.firestoreApi.doc(firebase.db, 'households', user.uid);
    const snapshot = await firebase.firestoreApi.getDoc(reference);
    return snapshot.exists() ? { householdId: user.uid, ownerId: snapshot.data().ownerId || user.uid } : null;
  }

  async function discoverHousehold(user) {
    const invitation = await invitationFor(user).catch(() => null);
    if (invitation?.status === 'accepted' && invitation.acceptedBy === user.uid) {
      return { householdId: invitation.householdId, ownerId: invitation.ownerId };
    }

    const storedHouseholdId = storage.get(keys.cloudHouseholdId, null);
    const storedOwnerId = storage.get(keys.cloudOwnerUserId, null);
    if (storedHouseholdId) {
      const firebase = await global.budgetQuestFirebaseReady;
      const reference = firebase.firestoreApi.doc(firebase.db, 'households', storedHouseholdId);
      const snapshot = await firebase.firestoreApi.getDoc(reference).catch(() => null);
      if (snapshot?.exists()) return { householdId: storedHouseholdId, ownerId: snapshot.data().ownerId || storedOwnerId || user.uid };
    }

    const own = await ownHouseholdFor(user).catch(() => null);
    if (own) return own;
    pendingInvitation = invitation?.status === 'pending' ? invitation : null;
    return null;
  }

  global.budgetQuestInviteHouseholdMember = async event => {
    event?.preventDefault();
    const user = global.budgetQuestCurrentUser;
    const email = normaliseEmail(document.getElementById('cloudInviteEmail')?.value);
    const status = document.getElementById('cloudInviteStatus');
    if (!user || !email || activeOwnerId !== user.uid || !activeHouseholdId) return;
    if (email === normaliseEmail(user.email)) { if (status) status.textContent = 'Du kannst dich nicht selbst einladen.'; return; }
    try {
      const firebase = await global.budgetQuestFirebaseReady;
      const inviteId = await emailHash(email);
      const inviteReference = firebase.firestoreApi.doc(firebase.db, 'householdInvites', inviteId);
      const householdReference = firebase.firestoreApi.doc(firebase.db, 'households', activeHouseholdId);
      const batch = firebase.firestoreApi.writeBatch(firebase.db);
      batch.set(inviteReference, { householdId: activeHouseholdId, ownerId: user.uid, ownerEmail: normaliseEmail(user.email), inviteeEmail: email, status: 'pending', createdAt: firebase.firestoreApi.serverTimestamp() });
      batch.update(householdReference, { invitedEmails: firebase.firestoreApi.arrayUnion(email), updatedAt: firebase.firestoreApi.serverTimestamp(), updatedBy: user.uid });
      await batch.commit();
      if (status) status.textContent = `Einladung für ${email} wurde erstellt.`;
      const input = document.getElementById('cloudInviteEmail'); if (input) input.value = '';
    } catch (error) { if (status) status.textContent = messageFor(error); }
  };

  global.budgetQuestAcceptHouseholdInvitation = async () => {
    const user = global.budgetQuestCurrentUser;
    if (!user) return;
    try {
      pendingInvitation = pendingInvitation || await invitationFor(user);
      if (!pendingInvitation || pendingInvitation.status !== 'pending') return renderSetup();
      renderConnecting();
      const firebase = await global.budgetQuestFirebaseReady;
      const householdReference = firebase.firestoreApi.doc(firebase.db, 'households', pendingInvitation.householdId);
      const inviteReference = firebase.firestoreApi.doc(firebase.db, 'householdInvites', pendingInvitation.id);
      await firebase.firestoreApi.runTransaction(firebase.db, async transaction => {
        const snapshot = await transaction.get(householdReference);
        if (!snapshot.exists()) throw new Error('Haushalt nicht gefunden');
        const data = snapshot.data();
        const memberIds = Array.isArray(data.memberIds) ? data.memberIds : [];
        const invitedEmails = Array.isArray(data.invitedEmails) ? data.invitedEmails : [];
        transaction.update(householdReference, { memberIds: memberIds.includes(user.uid) ? memberIds : [...memberIds, user.uid], invitedEmails: invitedEmails.filter(email => email !== normaliseEmail(user.email)), updatedAt: firebase.firestoreApi.serverTimestamp(), updatedBy: user.uid });
        transaction.update(inviteReference, { status: 'accepted', acceptedBy: user.uid, acceptedAt: firebase.firestoreApi.serverTimestamp() });
      });
      await startSync(user, pendingInvitation.householdId, pendingInvitation.ownerId, 'remote-first');
    } catch (error) { renderError(error); }
  };

  global.budgetQuestEnableCloudSync = async () => {
    const user = global.budgetQuestCurrentUser;
    if (!user) return;
    if (!global.confirm('Neuen Cloud-Haushalt erstellen und die vorhandenen lokalen Daten einmalig hochladen?')) return;
    try { await startSync(user, user.uid, user.uid, 'local-first'); }
    catch (error) { renderError(error); }
  };

  global.budgetQuestReconnectCloud = async () => {
    const user = global.budgetQuestCurrentUser;
    if (!user) return;
    await handleAuthChanged(user);
  };

  global.budgetQuestDisconnectCloudSync = async () => {
    const firebase = await global.budgetQuestFirebaseReady;
    await firebase.authApi.signOut(firebase.auth);
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
    if (activeUserId === user.uid && activeSync) return renderActive();
    renderConnecting();
    try {
      const household = await discoverHousehold(user);
      if (!household) return renderSetup();
      await startSync(user, household.householdId, household.ownerId, 'remote-first');
    } catch (error) { renderError(error); }
  }

  global.addEventListener('budgetquest-auth-changed', event => handleAuthChanged(event.detail?.user || null));
})(window);