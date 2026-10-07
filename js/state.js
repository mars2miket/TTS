/**
 * state.js — classic script, no modules.
 * -----------------------------------------------------------------------------
 * The single store. Every UI module reads from here and subscribes to changes.
 *
 * Usage:
 *   const { rows } = window.getState();
 *   window.setState({ rows: [...] });       // triggers all subscribers
 *   const unsub = window.subscribe(s => { ... });
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var listeners = new Set();

  var initialState = {
    // ─── UI / chrome ─────────────────────────────────────────────────────
    theme: 'dark',
    lang: 'en',
    sidebarOpen: window.innerWidth > 700,

    // ─── Grid data ───────────────────────────────────────────────────────
    rows: [],                       // [{ a: '', b: '' }, ...]
    colHidden: { A: false, B: false },

    // ─── Lists ───────────────────────────────────────────────────────────
    lists: {},                      // { name: "raw text" }
    activeList: null,

    // ─── Notes ───────────────────────────────────────────────────────────
    notes: {},                      // { name: "raw text" }
    activeNote: null,
    noteActive: false,

    // ─── Speech ──────────────────────────────────────────────────────────
    isSpeaking: false,
    isPaused: false,
    isLooping: false,
    speed: 0.75,
    lastIndex: 0,
    voices: [],
    filteredVoices: [],
    selectedVoiceName: null,
    genderFilter: 'all',
    voiceSearchQuery: '',

    // ─── Exam ────────────────────────────────────────────────────────────
    examActive: false,
    examMode: 'choice',             // 'choice' | 'tf' | 'type'
    examReverse: false,             // false = A→B, true = B→A
    examDeck: [],
    examActiveQuestion: null,
    examCounter: 0,
    examCorrect: 0,
    examAnswered: 0,

    // ─── Timer ───────────────────────────────────────────────────────────
    timerRunning: false,
    timerStartMs: 0,
    timerElapsedMs: 0,

    // 'lists' | 'notes'
    viewMode: 'lists',
  };

  var state = Object.assign({}, initialState);

  function getState() {
    return state;
  }

  function setState(patch) {
    var prev = state;
    state = Object.assign({}, state, patch);
    notify(prev);
  }

  function subscribe(fn) {
    listeners.add(fn);
    return function () { listeners.delete(fn); };
  }

  function selectSubscribe(selector, fn) {
    var last = selector(state);
    fn(last, last); // fire immediately with current value

    return subscribe(function (next) {
      var value = selector(next);
      if (value !== last) {
        var prev = last;
        last = value;
        fn(value, prev);
      }
    });
  }

  function resetState() {
    var prev = state;
    state = Object.assign({}, initialState);
    notify(prev);
  }

  function notify(prev) {
    listeners.forEach(function (fn) {
      try {
        fn(state, prev);
      } catch (err) {
        console.error('[state] subscriber threw:', err);
      }
    });
  }

  // Expose globally
  window.getState = getState;
  window.setState = setState;
  window.subscribe = subscribe;
  window.selectSubscribe = selectSubscribe;
  window.resetState = resetState;

  // Debug helper
  window.__recallrx_state__ = function () { return state; };
})();