'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const client = read('src/firebase/firebase-client.js');
const authUi = read('src/firebase/firebase-auth-ui.js');
const ownerControls = read('src/firebase/firebase-owner-controls.js');
const homeFix = read('home-affordability-fix.js');
const cloudSync = read('src/storage/cloud-sync-service.js');
const index = read('index.html');
const worker = read('service-worker.js');
const rules = read('firestore.rules');

assert.match(client, /projectId:\s*'budgetquest-cloud'/);
assert.match(client, /budgetQuestFirebaseReady/);
assert.match(client, /setPersistence\(auth, authApi\.browserLocalPersistence\)/);
assert.match(client, /firebase-owner-controls\.js/);
assert.match(client, /home-affordability-fix\.js/);
assert.match(authUi, /GoogleAuthProvider/);
assert.match(authUi, /signInWithPopup/);
assert.match(authUi, /signInWithRedirect/);
assert.match(authUi, /getRedirectResult/);
assert.match(authUi, /display-mode: standalone/);
assert.match(authUi, /navigator\?\.standalone/);
assert.match(authUi, /budgetQuestGoogleSignIn/);
assert.doesNotMatch(authUi, /signInWithEmailAndPassword/);
assert.match(authUi, /firebaseCloudControls/);
assert.match(ownerControls, /data\.ownerId === user\.uid/);
assert.match(ownerControls, /budgetQuestOwnerInviteHouseholdMember/);
assert.match(ownerControls, /Zum Haushalt einladen/);
assert.match(homeFix, /Jahresbruttolohn/);
assert.match(homeFix, /function ensureHomePlan\(\)/);
assert.match(homeFix, /global\.homePlan = \{ \.\.\.saved \}/);
assert.match(homeFix, /const plan = ensureHomePlan\(\)/);
assert.match(homeFix, /annualGross/);
assert.match(homeFix, /Nettobeträgen des Budgets/);
assert.match(cloudSync, /let initialRemoteSnapshot = true/);
assert.match(cloudSync, /notify: !initialRemoteSnapshot/);
assert.match(cloudSync, /applySnapshot\(normalized, \{ notify:/);

const storagePosition = index.indexOf('src/storage/storage-bootstrap.js');
const firebasePosition = index.indexOf('src/firebase/firebase-client.js');
const appPosition = index.indexOf('app.js?v=');
assert(storagePosition >= 0 && firebasePosition > storagePosition && appPosition > firebasePosition);
assert.match(index, /id="firebaseAccount"/);
assert.match(worker, /budgetquest-v71/);
assert.match(worker, /src\/firebase\/firebase-client\.js/);
assert.match(worker, /src\/firebase\/firebase-auth-ui\.js/);
assert.match(worker, /src\/firebase\/firebase-owner-controls\.js/);
assert.match(worker, /home-affordability-fix\.js/);
assert.match(rules, /request\.auth\.uid in data\.memberIds/);
assert.match(rules, /householdInvites/);
assert.match(index, /cloud-sync-service\.js/);
assert.match(index, /firebase-firestore-adapter\.js/);
assert.match(index, /firebase-cloud-controller\.js/);

console.log('✅ Firebase-Grundlage, Eigentümereinladung und rückwärtskompatibler Eigenheim-Import sind eingebunden.');
