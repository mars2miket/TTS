/**
 * workspace-toggle.js — classic script.
 * Manages the [Lists | Notes] toggle and the dynamic dropdown below it.
 */
(function () {
  'use strict';

  var toggle, viewSelect;

  function initWorkspaceToggle() {
    toggle     = document.getElementById('seg-toggle');
    viewSelect = document.getElementById('view-select');
    if (!toggle || !viewSelect) return;

    // Wire toggle buttons
    toggle.querySelectorAll('.seg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setMode(btn.dataset.mode);
      });
    });

    // Wire the dropdown
    viewSelect.addEventListener('change', onDropdownChange);

    // Wire management buttons — route by viewMode
    var mgmtNew    = document.getElementById('mgmt-new-btn');
    var mgmtRename = document.getElementById('mgmt-rename-btn');
    var mgmtDelete = document.getElementById('mgmt-delete-btn');

    function runMgmt(action) {
      var mode = window.getState().viewMode;
      var actions = (mode === 'lists') ? window.listActions : window.noteActions;
      if (actions && typeof actions[action] === 'function') {
        actions[action]();
      }
    }

    if (mgmtNew)    mgmtNew.addEventListener('click',    function () { runMgmt('create'); });
    if (mgmtRename) mgmtRename.addEventListener('click', function () { runMgmt('rename'); });
    if (mgmtDelete) mgmtDelete.addEventListener('click', function () { runMgmt('remove'); });

    // React to state changes
    window.subscribe(function (state, prev) {
      if (state.viewMode !== prev.viewMode) {
        applyMode();
      }
      if (state.lists !== prev.lists
       || state.activeList !== prev.activeList
       || state.notes !== prev.notes
       || state.activeNote !== prev.activeNote) {
        refreshDropdown();
      }
    });

    // Initial render
    applyMode();
  }

  // ─── Mode switching ──────────────────────────────────────────────────────
  function setMode(mode) {
    var state = window.getState();
    if (state.viewMode === mode) return;

    // Save the current grid into its list before leaving Lists mode
    if (mode === 'notes' && typeof window.serializeGrid === 'function') {
      var lists = Object.assign({}, state.lists);
      if (state.activeList) {
        lists[state.activeList] = window.serializeGrid();
        window.setState({ lists: lists });
      }
    }

    // Sync noteActive flag
    if (mode === 'notes') {
      // Bootstrap guarantees at least one note exists
      var lastNote = state.activeNote;
      var noteExists = lastNote && lastNote in state.notes;
      var targetNote = noteExists ? lastNote : Object.keys(state.notes)[0];
      window.setState({
        viewMode: 'notes',
        noteActive: !!targetNote,
        activeNote: targetNote || null
      });
    } else {
      window.setState({
        viewMode: 'lists',
        noteActive: false
      });
    }

    applyMode();
  }

  function applyMode() {
    var state = window.getState();
    var mode = state.viewMode || 'lists';

    // Toggle active state
    toggle.querySelectorAll('.seg-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });

    // Refresh dropdown options
    refreshDropdown();
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────
  function refreshDropdown() {
    var state = window.getState();
    var mode = state.viewMode || 'lists';

    viewSelect.innerHTML = '';

    if (mode === 'lists') {
      var listNames = Object.keys(state.lists || {});
      listNames.forEach(function (name) {
        var op = document.createElement('option');
        op.value = name;
        op.textContent = name;
        viewSelect.appendChild(op);
      });

      viewSelect.value = state.activeList && state.activeList in state.lists
        ? state.activeList
        : (listNames[0] || '');

    } else {
      var noteNames = Object.keys(state.notes || {});
      noteNames.forEach(function (name) {
        var op = document.createElement('option');
        op.value = name;
        op.textContent = name;
        viewSelect.appendChild(op);
      });

      viewSelect.value = state.activeNote && state.activeNote in state.notes
        ? state.activeNote
        : (noteNames[0] || '');
    }
  }

  function onDropdownChange() {
    var name = viewSelect.value;
    var state = window.getState();

    if (state.viewMode === 'lists') {
      if (!name || !(name in state.lists)) return;
      if (name === state.activeList) return;

      // Save current grid into outgoing list
      var lists = Object.assign({}, state.lists);
      if (state.activeList) {
        lists[state.activeList] = window.serializeGrid();
      }

      window.setState({
        lists: lists,
        activeList: name,
        rows: window.parseList ? window.parseList(lists[name]) : []
      });

      if (typeof window.__gridRerender__ === 'function') window.__gridRerender__();
      if (typeof window.updateCharCount === 'function') window.updateCharCount();
      if (typeof window.syncStartTestButton === 'function') window.syncStartTestButton();

    } else {
      if (!name || !(name in state.notes)) return;

      window.setState({
        noteActive: true,
        activeNote: name
      });

      var noteArea = document.getElementById('note-area');
      if (noteArea) noteArea.value = state.notes[name] || '';
    }
  }

  window.initWorkspaceToggle = initWorkspaceToggle;
})();