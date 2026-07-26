(function (global) {
  'use strict';

  const storage = global.budgetQuestStorage;
  const keys = global.BudgetQuestStorageKeys;
  let currentUser = null;
  let checking = false;

  const normaliseEmail = value => String(value || '').trim().toLowerCase();
  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[character]));

  async function emailHash(email) {
    const data = new TextEncoder().encode(normaliseEmail(email));
    const digest = await global.crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function householdIdFor(user) {
    return storage.get(keys.cloudHouseholdId, null) || user?.uid || '';
  }

  async function ownerContext(user) {
    if (!user) return null;
    const firebase = await global.budgetQuestFirebaseReady;
    const householdId = householdIdFor(user);
    if (!householdId) return null;
    const reference = firebase.firestoreApi.doc(firebase.db, 'households', householdId);
    const snapshot = await firebase.firestoreApi.getDoc(reference);
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    return data.ownerId === user.uid ? { firebase, householdId, data } : null;
  }

  async function ensureOwnerControls() {
    if (checking || !currentUser) return;
    const panel = document.querySelector('#firebaseCloudControls .cloud-sync-active');
    if (!panel || document.getElementById('cloudInviteEmail')) return;
    checking = true;
    try {
      const context = await ownerContext(currentUser);
      if (!context || document.getElementById('cloudInviteEmail')) return;
      const disconnect = panel.querySelector('button[onclick*="budgetQuestDisconnectCloudSync"]');
      const wrapper = document.createElement('div');
      wrapper.id = 'cloudOwnerInviteControls';
      wrapper.innerHTML = `
        <form class="form section" onsubmit="budgetQuestOwnerInviteHouseholdMember(event)">
          <label>Google-Adresse der Partnerin oder des Partners
            <input id="cloudInviteEmail" type="email" autocomplete="email" placeholder="name@gmail.com" required>
          </label>
          <button class="btn" type="submit">Zum Haushalt einladen</button>
        </form>
        <div id="cloudInviteStatus" class="tiny"></div>
      `;
      panel.insertBefore(wrapper, disconnect || null);
      const description = panel.querySelector('p.tiny');
      if (description) description.textContent = 'Dieser gemeinsame Haushalt gehört deinem Google-Konto. Änderungen werden automatisch synchronisiert.';
    } catch (error) {
      console.warn('BudgetQuest Eigentümerprüfung:', error);
    } finally {
      checking = false;
    }
  }

  global.budgetQuestOwnerInviteHouseholdMember = async event => {
    event?.preventDefault();
    const email = normaliseEmail(document.getElementById('cloudInviteEmail')?.value);
    const status = document.getElementById('cloudInviteStatus');
    if (!currentUser || !email) return;
    if (email === normaliseEmail(currentUser.email)) {
      if (status) status.textContent = 'Du kannst dich nicht selbst einladen.';
      return;
    }
    try {
      const context = await ownerContext(currentUser);
      if (!context) throw new Error('Dieses Konto ist nicht Eigentümer des aktiven Haushalts.');
      const { firebase, householdId } = context;
      const inviteId = await emailHash(email);
      const inviteReference = firebase.firestoreApi.doc(firebase.db, 'householdInvites', inviteId);
      const householdReference = firebase.firestoreApi.doc(firebase.db, 'households', householdId);
      const batch = firebase.firestoreApi.writeBatch(firebase.db);
      batch.set(inviteReference, {
        householdId,
        ownerId: currentUser.uid,
        ownerEmail: normaliseEmail(currentUser.email),
        inviteeEmail: email,
        status: 'pending',
        createdAt: firebase.firestoreApi.serverTimestamp()
      });
      batch.update(householdReference, {
        invitedEmails: firebase.firestoreApi.arrayUnion(email),
        updatedAt: firebase.firestoreApi.serverTimestamp(),
        updatedBy: currentUser.uid
      });
      await batch.commit();
      if (status) status.textContent = `Einladung für ${escapeHtml(email)} wurde erstellt.`;
      const input = document.getElementById('cloudInviteEmail');
      if (input) input.value = '';
    } catch (error) {
      if (status) status.textContent = error?.code?.includes('permission-denied')
        ? 'Einladung wurde von Firestore abgewiesen. Bitte Regeln und Eigentümerstatus prüfen.'
        : (error?.message || 'Einladung konnte nicht erstellt werden.');
    }
  };

  global.addEventListener('budgetquest-auth-changed', event => {
    currentUser = event.detail?.user || null;
    global.setTimeout(ensureOwnerControls, 400);
  });

  const observer = new MutationObserver(() => global.setTimeout(ensureOwnerControls, 50));
  const start = () => observer.observe(document.body, { childList: true, subtree: true });
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', start, { once: true })
    : start();
})(window);
