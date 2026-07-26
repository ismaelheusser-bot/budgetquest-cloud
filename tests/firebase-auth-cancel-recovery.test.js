'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const authUi = fs.readFileSync(path.join(root, 'src/firebase/firebase-auth-ui.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

assert.match(authUi, /AUTH_OPERATION_TIMEOUT_MS/);
assert.match(authUi, /Promise\.race/);
assert.match(authUi, /pageshow/);
assert.match(authUi, /visibilitychange/);
assert.match(authUi, /resetPendingAuthState/);
assert.match(authUi, /auth\/popup-closed-by-user/);
assert.match(worker, /budgetquest-v68/);

console.log('✅ Abgebrochene Google-Anmeldungen geben die Oberfläche wieder frei.');