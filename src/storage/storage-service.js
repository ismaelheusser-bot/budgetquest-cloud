(function (global) {
  'use strict';

  class StorageService {
    constructor(adapter) {
      if (!adapter) throw new Error('Ein Speicher-Adapter ist erforderlich.');
      this.adapter = adapter;
      this.listeners = new Set();
    }

    get(key, fallback = null) {
      return this.adapter.get(key, fallback);
    }

    set(key, value) {
      const stored = this.adapter.set(key, value);
      this.emit({ type: 'set', key, value: stored });
      return stored;
    }

    remove(key) {
      const result = this.adapter.remove(key);
      this.emit({ type: 'remove', key });
      return result;
    }

    has(key) {
      return this.adapter.has(key);
    }

    export(keys = null) {
      if (!keys) return this.adapter.exportAll();
      return [...keys].reduce((result, key) => {
        if (this.has(key)) result[key] = this.get(key);
        return result;
      }, {});
    }

    exportAll() {
      return this.export();
    }

    subscribe(listener) {
      if (typeof listener !== 'function') {
        throw new Error('Ein Speicher-Listener muss eine Funktion sein.');
      }
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    emit(change) {
      this.listeners.forEach(listener => {
        try {
          listener(change);
        } catch (error) {
          console.warn('BudgetQuest: Speicher-Listener ist fehlgeschlagen.', error);
        }
      });
    }
  }

  global.BudgetQuestStorageService = StorageService;
})(window);
