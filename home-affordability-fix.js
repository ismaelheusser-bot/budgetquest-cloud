(function (global) {
  'use strict';

  const storage = global.budgetQuestStorage;
  const keys = global.BudgetQuestStorageKeys;
  let preparing = false;

  function storedPlan() {
    const value = storage.get(keys.homePlan, {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function ensureHomePlan() {
    const current = global.homePlan;
    if (current && typeof current === 'object' && !Array.isArray(current)) return current;
    const saved = storedPlan();
    global.homePlan = { ...saved };
    return global.homePlan;
  }

  function prepareGrossInput() {
    if (preparing) return;
    const input = document.getElementById('homeGross');
    if (!input) return;
    preparing = true;
    input.readOnly = false;
    input.title = 'Tatsächlichen gemeinsamen Jahresbruttolohn gemäss Lohnausweisen oder Arbeitsverträgen eingeben.';
    input.closest('label')?.classList.remove('auto-value');
    const label = input.closest('label');
    if (label && !label.querySelector('.gross-income-note')) {
      const note = document.createElement('small');
      note.className = 'tiny gross-income-note';
      note.textContent = 'Für die Tragbarkeit zählt der Bruttolohn. Er wird nicht aus den Nettobeträgen des Budgets berechnet.';
      label.appendChild(note);
    }
    preparing = false;
  }

  function installCalculationCorrection() {
    if (typeof global.syncHomeFromBudget !== 'function' || typeof global.renderHome !== 'function') return false;

    global.syncHomeFromBudget = function () {
      const budget = typeof global.settings !== 'undefined' ? global.settings : (storage.get(keys.settings, {}) || {});
      const saved = storedPlan();
      const plan = ensureHomePlan();
      plan.annualGross = Math.max(0, Number(saved.annualGross ?? plan.annualGross ?? 0));
      plan.monthlySaving = Math.max(0, Number(budget?.saving || 0));
      plan.incomeGrowth = Math.max(0, Number(plan.incomeGrowth || 0));
      plan.equity = Math.max(0, Number(plan.equity || 0));
      plan.pillar3aBalance = Math.max(0, Number(plan.pillar3aBalance || 0));
      plan.pillar3aAnnual = Math.max(0, Number(plan.pillar3aAnnual || 0));
      storage.set(keys.homePlan, plan);
    };

    const originalRenderHome = global.renderHome;
    global.renderHome = function () {
      ensureHomePlan();
      originalRenderHome();
      prepareGrossInput();
    };

    const input = document.getElementById('homeGross');
    if (input && !input.dataset.grossFixReady) {
      input.dataset.grossFixReady = '1';
      input.addEventListener('input', () => {
        const value = Math.max(0, Number(input.value || 0));
        const plan = ensureHomePlan();
        plan.annualGross = value;
        storage.set(keys.homePlan, plan);
        global.setTimeout(() => global.renderHome(), 0);
      });
    }

    ensureHomePlan();
    prepareGrossInput();
    return true;
  }

  function start() {
    let attempts = 0;
    const timer = global.setInterval(() => {
      attempts += 1;
      if (installCalculationCorrection() || attempts > 40) global.clearInterval(timer);
    }, 100);

    const observer = new MutationObserver(prepareGrossInput);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['readonly'] });
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', start, { once: true })
    : start();
})(window);
