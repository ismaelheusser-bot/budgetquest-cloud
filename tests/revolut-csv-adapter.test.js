'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/import/revolut-csv-adapter.js'),
  'utf8'
);
const context = vm.createContext({});
vm.runInContext(source, context, { filename: 'revolut-csv-adapter.js' });

const adapter = context.BudgetQuestRevolutCsvAdapter;
const headers = [
  'Type',
  'Product',
  'Started Date',
  'Completed Date',
  'Description',
  'Amount',
  'Fee',
  'Currency',
  'State',
  'Balance'
];

assert.equal(adapter.detect(headers), true);
assert.equal(adapter.detect(['Datum', 'Buchungstext', 'Betrag']), false);

const result = adapter.parse(headers, [
  ['CARD_PAYMENT', 'Current', '2026-07-20 08:00:00', '2026-07-21 08:00:00', 'MIGROS USTER', '-42.50', '0', 'CHF', 'COMPLETED', '500'],
  ['TRANSFER', 'Current', '2026-07-22 08:00:00', '2026-07-22 08:01:00', 'Lohn', '5000.00', '0', 'CHF', 'COMPLETED', '5500'],
  ['CARD_PAYMENT', 'Current', '2026-07-23 08:00:00', '', 'COOP', '-12.20', '0', 'CHF', 'REVERTED', '5500'],
  ['CARD_PAYMENT', 'Current', '2026-07-24 08:00:00', '', 'PENDING', '-8.10', '0', 'CHF', 'PENDING', '5500'],
  ['CARD_PAYMENT', 'Current', '2026-07-25 08:00:00', '2026-07-25 08:01:00', 'EURO SHOP', '-8.10', '0', 'EUR', 'COMPLETED', '5500']
], {
  fileName: 'account-statement.csv',
  parseAmount: Number
});

assert.equal(result.rows.length, 2);
assert.equal(result.summary.provider, 'Revolut');
assert.equal(result.summary.accepted, 2);
assert.equal(result.summary.ignored, 3);
assert.equal(result.summary.ignoredForeignCurrency, 1);
assert.equal(result.rows[0].title, 'MIGROS USTER');
assert.equal(result.rows[0].rawAmount, -42.5);
assert.equal(result.rows[0].date, '2026-07-21');
assert.equal(result.rows[0].currency, 'CHF');
assert.equal(result.rows[0].source, 'revolut_csv');
assert.equal(result.rows[1].rawAmount, 5000);

const germanDate = adapter.parse(headers, [
  ['CARD_PAYMENT', 'Current', '24.07.2026', '25.07.2026', 'LANDI', '-10,50', '0', 'CHF', 'Abgeschlossen', '100']
], {
  parseAmount: value => Number(String(value).replace(',', '.'))
});

assert.equal(germanDate.rows[0].date, '2026-07-25');
assert.equal(germanDate.rows[0].rawAmount, -10.5);

console.log('✅ Revolut-CSV-Adapter: Erkennung, Statusfilter und Buchungsdaten geprüft.');
