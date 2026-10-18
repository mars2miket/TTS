/**
 * --- SPREADSHEET ROW-SYNCHRONIZED SORTING ENGINE ---
 * Sorts the state rows, then asks grid.js to re-render.
 */

function sortSpreadsheetByColumn(letter) {
  var state = window.getState();
  var rows = (state.rows || []).slice();

  // Keep only rows that have content in at least one column
  var filled = rows.filter(function (r) {
    return (r.a && r.a.trim()) || (r.b && r.b.trim());
  });

  if (filled.length === 0) return;

  // Track sort direction per column
  var dirKey = letter === 'A' ? 'sortDirA' : 'sortDirB';
  var currentDir = window.__sortDirs__ && window.__sortDirs__[dirKey];
  var nextDir = currentDir === 'asc' ? 'desc' : 'asc';

  window.__sortDirs__ = window.__sortDirs__ || {};
  window.__sortDirs__[dirKey] = nextDir;

  filled.sort(function (rowX, rowY) {
    var textX = ((letter === 'A' ? rowX.a : rowX.b) || '').toLowerCase();
    var textY = ((letter === 'A' ? rowY.a : rowY.b) || '').toLowerCase();

    if (textX === '' && textY !== '') return 1;
    if (textX !== '' && textY === '') return -1;
    if (textX === '' && textY === '') return 0;

    return textX.localeCompare(textY);
  });

  if (nextDir === 'desc') filled.reverse();

  // Always append one trailing blank row (grid.js also enforces this)
  filled.push({ a: '', b: '' });

  window.setState({ rows: filled });

  // Force the grid to re-render from the new state
  if (typeof window.__gridRerender__ === 'function') {
    window.__gridRerender__();
  }
  if (typeof window.updateCharCount === 'function') {
    window.updateCharCount();
  }
  if (typeof window.syncStartTestButton === 'function') {
    window.syncStartTestButton();
  }
}

function initializeSortingControls() {
  var container = document.getElementById('spreadsheet-container');
  if (!container) return;

  container.querySelectorAll('.header-cell').forEach(function (headerEl) {
    var columnLetter = headerEl.dataset.col;
    var sortBtn = headerEl.querySelector('.header-sort-btn');

    if (sortBtn) {
      sortBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        sortSpreadsheetByColumn(columnLetter);
      });
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSortingControls);
} else {
  initializeSortingControls();
}