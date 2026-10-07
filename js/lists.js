/**
 * lists.js — classic script.
 * -----------------------------------------------------------------------------
 * Manages the "Lists" accordion:
 *   • Populate the dropdown from state.lists
 *   • Switch active list (persists grid content into previous list)
 *   • New / Rename / Delete list
 *   • Export / Import list as .txt
 *   • Wires the "+ Add Row" button (adds an empty row to the grid)
 *   • Wires "Clear Content"
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var exportBtn, importBtn, importInput, clearBtn;

  function initLists() {
    exportBtn   = document.getElementById('list-export-btn');
    importBtn   = document.getElementById('list-import-btn');
    importInput = document.getElementById('list-import-input');
    clearBtn    = document.getElementById('clear-btn');

    if (exportBtn)   exportBtn.addEventListener('click', onExport);
    if (importBtn && importInput) {
      importBtn.addEventListener('click', function () { importInput.click(); });
      importInput.addEventListener('change', onImport);
    }
    if (clearBtn)  clearBtn.addEventListener('click', onClear);

    // Bootstrap: ensure at least one list exists on first load
    var st = window.getState();
    if (Object.keys(st.lists || {}).length === 0) {
      var defaultName = 'Untitled';
      window.setState({
        lists: { 'Untitled': '' },
        activeList: defaultName,
        rows: [{ a: '', b: '' }]
      });
    } else if (!st.activeList || !(st.activeList in st.lists)) {
      // Refresh restored a stale activeList — fall back to the first
      var first = Object.keys(st.lists)[0];
      window.setState({
        activeList: first,
        rows: parseList(st.lists[first])
      });
    }

    // Expose functions so the workspace mgmt buttons can call them
    window.listActions = {
      create: onNewList,
      rename: onRenameList,
      remove: onDeleteList
    };
  }


  // ─── New / Rename / Delete ───────────────────────────────────────────────
  function onNewList() {
    var raw = window.prompt('New list name:');
    if (raw === null) return;
    var name = raw.trim();
    if (!name) return;

    var state = window.getState();
    if (name in state.lists) { alert('A list with that name already exists.'); return; }

    var lists = Object.assign({}, state.lists);
    lists[state.activeList] = serializeGrid();
    lists[name] = '';

    window.setState({
      lists: lists,
      activeList: name,
      rows: [{ a: '', b: '' }]
    });
    if (typeof window.__gridRerender__ === 'function') window.__gridRerender__();
  }

  function onRenameList() {
    var state = window.getState();
    var raw = window.prompt('Rename list:', state.activeList);
    if (raw === null) return;
    var name = raw.trim();
    if (!name || name === state.activeList) return;
    if (name in state.lists) { alert('A list with that name already exists.'); return; }

    var lists = {};
    Object.keys(state.lists).forEach(function (k) {
      lists[k === state.activeList ? name : k] = state.lists[k];
    });

    window.setState({ lists: lists, activeList: name });
  }

  function onDeleteList() {
    var state = window.getState();
    if (Object.keys(state.lists).length <= 1) {
      alert('You need at least one list.');
      return;
    }

    var target = state.activeList;
    var doDelete = function () {
      var lists = Object.assign({}, state.lists);
      delete lists[target];
      var nextActive = Object.keys(lists)[0];

      window.setState({
        lists: lists,
        activeList: nextActive,
        rows: parseList(lists[nextActive])
      });
      if (typeof window.__gridRerender__ === 'function') window.__gridRerender__();
    };

    if (typeof window.showConfirm === 'function') {
      window.showConfirm('Delete list', 'Delete "' + target + '"? This cannot be undone.', 'Delete', doDelete);
    } else if (window.confirm('Delete "' + target + '"?')) {
      doDelete();
    }
  }

  // ─── Export / Import ─────────────────────────────────────────────────────
  function onExport() {
    var state = window.getState();
    var text = serializeGrid();
    if (!text.trim()) { alert('This list is empty — nothing to export.'); return; }

    var safeName = (state.activeList || 'list').replace(/[\\/:*?"<>|]/g, '_');
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);

    var a = document.createElement('a');
    a.href = url;
    a.download = safeName + '.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function onImport(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

      var okExt = /\.(txt|csv|tsv|md)$/i.test(file.name);
    if (!okExt) {
      alert('Only .txt, .tsv, .md and .csv files are allowed.');
      importInput.value = '';
      return;
    }

    var MAX_BYTES = 500 * 1024;
    if (file.size > MAX_BYTES) {
      alert('File too large. Max 500 KB.');
      importInput.value = '';
      return;
    }

    var reader = new FileReader();
    reader.onload = function (ev) {
      var raw = String(ev.target.result || '').replace(/\r\n/g, '\n');
      if (!raw.trim()) { alert('That file is empty.'); importInput.value = ''; return; }

      var baseName = file.name.replace(/\.[^.]+$/, '').trim() || 'Imported';
      var name = baseName;
      var n = 2;
      var state = window.getState();
      while (name in state.lists) { name = baseName + ' (' + (n++) + ')'; }

      var lists = Object.assign({}, state.lists);
      lists[state.activeList] = serializeGrid();
      lists[name] = raw.replace(/\s+$/, '');

      window.setState({
        lists: lists,
        activeList: name,
        rows: parseList(lists[name])
      });
      if (typeof window.__gridRerender__ === 'function') window.__gridRerender__();
      importInput.value = '';
    };
    reader.onerror = function () { alert('Could not read that file.'); importInput.value = ''; };
    reader.readAsText(file);
  }

  // ─── Add row / Clear ─────────────────────────────────────────────────────
  function onAddRow() {
    var rows = (window.getState().rows || []).slice();
    rows.push({ a: '', b: '' });
    window.setState({ rows: rows });
    if (typeof window.__gridRerender__ === 'function') window.__gridRerender__();

    // Focus the newly created first cell
    setTimeout(function () {
      var maxRow = 0;
      document.querySelectorAll('.data-cell[data-col="A"]').forEach(function (c) {
        var n = parseInt(c.dataset.row, 10) || 0;
        if (n > maxRow) maxRow = n;
      });
      var target = document.querySelector('.data-cell[data-row="' + maxRow + '"][data-col="A"]');
      if (target) { target.scrollIntoView({ block: 'nearest' }); target.focus(); }
    }, 30);
  }

  function onClear() {
    var doClear = function () {
      window.setState({ rows: [{ a: '', b: '' }] });
      if (typeof window.__gridRerender__ === 'function') window.__gridRerender__();
      if (typeof window.updateCharCount === 'function') window.updateCharCount();
      if (typeof window.syncStartTestButton === 'function') window.syncStartTestButton();
    };

    if (typeof window.showConfirm === 'function') {
      window.showConfirm('Clear content', 'Clear all content from this list? This cannot be undone.', 'Clear', doClear);
    } else if (window.confirm('Clear all cells in the current list?')) {
      doClear();
    }
  }

  // ─── Serialization helpers ───────────────────────────────────────────────
  function serializeGrid() {
    var rows = window.getState().rows || [];
    return rows.map(function (r) {
      return (r.a || '') + '\t' + (r.b || '');
    }).join('\n');
  }

  function parseList(text) {
    if (!text) return [{ a: '', b: '' }];
    var rows = text.replace(/\r\n/g, '\n').split('\n').map(function (line) {
      var cols = line.split('\t');
      return { a: cols[0] || '', b: cols[1] || '' };
    });
    if (rows.length === 0) rows.push({ a: '', b: '' });
    return rows;
  }

  // Expose
  window.initLists = initLists;
  window.serializeGrid = serializeGrid;
  window.parseList = parseList;
})();