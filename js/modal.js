// --- REUSABLE CONFIRMATION MODAL ---
// window.showConfirm(title, message, confirmLabel, onConfirm)
// onConfirm receives no arguments; called only when user confirms.

(function () {
    const overlay = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const messageEl = document.getElementById('confirm-modal-message');
    const okBtn = document.getElementById('confirm-modal-ok');
    const cancelBtn = document.getElementById('confirm-modal-cancel');

    if (!overlay || !okBtn || !cancelBtn) return;

    let pendingCallback = null;
    let lastFocused = null;

    function open(title, message, confirmLabel, onConfirm) {
        titleEl.textContent = title || 'Confirm';
        messageEl.textContent = message || '';
        okBtn.textContent = confirmLabel || 'Confirm';
        pendingCallback = typeof onConfirm === 'function' ? onConfirm : null;
        lastFocused = document.activeElement;
        overlay.classList.add('visible');
        setTimeout(() => okBtn.focus(), 0);
    }

    function close(confirmed) {
        overlay.classList.remove('visible');
        const cb = pendingCallback;
        pendingCallback = null;
        if (lastFocused && typeof lastFocused.focus === 'function') {
            try { lastFocused.focus(); } catch (e) {}
        }
        if (confirmed && cb) cb();
    }

    okBtn.addEventListener('click', () => close(true));
    cancelBtn.addEventListener('click', () => close(false));

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(false);
    });

    document.addEventListener('keydown', (e) => {
        if (!overlay.classList.contains('visible')) return;
        if (e.key === 'Escape') { e.preventDefault(); close(false); }
        else if (e.key === 'Enter') { e.preventDefault(); close(true); }
    });

    window.showConfirm = open;
})();