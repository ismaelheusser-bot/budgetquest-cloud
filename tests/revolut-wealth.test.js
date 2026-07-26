'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/wealth/revolut-statement-parser.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context, { filename: 'revolut-statement-parser.js' });
const parser = context.BudgetQuestRevolutStatementParser;

const csv = [
  'Asset Type,Symbol,Name,Quantity,Market Price,Market Value,Currency',
  'Stock,AAPL,Apple Inc,2,210.50,421.00,USD',
  'ETF,VWRL,Vanguard FTSE All-World,3,120.00,360.00,CHF',
  'Crypto,BTC,Bitcoin,0.015,60000,900.00,USD',
  'Crypto,ETH,Ethereum,0.4,2500,1000.00,USD'
].join('\n');

const result = parser.parseCsv(csv, 'Revolut-Vermoegen.csv');
assert.equal(result.positions.length, 4);
assert.equal(result.positions.filter(item => item.category === 'depot').length, 2);
assert.equal(result.positions.filter(item => item.category === 'crypto').length, 2);
assert.equal(result.positions[0].source, 'revolut_statement');
assert.equal(result.positions[0].name, 'Apple Inc');
assert.equal(result.positions[0].value, 421);

const totals = parser.totalsByCurrency(result.positions);
assert.equal(totals.USD, 2321);
assert.equal(totals.CHF, 360);

const pdfText = [
  'AAPL Apple Inc 2 210.50 421.00 USD',
  'BTC Bitcoin 0.015 60000 900.00 USD'
].join('\n');
const pdfResult = parser.parseText(pdfText, 'Revolut.pdf');
assert.equal(pdfResult.positions.length, 2);
assert.equal(pdfResult.positions[1].category, 'crypto');

const transactions = [
  'Type,Product,Completed Date,Description,Amount,Currency,State',
  'CARD_PAYMENT,Current,2026-07-20,MIGROS,-42.50,CHF,COMPLETED'
].join('\n');
assert.equal(parser.parseCsv(transactions).positions.length, 0, 'Zahlungskonto darf nicht als Vermögen importiert werden.');

const ui = fs.readFileSync(path.join(root, 'src/wealth/revolut-wealth.js'), 'utf8');
assert.match(ui, /keys\.wealth/);
assert.match(ui, /Geprüfte Bestände übernehmen/);
assert.match(ui, /bisherigen Revolut-Bestand ersetzen/);
assert.doesNotMatch(ui, /keys\.transactions|bq_tx/);

console.log('✅ Revolut-Vermögen: Depot, Krypto, Währungen und Schutz vor Kontobuchungen geprüft.');
