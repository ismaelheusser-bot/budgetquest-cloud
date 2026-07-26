'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const controller = read('src/firebase/firebase-cloud-controller.js');
const bootstrap = read('src/storage/storage-bootstrap.js');
const rules = read('firestore.rules');

assert.match(controller, /budgetQuestEnableCloudSync/);
assert.match(controller, /budgetQuestDisconnectCloudSync/);
assert.match(controller, /initialStrategy = 'remote-first'/);
assert.match(controller, /startSync\(user, 'local-first'\)/);
assert.match(controller, /startSync\(user, 'remote-first'\)/);
assert.match(controller, /global\.confirm/);
assert.match(controller, /metadataKeys/);
assert.match(controller, /Object\.values\(keys\)\.filter/);
assert.match(controller, /onRemoteChange: scheduleReload/);

assert.match(bootstrap, /bq_cloud_sync_enabled/);
assert.match(bootstrap, /bq_cloud_household_id/);
assert.match(bootstrap, /bq_cloud_owner_user_id/);

assert.match(rules, /householdId == request\.auth\.uid/);
assert.match(rules, /request\.resource\.data\.memberIds == \[request\.auth\.uid\]/);
assert.doesNotMatch(controller, /apiKey|accessToken|refreshToken|password/);

console.log('✅ Persönliche Cloud-Aktivierung ist sicher vorbereitet.');
