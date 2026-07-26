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
      'auth/email-already-in-use': 'Für diese E-Mail besteht bereits ein Konto.',
      'auth/invalid-credential': 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
      'auth/invalid-email': 'Bitte eine gültige E-Mail-Adresse eingeben.',
      'auth/operation-not-allowed': 'E-Mail/Passwort muss zuerst in Firebase Authentication aktiviert werden.',
      'auth/too-many-requests': 'Zu viele Versuche. Bitte später nochmals probieren.',
      'auth/weak-password': 'Das Passwort muss mindestens sechs Zeichen enthalten.'
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
    <p>Melde dich an oder erstelle ein Konto. Deine Budgetdaten bleiben bis zur ausdrücklich bestätigten Migration auf diesem Gerät.</p>
    <form class="form section" onsubmit="budgetQuestSignIn(event)">
      <label>E-Mail-Adresse<input id="firebaseEmail" type="email" autocomplete="email" required></label>
      <label>Passwort<input id="firebasePassword" type="password" minlength="6" autocomplete="current-password" required></label>
      <div class="actions">
        <button class="btn" data-firebase-auth type="submit">Anmelden</button>
        <button class="btn secondary" data-firebase-auth type="button" onclick="budgetQuestRegister()">Konto erstellen</button>
      </div>
    </form>
    <div id="firebaseAuthStatus" class="tiny cloud-auth-status">Noch nicht angemeldet.</div>
  `;

  const signedInTemplate = user => `
    <strong>☁️ BudgetQuest Cloud</strong>
    <p>Angemeldet als <b class="cloud-account-email"></b></p>
    <div class="cloud-auth-state">
      <span class="cloud-state-dot"></span>
      <span>${user.emailVerified ? 'E-Mail bestätigt' : 'E-Mail noch nicht bestätigt'}</span>
    </div>
    <button class="btn secondary section" data-firebase-auth type="button" onclick="budgetQuestSignOut()">Abmelden</button>
    <div id="firebaseAuthStatus" class="tiny cloud-auth-status">Cloud-Synchronisation ist noch nicht aktiviert; lokale Daten wurden nicht hochgeladen.</div>
  `;

  function renderUser(user) {
    const element = container();
    if (!element) return;
    element.innerHTML = user ? signedInTemplate(user) : signedOutTemplate();
    if (user) {
      const email = element.querySelector('.cloud-account-email');
      if (email) email.textContent = user.email || 'unbekannt';
    }
  }

  async function credentials() {
    const email = document.getElementById('firebaseEmail')?.value.trim();
    const password = document.getElementById('firebasePassword')?.value || '';
    if (!email || password.length < 6) {
      throw Object.assign(new Error('Ungültige Eingabe'), { code: 'auth/weak-password' });
    }
    return { email, password };
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

  global.budgetQuestSignIn = event => {
    event?.preventDefault();
    return perform(async firebase => {
      const { email, password } = await credentials();
      await firebase.authApi.signInWithEmailAndPassword(firebase.auth, email, password);
    }, 'Erfolgreich angemeldet.');
  };

  global.budgetQuestRegister = () => perform(async firebase => {
    const { email, password } = await credentials();
    const credential = await firebase.authApi.createUserWithEmailAndPassword(
      firebase.auth,
      email,
      password
    );
    await firebase.authApi.sendEmailVerification(credential.user);
  }, 'Konto erstellt. Bitte bestätige die E-Mail in deinem Postfach.');

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
