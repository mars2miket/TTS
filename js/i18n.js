/**
 * i18n.js — classic script.
 * -----------------------------------------------------------------------------
 * Applies translations to any element with:
 *   data-i18n              → textContent
 *   data-i18n-title        → title attribute
 *   data-i18n-aria         → aria-label
 *   data-i18n-placeholder  → placeholder
 *
 * Reads from window.__LOCALES__ (populated by js/locales/*.js).
 * Current language is stored in state.lang and persisted by main.js.
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var locales = window.__LOCALES__ || {};
  var codes = Object.keys(locales);

  if (codes.length === 0) {
    console.warn('[i18n] no locales loaded');
    window.__i18n__ = {
      apply: function () {},
      get: function () { return 'en'; },
      codes: [],
      t: function (key) { return key; }
    };
    return;
  }

  var SHORT = { en: 'EN', vi: 'VI' };

  /**
   * Apply a language to the DOM.
   */
  function apply(lang) {
    if (codes.indexOf(lang) === -1) lang = codes[0];

    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('data-lang', lang);

    var dict = locales[lang] || {};

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (dict[key] != null) el.innerHTML = dict[key];
    });

    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      if (dict[key] != null) el.setAttribute('title', dict[key]);
    });

    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria');
      if (dict[key] != null) el.setAttribute('aria-label', dict[key]);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (dict[key] != null) el.setAttribute('placeholder', dict[key]);
    });

    // Update language toggle label
    var label = document.getElementById('lang-toggle-label');
    if (label) label.textContent = SHORT[lang] || lang.toUpperCase();

    // Notify state (main.js will persist it)
    if (typeof window.setState === 'function') {
      window.setState({ lang: lang });
    }

        // Notify dependent modules
    if (typeof window.refreshExamLanguage === 'function') {
      try { window.refreshExamLanguage(); } catch (e) {}
    }

    // ULTIMATE DIRECT FIX: Rebuild dropdown and restore its precise selection position
    var selectEl = document.getElementById('view-select');
    if (selectEl) {
      var state = (window.getState && window.getState()) || {};
      var mode = state.viewMode || 'lists';
      
      selectEl.innerHTML = '';
      
      if (mode === 'lists') {
        var listNames = Object.keys(state.lists || {});
        listNames.forEach(function (name) {
          var op = document.createElement('option');
          op.value = name;
          op.textContent = window.getDisplayName ? window.getDisplayName(name, 'lists') : name;
          selectEl.appendChild(op);
        });
        // FIX: Re-bind the value and force the browser select element to acknowledge it
        if (state.activeList) {
          selectEl.value = state.activeList;
        }
      } else {
        var noteNames = Object.keys(state.notes || {});
        noteNames.forEach(function (name) {
          var op = document.createElement('option');
          op.value = name;
          op.textContent = window.getDisplayName ? window.getDisplayName(name, 'notes') : name;
          selectEl.appendChild(op);
        });
        // FIX: Re-bind the value and force the browser select element to acknowledge it
        if (state.activeNote) {
          selectEl.value = state.activeNote;
        }
      }
    }



    // FIX: Force the dropdown menu to instantly redraw in the new language
    if (typeof window.setState === 'function') {
      var currentLists = (window.getState && window.getState().lists) || {};
      window.setState({ lists: Object.assign({}, currentLists) });
    }


        // FIX: Force state mutation trigger to trigger dropdown redraw loop
    if (typeof window.setState === 'function') {
      var currentLists = (window.getState && window.getState().lists) || {};
      window.setState({ lists: Object.assign({}, currentLists) });
    }
  }

  /**
   * Translate a single key. Falls back to English, then to the key itself.
   */
  function t(key) {
    var current = (window.getState && window.getState().lang) || codes[0];
    var dict = locales[current] || {};
    if (dict[key] != null) return dict[key];
    var fallback = locales[codes[0]] || {};
    if (fallback[key] != null) return fallback[key];
    return key;
  }

  // Expose globally
  window.__i18n__ = {
    apply: apply,
    get: function () {
      return (window.getState && window.getState().lang) || codes[0];
    },
    codes: codes,
    t: t
  };
})();