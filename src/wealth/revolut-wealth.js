(function (global) {
  'use strict';

  const storage = global.budgetQuestStorage;
  const keys = global.BudgetQuestStorageKeys;
  const parser = global.BudgetQuestRevolutStatementParser;
  const pdfVersion = '4.10.38';
  let pending = [];
  let pendingFiles = [];
  let pendingStatementDates = [];

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[character]));

  const number = value => Number(value || 0).toLocaleString('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  function current() {
    const wealth = storage.get(keys.wealth, {});
    return wealth && typeof wealth === 'object' ? wealth.revolut || null : null;
  }

  function totalsMarkup(positions) {
    const totals = parser.totalsByCurrency(positions);
    const entries = Object.entries(totals);
    if (!entries.length) return '<strong>Keine Bestände</strong>';
    return entries.map(([currency, value]) => `<strong>${escapeHtml(currency)} ${number(value)}</strong>`).join('<span> · </span>');
  }

  function positionsMarkup(positions) {
    if (!positions.length) return '<div class="empty">Noch kein Revolut-Depot oder Kryptobestand importiert.</div>';
    return positions.map(item => `
      <div class="revolut-position">
        <span class="revolut-asset-icon">${item.category === 'crypto' ? '₿' : '📈'}</span>
        <div>
          <b>${escapeHtml(item.symbol || item.name)}</b>
          <small>${escapeHtml(item.name)} · ${Number(item.quantity).toLocaleString('de-CH', { maximumFractionDigits: 8 })}</small>
        </div>
        <strong>${escapeHtml(item.currency)} ${number(item.value)}</strong>
      </div>
    `).join('');
  }

  function render() {
    const section = document.getElementById('revolutWealth');
    if (!section) return;
    const data = current();
    const positions = Array.isArray(data?.positions) ? data.positions : [];
    const depot = positions.filter(item => item.category === 'depot');
    const crypto = positions.filter(item => item.category === 'crypto');
    section.innerHTML = `
      <div class="card revolut-wealth-card">
        <div class="section-head">
          <div><h3>Revolut Vermögen</h3><div class="tiny">Nur Depot und Krypto – keine Kontobuchungen</div></div>
          <button class="btn secondary" type="button" onclick="budgetQuestOpenRevolutImport()">Auszug importieren</button>
        </div>
        <div class="revolut-total">${totalsMarkup(positions)}</div>
        <div class="revolut-groups">
          <div><span>📈 Depot</span><b>${depot.length} Positionen</b></div>
          <div><span>₿ Krypto</span><b>${crypto.length} Positionen</b></div>
          <div><span>Stand</span><b>${data?.statementDate ? new Date(data.statementDate).toLocaleDateString('de-CH') : '–'}</b></div>
        </div>
        <div class="revolut-position-list">${positionsMarkup(positions)}</div>
      </div>
    `;
  }

  function ensureUi() {
    const today = document.getElementById('today');
    if (today && !document.getElementById('revolutWealth')) {
      const section = document.createElement('section');
      section.id = 'revolutWealth';
      section.className = 'section';
      today.querySelector('.hero')?.after(section);
    }
    if (!document.getElementById('revolutImportDialog')) {
      const dialog = document.createElement('dialog');
      dialog.id = 'revolutImportDialog';
      dialog.innerHTML = `
        <div class="section-head">
          <div><h2>Revolut Depot & Krypto</h2><div class="tiny">Aktuellen Bestandsauszug importieren</div></div>
          <button class="icon-btn" type="button" onclick="document.getElementById('revolutImportDialog').close()">✕</button>
        </div>
        <p class="tiny">BudgetQuest liest ausschliesslich Vermögenspositionen. Zahlungs-, Karten- und Girokontobuchungen werden nicht übernommen.</p>
        <label class="dropzone">PDF oder CSV auswählen
          <input id="revolutWealthFiles" type="file" accept=".pdf,.csv,application/pdf,text/csv" multiple>
        </label>
        <div id="revolutImportStatus" class="status">Noch kein Auszug ausgewählt.</div>
        <div id="revolutImportReview"></div>
        <div class="actions">
          <button id="revolutSaveImport" class="btn" type="button" disabled>Geprüfte Bestände übernehmen</button>
          <button class="btn secondary" type="button" onclick="document.getElementById('revolutImportDialog').close()">Abbrechen</button>
        </div>
      `;
      document.body.appendChild(dialog);
      dialog.querySelector('#revolutWealthFiles').onchange = event => readFiles(event.target.files);
      dialog.querySelector('#revolutSaveImport').onclick = savePending;
    }
    render();
  }

  async function pdfText(file) {
    const module = await import(`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfVersion}/pdf.min.mjs`);
    module.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfVersion}/pdf.worker.min.mjs`;
    const pdf = await module.getDocument({ data: await file.arrayBuffer() }).promise;
    const lines = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const rows = new Map();
      content.items.forEach(item => {
        const y = Math.round(item.transform?.[5] || 0);
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y).push({ x: item.transform?.[4] || 0, value: item.str });
      });
      [...rows.entries()].sort((left, right) => right[0] - left[0]).forEach(([, items]) => {
        lines.push(items.sort((left, right) => left.x - right.x).map(item => item.value).join(' '));
      });
    }
    return lines.join('\n');
  }

  function renderReview() {
    const review = document.getElementById('revolutImportReview');
    const save = document.getElementById('revolutSaveImport');
    if (!pending.length) {
      review.innerHTML = '';
      save.disabled = true;
      return;
    }
    review.innerHTML = `
      <h3>Bitte prüfen</h3>
      <div class="revolut-review-list">${pending.map((item, index) => `
        <label class="revolut-review-row">
          <input type="checkbox" data-revolut-position="${index}" checked>
          <span><b>${escapeHtml(item.symbol || item.name)}</b><small>${escapeHtml(item.category === 'crypto' ? 'Krypto' : 'Depot')} · ${Number(item.quantity).toLocaleString('de-CH', { maximumFractionDigits: 8 })}</small></span>
          <strong>${escapeHtml(item.currency)} ${number(item.value)}</strong>
        </label>
      `).join('')}</div>
      <div class="info-note">Es werden nur markierte Positionen gespeichert. Der bisherige Revolut-Bestand wird erst nach deiner Bestätigung ersetzt.</div>
    `;
    save.disabled = false;
  }

  async function readFiles(files) {
    const status = document.getElementById('revolutImportStatus');
    pending = [];
    pendingFiles = [];
    pendingStatementDates = [];
    let transactionHistoryDetected = false;
    status.textContent = 'Auszüge werden gelesen …';
    try {
      for (const file of Array.from(files || [])) {
        const result = /\.pdf$/i.test(file.name) || file.type === 'application/pdf'
          ? parser.parseText(await pdfText(file), file.name)
          : parser.parseCsv(await file.text(), file.name);
        pending.push(...result.positions);
        pendingFiles.push(file.name);
        if (result.statementDate) pendingStatementDates.push(result.statementDate);
        if (result.kind === 'transaction_history') transactionHistoryDetected = true;
      }
      const unique = new Map(pending.map(item => [item.id, item]));
      pending = [...unique.values()];
      status.textContent = pending.length
        ? `${pending.length} aktuelle Depot-/Kryptopositionen erkannt.`
        : transactionHistoryDetected
          ? 'Transaktionshistorie erkannt. Sie enthält vergangene Ausführungskurse, aber keine aktuellen Marktwerte und wird deshalb nicht als aktueller Bestand übernommen.'
          : 'Keine sicheren Bestandspositionen erkannt. Bitte einen aktuellen Depot- oder Krypto-Auszug verwenden.';
    } catch (error) {
      console.warn('Revolut-Vermögensimport:', error);
      status.textContent = 'Auszug konnte nicht gelesen werden. Deine bestehenden Daten wurden nicht verändert.';
      pending = [];
    }
    renderReview();
  }

  function savePending() {
    const selected = [...document.querySelectorAll('[data-revolut-position]:checked')]
      .map(input => pending[Number(input.dataset.revolutPosition)])
      .filter(Boolean);
    if (!selected.length) return;
    if (!global.confirm(`${selected.length} geprüfte Revolut-Positionen übernehmen und den bisherigen Revolut-Bestand ersetzen?`)) return;
    const wealth = storage.get(keys.wealth, {});
    const next = wealth && typeof wealth === 'object' ? { ...wealth } : {};
    next.revolut = {
      positions: selected,
      statementDate: pendingStatementDates.sort().at(-1) || new Date().toISOString(),
      sourceFiles: pendingFiles
    };
    storage.set(keys.wealth, next);
    pending = [];
    pendingFiles = [];
    pendingStatementDates = [];
    document.getElementById('revolutImportDialog').close();
    render();
  }

  global.budgetQuestOpenRevolutImport = () => {
    ensureUi();
    document.getElementById('revolutImportDialog').showModal();
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', ensureUi)
    : ensureUi();
})(window);
