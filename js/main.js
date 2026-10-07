/**
 * main.js — classic script, no modules.
 * -----------------------------------------------------------------------------
 * Bootstrap. Loads after state.js and storage.js.
 *
 * Step 2 responsibilities:
 *   1. Run storage migration
 *   2. Hydrate state from storage
 *   3. Persist state slices on change
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  // ─── 1. Migrate old keys ────────────────────────────────────────────────
  window.migrateLegacyKeys();

  var storage    = window.storage;
  var getState   = window.getState;
  var setState   = window.setState;
  var subscribe  = window.subscribe;

    // ─── Sample data for first-run seed ─────────────────────────────────────
  window.SAMPLE_DATA = {
    en: [
      ["hello", "xin chào"],
      ["thank you", "cảm ơn"],
      ["goodbye", "tạm biệt"],
      ["student", "học sinh"],
      ["teacher", "giáo viên"]
    ],
    vi: [
      ["xin chào", "hello"],
      ["cảm ơn", "thank you"],
      ["tạm biệt", "goodbye"],
      ["học sinh", "student"],
      ["giáo viên", "teacher"]
    ]
  };

  // ─── 2. Hydrate state from storage ──────────────────────────────────────
  function hydrate() {
    var theme        = storage.get('theme', 'dark');
    var lang         = storage.get('lang', 'en');
    var rows         = storage.get('rows', []);
    var lists        = storage.get('lists', {});
    var activeList   = storage.get('activeList', null);
    var notes        = storage.get('notes', {});
    var speed        = storage.get('speed', 0.75);
    var genderFilter = storage.get('genderFilter', 'all');
    var voiceName    = storage.get('voiceName', null);
    var examMode     = storage.get('examMode', 'choice');
    var examReverse  = storage.get('examReverse', false);
    var viewMode = storage.get('viewMode', 'lists');

    // Ensure at least one empty row exists
    var safeRows = Array.isArray(rows) && rows.length > 0
      ? rows
      : [{ a: '', b: '' }];

    // If no list exists yet, leave empty — lists.js creates the default
    var safeLists = lists || {};

    var safeActiveList = activeList && activeList in safeLists
      ? activeList
      : Object.keys(safeLists)[0];

    var savedMode     = storage.get('mode', 'grid');
    var savedNoteName = storage.get('activeNote', null);
    var noteWasActive = savedMode === 'note' && savedNoteName && savedNoteName in notes;

    setState({
      theme: theme,
      lang: lang,
      rows: safeRows,
      lists: safeLists,
      activeList: safeActiveList,
      notes: notes,
      noteActive: !!noteWasActive,
      activeNote: noteWasActive ? savedNoteName : null,
      speed: speed,
      genderFilter: genderFilter,
      selectedVoiceName: voiceName,
      examMode: examMode,
      examReverse: examReverse,
      viewMode: viewMode
    });

    // Apply theme + lang to the DOM immediately (avoid flash)
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('data-lang', lang);
  }

  hydrate();

  // ─── 3. Persist state slices on change ──────────────────────────────────
  // Only persist slices that should survive a refresh. Never persist
  // transient state (sidebarOpen, isSpeaking, examDeck, etc.).
  var PERSISTED_KEYS = {
    theme:             'theme',
    lang:              'lang',
    rows:              'rows',
    lists:             'lists',
    activeList:        'activeList',
    notes:             'notes',
    speed:             'speed',
    genderFilter:      'genderFilter',
    selectedVoiceName: 'voiceName',
    examMode:          'examMode',
    examReverse:       'examReverse',
    viewMode: 'viewMode'
  };

  subscribe(function (state, prev) {
    Object.keys(PERSISTED_KEYS).forEach(function (stateKey) {
      if (state[stateKey] !== prev[stateKey]) {
        storage.set(PERSISTED_KEYS[stateKey], state[stateKey]);
      }
    });
  });
})();

  // ─── 4. Kick off UI modules ─────────────────────────────────────────────
  if (typeof window.initModal === 'function')      window.initModal();
  if (typeof window.initNav === 'function')        window.initNav();
  if (typeof window.initGrid === 'function')       window.initGrid();
  if (typeof window.initLists === 'function')      window.initLists();
  if (typeof window.initNotes === 'function')      window.initNotes();
  if (typeof window.initSpeech === 'function')     window.initSpeech();
  if (typeof window.initExam === 'function')       window.initExam();
  if (typeof window.initOnboarding === 'function') window.initOnboarding();
  if (typeof window.initWorkspaceToggle === 'function') window.initWorkspaceToggle();

  console.log('[RecallRx] Data layer ready.');
