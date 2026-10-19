/**
 * duplicates.js — classic script.
 * Highlights duplicate cells within a column (warning only, never blocks editing).
 * Works from the DOM, so it needs no changes to grid.js.
 */
(function () {
  'use strict';

  var container = null, timer = null;

  function t(key, fb) {
    var v = (window.__i18n__ && window.__i18n__.t) ? window.__i18n__.t(key) : null;
    return (v && v !== key) ? v : fb;
  }

  function scan() {
    if (!container) return;
    var cells = container.querySelectorAll('.data-cell');
    var seen = { A: {}, B: {} };

    cells.forEach(function (c) {
      c.classList.remove('dup-cell');
      if (c.dataset.dup) { c.removeAttribute('title'); delete c.dataset.dup; }
      var col = c.dataset.col;
      if (!seen[col]) return;
      if (c.querySelector('.col-hidden')) return;          // masked: don't leak hints
      var key = (c.textContent || '').trim().toLowerCase();
      if (!key) return;
      (seen[col][key] = seen[col][key] || []).push(c);
    });

    ['A', 'B'].forEach(function (col) {
      Object.keys(seen[col]).forEach(function (key) {
        var group = seen[col][key];
        if (group.length < 2) return;
        group.forEach(function (c) {
          c.classList.add('dup-cell');
          c.dataset.dup = '1';
          c.title = t('dupWarning', 'Duplicate in this column');
        });
      });
    });
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(scan, 200);
  }

  function init() {
    container = document.getElementById('spreadsheet-container');
    if (!container) return;
    new MutationObserver(schedule).observe(container, {
      childList: true, subtree: true, characterData: true
    });
    container.addEventListener('input', schedule);
    if (typeof window.subscribe === 'function') {
      window.subscribe(function (state, prev) {
        if (state.lang !== prev.lang || state.colHidden !== prev.colHidden) schedule();
      });
    }
    schedule();
  }

  window.initDuplicates = init;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
