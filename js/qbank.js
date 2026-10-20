/**
 * qbank.js — classic script.
 * Question Bank picker: loads Q_Bank.csv (Category,Q,A), lets the user pick a
 * category + a question count, and imports random UNUSED questions as a new list.
 * Used questions are tracked by a hash of the question text (not by category).
 */
(function () {
  'use strict';

  var CSV_URL = 'Q_Bank.csv';
  var DEFAULT_COUNT = 20;
  var USED_KEY = 'qbankUsed';
  var SEQ_KEY = 'qbankSeq';

  var data = null;            // { category: [{ q, a, id }] }
  var selected = null;
  var overlay, searchEl, listEl, statusEl, countEl, hintEl, resetBtn, importBtn, titleEl, cancelBtn, countLabel;

  function t(key, fb) {
    var v = (window.__i18n__ && window.__i18n__.t) ? window.__i18n__.t(key) : null;
    return (v && v !== key) ? v : fb;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function hash(str) {                       // cyrb53
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  function clean(s) { return String(s || '').replace(/[\t\r\n]+/g, ' ').trim(); }

  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var rows = [], row = [], field = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
        } else field += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = ''; rows.push(row); row = [];
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function buildData(text) {
    var rows = parseCSV(text);
    var out = {};
    rows.forEach(function (r, i) {
      var cat = clean(r[0]), q = clean(r[1]), a = clean(r[2]);
      if (i === 0 && cat.toLowerCase() === 'category') return;
      if (!cat || !q || !a) return;
      (out[cat] = out[cat] || []).push({
        q: q, a: a, id: hash(q.replace(/\s+/g, ' ').toLowerCase())
      });
    });
    return out;
  }

  function getUsedSet() {
    var arr = window.storage.get(USED_KEY, []) || [];
    var set = {};
    arr.forEach(function (id) { set[id] = 1; });
    return set;
  }
  function saveUsedSet(set) { window.storage.set(USED_KEY, Object.keys(set)); }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function leftIn(name, used) {
    return data[name].filter(function (i) { return !used[i.id]; }).length;
  }

  // ─── DOM ─────────────────────────────────────────────────────────────────
  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function buildDom() {
    overlay = el('div', 'modal-overlay');
    overlay.id = 'qbank-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    var card = el('div', 'modal-card qbank-card');
    titleEl = el('h3', 'modal-title');

    searchEl = el('input', 'ctrl-input');
    searchEl.type = 'text';
    searchEl.autocomplete = 'off';

    listEl = el('div', 'qbank-list');
    statusEl = el('div', 'qbank-status');

    var row = el('div', 'qbank-row');
    countLabel = el('label');
    countEl = el('input', 'ctrl-input');
    countEl.type = 'number';
    countEl.min = '1';
    countEl.inputMode = 'numeric';
    hintEl = el('span', 'qbank-hint');
    row.appendChild(countLabel); row.appendChild(countEl); row.appendChild(hintEl);

    var actions = el('div', 'modal-actions');
    resetBtn = el('button', 'modal-btn'); resetBtn.type = 'button';
    cancelBtn = el('button', 'modal-btn'); cancelBtn.type = 'button';
    importBtn = el('button', 'modal-btn confirm'); importBtn.type = 'button';
    actions.appendChild(resetBtn); actions.appendChild(cancelBtn); actions.appendChild(importBtn);

    [titleEl, searchEl, listEl, statusEl, row, actions].forEach(function (n) { card.appendChild(n); });
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    searchEl.addEventListener('input', renderList);
    cancelBtn.addEventListener('click', close);
    importBtn.addEventListener('click', doImport);
    resetBtn.addEventListener('click', doReset);
    countEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); doImport(); }
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !overlay.classList.contains('visible')) return;
      var confirmEl = document.getElementById('confirm-modal');
      if (confirmEl && confirmEl.classList.contains('visible')) return;
      close();
    });
  }

  function applyLabels() {
    titleEl.textContent = t('qbankTitle', 'Question Bank');
    searchEl.placeholder = t('qbankSearch', 'Search categories...');
    countLabel.textContent = t('qbankHowMany', 'Questions');
    resetBtn.textContent = t('qbankReset', 'Reset category');
    cancelBtn.textContent = t('cancel', 'Cancel');
    importBtn.textContent = t('qbankImport', 'Create list');
  }

  function renderList() {
    if (!data) return;
    var keep = listEl.scrollTop;
    var q = searchEl.value.trim().toLowerCase();
    var used = getUsedSet();
    listEl.innerHTML = '';

    var names = Object.keys(data).sort(function (a, b) { return a.localeCompare(b); })
      .filter(function (n) { return !q || n.toLowerCase().indexOf(q) !== -1; });

    if (!names.length) {
      var none = el('div', 'qbank-status');
      none.textContent = t('qbankNone', 'No categories found.');
      listEl.appendChild(none);
    }

    names.forEach(function (name) {
      var btn = el('button', 'qbank-item' + (name === selected ? ' selected' : ''));
      btn.type = 'button';
      btn.dataset.name = name;
      var n = el('span', 'qbank-item-name'); n.textContent = name;
      var c = el('span', 'qbank-item-count');
      c.textContent = t('qbankLeft', '{left} of {total} left')
        .replace('{left}', leftIn(name, used)).replace('{total}', data[name].length);
      btn.appendChild(n); btn.appendChild(c);
      btn.addEventListener('click', function () { select(name); });
      listEl.appendChild(btn);
    });
    listEl.scrollTop = keep;
  }

  function select(name) {
    selected = name;
    listEl.querySelectorAll('.qbank-item').forEach(function (b) {
      b.classList.toggle('selected', b.dataset.name === name);
    });
    updateControls();
  }

  function updateControls() {
    if (!data || !selected || !data[selected]) {
      importBtn.disabled = true;
      resetBtn.hidden = true;
      countEl.disabled = true;
      hintEl.textContent = '';
      statusEl.textContent = t('qbankSelect', 'Select a category.');
      return;
    }
    var used = getUsedSet();
    var total = data[selected].length;
    var left = leftIn(selected, used);
    countEl.disabled = left === 0;
    countEl.max = String(left);
    importBtn.disabled = left === 0;
    resetBtn.hidden = (total - left) === 0;
    hintEl.textContent = left > 0 ? t('qbankUpTo', 'Up to {n} available').replace('{n}', left) : '';
    statusEl.textContent = left === 0 ? t('qbankAllUsed', 'All questions used. Reset to start over.') : '';
  }

  // ─── Open / close ────────────────────────────────────────────────────────
  function open() {
    if (!overlay) buildDom();
    applyLabels();
    selected = null;
    searchEl.value = '';
    countEl.value = String(DEFAULT_COUNT);
    listEl.innerHTML = '';
    statusEl.textContent = t('qbankLoading', 'Loading...');
    updateControls();
    statusEl.textContent = t('qbankLoading', 'Loading...');
    overlay.classList.add('visible');

    fetch(CSV_URL, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (text) { data = buildData(text); })
      .catch(function (err) { console.warn('[qbank] load failed:', err); })
      .then(function () {
        if (!data) { statusEl.textContent = t('qbankLoadErr', 'Could not load the question bank.'); return; }
        renderList();
        updateControls();
        if (window.matchMedia('(hover: hover)').matches) searchEl.focus();
      });
  }

  function close() {
    if (overlay) overlay.classList.remove('visible');
  }

  // ─── Actions ─────────────────────────────────────────────────────────────
  function doReset() {
    if (!selected) return;
    var name = selected;
    var run = function () {
      var used = getUsedSet();
      data[name].forEach(function (i) { delete used[i.id]; });
      saveUsedSet(used);
      renderList();
      updateControls();
    };
    if (typeof window.showConfirm === 'function') {
      window.showConfirm(
        t('qbankReset', 'Reset category'),
        t('qbankResetConfirm', 'Reset "{name}"? Used questions can appear again.').replace('{name}', name),
        t('confirm', 'Confirm'),
        run
      );
    } else run();
  }

  function doImport() {
    if (!selected || !data || !data[selected]) return;
    var used = getUsedSet();
    var pool = data[selected].filter(function (i) { return !used[i.id]; });
    var n = parseInt(countEl.value, 10);
    if (!(n > 0)) n = DEFAULT_COUNT;
    n = Math.min(n, pool.length);
    if (n < 1) return;

    var picked = shuffle(pool.slice()).slice(0, n);
    var st = window.getState();
    var lists = Object.assign({}, st.lists);
    if (st.activeList && typeof window.serializeGrid === 'function') {
      lists[st.activeList] = window.serializeGrid();
    }

    var seq = window.storage.get(SEQ_KEY, {}) || {};
    var num = (seq[selected] || 0) + 1;
    var name = selected + ' #' + num + ' (' + n + ')';
    while (name in lists) { num++; name = selected + ' #' + num + ' (' + n + ')'; }
    seq[selected] = num;
    window.storage.set(SEQ_KEY, seq);

    lists[name] = picked.map(function (i) { return i.q + '\t' + i.a; }).join('\n');
    picked.forEach(function (i) { used[i.id] = 1; });
    saveUsedSet(used);

    window.setState({
      lists: lists,
      activeList: name,
      rows: window.parseList(lists[name])
    });
    if (typeof window.__gridRerender__ === 'function') window.__gridRerender__();
    if (typeof window.updateCharCount === 'function') window.updateCharCount();
    if (typeof window.syncStartTestButton === 'function') window.syncStartTestButton();
    close();
  }

  // ─── Init ────────────────────────────────────────────────────────────────
  function initQbank() {
    var btn = document.getElementById('qbank-open-btn');
    if (btn) btn.addEventListener('click', open);
  }

  window.initQbank = initQbank;
})();
