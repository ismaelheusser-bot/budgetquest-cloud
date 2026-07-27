(function (global) {
  'use strict';

  const storage = global.budgetQuestStorage;
  const keys = global.BudgetQuestStorageKeys;
  if (!storage || !keys) return;

  const money = value => 'CHF ' + Math.round(Number(value || 0)).toLocaleString('de-CH');
  const millions = value => (Number(value || 0) / 1000000).toLocaleString('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' Mio.';
  const numberValue = (id, fallback = 0) => {
    const element = document.getElementById(id);
    const value = element ? Number(element.value) : Number(fallback);
    return Number.isFinite(value) ? value : Number(fallback || 0);
  };
  const objectValue = key => {
    const value = storage.get(key, {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  };

  function plan() {
    const saved = objectValue(keys.homePlan);
    const budget = objectValue(keys.settings);
    const activeSaving = Math.max(0, Number(storage.get(keys.activeSavingsMonthly, 0) || 0));
    const committed = (storage.get(keys.homeSavingsMode, null) || 'simulate') === 'committed';
    return {
      equity: Math.max(0, numberValue('homeEquity', saved.equity || 0)),
      annualGross: Math.max(0, numberValue('homeGross', saved.annualGross || 0)),
      monthlySaving: Math.max(0, Number(budget.saving ?? saved.monthlySaving ?? 0)),
      additionalMonthlySaving: committed ? activeSaving : 0,
      pillar3aBalance: Math.max(0, numberValue('home3aBalance', saved.pillar3aBalance || 0)),
      pillar3aAnnual: Math.max(0, numberValue('home3aAnnual', saved.pillar3aAnnual || 0)),
      pillar3aMode: document.getElementById('home3aMode')?.value || saved.pillar3aMode || 'withdraw',
      incomeGrowth: Math.max(0, numberValue('homeIncomeGrowth', saved.incomeGrowth || 0)),
      equityShare: Math.max(1, numberValue('homeEquityShare', saved.equityShare || 20)),
      affordabilityShare: Math.max(0, numberValue('homeAffordability', saved.affordabilityShare || 33)),
      calcInterest: Math.max(0, numberValue('homeInterest', saved.calcInterest || 5)),
      maintenance: Math.max(0, numberValue('homeMaintenance', saved.maintenance || 1)),
      amortizationYears: Math.max(1, Number(saved.amortizationYears || 15))
    };
  }

  function financingAtPrice(price, equity, p) {
    const mortgage = Math.max(0, price - equity);
    const firstMortgageLimit = price * (2 / 3);
    const secondMortgage = Math.max(0, mortgage - firstMortgageLimit);
    const interestCost = mortgage * (p.calcInterest / 100);
    const maintenanceCost = price * (p.maintenance / 100);
    const amortizationCost = secondMortgage / p.amortizationYears;
    const annualCost = interestCost + maintenanceCost + amortizationCost;
    return { mortgage, firstMortgageLimit, secondMortgage, interestCost, maintenanceCost, amortizationCost, annualCost };
  }

  function calculate(years) {
    const p = plan();
    const duration = Math.max(0, Number(years || 0));
    const effectiveMonthlySaving = p.monthlySaving + p.additionalMonthlySaving;
    const savedCapital = effectiveMonthlySaving * 12 * duration;
    const cashEquity = p.equity + savedCapital;
    const pillar3a = p.pillar3aBalance + p.pillar3aAnnual * duration;
    const usable3a = p.pillar3aMode === 'withdraw' ? pillar3a : 0;
    const equity = cashEquity + usable3a;
    const income = p.annualGross * Math.pow(1 + p.incomeGrowth / 100, duration);
    const minimumEquityShare = p.equityShare / 100;
    const equityLimit = minimumEquityShare > 0 ? equity / minimumEquityShare : 0;
    const maxAnnualHousingCost = income * (p.affordabilityShare / 100);

    let low = 0;
    let high = Math.max(0, equityLimit);
    for (let i = 0; i < 80; i += 1) {
      const middle = (low + high) / 2;
      const costs = financingAtPrice(middle, equity, p);
      if (costs.annualCost <= maxAnnualHousingCost) low = middle;
      else high = middle;
    }

    const affordabilityLimit = low;
    const price = Math.max(0, Math.min(equityLimit, affordabilityLimit));
    const financing = financingAtPrice(price, equity, p);
    const limiter = equityLimit <= affordabilityLimit + 1 ? 'Eigenkapital' : 'Tragbarkeit';

    return {
      years: duration,
      effectiveMonthlySaving,
      savedCapital,
      cashEquity,
      pillar3a,
      usable3a,
      equity,
      income,
      minimumEquityShare,
      equityLimit,
      maxAnnualHousingCost,
      affordabilityLimit,
      price,
      limiter,
      ...financing,
      calcInterest: p.calcInterest,
      maintenance: p.maintenance,
      affordabilityShare: p.affordabilityShare,
      amortizationYears: p.amortizationYears
    };
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function persistGross() {
    const input = document.getElementById('homeGross');
    if (!input) return;
    input.readOnly = false;
    input.title = 'Tatsächlichen gemeinsamen Jahresbruttolohn eingeben.';
    input.closest('label')?.classList.remove('auto-value');
    if (input.dataset.yearProjectionReady) return;
    input.dataset.yearProjectionReady = '1';
    input.addEventListener('input', () => {
      const saved = objectValue(keys.homePlan);
      saved.annualGross = Math.max(0, Number(input.value || 0));
      storage.set(keys.homePlan, saved);
      render();
    });
  }

  function ensureDialog() {
    let dialog = document.getElementById('homeBankCalculationDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'homeBankCalculationDialog';
    dialog.innerHTML = '<div class="section-head"><div><h2 id="homeBankCalcTitle">Berechnung</h2><div class="tiny">Berechnung nach üblicher Schweizer Banklogik</div></div><button class="icon-btn" type="button" data-home-bank-close>✕</button></div><div id="homeBankCalcContent" class="section"></div><button class="btn secondary wide" type="button" data-home-bank-close>Schliessen</button>';
    document.body.appendChild(dialog);
    dialog.querySelectorAll('[data-home-bank-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
    return dialog;
  }

  function calculationRow(label, value, strong = false) {
    return `<div class="limit-row"><span>${label}</span><${strong ? 'strong' : 'b'}>${value}</${strong ? 'strong' : 'b'}></div>`;
  }

  function showCalculation(years) {
    const result = calculate(years);
    const dialog = ensureDialog();
    const when = years === 0 ? 'Heute' : `In ${years} Jahren`;
    dialog.querySelector('#homeBankCalcTitle').textContent = `${when}: ${money(result.price)}`;
    dialog.querySelector('#homeBankCalcContent').innerHTML = `
      <div class="card"><h3>1. Eigenmittel</h3>
        ${calculationRow('Freies Eigenkapital', money(result.cashEquity))}
        ${calculationRow('Anrechenbare Säule 3a', money(result.usable3a))}
        ${calculationRow('Eigenmittel total', money(result.equity), true)}
        ${calculationRow(`Maximaler Kaufpreis bei ${Math.round(result.minimumEquityShare * 100)} % Mindest-Eigenmitteln`, money(result.equityLimit), true)}
      </div>
      <div class="card section"><h3>2. Finanzierung beim berechneten Kaufpreis</h3>
        ${calculationRow('Kaufpreis', money(result.price), true)}
        ${calculationRow('Benötigte Hypothek', money(result.mortgage), true)}
        ${calculationRow('Davon zweite Hypothek', money(result.secondMortgage))}
      </div>
      <div class="card section"><h3>3. Tragbarkeitskosten pro Jahr</h3>
        ${calculationRow(`Kalkulatorischer Zins (${result.calcInterest} % der Hypothek)`, money(result.interestCost))}
        ${calculationRow(`Unterhalt/Nebenkosten (${result.maintenance} % des Kaufpreises)`, money(result.maintenanceCost))}
        ${calculationRow(`Amortisation zweite Hypothek / ${result.amortizationYears} Jahre`, money(result.amortizationCost))}
        ${calculationRow('Kalkulatorische Wohnkosten total', money(result.annualCost), true)}
        ${calculationRow(`Maximal erlaubt (${result.affordabilityShare} % von ${money(result.income)})`, money(result.maxAnnualHousingCost), true)}
      </div>
      <div class="card section"><h3>4. Ergebnis</h3>
        ${calculationRow('Grenze durch Eigenmittel', money(result.equityLimit))}
        ${calculationRow('Grenze durch Tragbarkeit', money(result.affordabilityLimit))}
        ${calculationRow(`Möglicher Kaufpreis · ${result.limiter}`, money(result.price), true)}
      </div>`;
    dialog.showModal();
  }

  function bindCalculationButtons() {
    const years = [0, 2, 3];
    document.querySelectorAll('#home .home-year').forEach((card, index) => {
      const button = card.querySelector('.home-calc-btn');
      if (!button) return;
      button.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        showCalculation(years[index] ?? 0);
      };
    });
  }

  function render() {
    persistGross();
    const rows = [calculate(0), calculate(2), calculate(3)];
    rows.forEach((result, index) => {
      const suffix = index === 0 ? 'Now' : index === 1 ? '2' : '3';
      setText('homePrice' + suffix, millions(result.price));
      setText('homeEquity' + suffix, money(result.equity));
      setText('home3a' + suffix, money(result.pillar3a));
      setText('homeLimit' + suffix, result.limiter);
    });

    const today = rows[0];
    const inThreeYears = rows[2];
    setText('homeHeroPrice', millions(today.price));
    setText('homeHeroSub', `Heute möglich · begrenzt durch ${today.limiter.toLowerCase()}`);
    setText('homeGrowthText', `Der mögliche Kaufpreis steigt in drei Jahren um ${money(Math.max(0, inThreeYears.price - today.price))}, weil zusätzliche Eigenmittel die benötigte Hypothek und damit die Tragbarkeitskosten senken.`);
    setText('homeEquityLimit', millions(today.equityLimit));
    setText('homeAffordabilityLimit', millions(today.affordabilityLimit));
    bindCalculationButtons();
  }

  global.budgetQuestCalculateHomeAt = calculate;
  global.budgetQuestRenderHomeProjection = render;
  global.budgetQuestShowHomeCalculation = showCalculation;

  const start = () => {
    render();
    document.querySelectorAll('[data-home-input], #home3aMode').forEach(element => {
      if (element.dataset.yearProjectionListener) return;
      element.dataset.yearProjectionListener = '1';
      element.addEventListener('input', () => global.setTimeout(render, 0));
      element.addEventListener('change', () => global.setTimeout(render, 0));
    });
    new MutationObserver(() => global.setTimeout(render, 0)).observe(document.body, { childList: true, subtree: true });
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', start, { once: true })
    : start();
})(window);