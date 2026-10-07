/**
 * notes.js — classic script.
 * Manages note textarea, note mode, and note CRUD.
 */
(function () {
  'use strict';

  var noteArea, noteResizer, workspace;

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

    // Bootstrap: ensure at least one note exists on first load
    var st = window.getState();
    if (Object.keys(st.notes || {}).length === 0) {
      window.setState({
        notes: { 'Untitled Note': '' },
        activeNote: 'Untitled',
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
    var raw = window.prompt('New note name:');
    if (raw === null) return;
    var name = raw.trim();
    if (!name) return;

    var state = window.getState();
    if (name in state.notes) { alert('A note with that name already exists.'); return; }

    var notes = Object.assign({}, state.notes);
    notes[name] = '';

    window.setState({ notes: notes });
    enterNote(name);
  }

  function onRenameNote() {
    var state = window.getState();
    if (!state.activeNote) { alert('Select a note first.'); return; }

    var raw = window.prompt('Rename note:', state.activeNote);
    if (raw === null) return;
    var name = raw.trim();
    if (!name || name === state.activeNote) return;
    if (name in state.notes) { alert('A note with that name already exists.'); return; }

    var notes = {};
    Object.keys(state.notes).forEach(function (k) {
      notes[k === state.activeNote ? name : k] = state.notes[k];
    });

    window.setState({ notes: notes, activeNote: name });
  }

  function onDeleteNote() {
    var state = window.getState();
    if (!state.activeNote) { alert('Select a note first.'); return; }

    var target = state.activeNote;
    var doDelete = function () {
      var notes = Object.assign({}, state.notes);
      delete notes[target];
      window.setState({ notes: notes, activeNote: null, noteActive: false });
    };

    if (typeof window.showConfirm === 'function') {
      window.showConfirm('Delete note', 'Delete "' + target + '"? This cannot be undone.', 'Delete', doDelete);
    } else if (window.confirm('Delete "' + target + '"?')) {
      doDelete();
    }
  }

  // ─── Input ───────────────────────────────────────────────────────────────
  function onNoteInput() {
    var state = window.getState();
    if (!state.activeNote) return;

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