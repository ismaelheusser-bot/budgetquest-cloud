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
    experience: 'bq_xp',
    setupComplete: 'bq_setup_done',
    savingsAssistant: 'bq_savings_assistant',
    savingsActive: 'bq_savings_active',
    activeSavingsMonthly: 'bq_active_savings_monthly',
    privateSchoolMonthly: 'bq_private_school_monthly',
    homePlan: 'bq_home_plan',
    homeSavingsMode: 'bq_home_savings_mode',
    incomePlan: 'bq_income_plan_v1',
    bonusRiskFactor: 'bq_bonus_risk_factor',
    budgetStart: 'bq_budget_start'
  });
})(window);
