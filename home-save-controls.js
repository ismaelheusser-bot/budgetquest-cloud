(function (global) {
  'use strict';

  const storage = global.budgetQuestStorage;
  const keys = global.BudgetQuestStorageKeys;
  if (!storage || !keys) return;

  const numericValue = id => Math.max(0, Number(document.getElementById(id)?.value || 0));

  function persistHomeFields(showConfirmation = false) {
    const current = storage.get(keys.homePlan, {});
    const plan = current && typeof current === 'object' && !Array.isArray(current) ? { ...current } : {};

    const fields = {
      equity: 'homeEquity',
      pillar3aBalance: 'home3aBalance',
      pillar3aAnnual: 'home3aAnnual',
      incomeGrowth: 'homeIncomeGrowth',
      equityShare: 'homeEquityShare',
      affordabilityShare: 'homeAffordability',
      calcInterest: 'homeInterest',
      maintenance: 'homeMaintenance'
    };

    Object.entries(fields).forEach(([key, id]) => {
      const input = document.getElementById(id);
      if (input && !input.readOnly) plan[key] = numericValue(id);
    });

    const mode = document.getElementById('home3aMode');
    if (mode) plan.pillar3aMode = mode.value || 'withdraw';

    storage.set(keys.homePlan, plan);

    if (typeof global.updateHomePlan === 'function') {
      try { global.updateHomePlan({ target: { readOnly: false } }); } catch (_) {}
    }

    const status = document.getElementById('homeSaveStatus');
    if (status) {
      status.textContent = showConfirmation
        ? `Gespeichert · ${new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}`
        : 'Änderungen automatisch gespeichert.';
    }
  }

  function installControls() {
    const home = document.getElementById('home');
    if (!home || document.getElementById('homeSaveControls')) return;

    const firstCard = home.querySelector('.card');
    if (!firstCard) return;

    const box = document.createElement('div');
    box.id = 'homeSaveControls';
    box.className = 'actions section';
    box.innerHTML = '<button class="btn" id="homeSaveButton" type="button">Eigenheim-Daten speichern</button><span class="tiny" id="homeSaveStatus">Änderungen werden automatisch gespeichert.</span>';
    firstCard.appendChild(box);

    document.getElementById('homeSaveButton').addEventListener('click', () => persistHomeFields(true));

    document.querySelectorAll('#home [data-home-input], #home3aMode').forEach(input => {
      if (input.dataset.homeSaveBound === '1') return;
      input.dataset.homeSaveBound = '1';
      input.addEventListener('change', () => persistHomeFields(false));
      input.addEventListener('blur', () => persistHomeFields(false));
    });
  }

  document.addEventListener('pointerdown', event => {
    const navigationTarget = event.target.closest('nav button, .bottom-nav button, [data-view], [data-tab]');
    if (navigationTarget && document.getElementById('home') && !document.getElementById('home').hidden) {
      persistHomeFields(false);
    }
  }, true);

  global.addEventListener('pagehide', () => persistHomeFields(false));
  global.addEventListener('beforeunload', () => persistHomeFields(false));

  const start = () => {
    installControls();
    new MutationObserver(installControls).observe(document.documentElement, { childList: true, subtree: true });
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', start, { once: true })
    : start();
})(window);
