/**
 * grid.js — classic script.
 * -----------------------------------------------------------------------------
 * Editable spreadsheet grid:
 *   • Two contenteditable cells per row (A + B)
 *   • Auto-append a new row when typing in the last row
 *   • Paste from Excel/Sheets/plain text (multi-row, multi-column)
 *   • Click a column header to toggle hiding that column
 *   • Masked cells reveal on focus, re-mask on blur
 *   • Live char count + time estimate
 *   • Hover a B cell → trash icon → delete that row
 *   • Persists to state on every change (state → storage auto-handled)
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────────────────
  var MASK_CLASS = 'recall-word';
  var HIDDEN_CLASS = 'col-hidden';
  var HIDDEN_ACTIVE_HEADER = 'col-hidden-active';

  // ─── Module refs ─────────────────────────────────────────────────────────
  var container = null;

  // ─── Init ────────────────────────────────────────────────────────────────
  function initGrid() {
    container = document.getElementById('spreadsheet-container');
    if (!container) return;

    // Render initial rows from state
    renderAll();

    // Event delegation
    container.addEventListener('input', onInput);
    container.addEventListener('beforeinput', onBeforeInput);
    container.addEventListener('paste', onPaste);
    container.addEventListener('focusin', onFocusIn);
    container.addEventListener('focusout', onFocusOut);

    // Header click → toggle column hide
    container.querySelectorAll('.header-cell .header-label').forEach(function (label) {
      label.addEventListener('click', function () {
        toggleColumnHide(label.dataset.col);
      });
    });

    // Delete-row wiring
    initRowDelete();

    // Re-render only when rows change from an EXTERNAL source
    // (list switch, onboarding seed). Never while the user is typing.
    var externalRowChange = false;

    window.subscribe(function (state, prev) {
      if (state.rows !== prev.rows && externalRowChange) renderAll();
      if (state.colHidden !== prev.colHidden) applyMaskAll();
    });

    // Called by other modules (lists.js, onboarding.js) to force a re-render
    window.__gridRerender__ = function () {
      externalRowChange = true;
      renderAll();
      externalRowChange = false;
    };

    // Initial char count + button state
    updateCharCount();
    syncStartTestButton();

    // Expose to other modules
    window.updateCharCount = updateCharCount;
  }

  // ─── Rendering ───────────────────────────────────────────────────────────
  function renderAll() {
    if (!container) return;

    // Remove all existing data cells (keep headers)
    container.querySelectorAll('.data-cell').forEach(function (c) { c.remove(); });

    var rows = (window.getState().rows || []).slice();

    // Strip trailing empty rows
    while (rows.length > 0) {
      var last = rows[rows.length - 1];
      if (!last.a.trim() && !last.b.trim()) rows.pop();
      else break;
    }

    // Always append exactly one blank row at the end
    rows.push({ a: '', b: '' });

    rows.forEach(function (row, i) {
      createRowCells(i + 1, row.a || '', row.b || '');
    });

    applyMaskAll();
  }

  function createRowCells(rowNum, valA, valB) {
    var cellA = document.createElement('div');
    cellA.className = 'cell data-cell';
    cellA.contentEditable = 'true';
    cellA.dataset.row = rowNum;
    cellA.dataset.col = 'A';
    cellA.textContent = valA;

    var cellB = document.createElement('div');
    cellB.className = 'cell data-cell';
    cellB.contentEditable = 'true';
    cellB.dataset.row = rowNum;
    cellB.dataset.col = 'B';
    cellB.textContent = valB;

    container.appendChild(cellA);
    container.appendChild(cellB);
  }

  // ─── Input handling ──────────────────────────────────────────────────────
  function onInput(e) {
    var cell = e.target;
    if (!cell.classList.contains('data-cell')) return;

    var raw = cell.textContent;

    // If paste inserted a tab or newline, redistribute
    if (raw.indexOf('\t') !== -1 || raw.indexOf('\n') !== -1) {
      cell.textContent = '';
      distributePastedText(cell, raw);
      return;
    }

    // Auto-append a new empty row when typing in the last row
    var rowNum = parseInt(cell.dataset.row, 10);
    var maxRow = getMaxRow();
    if (rowNum === maxRow) {
      appendEmptyRow();
    }

    commitToState();
  }

  function onBeforeInput(e) {
    if (e.inputType !== 'insertFromPaste' && e.inputType !== 'insertText') return;
    if (!e.target.classList.contains('data-cell')) return;

    var text = extractClipboardText(e.dataTransfer);
    if (!text) return;

    if (text.indexOf('\t') !== -1 || text.indexOf('\n') !== -1) {
      e.preventDefault();
      distributePastedText(e.target, text);
    }
  }

  function onPaste(e) {
    var cell = e.target;
    if (!cell.classList.contains('data-cell')) return;

    var data = e.clipboardData || window.clipboardData;
    var text = extractClipboardText(data);
    if (!text) return;

    e.preventDefault();
    distributePastedText(cell, text);
  }

  function onFocusIn(e) {
    var cell = e.target;
    if (!cell.classList.contains('data-cell')) return;
    // Reveal masked words while editing
    if (cell.querySelector('.' + MASK_CLASS)) {
      unmaskCell(cell);
    }
  }

  function onFocusOut(e) {
    var cell = e.target;
    if (!cell.classList.contains('data-cell')) return;
    // Re-mask on blur if the column is hidden
    if (window.getState().colHidden[cell.dataset.col]) {
      maskCell(cell);
    }
  }

  // ─── Row helpers ─────────────────────────────────────────────────────────
  function getMaxRow() {
    var max = 0;
    container.querySelectorAll('.data-cell[data-col="A"]').forEach(function (c) {
      var n = parseInt(c.dataset.row, 10) || 0;
      if (n > max) max = n;
    });
    return max;
  }

  function appendEmptyRow() {
    var next = getMaxRow() + 1;
    createRowCells(next, '', '');
  }

  // ─── Paste handling ──────────────────────────────────────────────────────
  function extractClipboardText(dataSource) {
    if (!dataSource) return '';
    var plain = (dataSource.getData && (dataSource.getData('text/plain') || dataSource.getData('text'))) || '';
    if (plain.indexOf('\t') !== -1 || plain.indexOf('\n') !== -1) return plain;

    var html = dataSource.getData && dataSource.getData('text/html');
    if (html) {
      var fromTable = htmlTableToDelimitedText(html);
      if (fromTable) return fromTable;
    }
    return plain;
  }

  function htmlTableToDelimitedText(html) {
    try {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var table = doc.querySelector('table');
      if (!table) return null;
      var rows = Array.prototype.slice.call(table.querySelectorAll('tr'));
      if (!rows.length) return null;
      return rows.map(function (tr) {
        return Array.prototype.slice.call(tr.querySelectorAll('td, th'))
          .map(function (cell) { return cell.textContent.trim(); })
          .join('\t');
      }).join('\n');
    } catch (err) {
      return null;
    }
  }

  function distributePastedText(targetCell, pastedText) {
    if (!targetCell.classList.contains('data-cell')) return;

    var startRow = parseInt(targetCell.dataset.row, 10);
    var startCol = targetCell.dataset.col;
    var lines = pastedText.replace(/\r\n/g, '\n').split('\n');

    // Drop the trailing empty line that Excel often adds
    if (lines.length && lines[lines.length - 1] === '') lines.pop();

    lines.forEach(function (line, i) {
      var rowNum = startRow + i;
      var cols = line.split('\t');

      // Ensure the row exists
      var cellA = container.querySelector('.data-cell[data-row="' + rowNum + '"][data-col="A"]');
      if (!cellA) {
        createRowCells(rowNum, '', '');
      }

      // If pasting starts in column B, shift the first value to B
      cols.forEach(function (val, j) {
        var targetLetter;
        if (startCol === 'A') {
          targetLetter = (j === 0) ? 'A' : 'B';
        } else {
          targetLetter = 'B';
        }
        var dest = container.querySelector(
          '.data-cell[data-row="' + rowNum + '"][data-col="' + targetLetter + '"]'
        );
        if (dest) dest.textContent = val.trim();
      });
    });

    // Ensure there's a trailing empty row to type into
    appendEmptyRow();

    commitToState();
  }

  // ─── Masking (column hide) ───────────────────────────────────────────────
  function toggleColumnHide(letter) {
    var state = window.getState();
    var next = Object.assign({}, state.colHidden);
    next[letter] = !next[letter];
    window.setState({ colHidden: next });

    var headerEl = container.querySelector('.header-cell[data-col="' + letter + '"]');
    if (headerEl) {
      headerEl.classList.toggle(HIDDEN_ACTIVE_HEADER, next[letter]);
      var label = headerEl.querySelector('.header-label');
      if (label) {
        var newKey = next[letter] ? ('showCol' + letter) : ('hideCol' + letter);
        label.dataset.i18n = newKey;
        if (window.__i18n__ && typeof window.__i18n__.t === 'function') {
          label.textContent = window.__i18n__.t(newKey);
        }
      }
    }

    applyMaskAll();
  }

  function applyMaskAll() {
    var hidden = window.getState().colHidden;
    ['A', 'B'].forEach(function (letter) {
      var cells = container.querySelectorAll('.data-cell[data-col="' + letter + '"]');
      cells.forEach(function (cell) {
        if (cell === document.activeElement) return;
        if (hidden[letter]) maskCell(cell);
        else unmaskCell(cell);
      });
    });
  }

  function maskCell(cell) {
    var text = cell.textContent || '';
    if (!text) return;

    cell.innerHTML = '';
    // Split on whitespace, preserving the whitespace itself
    var tokens = text.split(/(\s+)/);
    tokens.forEach(function (token) {
      if (token === '') return;
      if (/^\s+$/.test(token)) {
        cell.appendChild(document.createTextNode(token));
      } else {
        var span = document.createElement('span');
        span.className = MASK_CLASS + ' ' + HIDDEN_CLASS;
        span.textContent = token;
        cell.appendChild(span);
      }
    });
  }

  function unmaskCell(cell) {
    // Collapse all text nodes back to plain textContent
    cell.textContent = cell.textContent;
  }

  // ─── State commit ────────────────────────────────────────────────────────
  function commitToState() {
    var rows = [];
    var maxRow = getMaxRow();

    for (var i = 1; i <= maxRow; i++) {
      var cellA = container.querySelector('.data-cell[data-row="' + i + '"][data-col="A"]');
      var cellB = container.querySelector('.data-cell[data-row="' + i + '"][data-col="B"]');
      rows.push({
        a: cellA ? cellA.textContent : '',
        b: cellB ? cellB.textContent : ''
      });
    }

    // Drop ALL trailing empty rows, then always append exactly one blank row
    while (rows.length > 0) {
      var last = rows[rows.length - 1];
      if (!last.a.trim() && !last.b.trim()) rows.pop();
      else break;
    }
    rows.push({ a: '', b: '' });

    window.setState({ rows: rows });
    updateCharCount();
    syncStartTestButton();
  }

  // ─── Char count + time estimate ──────────────────────────────────────────
  function updateCharCount() {
    var total = 0;
    var st = window.getState();

    if (st.viewMode === 'notes') {
      var noteArea = document.getElementById('note-area');
      total = noteArea ? noteArea.value.length : 0;
    } else {
      container.querySelectorAll('.data-cell').forEach(function (c) {
        total += (c.textContent || '').length;
      });
    }

    var charEl = document.getElementById('char-count');
    if (charEl) charEl.textContent = total;

    var estEl = document.getElementById('time-estimate');
    if (estEl) {
      var totalMinutes = total / 1000;
      var minutes = Math.floor(totalMinutes);
      var seconds = Math.floor((totalMinutes - minutes) * 60);
      estEl.textContent = minutes + 'm ' + seconds + 's';
    }
  }

  // ─── Start Test button state ─────────────────────────────────────────────
  function syncStartTestButton() {
    var btn = document.getElementById('start-test-btn');
    if (!btn) return;
    var rows = window.getState().rows || [];
    var hasContent = rows.some(function (r) {
      return (r.a && r.a.trim()) || (r.b && r.b.trim());
    });
    btn.disabled = !hasContent;
  }

  // ─── Delete row ──────────────────────────────────────────────────────────
  function initRowDelete() {
    // Create the floating delete button (hidden by default)
    var delBtn = document.createElement('button');
    delBtn.id = 'row-delete-btn';
    delBtn.type = 'button';
    delBtn.title = 'Delete row';
    delBtn.textContent = '🗑';
    delBtn.setAttribute('aria-label', 'Delete row');
    container.appendChild(delBtn);

    var targetRow = null;

    function showFor(cell) {
      var c = container.getBoundingClientRect();
      var r = cell.getBoundingClientRect();
      delBtn.style.top  = (r.top - c.top + container.scrollTop + (r.height - 36) / 2) + 'px';
      delBtn.style.left = (r.right - c.left + container.scrollLeft - 44) + 'px';
      delBtn.classList.add('visible');
      targetRow = cell.dataset.row;
    }

    function hide() {
      delBtn.classList.remove('visible');
      targetRow = null;
    }

    // Desktop: show on hover over the B cell, near the right edge
    container.addEventListener('mousemove', function (e) {
      if (e.target === delBtn) return;
      var cell = e.target.closest('.data-cell[data-col="B"]');
      if (!cell) { hide(); return; }
      var rect = cell.getBoundingClientRect();
      if (e.clientX >= rect.right - 56) showFor(cell);
      else hide();
    });

    container.addEventListener('mouseleave', hide);

    // Mobile: show when the B cell is focused
    container.addEventListener('focusin', function (e) {
      if (e.target.matches('.data-cell[data-col="B"]') && window.matchMedia('(hover: none)').matches) {
        showFor(e.target);
      }
    });

    container.addEventListener('focusout', function (e) {
      if (e.relatedTarget !== delBtn) hide();
    });

    // Click handler
    delBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
    delBtn.addEventListener('click', function () {
      if (targetRow) deleteRowAt(targetRow);
      hide();
    });

    // Hide on scroll (position would be stale)
    container.addEventListener('scroll', hide);
  }

  function deleteRowAt(rowNum) {
    var state = window.getState();
    var rows = (state.rows || []).slice();
    var idx = parseInt(rowNum, 10) - 1;

    if (idx < 0 || idx >= rows.length) return;

    rows.splice(idx, 1);

    // Strip trailing empties, then ensure one blank row at the end
    while (rows.length > 0) {
      var last = rows[rows.length - 1];
      if (!last.a.trim() && !last.b.trim()) rows.pop();
      else break;
    }
    rows.push({ a: '', b: '' });

    window.setState({ rows: rows });
    if (typeof window.__gridRerender__ === 'function') window.__gridRerender__();
    if (typeof window.updateCharCount === 'function') window.updateCharCount();
    if (typeof window.syncStartTestButton === 'function') window.syncStartTestButton();
  }

  // Expose
  window.initGrid = initGrid;
  window.syncStartTestButton = syncStartTestButton;
})();