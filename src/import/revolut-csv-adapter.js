(function (root) {
  'use strict';

  function normaliseHeader(value) {
    return String(value || '')
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');
  }

  function findColumn(headers, names) {
    const wanted = names.map(normaliseHeader);
    return headers.findIndex(header => wanted.includes(normaliseHeader(header)));
  }

  function detect(headers) {
    const normalised = headers.map(normaliseHeader);
    const hasDescription = normalised.includes('description');
    const hasAmount = normalised.includes('amount');
    const hasRevolutDate = normalised.includes('completed date') || normalised.includes('started date');
    const hasRevolutMarker = normalised.includes('product') || normalised.includes('state') || normalised.includes('fee');
    return hasDescription && hasAmount && hasRevolutDate && hasRevolutMarker;
  }

  function parseDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const swissDate = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})(?:\s+.*)?$/);
    const isoValue = swissDate
      ? `${swissDate[3].length === 2 ? '20' + swissDate[3] : swissDate[3]}-${swissDate[2].padStart(2, '0')}-${swissDate[1].padStart(2, '0')}`
      : raw;
    const date = new Date(isoValue);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  function isCompleted(state) {
    const value = normaliseHeader(state);
    return !value || ['completed', 'complete', 'abgeschlossen'].includes(value);
  }

  function parse(headers, records, options) {
    const parseAmount = options.parseAmount;
    const fileName = options.fileName || 'Revolut.csv';
    const index = {
      type: findColumn(headers, ['type', 'transaction type']),
      product: findColumn(headers, ['product', 'account']),
      startedDate: findColumn(headers, ['started date']),
      completedDate: findColumn(headers, ['completed date', 'date']),
      description: findColumn(headers, ['description', 'merchant']),
      amount: findColumn(headers, ['amount']),
      fee: findColumn(headers, ['fee']),
      currency: findColumn(headers, ['currency']),
      state: findColumn(headers, ['state', 'status'])
    };

    let ignored = 0;
    let ignoredForeignCurrency = 0;
    const rows = records.map((columns, rowIndex) => {
      const state = index.state >= 0 ? columns[index.state] : '';
      if (!isCompleted(state)) {
        ignored += 1;
        return null;
      }

      const rawAmount = parseAmount(columns[index.amount]);
      const completedDate = index.completedDate >= 0 ? columns[index.completedDate] : '';
      const startedDate = index.startedDate >= 0 ? columns[index.startedDate] : '';
      const date = parseDate(completedDate || startedDate);
      if (!Number.isFinite(rawAmount) || rawAmount === 0 || !date) {
        ignored += 1;
        return null;
      }

      const type = index.type >= 0 ? String(columns[index.type] || '').trim() : '';
      const description = index.description >= 0 ? String(columns[index.description] || '').trim() : '';
      const product = index.product >= 0 ? String(columns[index.product] || '').trim() : '';
      const currency = index.currency >= 0 ? String(columns[index.currency] || '').trim().toUpperCase() : '';
      const fee = index.fee >= 0 ? parseAmount(columns[index.fee]) : 0;
      if (currency && currency !== 'CHF') {
        ignored += 1;
        ignoredForeignCurrency += 1;
        return null;
      }

      return {
        title: description || type || 'Revolut-Buchung',
        rawAmount,
        date,
        bank: 'Revolut',
        bankType: type,
        account: product,
        currency,
        fee: Number.isFinite(fee) ? Math.abs(fee) : 0,
        state: state || 'COMPLETED',
        source: 'revolut_csv',
        file: fileName,
        row: rowIndex
      };
    }).filter(Boolean);

    return {
      rows,
      summary: {
        provider: 'Revolut',
        accepted: rows.length,
        ignored,
        ignoredForeignCurrency
      }
    };
  }

  root.BudgetQuestRevolutCsvAdapter = Object.freeze({
    detect,
    parse
  });
})(typeof window !== 'undefined' ? window : globalThis);
