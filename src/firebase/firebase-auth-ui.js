(function (global) {
  'use strict';

  const AUTH_OPERATION_TIMEOUT_MS = 60000;
  let authBusy = false;

  const container = () => document.getElementById('firebaseAccount');
  const isFirebaseHosted = () => /(^|\.)budgetquest-cloud\.(firebaseapp\.com|web\.app)$/i.test(global.location.hostname);

  const status = (message, isError = false) => {
    const element = document.getElementById('firebaseAuthStatus');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('cloud-auth-error', isError);
  };

  const messageFor = error => {
    const messages = {
      'auth/account-exists-with-different-credential': 'Für diese E-Mail besteht bereits eine andere Anmeldemethode.',
      'auth/cancelled-popup-request': 'Die vorherige Anmeldung wurde abgebrochen. Du kannst es erneut versuchen.',
      'auth/network-request-failed': 'Keine Verbindung zu Google. Bitte Internetverbindung prüfen.',
      'auth/operation-not-allowed': 'Google muss zuerst in Firebase Authentication aktiviert werden.',
      'auth/popup-blocked': 'Das Google-Anmeldefenster wurde blockiert. Bitte nochmals direkt auf den Anmeldeknopf tippen.',
      'auth/popup-closed-by-user': 'Google-Anmeldung wurde abgebrochen.',
      'auth/operation-timeout': 'Die Google-Anmeldung hat zu lange gewartet. Bitte erneut versuchen.',
      'auth/too-many-requests': 'Zu viele Versuche. Bitte später nochmals probieren.',
      'auth/unauthorized-domain': 'Diese App-Adresse muss in Firebase als autorisierte Domain eingetragen werden.'
    };
    return messages[error?.code] || `Anmeldung nicht abgeschlossen${error?.code ? ` (${error.code})` : ''}. Bitte erneut versuchen.`;
  };

  const setBusy = busy => {
    authBusy = busy;
    document.querySelectorAll('[data-firebase-auth]').forEach(button => {
      button.disabled = busy;
      button.setAttribute('aria-busy', busy ? 'true' : 'false');
    });
  };

  function withTimeout(promise) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = global.setTimeout(() => {
        const error = new Error('Google-Anmeldung abgelaufen');
        error.code = 'auth/operation-timeout';
        reject(error);
      }, AUTH_OPERATION_TIMEOUT_MS);
    });
    return Promise.race([promise, timeout]).finally(() => global.clearTimeout(timeoutId));
  }

  const signedOutTemplate = () => `
    <strong>☁️ BudgetQuest Cloud</strong>
    <p>Melde dich mit deinem Google-Konto an. Danach wird dein Cloud-Haushalt automatisch geladen.</p>
    <button class="btn google-sign-in section" data-firebase-auth type="button" onclick="budgetQuestGoogleSignIn()">
      <span class="google-mark" aria-hidden="true">G</span>
      <span>Mit Google anmelden</span>
    </button>
    <div id="firebaseAuthStatus" class="tiny cloud-auth-status">${isFirebaseHosted() ? 'Sichere Firebase-Anmeldung bereit.' : 'Für die zuverlässige Anmeldung bitte die Firebase-Version der App verwenden.'}</div>
  `;

  const signedInTemplate = () => `
    <strong>☁️ BudgetQuest Cloud</strong>
    <p>Angemeldet als <b class="cloud-account-name"></b></p>
    <div class="cloud-account-email tiny"></div>
    <div class="cloud-auth-state"><span class="cloud-state-dot"></span><span>Google-Konto dauerhaft verbunden</span></div>
    <div id="firebaseCloudControls" class="cloud-sync-controls section"><div class="tiny">Cloud-Haushalt wird geladen …</div></div>
    <button class="btn secondary section" data-firebase-auth type="button" onclick="budgetQuestSignOut()">Abmelden</button>
    <div id="firebaseAuthStatus" class="tiny cloud-auth-status">Google-Anmeldung aktiv.</div>
  `;

  function renderUser(user) {
    const element = container();
    if (!element) return;
    element.innerHTML = user ? signedInTemplate() : signedOutTemplate();
    if (user) {
      const name = element.querySelector('.cloud-account-name');
      const email = element.querySelector('.cloud-account-email');
      if (name) name.textContent = user.displayName || user.email || 'Google-Nutzer';
      if (email) email.textContent = user.email || '';
    }
    setBusy(false);
    global.budgetQuestCurrentUser = user || null;
    global.dispatchEvent(new CustomEvent('budgetquest-auth-changed', { detail: { user: user || null } }));
  }

  global.budgetQuestGoogleSignIn = async () => {
    if (authBusy) return;
    setBusy(true);
    status('Google-Anmeldung wird geöffnet …');
    try {
      const firebase = await global.budgetQuestFirebaseReady;
      const provider = new firebase.authApi.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await withTimeout(firebase.authApi.signInWithPopup(firebase.auth, provider));
      const user = result?.user || firebase.auth.currentUser || null;
      if (!user) {
        const error = new Error('Kein Google-Konto zurückgegeben');
        error.code = 'auth/no-user-returned';
        throw error;
      }
      renderUser(user);
      status('Erfolgreich mit Google angemeldet. Cloud-Haushalt wird geladen …');
    } catch (error) {
      console.warn('BudgetQuest Firebase Authentication:', error);
      renderUser(firebaseCurrentUserSafe());
      status(messageFor(error), true);
    } finally {
      setBusy(false);
    }
  };

  function firebaseCurrentUserSafe() {
    return global.budgetQuestCurrentUser || null;
  }

  global.budgetQuestSignOut = async () => {
    if (authBusy) return;
    setBusy(true);
    try {
      const firebase = await global.budgetQuestFirebaseReady;
      await firebase.authApi.signOut(firebase.auth);
      renderUser(null);
      status('Erfolgreich abgemeldet.');
    } catch (error) {
      status(messageFor(error), true);
    } finally {
      setBusy(false);
    }
  };

  const initialize = async () => {
    try {
      const firebase = await global.budgetQuestFirebaseReady;
      renderUser(firebase.auth.currentUser || null);
      firebase.authApi.onAuthStateChanged(firebase.auth, renderUser, error => status(messageFor(error), true));
    } catch (error) {
      console.warn('BudgetQuest Firebase konnte nicht geladen werden:', error);
      renderUser(null);
      status('Firebase konnte nicht geladen werden. Offline-Daten bleiben verfügbar.', true);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})(window);
