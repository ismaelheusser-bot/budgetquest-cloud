'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

class MemoryStorage {
  constructor(entries = {}) {
    this.data = new Map(Object.entries(entries));
  }

  get length() {
    return this.data.size;
  }

  key(index) {
    return [...this.data.keys()][index] ?? null;
  }

  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }

  setItem(key, value) {
    this.data.set(key, String(value));
  }

  removeItem(key) {
    this.data.delete(key);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '.git' || entry.name === 'node_modules') return [];
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const localStorage = new MemoryStorage({
  bq_household: 'Familie Heusser',
  bq_settings: '{"income":10700,"fixed":6180,"saving":1120}',
  bq_tx: '[{"title":"Migros","amount":42.5}]',
  bq_xp: '2480',
  bq_setup_done: '1'
});
const window = { localStorage };
const context = vm.createContext({ window, console });

for (const file of [
  'src/storage/storage-service.js',
  'src/storage/local-storage-adapter.js',
  'src/storage/storage-bootstrap.js'
]) {
  vm.runInContext(read(file), context, { filename: file });
}

const storage = window.budgetQuestStorage;
const keys = window.BudgetQuestStorageKeys;

assert.equal(storage.get(keys.household), 'Familie Heusser');
assert.equal(storage.get(keys.settings).income, 10700);
assert.equal(storage.get(keys.transactions)[0].amount, 42.5);
assert.equal(storage.get(keys.experience), 2480);
assert.equal(storage.has(keys.setupComplete), true);
assert.equal(storage.get('nicht_vorhanden', 'fallback'), 'fallback');

storage.set(keys.household, 'Neuer Haushalt');
assert.equal(storage.get(keys.household), 'Neuer Haushalt');
storage.set('bq_test_array', [{ value: 1 }]);
assert.equal(JSON.stringify(storage.get('bq_test_array')), JSON.stringify([{ value: 1 }]));
storage.remove('bq_test_array');
assert.equal(storage.has('bq_test_array'), false);

const keyValues = Object.values(keys);
assert.equal(new Set(keyValues).size, keyValues.length, 'Storage-Schlüssel müssen eindeutig sein.');

const serviceWorker = read('service-worker.js');
const shellMatch = serviceWorker.match(/const APP_SHELL=\[(.*?)\];/s);
assert.ok(shellMatch, 'APP_SHELL wurde im Service Worker nicht gefunden.');
const shellFiles = [...shellMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
for (const shellFile of shellFiles) {
  if (shellFile === './') continue;
  const relativePath = shellFile.replace(/^\.\//, '');
  assert.ok(fs.existsSync(path.join(root, relativePath)), `Offline-Datei fehlt: ${relativePath}`);
}

const javascriptFiles = walk(root).filter(file => file.endsWith('.js'));
const forbidden = /localStorage\.(?:getItem|setItem|removeItem)/;
for (const absolutePath of javascriptFiles) {
  const relativePath = path.relative(root, absolutePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  assert.doesNotMatch(source, forbidden, `Direkter localStorage-Zugriff in ${relativePath}`);
  new vm.Script(source, { filename: relativePath });
}

console.log(`✅ Storage-Prüfung bestanden: ${keyValues.length} Schlüssel, ${javascriptFiles.length} JavaScript-Dateien, ${shellFiles.length} Offline-Einträge.`);
