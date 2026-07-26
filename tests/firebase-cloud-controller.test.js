'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const controller = read('src/firebase/firebase-cloud-controller.js');
const adapter = read('src/storage/firebase-firestore-adapter.js');
const bootstrap = read('src/storage/storage-bootstrap.js');
const rules = read('firestore.rules');

assert.match(controller, /budgetQuestEnableCloudSync/);
assert.match(controller, /budgetQuestDisconnectCloudSync/);
assert.match(controller, /budgetQuestInviteHouseholdMember/);
assert.match(controller, /budgetQuestAcceptHouseholdInvitation/);
assert.match(controller, /budgetQuestCheckHouseholdInvitation/);
assert.match(controller, /householdInvites/);
assert.match(controller, /SHA-256/);
assert.match(controller, /writeBatch/);
assert.match(controller, /runTransaction/);
assert.match(controller, /arrayUnion/);
assert.match(controller, /initialStrategy = 'remote-first'/);
assert.match(controller, /startSync\(user, 'local-first'\)/);
assert.match(controller, /startSync\(user, 'remote-first'/);
assert.match(controller, /global\.confirm/);
assert.match(controller, /metadataKeys/);
assert.match(controller, /Object\.values\(keys\)\.filter/);
assert.match(controller, /onRemoteChange: scheduleReload/);
assert.match(controller, /storage\.get\(keys\.cloudHouseholdId/);

assert.match(adapter, /data\.invitedEmails = \[\]/);
assert.match(bootstrap, /bq_cloud_sync_enabled/);
assert.match(bootstrap, /bq_cloud_household_id/);
assert.match(bootstrap, /bq_cloud_owner_user_id/);

assert.match(rules, /householdId == request\.auth\.uid/);
assert.match(rules, /request\.resource\.data\.memberIds == \[request\.auth\.uid\]/);
assert.match(rules, /match \/householdInvites\/\{inviteId\}/);
assert.match(rules, /isInvited/);
assert.match(rules, /acceptedBy == request\.auth\.uid/);
assert.match(rules, /affectedKeys\(\)\.hasOnly/);
assert.doesNotMatch(controller, /apiKey|accessToken|refreshToken|password/);

console.log('✅ Gemeinsame Cloud-Haushalte mit eigener Google-Anmeldung sind sicher vorbereitet.');
