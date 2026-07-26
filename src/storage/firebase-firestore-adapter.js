(function (global) {
  'use strict';

  class FirebaseFirestoreAdapter {
    constructor({ db, firestore, collectionName = 'households' }) {
      if (!db || !firestore) throw new Error('Firestore und seine API-Funktionen sind erforderlich.');
      const required = ['doc', 'getDoc', 'setDoc', 'updateDoc', 'onSnapshot', 'deleteField', 'serverTimestamp'];
      required.forEach(name => {
        if (typeof firestore[name] !== 'function') {
          throw new Error(`Firestore-Funktion fehlt: ${name}`);
        }
      });
      this.db = db;
      this.firestore = firestore;
      this.collectionName = collectionName;
      this.reference = null;
      this.userId = null;
      this.lastValues = {};
      this.exists = false;
    }

    async connect({ householdId, userId }) {
      if (!householdId || !userId) {
        throw new Error('Haushalts-ID und angemeldete Benutzer-ID sind erforderlich.');
      }
      this.reference = this.firestore.doc(this.db, this.collectionName, householdId);
      this.userId = userId;
    }

    async pullAll() {
      this.assertConnected();
      const snapshot = await this.firestore.getDoc(this.reference);
      this.exists = snapshot.exists();
      const values = this.exists ? snapshot.data().values || {} : {};
      this.lastValues = values;
      return { values };
    }

    async replaceAll(values) {
      this.assertConnected();
      const data = {
        values,
        updatedAt: this.firestore.serverTimestamp(),
        updatedBy: this.userId
      };
      if (!this.exists) {
        data.ownerId = this.userId;
        data.memberIds = [this.userId];
        data.invitedEmails = [];
        data.createdAt = this.firestore.serverTimestamp();
      }
      await this.firestore.setDoc(this.reference, data, { merge: true });
      this.exists = true;
      this.lastValues = values;
    }

    async set(key, value) {
      this.assertConnected();
      await this.firestore.updateDoc(this.reference, {
        [`values.${key}`]: value,
        updatedAt: this.firestore.serverTimestamp(),
        updatedBy: this.userId
      });
      this.lastValues = { ...this.lastValues, [key]: value };
    }

    async remove(key) {
      this.assertConnected();
      await this.firestore.updateDoc(this.reference, {
        [`values.${key}`]: this.firestore.deleteField(),
        updatedAt: this.firestore.serverTimestamp(),
        updatedBy: this.userId
      });
      const next = { ...this.lastValues };
      delete next[key];
      this.lastValues = next;
    }

    subscribe(listener) {
      this.assertConnected();
      return this.firestore.onSnapshot(this.reference, snapshot => {
        const values = snapshot.exists() ? snapshot.data().values || {} : {};
        const deletedKeys = Object.keys(this.lastValues).filter(key => !(key in values));
        this.lastValues = values;
        listener({ values, deletedKeys });
      });
    }

    assertConnected() {
      if (!this.reference) throw new Error('FirebaseFirestoreAdapter ist noch nicht verbunden.');
    }
  }

  global.BudgetQuestFirebaseFirestoreAdapter = FirebaseFirestoreAdapter;
})(window);
