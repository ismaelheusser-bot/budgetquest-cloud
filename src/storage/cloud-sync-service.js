(function (global) {
  'use strict';

  class CloudSyncService {
    constructor({ storage, adapter, keys, onError = console.error }) {
      if (!storage || typeof storage.subscribe !== 'function') {
        throw new Error('Ein abonnierbarer StorageService ist erforderlich.');
      }
      if (!adapter) throw new Error('Ein Cloud-Adapter ist erforderlich.');
      this.storage = storage;
      this.adapter = adapter;
      this.keys = new Set(keys || []);
      this.onError = onError;
      this.applyingRemote = false;
      this.unsubscribeLocal = null;
      this.unsubscribeRemote = null;
    }

    async start(context) {
      this.stop();
      await this.adapter.connect(context);

      const snapshot = this.normalize(await this.adapter.pullAll());
      if (Object.keys(snapshot.values).length) {
        this.applySnapshot(snapshot);
      } else {
        await this.adapter.replaceAll(this.storage.export(this.keys));
      }

      this.unsubscribeLocal = this.storage.subscribe(change => {
        if (this.applyingRemote || !this.keys.has(change.key)) return;
        const operation = change.type === 'remove'
          ? this.adapter.remove(change.key)
          : this.adapter.set(change.key, change.value);
        Promise.resolve(operation).catch(this.onError);
      });

      if (typeof this.adapter.subscribe === 'function') {
        this.unsubscribeRemote = this.adapter.subscribe(remote => {
          try {
            this.applySnapshot(this.normalize(remote));
          } catch (error) {
            this.onError(error);
          }
        });
      }

      return this;
    }

    normalize(snapshot) {
      if (!snapshot) return { values: {}, deletedKeys: [] };
      if (snapshot.values) {
        return {
          values: snapshot.values || {},
          deletedKeys: Array.isArray(snapshot.deletedKeys) ? snapshot.deletedKeys : []
        };
      }
      return { values: snapshot, deletedKeys: [] };
    }

    applySnapshot({ values, deletedKeys }) {
      this.applyingRemote = true;
      try {
        Object.entries(values).forEach(([key, value]) => {
          if (this.keys.has(key)) this.storage.set(key, value);
        });
        deletedKeys.forEach(key => {
          if (this.keys.has(key)) this.storage.remove(key);
        });
      } finally {
        this.applyingRemote = false;
      }
    }

    stop() {
      if (this.unsubscribeLocal) this.unsubscribeLocal();
      if (this.unsubscribeRemote) this.unsubscribeRemote();
      this.unsubscribeLocal = null;
      this.unsubscribeRemote = null;
    }
  }

  global.BudgetQuestCloudSyncService = CloudSyncService;
})(window);
