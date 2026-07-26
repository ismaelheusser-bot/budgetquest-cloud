'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

class MemoryStorage {
  constructor(entries = {}) { this.data = new Map(Object.entries(entries)); }
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

async function main() {
  const localStorage = new MemoryStorage({ bq_household: 'Familie Heusser' });
  const window = { localStorage };
  const context = vm.createContext({ window, console });

  for (const file of [
    'src/storage/storage-service.js',
    'src/storage/local-storage-adapter.js',
    'src/storage/storage-bootstrap.js',
    'src/storage/cloud-sync-service.js',
    'src/storage/firebase-firestore-adapter.js'
  ]) vm.runInContext(read(file), context, { filename: file });

  const storage = window.budgetQuestStorage;
  const keys = window.BudgetQuestStorageKeys;
  const calls = [];
  let remoteListener = null;
  let remoteSnapshot = { values: {} };
  let remoteChanges = 0;

  const adapter = {
    async connect(contextValue) { calls.push(['connect', contextValue]); },
    async pullAll() { return remoteSnapshot; },
    async replaceAll(values) { calls.push(['replaceAll', values]); },
    async set(key, value) { calls.push(['set', key, value]); },
    async remove(key) { calls.push(['remove', key]); },
    subscribe(listener) { remoteListener = listener; return () => { remoteListener = null; }; }
  };

  const sync = new window.BudgetQuestCloudSyncService({
    storage, adapter, keys: Object.values(keys),
    onError: error => { throw error; },
    onRemoteChange: () => { remoteChanges += 1; }
  });

  await sync.start({ householdId: 'haushalt-1', userId: 'user-1' });
  assert.equal(calls[0][0], 'connect');
  assert.equal(calls[1][0], 'replaceAll');
  assert.equal(calls[1][1][keys.household], 'Familie Heusser');

  storage.set(keys.household, 'Lokal geändert');
  await Promise.resolve();
  assert.equal(calls.at(-1)[0], 'set');

  const callCount = calls.length;
  remoteListener({ values: { [keys.household]: 'Cloud-Stand' }, deletedKeys: [] });
  assert.equal(storage.get(keys.household), 'Cloud-Stand');
  assert.equal(calls.length, callCount);
  assert.equal(remoteChanges, 0, 'Der initiale Firestore-Snapshot darf keinen Reload auslösen.');

  remoteListener({ values: { [keys.household]: 'Cloud-Stand 2' }, deletedKeys: [] });
  assert.equal(storage.get(keys.household), 'Cloud-Stand 2');
  assert.equal(remoteChanges, 1, 'Spätere echte Cloud-Änderungen müssen aktualisieren.');

  remoteListener({ values: { [keys.household]: 'Cloud-Stand 2' }, deletedKeys: [] });
  assert.equal(remoteChanges, 1);

  remoteListener({ values: {}, deletedKeys: [keys.household] });
  assert.equal(storage.has(keys.household), false);
  assert.equal(calls.length, callCount);
  assert.equal(remoteChanges, 2);

  sync.stop();
  assert.equal(remoteListener, null);

  storage.set(keys.household, 'Bewusster lokaler Erststand');
  remoteSnapshot = { values: { [keys.household]: 'Vorhandener Cloud-Stand' } };
  calls.length = 0;
  await sync.start(
    { householdId: 'haushalt-1', userId: 'user-1' },
    { initialStrategy: 'local-first' }
  );
  assert.equal(calls[1][0], 'replaceAll');
  assert.equal(calls[1][1][keys.household], 'Bewusster lokaler Erststand');
  assert.equal(storage.get(keys.household), 'Bewusster lokaler Erststand');

  sync.stop();
  console.log('✅ CloudSyncService-Prüfung bestanden.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});