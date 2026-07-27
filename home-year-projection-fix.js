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
  const objectValue = (key) => {
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
    const equityShare = p.equityShare / 100;
    const mortgageShare = Math.max(0, 1 - equityShare);
    const equityLimit = equity / equityShare;
    const secondMortgageShare = Math.max(0, mortgageShare - 2 / 3);
    const amortizationRate = secondMortgageShare / p.amortizationYears;
    const annualCostRate = mortgageShare * (p.calcInterest / 100) + (p.maintenance / 100) + amortizationRate;
    const affordabilityLimit = annualCostRate > 0
      ? income * (p.affordabilityShare / 100) / annualCostRate
      : 0;
    const price = Math.max(0, Math.min(equityLimit, affordabilityLimit));
    return {
      years: duration,
      equity,
      pillar3a,
      income,
      equityLimit,
      affordabilityLimit,
      price,
      limiter: equityLimit < affordabilityLimit ? 'Eigenkapital' : 'Tragbarkeit'
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
    setText('homeGrowthText', inThreeYears.price > today.price
      ? `Der mögliche Kaufpreis steigt in drei Jahren um ${money(inThreeYears.price - today.price)}.`
      : `Der Kaufpreis bleibt trotz wachsender Eigenmittel gleich, weil aktuell die ${today.limiter.toLowerCase()} begrenzt.`);
    setText('homeEquityLimit', millions(today.equityLimit));
    setText('homeAffordabilityLimit', millions(today.affordabilityLimit));
  }

  global.budgetQuestCalculateHomeAt = calculate;
  global.budgetQuestRenderHomeProjection = render;

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
