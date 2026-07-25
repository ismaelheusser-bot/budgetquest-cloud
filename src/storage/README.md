# Speicher-Modul

BudgetQuest verwendet künftig `budgetQuestStorage` statt direkter Zugriffe auf `localStorage`.

```js
const settings = budgetQuestStorage.get(BudgetQuestStorageKeys.settings, defaults);
budgetQuestStorage.set(BudgetQuestStorageKeys.settings, settings);
```

Der aktuell aktive Adapter speichert weiterhin lokal. Später wird ein FirebaseAdapter mit derselben Schnittstelle ergänzt.
