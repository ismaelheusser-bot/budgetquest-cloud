(function (global) {
  'use strict';

  const AUTH_OPERATION_TIMEOUT_MS = 45000;
  let authBusy = false;

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
      'auth/cancelled-popup-request': 'Die vorherige Anmeldung wurde abgebrochen. Du kannst es erneut versuchen.',
      'auth/network-request-failed': 'Keine Verbindung zu Google. Bitte Internetverbindung prüfen.',
      'auth/operation-not-allowed': 'Google muss zuerst in Firebase Authentication aktiviert werden.',
      'auth/popup-blocked': 'Das Google-Fenster wurde blockiert. Bitte Pop-ups für BudgetQuest erlauben.',
      'auth/popup-closed-by-user': 'Google-Anmeldung wurde abgebrochen. Die App kann normal weiterverwendet werden.',
      'auth/operation-timeout': 'Die Google-Anmeldung hat zu lange gewartet und wurde zurückgesetzt. Bitte erneut versuchen.',
      'auth/too-many-requests': 'Zu viele Versuche. Bitte später nochmals probieren.',
      'auth/unauthorized-domain': 'Diese App-Adresse muss in Firebase als autorisierte Domain eingetragen werden.'
    };
    return messages[error?.code] || 'Anmeldung derzeit nicht möglich. Bitte später nochmals probieren.';
  };

  const setBusy = busy => {
    authBusy = busy;
    document.querySelectorAll('[data-firebase-auth]').forEach(button => {
      button.disabled = busy;
      button.setAttribute('aria-busy', busy ? 'true' : 'false');
    });
  };

  function resetPendingAuthState(message = '') {
    if (!authBusy) return;
    setBusy(false);
    if (message) status(message, true);
  }

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
    <div id="firebaseCloudControls" class="cloud-sync-controls section">
      <div class="tiny">Cloud-Status wird geprüft …</div>
    </div>
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
    global.dispatchEvent(new CustomEvent('budgetquest-auth-changed', {
      detail: { user: user || null }
    }));
  }

  async function perform(action, successMessage) {
    if (authBusy) return;
    setBusy(true);
    status('Bitte warten …');
    try {
      const firebase = await global.budgetQuestFirebaseReady;
      await withTimeout(action(firebase));
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

  global.addEventListener('pageshow', () => {
    resetPendingAuthState('Die unterbrochene Google-Anmeldung wurde zurückgesetzt. Du kannst die App weiterverwenden.');
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      global.setTimeout(() => {
        resetPendingAuthState('Die unterbrochene Google-Anmeldung wurde zurückgesetzt. Du kannst es erneut versuchen.');
      }, 500);
    }
  });

  const initialize = async () => {
    renderUser(null);
    try {
      const firebase = await global.budgetQuestFirebaseReady;
      firebase.authApi.onAuthStateChanged(firebase.auth, renderUser, error => {
        resetPendingAuthState();
        status(messageFor(error), true);
      });
    } catch (error) {
      console.warn('BudgetQuest Firebase konnte nicht geladen werden:', error);
      resetPendingAuthState();
      status('Firebase konnte nicht geladen werden. Die App funktioniert weiterhin lokal.', true);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})(window);
