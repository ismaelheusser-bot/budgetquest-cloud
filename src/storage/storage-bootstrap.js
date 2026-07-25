(function (global) {
  'use strict';

  if (!global.BudgetQuestStorageService || !global.BudgetQuestLocalStorageAdapter) {
    throw new Error('BudgetQuest-Speicher konnte nicht initialisiert werden.');
  }

  const adapter = new global.BudgetQuestLocalStorageAdapter(global.localStorage);
  global.budgetQuestStorage = new global.BudgetQuestStorageService(adapter);

  global.BudgetQuestStorageKeys = Object.freeze({
    settings: 'bq_settings',
    budgets: 'bq_budgets',
    transactions: 'bq_tx',
    household: 'bq_household',
    experience: 'bq_xp'
  });
})(window);
