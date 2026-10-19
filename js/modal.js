/**
 * modal.js — classic script.
 * Exposes:
 *   window.showConfirm(title, message, confirmLabel, onConfirm)
 *   window.showPrompt(title, message, defaultValue, onSubmit, confirmLabel)
 *   window.showAlert(title, message)
 * Button labels are translated every time the modal opens.
 */
(function () {
  'use strict';

  var overlay, titleEl, messageEl, inputEl, okBtn, cancelBtn;
  var pendingCallback = null;
  var currentMode = 'confirm';
  var lastFocused = null;

  function tt(key, fallback) {
    var v = (window.__i18n__ && window.__i18n__.t) ? window.__i18n__.t(key) : null;
    return (v && v !== key) ? v : fallback;
  }

  function init() {
    overlay   = document.getElementById('confirm-modal');
    titleEl   = document.getElementById('confirm-modal-title');
    messageEl = document.getElementById('confirm-modal-message');
    inputEl   = document.getElementById('confirm-modal-input');
    okBtn     = document.getElementById('confirm-modal-ok');
    cancelBtn = document.getElementById('confirm-modal-cancel');
    if (!overlay || !okBtn || !cancelBtn) return;

    okBtn.addEventListener('click', function () { close(true); });
    cancelBtn.addEventListener('click', function () { close(false); });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close(false);
    });
    document.addEventListener('keydown', function (e) {
      if (!overlay.classList.contains('visible')) return;
      if (e.key === 'Escape')      { e.preventDefault(); close(false); }
      else if (e.key === 'Enter')  { e.preventDefault(); close(true); }
    });
  }

  function show(opts) {
    if (!overlay) init();
    if (!overlay) return false;

    currentMode = opts.mode;
    titleEl.textContent   = opts.title || tt('confirmTitle', 'Confirm');
    messageEl.textContent = opts.message || '';
    okBtn.textContent     = opts.confirmLabel || tt('confirm', 'Confirm');
    cancelBtn.textContent = tt('cancel', 'Cancel');
    cancelBtn.style.display = (opts.mode === 'alert') ? 'none' : '';

    if (inputEl) {
      inputEl.hidden = (opts.mode !== 'prompt');
      inputEl.value = opts.defaultValue || '';
    }

    pendingCallback = typeof opts.onConfirm === 'function' ? opts.onConfirm : null;
    lastFocused = document.activeElement;
    overlay.classList.add('visible');
    setTimeout(function () {
      if (opts.mode === 'prompt' && inputEl) { inputEl.focus(); inputEl.select(); }
      else okBtn.focus();
    }, 0);
    return true;
  }

  function showConfirm(title, message, confirmLabel, onConfirm) {
    return show({ mode: 'confirm', title: title, message: message,
                  confirmLabel: confirmLabel, onConfirm: onConfirm });
  }

  function showPrompt(title, message, defaultValue, onSubmit, confirmLabel) {
    return show({ mode: 'prompt', title: title, message: message,
                  defaultValue: defaultValue, confirmLabel: confirmLabel,
                  onConfirm: onSubmit });
  }

  function showAlert(title, message) {
    return show({ mode: 'alert', title: title || tt('noticeTitle', 'Notice'), message: message,
                  confirmLabel: tt('ok', 'OK') });
  }

  function close(confirmed) {
    if (!overlay) return;
    overlay.classList.remove('visible');
    var cb = pendingCallback;
    var mode = currentMode;
    var value = inputEl ? inputEl.value : '';
    pendingCallback = null;
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus(); } catch (e) {}
    }
    if (confirmed && cb) {
      if (mode === 'prompt') cb(value); else cb();
    }
  }

  window.showConfirm = showConfirm;
  window.showPrompt = showPrompt;
  window.showAlert = showAlert;
  window.initModal = init;
})();
