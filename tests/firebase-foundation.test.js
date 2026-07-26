'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const client = read('src/firebase/firebase-client.js');
const authUi = read('src/firebase/firebase-auth-ui.js');
const index = read('index.html');
const worker = read('service-worker.js');
const rules = read('firestore.rules');

assert.match(client, /projectId:\s*'budgetquest-cloud'/);
assert.match(client, /budgetQuestFirebaseReady/);
assert.match(authUi, /GoogleAuthProvider/);
assert.match(authUi, /signInWithPopup/);
assert.match(authUi, /budgetQuestGoogleSignIn/);
assert.doesNotMatch(authUi, /signInWithEmailAndPassword/);
assert.match(authUi, /Cloud-Synchronisation ist noch nicht aktiviert/);

const storagePosition = index.indexOf('src/storage/storage-bootstrap.js');
const firebasePosition = index.indexOf('src/firebase/firebase-client.js');
const appPosition = index.indexOf('app.js?v=');
assert(storagePosition >= 0 && firebasePosition > storagePosition && appPosition > firebasePosition);
assert.match(index, /id="firebaseAccount"/);
assert.match(worker, /budgetquest-v62/);
assert.match(worker, /src\/firebase\/firebase-client\.js/);
assert.match(worker, /src\/firebase\/firebase-auth-ui\.js/);
assert.match(rules, /request\.auth\.uid in data\.memberIds/);
assert.doesNotMatch(index, /cloud-sync-service\.js/);

console.log('✅ Firebase-Grundlage ist eingebunden, Cloud-Sync bleibt inaktiv.');
