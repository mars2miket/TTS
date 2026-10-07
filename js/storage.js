/**
 * storage.js — classic script, no modules.
 * -----------------------------------------------------------------------------
 * Single source of truth for all localStorage access.
 * Namespaces keys under "recallrx:" so future keys never collide with other
 * apps on the same origin.
 *
 * Also handles a one-time migration from the old un-namespaced keys.
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var PREFIX = 'recallrx:';

  var storage = {
    get: function (key, fallback) {
      if (fallback === undefined) fallback = null;
      try {
        var raw = localStorage.getItem(PREFIX + key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
      } catch (err) {
        console.warn('[storage] failed to read "' + key + '":', err);
        return fallback;
      }
    },

    set: function (key, value) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch (err) {
        console.warn('[storage] failed to write "' + key + '":', err);
        return false;
      }
    },

    remove: function (key) {
      try {
        localStorage.removeItem(PREFIX + key);
      } catch (err) {
        console.warn('[storage] failed to remove "' + key + '":', err);
      }
    },

    clear: function () {
      try {
        Object.keys(localStorage)
          .filter(function (k) { return k.indexOf(PREFIX) === 0; })
          .forEach(function (k) { localStorage.removeItem(k); });
      } catch (err) {
        console.warn('[storage] clear failed:', err);
      }
    }
  };

  /**
   * One-time migration from the old un-namespaced keys.
   * Runs once per browser; safe to call on every boot.
   */
  function migrateLegacyKeys() {
    if (storage.get('migrated')) return;

    var map = {
      'savedSpreadsheetGridData': 'rows',
      'whLists':                  'lists',
      'whNotes':                  'notes',
      'whActiveList':             'activeList',
      'whActiveNote':             'activeNote',
      'whMode':                   'mode',
      'recallrx-theme':           'theme',
      'recallrx-lang':            'lang',
      'recallrx-hint-dismissed':  'hintDismissed',
      'recallrx-onboarded':       'onboarded',
      'savedVoiceNameString':     'voiceName',
      'savedGenderFilter':        'genderFilter'
    };

    Object.keys(map).forEach(function (oldKey) {
      var newKey = map[oldKey];
      try {
        var raw = localStorage.getItem(oldKey);
        if (raw === null) return;

        // Old keys are a mix of plain strings and JSON. Try JSON first.
        var parsed;
        try { parsed = JSON.parse(raw); }
        catch (e) { parsed = raw; }

        storage.set(newKey, parsed);
        localStorage.removeItem(oldKey);
      } catch (err) {
        console.warn('[storage] migration failed for "' + oldKey + '":', err);
      }
    });

    storage.set('migrated', true);
  }

  // Expose globally
  window.storage = storage;
  window.migrateLegacyKeys = migrateLegacyKeys;
})();