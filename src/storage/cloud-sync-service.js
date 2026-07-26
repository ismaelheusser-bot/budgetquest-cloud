(function (global) {
  'use strict';

  class CloudSyncService {
    constructor({ storage, adapter, keys, onError = console.error, onRemoteChange = null }) {
      if (!storage || typeof storage.subscribe !== 'function') {
        throw new Error('Ein abonnierbarer StorageService ist erforderlich.');
      }
      if (!adapter) throw new Error('Ein Cloud-Adapter ist erforderlich.');
      this.storage = storage;
      this.adapter = adapter;
      this.keys = new Set(keys || []);
      this.onError = onError;
      this.onRemoteChange = onRemoteChange;
      this.applyingRemote = false;
      this.unsubscribeLocal = null;
      this.unsubscribeRemote = null;
    }

    async start(context, { initialStrategy = 'remote-first' } = {}) {
      this.stop();
      await this.adapter.connect(context);

      const snapshot = this.normalize(await this.adapter.pullAll());
      const hasRemoteValues = Object.keys(snapshot.values).length > 0;
      if (initialStrategy === 'local-first') {
        await this.adapter.replaceAll(this.storage.export(this.keys));
      } else if (hasRemoteValues) {
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

    equal(left, right) {
      if (left === right) return true;
      try {
        return JSON.stringify(left) === JSON.stringify(right);
      } catch (error) {
        return false;
      }
    }

    applySnapshot({ values, deletedKeys }) {
      let changed = false;
      this.applyingRemote = true;
      try {
        Object.entries(values).forEach(([key, value]) => {
          if (!this.keys.has(key) || this.equal(this.storage.get(key, null), value)) return;
          this.storage.set(key, value);
          changed = true;
        });
        deletedKeys.forEach(key => {
          if (!this.keys.has(key) || !this.storage.has(key)) return;
          this.storage.remove(key);
          changed = true;
        });
      } finally {
        this.applyingRemote = false;
      }
      if (changed && typeof this.onRemoteChange === 'function') {
        this.onRemoteChange();
      }
      return changed;
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
