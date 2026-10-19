/**
 * notes.js — classic script.
 * Manages note textarea, note mode, and note CRUD.
 */
(function () {
  'use strict';

  var RESULTS_KEY = '__TEST_RESULTS__';
  var noteArea, noteResizer, workspace;

  function t(key, fallback) {
    var v = (window.__i18n__ && window.__i18n__.t) ? window.__i18n__.t(key) : null;
    return (v && v !== key) ? v : fallback;
  }
  function say(msg) {
    if (typeof window.showAlert === 'function') window.showAlert('', msg); else alert(msg);
  }
  function ask(title, msg, def, cb) {
    if (typeof window.showPrompt === 'function') { window.showPrompt(title, msg, def, cb); return; }
    var raw = window.prompt(msg, def);
    if (raw !== null) cb(raw);
  }

  function initNotes() {
    noteArea    = document.getElementById('note-area');
    noteResizer = document.getElementById('note-resizer');
    workspace   = document.querySelector('.input-workspace');

    window.subscribe(function (state, prev) {
      if (state.notes !== prev.notes
       || state.activeNote !== prev.activeNote
       || state.noteActive !== prev.noteActive
       || state.viewMode !== prev.viewMode) {
        applyNoteMode();
      }
    });

    if (noteArea)    noteArea.addEventListener('input', onNoteInput);
    if (noteResizer) initResize();

    applyNoteMode();

    // Migration: legacy 'Test Results' note -> locked internal key
    var pre = window.getState();
    if (pre.notes && ('Test Results' in pre.notes)) {
      var migrated = Object.assign({}, pre.notes);
      migrated[RESULTS_KEY] = (migrated[RESULTS_KEY] ? migrated[RESULTS_KEY] + '\n' : '') + migrated['Test Results'];
      delete migrated['Test Results'];
      window.setState({
        notes: migrated,
        activeNote: pre.activeNote === 'Test Results' ? RESULTS_KEY : pre.activeNote
      });
    }

    // Bootstrap: ensure at least one note exists on first load
    var st = window.getState();
    if (Object.keys(st.notes || {}).length === 0) {
      var defaultNote = (window.__i18n__ && window.__i18n__.t)
        ? window.__i18n__.t('dropdownNotes')
        : 'Untitled Note';
      var seededNotes = {};
      seededNotes[defaultNote] = '';
      window.setState({
        notes: seededNotes,
        activeNote: defaultNote,
        noteActive: false
      });
    } else if (st.activeNote && !(st.activeNote in st.notes)) {
      var first = Object.keys(st.notes)[0];
      window.setState({ activeNote: first });
    }

    // Expose functions so the workspace mgmt buttons can call them
    window.noteActions = {
      create: onNewNote,
      rename: onRenameNote,
      remove: onDeleteNote
    };
  }

  // ─── Enter / Exit ────────────────────────────────────────────────────────
  function enterNote(name) {
    var state = window.getState();
    if (!(name in state.notes)) return;

    window.setState({
      noteActive: true,
      activeNote: name,
      viewMode: 'notes'
    });

    if (noteArea) noteArea.value = state.notes[name] || '';
    if (workspace) workspace.classList.add('note-mode');

    if (typeof window.updateCharCount === 'function') window.updateCharCount();
  }

  function exitNote() {
    window.setState({
      noteActive: false,
      activeNote: null,
      viewMode: 'lists'
    });

    if (workspace) workspace.classList.remove('note-mode');
    if (typeof window.updateCharCount === 'function') window.updateCharCount();
  }

  /**
   * applyNoteMode — drives grid vs. textarea visibility.
   * Visibility is controlled by viewMode, NOT by noteActive.
   */
  function applyNoteMode() {
    var state = window.getState();
    var inNotesView = state.viewMode === 'notes';

    if (noteArea) {
      noteArea.readOnly = (state.activeNote === RESULTS_KEY);
      if (inNotesView && state.activeNote) {
        noteArea.value = state.notes[state.activeNote] || '';
      } else if (inNotesView) {
        noteArea.value = '';
      }
    }

    if (workspace) {
      workspace.classList.toggle('note-mode', inNotesView);
    }
  }

  // ─── New / Rename / Delete ───────────────────────────────────────────────
  function onNewNote() {
    ask(t('newNote', 'New note'), t('promptNewNote', 'New note name:'), '', function (raw) {
      var name = raw.trim();
      if (!name) return;

      var state = window.getState();
      if (name in state.notes) { say(t('errNoteExists', 'A note with that name already exists.')); return; }

      var notes = Object.assign({}, state.notes);
      notes[name] = '';

      window.setState({ notes: notes });
      enterNote(name);
    });
  }

  function onRenameNote() {
    var state = window.getState();
    if (!state.activeNote) { say(t('errSelectNote', 'Select a note first.')); return; }

    if (state.activeNote === RESULTS_KEY) { say(t('errNoteLocked', 'This note is locked and cannot be edited, renamed, or deleted.')); return; }

    var current = state.activeNote;
    ask(t('renameNote', 'Rename note'), t('promptRenameNote', 'Rename note:'), current, function (raw) {
      var name = raw.trim();
      var st = window.getState();
      if (!name || name === current) return;
      if (name in st.notes) { say(t('errNoteExists', 'A note with that name already exists.')); return; }

      var notes = {};
      Object.keys(st.notes).forEach(function (k) {
        notes[k === current ? name : k] = st.notes[k];
      });

      window.setState({ notes: notes, activeNote: name });
    });
  }

  function onDeleteNote() {
    var state = window.getState();
    if (!state.activeNote) { say(t('errSelectNote', 'Select a note first.')); return; }

    if (state.activeNote === RESULTS_KEY) { say(t('errNoteLocked', 'This note is locked and cannot be edited, renamed, or deleted.')); return; }

    var target = state.activeNote;
    var doDelete = function () {
      var notes = Object.assign({}, state.notes);
      delete notes[target];
      window.setState({ notes: notes, activeNote: null, noteActive: false });
    };

    if (typeof window.showConfirm === 'function') {
      window.showConfirm(
        t('deleteNote', 'Delete note'),
        t('deleteConfirmMsg', 'Delete "{name}"? This cannot be undone.').replace('{name}', target),
        t('deleteBtn', 'Delete'),
        doDelete
      );
    } else if (window.confirm('Delete "' + target + '"?')) {
      doDelete();
    }
  }

  // ─── Input ───────────────────────────────────────────────────────────────
  function onNoteInput() {
    var state = window.getState();
    if (!state.activeNote || state.activeNote === RESULTS_KEY) return;

    var notes = Object.assign({}, state.notes);
    notes[state.activeNote] = noteArea.value;

    window.setState({ notes: notes });
    if (typeof window.updateCharCount === 'function') window.updateCharCount();
  }

  // ─── Resizer ─────────────────────────────────────────────────────────────
  function initResize() {
    noteResizer.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      noteResizer.setPointerCapture(e.pointerId);
      var startY = e.clientY;
      var startH = noteArea.getBoundingClientRect().height;
      noteResizer.classList.add('resizing');

      function onMove(e2) {
        noteArea.style.height = Math.max(80, startH + (e2.clientY - startY)) + 'px';
      }
      function onUp(e2) {
        noteResizer.classList.remove('resizing');
        noteResizer.releasePointerCapture(e2.pointerId);
        noteResizer.removeEventListener('pointermove', onMove);
        noteResizer.removeEventListener('pointerup', onUp);
      }
      noteResizer.addEventListener('pointermove', onMove);
      noteResizer.addEventListener('pointerup', onUp);
    });
  }

  // Expose
  window.initNotes = initNotes;
})();