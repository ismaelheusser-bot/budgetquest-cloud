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
    if (!positions.length) return '<div class="empty">Noch keine Positionen importiert.</div>';
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
    const statementDate = data?.statementDate
      ? new Date(`${String(data.statementDate).slice(0, 10)}T12:00:00`).toLocaleDateString('de-CH')
      : '–';
    section.innerHTML = `
      <div class="section-head revolut-page-head">
        <div><div class="eyebrow">Vermögen</div><h2>Revolut</h2><div class="tiny">Depot und Krypto auf einer eigenen Seite</div></div>
        <button class="btn" type="button" onclick="budgetQuestOpenRevolutImport()">PDF-Auszug aktualisieren</button>
      </div>
      <div class="revolut-page-hero section">
        <div><span>Aktueller Bestand</span><div class="revolut-total">${totalsMarkup(positions)}</div><small>Summen bewusst nach Währung getrennt</small></div>
        <div class="revolut-page-mark">R</div>
      </div>
      <div class="revolut-groups section">
        <div><span>📈 Depot</span><b>${depot.length} Positionen</b></div>
        <div><span>₿ Krypto</span><b>${crypto.length} Positionen</b></div>
        <div><span>Stand des Auszugs</span><b>${statementDate}</b></div>
      </div>
      <div class="revolut-section-grid section">
        <div class="card revolut-wealth-card">
          <div class="section-head">
            <div><h3>📈 Aktien & ETF</h3><div class="tiny">${depot.length ? 'Aktueller Revolut-Depotauszug' : 'Noch kein Depotauszug importiert'}</div></div>
            <div class="revolut-section-total">${totalsMarkup(depot)}</div>
          </div>
          <div class="revolut-position-list">${positionsMarkup(depot)}</div>
        </div>
        <div class="card revolut-wealth-card">
          <div class="section-head">
            <div><h3>₿ Krypto</h3><div class="tiny">${crypto.length ? 'Aktueller Revolut-Kryptobestand' : 'Für den späteren Krypto-Auszug vorbereitet'}</div></div>
            <div class="revolut-section-total">${totalsMarkup(crypto)}</div>
          </div>
          ${crypto.length
            ? `<div class="revolut-position-list">${positionsMarkup(crypto)}</div>`
            : '<div class="revolut-crypto-empty"><span>₿</span><b>Krypto folgt später</b><p>Dein Depot bleibt beim späteren Krypto-Import erhalten.</p><button class="btn secondary" type="button" onclick="budgetQuestOpenRevolutImport()">Krypto-Auszug hinzufügen</button></div>'}
        </div>
      </div>
      <div class="info-note section">BudgetQuest übernimmt auf dieser Seite nur Depot- und Kryptobestände. Konto-, Karten- und Zahlungsbuchungen bleiben ausgeschlossen.</div>
    `;
    renderDashboardEntry(positions, statementDate);
  }

  function renderDashboardEntry(positions, statementDate) {
    const entry = document.getElementById('revolutDashboardEntry');
    if (!entry) return;
    entry.innerHTML = `
      <button type="button" class="card revolut-dashboard-button" onclick="budgetQuestOpenRevolutPage()">
        <span class="revolut-dashboard-icon">R</span>
        <span><b>Revolut Vermögen</b><small>${positions.length ? `${positions.length} Positionen · Stand ${statementDate}` : 'Depot und Krypto verwalten'}</small></span>
        <span class="revolut-dashboard-values">${positions.length ? totalsMarkup(positions) : 'Öffnen ›'}</span>
      </button>
    `;
  }

  function ensureUi() {
    const today = document.getElementById('today');
    if (today && !document.getElementById('revolutDashboardEntry')) {
      const section = document.createElement('section');
      section.id = 'revolutDashboardEntry';
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
      <div class="info-note">Es werden nur markierte Positionen gespeichert. Ein Depot-Auszug aktualisiert nur das Depot; vorhandene Krypto-Daten bleiben erhalten – und umgekehrt.</div>
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
    const importedCategories = new Set(selected.map(item => item.category));
    const categoryLabel = [...importedCategories].map(category => category === 'crypto' ? 'Krypto' : 'Depot').join(' und ');
    if (!global.confirm(`${selected.length} geprüfte ${categoryLabel}-Positionen übernehmen und diesen Bereich aktualisieren?`)) return;
    const wealth = storage.get(keys.wealth, {});
    const next = wealth && typeof wealth === 'object' ? { ...wealth } : {};
    const existingPositions = Array.isArray(next.revolut?.positions) ? next.revolut.positions : [];
    const retainedPositions = existingPositions.filter(item => !importedCategories.has(item.category));
    next.revolut = {
      positions: [...retainedPositions, ...selected],
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

  global.budgetQuestOpenRevolutPage = () => {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.querySelectorAll('.nav button').forEach(button => button.classList.toggle('active', button.dataset.target === 'revolut'));
    document.getElementById('revolut')?.classList.add('active');
    global.scrollTo({ top: 0, behavior: 'smooth' });
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', ensureUi)
    : ensureUi();
})(window);
