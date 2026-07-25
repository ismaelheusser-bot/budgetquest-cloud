(function (global) {
  'use strict';

  class StorageService {
    constructor(adapter) {
      if (!adapter) throw new Error('Ein Speicher-Adapter ist erforderlich.');
      this.adapter = adapter;
    }

    get(key, fallback = null) {
      return this.adapter.get(key, fallback);
    }

    set(key, value) {
      return this.adapter.set(key, value);
    }

    remove(key) {
      return this.adapter.remove(key);
    }

    has(key) {
      return this.adapter.has(key);
    }

    exportAll() {
      return this.adapter.exportAll();
    }
  }

  global.BudgetQuestStorageService = StorageService;
})(window);
