(function (global) {
  'use strict';

  const container = () => document.getElementById('firebaseAccount');
  const status = (message, isError = false) => {
    const element = document.getElementById('firebaseAuthStatus');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('cloud-auth-error', isError);
  };

  const messageFor = error => {
    const messages = {
      'auth/account-exists-with-different-credential': 'Für diese E-Mail besteht bereits eine andere Anmeldemethode.',
      'auth/cancelled-popup-request': 'Die vorherige Anmeldung wurde abgebrochen.',
      'auth/network-request-failed': 'Keine Verbindung zu Google. Bitte Internetverbindung prüfen.',
      'auth/operation-not-allowed': 'Google muss zuerst in Firebase Authentication aktiviert werden.',
      'auth/popup-blocked': 'Das Google-Fenster wurde blockiert. Bitte Pop-ups für BudgetQuest erlauben.',
      'auth/popup-closed-by-user': 'Google-Anmeldung wurde abgebrochen.',
      'auth/too-many-requests': 'Zu viele Versuche. Bitte später nochmals probieren.',
      'auth/unauthorized-domain': 'Diese App-Adresse muss in Firebase als autorisierte Domain eingetragen werden.'
    };
    return messages[error?.code] || 'Anmeldung derzeit nicht möglich. Bitte später nochmals probieren.';
  };

  const setBusy = busy => {
    document.querySelectorAll('[data-firebase-auth]').forEach(button => {
      button.disabled = busy;
    });
  };

  const signedOutTemplate = () => `
    <strong>☁️ BudgetQuest Cloud</strong>
    <p>Melde dich sicher mit deinem Google-Konto an. Deine Budgetdaten bleiben bis zur ausdrücklich bestätigten Migration auf diesem Gerät.</p>
    <button class="btn google-sign-in section" data-firebase-auth type="button" onclick="budgetQuestGoogleSignIn()">
      <span class="google-mark" aria-hidden="true">G</span>
      <span>Mit Google anmelden</span>
    </button>
    <div id="firebaseAuthStatus" class="tiny cloud-auth-status">Noch nicht angemeldet.</div>
  `;

  const signedInTemplate = () => `
    <strong>☁️ BudgetQuest Cloud</strong>
    <p>Angemeldet als <b class="cloud-account-name"></b></p>
    <div class="cloud-account-email tiny"></div>
    <div class="cloud-auth-state">
      <span class="cloud-state-dot"></span>
      <span>Google-Konto verbunden</span>
    </div>
    <button class="btn secondary section" data-firebase-auth type="button" onclick="budgetQuestSignOut()">Abmelden</button>
    <div id="firebaseAuthStatus" class="tiny cloud-auth-status">Cloud-Synchronisation ist noch nicht aktiviert; lokale Daten wurden nicht hochgeladen.</div>
  `;

  function renderUser(user) {
    const element = container();
    if (!element) return;
    element.innerHTML = user ? signedInTemplate() : signedOutTemplate();
    if (!user) return;

    const name = element.querySelector('.cloud-account-name');
    const email = element.querySelector('.cloud-account-email');
    if (name) name.textContent = user.displayName || user.email || 'Google-Nutzer';
    if (email) email.textContent = user.email || '';
  }

  async function perform(action, successMessage) {
    setBusy(true);
    status('Bitte warten …');
    try {
      const firebase = await global.budgetQuestFirebaseReady;
      await action(firebase);
      status(successMessage);
    } catch (error) {
      console.warn('BudgetQuest Firebase Authentication:', error);
      status(messageFor(error), true);
    } finally {
      setBusy(false);
    }
  }

  global.budgetQuestGoogleSignIn = () => perform(async firebase => {
    const provider = new firebase.authApi.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await firebase.authApi.signInWithPopup(firebase.auth, provider);
  }, 'Erfolgreich mit Google angemeldet.');

  global.budgetQuestSignOut = () => perform(
    firebase => firebase.authApi.signOut(firebase.auth),
    'Erfolgreich abgemeldet.'
  );

  const initialize = async () => {
    renderUser(null);
    try {
      const firebase = await global.budgetQuestFirebaseReady;
      firebase.authApi.onAuthStateChanged(firebase.auth, renderUser, error => {
        status(messageFor(error), true);
      });
    } catch (error) {
      console.warn('BudgetQuest Firebase konnte nicht geladen werden:', error);
      status('Firebase konnte nicht geladen werden. Die App funktioniert weiterhin lokal.', true);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})(window);
