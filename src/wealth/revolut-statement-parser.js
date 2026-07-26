(function (root) {
  'use strict';

  const cryptoNames = new Set([
    'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'AVAX', 'LINK', 'LTC',
    'BCH', 'XLM', 'UNI', 'ATOM', 'ALGO', 'MATIC', 'POL', 'SHIB', 'USDC', 'USDT'
  ]);

  function normalise(value) {
    return String(value || '')
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');
  }

  function splitLine(line, separator) {
    const values = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === separator && !quoted) {
        values.push(current.trim());
        current = '';
      } else {
        current += character;
      }
    }
    values.push(current.trim());
    return values;
  }

  function parseNumber(value) {
    let raw = String(value ?? '')
      .replace(/\u00A0/g, '')
      .replace(/\s/g, '')
      .replace(/[A-Z]{3}/gi, '')
      .replace(/[€$£₣]/g, '')
      .replace(/[()]/g, match => match === '(' ? '-' : '');
    if (!raw) return NaN;
    if (raw.includes(',') && raw.includes('.')) {
      raw = raw.lastIndexOf(',') > raw.lastIndexOf('.')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.replace(/,/g, '');
    } else {
      raw = raw.replace(/'/g, '').replace(',', '.');
    }
    return Number(raw.replace(/[^0-9.+-]/g, ''));
  }

  function findColumn(headers, names) {
    const candidates = names.map(normalise);
    const normalisedHeaders = headers.map(normalise);
    const exact = normalisedHeaders.findIndex(value => candidates.includes(value));
    if (exact >= 0) return exact;
    return normalisedHeaders.findIndex(value => candidates.some(candidate => value.includes(candidate)));
  }

  function categoryFor(type, symbol, name) {
    const combined = normalise(`${type} ${name}`);
    const ticker = String(symbol || '').trim().toUpperCase();
    if (
      /crypto|krypto|cryptocurrency|digital asset/.test(combined)
      || cryptoNames.has(ticker)
      || /bitcoin|ethereum|solana|ripple|cardano|dogecoin/.test(combined)
    ) return 'crypto';
    return 'depot';
  }

  function cleanCurrency(value) {
    const match = String(value || '').toUpperCase().match(/\b(CHF|EUR|USD|GBP)\b/);
    return match ? match[1] : String(value || '').trim().toUpperCase().slice(0, 5);
  }

  function position(input, row) {
    const quantity = parseNumber(input.quantity);
    const price = parseNumber(input.price);
    let value = parseNumber(input.value);
    if (!Number.isFinite(value) && Number.isFinite(quantity) && Number.isFinite(price)) {
      value = quantity * price;
    }
    const symbol = String(input.symbol || '').trim().toUpperCase();
    const name = String(input.name || symbol || '').trim();
    if (!name || !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(value) || value < 0) {
      return null;
    }
    return {
      id: `${categoryFor(input.type, symbol, name)}:${symbol || normalise(name)}:${cleanCurrency(input.currency)}`,
      category: categoryFor(input.type, symbol, name),
      symbol,
      name,
      quantity,
      price: Number.isFinite(price) ? price : null,
      value,
      currency: cleanCurrency(input.currency) || 'CHF',
      source: 'revolut_statement',
      row
    };
  }

  function mergePositions(positions) {
    const unique = new Map();
    positions.forEach(item => {
      if (!item) return;
      const existing = unique.get(item.id);
      if (!existing || item.value >= existing.value) unique.set(item.id, item);
    });
    return [...unique.values()];
  }

  function parseCsv(text, fileName = 'Revolut.csv') {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return { positions: [], rejected: 0, fileName };
    const separators = [';', '\t', ','];
    const separator = separators.sort(
      (left, right) => splitLine(lines[0], right).length - splitLine(lines[0], left).length
    )[0];
    const headers = splitLine(lines[0], separator);
    const columns = {
      symbol: findColumn(headers, ['symbol', 'ticker', 'isin', 'instrument code']),
      name: findColumn(headers, ['asset name', 'instrument name', 'security name', 'name', 'asset', 'instrument']),
      quantity: findColumn(headers, ['quantity', 'qty', 'shares', 'units', 'holdings', 'balance', 'anzahl', 'bestand']),
      price: findColumn(headers, ['market price', 'closing price', 'current price', 'price', 'kurs']),
      value: findColumn(headers, ['market value', 'current value', 'valuation', 'position value', 'value', 'marktwert', 'wert']),
      currency: findColumn(headers, ['valuation currency', 'market value currency', 'currency', 'wahrung']),
      type: findColumn(headers, ['asset type', 'asset class', 'security type', 'product', 'type', 'anlageklasse'])
    };
    if (columns.quantity < 0 || (columns.value < 0 && columns.price < 0) || (columns.name < 0 && columns.symbol < 0)) {
      return { positions: [], rejected: lines.length - 1, fileName };
    }
    let rejected = 0;
    const positions = lines.slice(1).map((line, row) => {
      const values = splitLine(line, separator);
      const read = key => columns[key] >= 0 ? values[columns[key]] : '';
      const item = position({
        symbol: read('symbol'),
        name: read('name'),
        quantity: read('quantity'),
        price: read('price'),
        value: read('value'),
        currency: read('currency'),
        type: read('type')
      }, row);
      if (!item) rejected += 1;
      return item;
    });
    return { positions: mergePositions(positions), rejected, fileName };
  }

  function parseText(text, fileName = 'Revolut.pdf') {
    const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const pattern = /^([A-Z0-9.-]{2,12})\s+(.+?)\s+([0-9][0-9'.,]*)\s+([0-9][0-9'.,]*)\s+([0-9][0-9'.,]*)\s+(CHF|EUR|USD|GBP)$/i;
    let rejected = 0;
    const positions = lines.map((line, row) => {
      const match = line.match(pattern);
      if (!match) return null;
      const item = position({
        symbol: match[1],
        name: match[2],
        quantity: match[3],
        price: match[4],
        value: match[5],
        currency: match[6]
      }, row);
      if (!item) rejected += 1;
      return item;
    });
    return { positions: mergePositions(positions), rejected, fileName };
  }

  function totalsByCurrency(positions) {
    return (positions || []).reduce((totals, item) => {
      const currency = item.currency || 'CHF';
      totals[currency] = (totals[currency] || 0) + Number(item.value || 0);
      return totals;
    }, {});
  }

  root.BudgetQuestRevolutStatementParser = Object.freeze({
    parseCsv,
    parseText,
    parseNumber,
    totalsByCurrency
  });
})(typeof window !== 'undefined' ? window : globalThis);
