(function (global) {
  'use strict';

  const storage = global.budgetQuestStorage;
  const keys = global.BudgetQuestStorageKeys;
  let observer = null;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[character]));

  const number = value => Number(value || 0).toLocaleString('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  function positions() {
    const wealth = storage?.get(keys?.wealth, {});
    const list = wealth?.revolut?.positions;
    return Array.isArray(list) ? list.filter(item => Number(item.value) > 0) : [];
  }

  function statementDate() {
    const wealth = storage?.get(keys?.wealth, {});
    return wealth?.revolut?.statementDate || null;
  }

  function totalsByCurrency(list) {
    return list.reduce((totals, item) => {
      const currency = String(item.currency || 'CHF').toUpperCase();
      totals[currency] = (totals[currency] || 0) + Number(item.value || 0);
      return totals;
    }, {});
  }

  function weightsByCurrency(list) {
    const totals = totalsByCurrency(list);
    return list.map(item => {
      const currency = String(item.currency || 'CHF').toUpperCase();
      const total = totals[currency] || 0;
      return { ...item, currency, weight: total ? Number(item.value || 0) / total : 0 };
    });
  }

  function ageInDays(dateValue) {
    if (!dateValue) return null;
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86400000));
  }

  function analyse(list) {
    const weighted = weightsByCurrency(list).sort((a, b) => b.weight - a.weight);
    const depot = list.filter(item => item.category === 'depot');
    const crypto = list.filter(item => item.category === 'crypto');
    const totals = totalsByCurrency(list);
    const depotTotals = totalsByCurrency(depot);
    const cryptoTotals = totalsByCurrency(crypto);
    const currencies = Object.keys(totals);
    const top = weighted[0] || null;
    const concentration = weighted.filter(item => item.weight >= 0.2);
    const staleDays = ageInDays(statementDate());

    let score = 100;
    if (list.length < 3) score -= 28;
    else if (list.length < 6) score -= 14;
    if (top?.weight >= 0.5) score -= 30;
    else if (top?.weight >= 0.35) score -= 20;
    else if (top?.weight >= 0.25) score -= 10;
    if (concentration.length >= 3) score -= 10;
    if (crypto.length && !depot.length) score -= 25;
    if (staleDays !== null && staleDays > 60) score -= 12;
    else if (staleDays !== null && staleDays > 30) score -= 6;
    score = Math.max(0, Math.min(100, score));

    const risk = score >= 80 ? 'eher ausgewogen' : score >= 60 ? 'mittel' : 'erhöht';
    const findings = [];
    const ideas = [];

    if (!list.length) {
      findings.push({ level: 'neutral', title: 'Noch keine Analyse möglich', text: 'Importiere zuerst einen aktuellen Depot- oder Krypto-Auszug.' });
    } else {
      findings.push({
        level: score >= 75 ? 'positive' : score >= 55 ? 'neutral' : 'warning',
        title: `Portfolio-Score ${score}/100`,
        text: `Die regelbasierte Einschätzung bewertet dein Portfolio aktuell als ${risk}.`
      });
    }

    if (top && top.weight >= 0.25) {
      findings.push({
        level: top.weight >= 0.4 ? 'warning' : 'neutral',
        title: 'Klumpenrisiko prüfen',
        text: `${top.symbol || top.name} macht innerhalb der Währung ${top.currency} rund ${Math.round(top.weight * 100)} % aus.`
      });
      ideas.push(`Keine automatische Verkaufsentscheidung treffen, aber die Zielgewichtung von ${top.symbol || top.name} bewusst festlegen.`);
    } else if (list.length >= 4) {
      findings.push({ level: 'positive', title: 'Keine dominante Einzelposition erkannt', text: 'Innerhalb der jeweiligen Währungen liegt keine Position über 25 %.' });
    }

    if (crypto.length) {
      const cryptoCurrencies = Object.keys(cryptoTotals);
      cryptoCurrencies.forEach(currency => {
        const total = totals[currency] || 0;
        const share = total ? (cryptoTotals[currency] || 0) / total : 0;
        if (share >= 0.3) {
          findings.push({ level: 'warning', title: 'Hoher Kryptoanteil', text: `In ${currency} beträgt der Kryptoanteil rund ${Math.round(share * 100)} %.` });
          ideas.push('Prüfen, ob der Kryptoanteil zu deinem maximal akzeptierten Verlust passt.');
        }
      });
    }

    if (currencies.length > 1) {
      findings.push({ level: 'neutral', title: 'Mehrere Währungen', text: `Bestände sind in ${currencies.join(', ')} geführt. Wechselkursschwankungen können die CHF-Gesamtsicht beeinflussen.` });
      ideas.push('Für eine echte Gesamtgewichtung braucht BudgetQuest aktuelle Wechselkurse; bis dahin werden Währungen getrennt beurteilt.');
    }

    if (staleDays !== null && staleDays > 30) {
      findings.push({ level: 'warning', title: 'Auszug aktualisieren', text: `Der importierte Stand ist ungefähr ${staleDays} Tage alt.` });
      ideas.push('Vor einer Anlageentscheidung einen aktuellen Revolut-Auszug importieren.');
    }

    if (list.length < 5 && list.length > 0) {
      ideas.push('Breitere Streuung über einen kostengünstigen, breit diversifizierten ETF prüfen.');
    }
    if (depot.length && !crypto.length) {
      ideas.push('Kein Kryptoanteil erkannt. Das ist kein Nachteil; ein Kryptoanteil ist optional und risikoreich.');
    }
    if (!ideas.length && list.length) {
      ideas.push('Aktuell besteht aus den importierten Bestandsdaten kein offensichtlicher Änderungsdruck.');
    }

    return { score, risk, totals, depotTotals, cryptoTotals, findings, ideas, weighted, staleDays };
  }

  function amountRows(totals, factor) {
    return Object.entries(totals).map(([currency, value]) =>
      `<span><b>${escapeHtml(currency)} ${number(value * factor)}</b></span>`
    ).join('');
  }

  function findingsMarkup(items) {
    return items.map(item => `
      <div class="ai-invest-finding ${escapeHtml(item.level)}">
        <b>${escapeHtml(item.title)}</b>
        <p>${escapeHtml(item.text)}</p>
      </div>
    `).join('');
  }

  function renderPanel() {
    const host = document.getElementById('revolutWealth');
    if (!host || document.getElementById('revolutAiInvest')) return;

    const list = positions();
    const analysis = analyse(list);
    const panel = document.createElement('section');
    panel.id = 'revolutAiInvest';
    panel.className = 'card section ai-invest-card';
    panel.innerHTML = `
      <div class="section-head ai-invest-head">
        <div>
          <div class="eyebrow">Portfolio-Assistent</div>
          <h3>🤖 KI Invest</h3>
          <div class="tiny">Analyse des zuletzt importierten Bestands – ohne erfundene Live-Kurse</div>
        </div>
        <div class="ai-invest-score"><strong>${analysis.score}</strong><span>/100</span><small>Risiko ${escapeHtml(analysis.risk)}</small></div>
      </div>
      <div class="ai-invest-grid">
        <div>
          <h4>Aktuelle Einschätzung</h4>
          <div class="ai-invest-findings">${findingsMarkup(analysis.findings)}</div>
        </div>
        <div>
          <h4>Mögliche nächste Schritte</h4>
          <ol class="ai-invest-ideas">${analysis.ideas.map(idea => `<li>${escapeHtml(idea)}</li>`).join('')}</ol>
        </div>
      </div>
      <div class="ai-invest-scenarios">
        <h4>Was-wäre-wenn-Szenarien</h4>
        <div class="ai-invest-scenario-grid">
          <div><span>Gesamtes Portfolio −10 %</span><div>${amountRows(analysis.totals, 0.9) || '–'}</div></div>
          <div><span>Gesamtes Portfolio −20 %</span><div>${amountRows(analysis.totals, 0.8) || '–'}</div></div>
          <div><span>Krypto −40 %, Depot unverändert</span><div>${Object.keys(analysis.totals).map(currency => {
            const value = (analysis.depotTotals[currency] || 0) + (analysis.cryptoTotals[currency] || 0) * 0.6;
            return `<span><b>${escapeHtml(currency)} ${number(value)}</b></span>`;
          }).join('') || '–'}</div></div>
        </div>
      </div>
      <div class="info-note ai-invest-disclaimer">
        Diese Auswertung ist eine regelbasierte Orientierung und keine persönliche Anlageberatung. Sie kennt noch keine Live-Kurse, Unternehmenszahlen, Steuern oder deine vollständige Risikofähigkeit. Käufe und Verkäufe werden nie automatisch ausgeführt.
      </div>
    `;
    host.appendChild(panel);
  }

  function installStyles() {
    if (document.getElementById('revolutAiInvestStyles')) return;
    const style = document.createElement('style');
    style.id = 'revolutAiInvestStyles';
    style.textContent = `
      .ai-invest-card{display:grid;gap:18px;border-color:#8c7bff55;background:linear-gradient(145deg,#121a31,#0d1628)}
      .ai-invest-head{align-items:center}.ai-invest-head h3{margin:4px 0;font-size:26px}
      .ai-invest-score{display:grid;grid-template-columns:auto auto;align-items:baseline;justify-content:end;min-width:110px}
      .ai-invest-score strong{font-size:38px;color:var(--green)}.ai-invest-score span{color:var(--muted)}.ai-invest-score small{grid-column:1/3;text-align:right;color:var(--muted)}
      .ai-invest-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.ai-invest-grid h4,.ai-invest-scenarios h4{margin:0 0 10px}
      .ai-invest-findings{display:grid;gap:9px}.ai-invest-finding{padding:12px;border:1px solid var(--line);border-radius:13px;background:#0b1425}
      .ai-invest-finding p{margin:5px 0 0;color:var(--muted);font-size:13px;line-height:1.45}.ai-invest-finding.positive{border-color:#5de29a55}.ai-invest-finding.warning{border-color:#ffb35c66}
      .ai-invest-ideas{margin:0;padding-left:22px;display:grid;gap:10px;color:var(--muted);line-height:1.45}
      .ai-invest-scenario-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.ai-invest-scenario-grid>div{padding:12px;border:1px solid var(--line);border-radius:13px;background:#0b1425;display:grid;gap:7px}
      .ai-invest-scenario-grid>div>span{font-size:12px;color:var(--muted)}.ai-invest-scenario-grid>div>div{display:flex;flex-wrap:wrap;gap:7px}
      .ai-invest-disclaimer{font-size:12px;line-height:1.5}
      @media(max-width:760px){.ai-invest-grid,.ai-invest-scenario-grid{grid-template-columns:1fr}.ai-invest-head{align-items:flex-start}.ai-invest-score{justify-content:start}.ai-invest-score small{text-align:left}}
    `;
    document.head.appendChild(style);
  }

  function initialize() {
    installStyles();
    renderPanel();
    const host = document.getElementById('revolutWealth');
    if (!host || observer) return;
    observer = new MutationObserver(() => global.setTimeout(renderPanel, 0));
    observer.observe(host, { childList: true });
  }

  global.BudgetQuestRevolutAiInvest = Object.freeze({ analyse });
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', initialize, { once: true })
    : initialize();
})(window);
