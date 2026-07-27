(function (global) {
  'use strict';

  const storage = global.budgetQuestStorage;
  const keys = global.BudgetQuestStorageKeys;
  if (!storage || !keys) return;

  const getPlan = () => {
    const value = storage.get(keys.homePlan, {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  };

  function addExplanation(input) {
    const label = input.closest('label');
    if (!label || label.querySelector('.gross-income-bank-note')) return;
    const note = document.createElement('small');
    note.className = 'tiny gross-income-bank-note';
    note.innerHTML = '<strong>Für die Hypothek:</strong> gemeinsames Bruttojahreseinkommen gemäss Lohnausweisen oder Arbeitsverträgen. Die Nettolöhne aus dem Budget werden hier nicht verwendet.';
    label.appendChild(note);
  }

  function updateState(input) {
    const plan = getPlan();
    const confirmed = plan.grossIncomeSource === 'manual';
    input.readOnly = false;
    input.required = true;
    input.placeholder = 'Gemeinsamer Bruttojahreslohn';
    input.title = 'Gemeinsames Bruttojahreseinkommen für die Bank-Tragbarkeitsrechnung eingeben.';
    input.closest('label')?.classList.remove('auto-value');
    addExplanation(input);

    if (!confirmed && input.dataset.grossIncomeSeparated !== '1') {
      input.value = '';
      plan.annualGross = 0;
      plan.grossIncomeSource = 'unconfirmed';
      storage.set(keys.homePlan, plan);
      input.dataset.grossIncomeSeparated = '1';
    }

    if (input.dataset.grossIncomeListener === '1') return;
    input.dataset.grossIncomeListener = '1';
    input.addEventListener('input', () => {
      const next = getPlan();
      next.annualGross = Math.max(0, Number(input.value || 0));
      next.grossIncomeSource = next.annualGross > 0 ? 'manual' : 'unconfirmed';
      storage.set(keys.homePlan, next);
      global.setTimeout(() => global.budgetQuestRenderHomeProjection?.(), 0);
    });
  }

  function apply() {
    const input = document.getElementById('homeGross');
    if (!input) return;
    updateState(input);
  }

  const start = () => {
    apply();
    new MutationObserver(apply).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['readonly', 'value']
    });
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', start, { once: true })
    : start();
})(window);
