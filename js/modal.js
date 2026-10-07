/**
 * modal.js — classic script.
 * Exposes window.showConfirm(title, message, confirmLabel, onConfirm).
 */
(function () {
  'use strict';

  var overlay, titleEl, messageEl, okBtn, cancelBtn;
  var pendingCallback = null;
  var lastFocused = null;

  function init() {
    overlay   = document.getElementById('confirm-modal');
    titleEl   = document.getElementById('confirm-modal-title');
    messageEl = document.getElementById('confirm-modal-message');
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

  function open(title, message, confirmLabel, onConfirm) {
    if (!overlay) init();
    if (!overlay) return;

    titleEl.textContent = title || 'Confirm';
    messageEl.textContent = message || '';
    okBtn.textContent = confirmLabel || 'Confirm';
    pendingCallback = typeof onConfirm === 'function' ? onConfirm : null;
    lastFocused = document.activeElement;
    overlay.classList.add('visible');
    setTimeout(function () { okBtn.focus(); }, 0);
  }

  function close(confirmed) {
    if (!overlay) return;
    overlay.classList.remove('visible');
    var cb = pendingCallback;
    pendingCallback = null;
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus(); } catch (e) {}
    }
    if (confirmed && cb) cb();
  }

  window.showConfirm = open;
  window.initModal = init;
})();