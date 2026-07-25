(function (global) {
  'use strict';

  class LocalStorageAdapter {
    constructor(storage = global.localStorage, prefix = '') {
      this.storage = storage;
      this.prefix = prefix;
    }

    key(key) {
      return `${this.prefix}${key}`;
    }

    get(key, fallback = null) {
      try {
        const raw = this.storage.getItem(this.key(key));
        if (raw === null) return fallback;
        return JSON.parse(raw);
      } catch (error) {
        console.warn(`BudgetQuest: Speicherwert ${key} konnte nicht gelesen werden.`, error);
        return fallback;
      }
    }

    set(key, value) {
      this.storage.setItem(this.key(key), JSON.stringify(value));
      return value;
    }

    remove(key) {
      this.storage.removeItem(this.key(key));
    }

    has(key) {
      return this.storage.getItem(this.key(key)) !== null;
    }

    exportAll() {
      const result = {};
      for (let index = 0; index < this.storage.length; index += 1) {
        const storageKey = this.storage.key(index);
        if (!storageKey || !storageKey.startsWith(this.prefix)) continue;
        const logicalKey = storageKey.slice(this.prefix.length);
        result[logicalKey] = this.get(logicalKey);
      }
      return result;
    }
  }

  global.BudgetQuestLocalStorageAdapter = LocalStorageAdapter;
})(window);
