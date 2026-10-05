// --- SIMPLE i18n ENGINE ---
// Reads locales from window.__LOCALES__ (populated by js/locales/*.js).
// Toggle button cycles through all available locales.
(function initI18n() {
    const root = document.documentElement;
    const btn = document.getElementById('lang-toggle');
    const label = document.getElementById('lang-toggle-label');

    const locales = window.__LOCALES__ || {};
    const codes = Object.keys(locales);
    if (codes.length === 0) return;

    const SHORT = { en: 'EN', vi: 'VI' };

    let current = (() => {
        try {
            const saved = localStorage.getItem('recallrx-lang');
            if (saved && codes.includes(saved)) return saved;
        } catch (e) {}
        return codes[0];
    })();

    function apply(lang) {
        if (!codes.includes(lang)) return;
        current = lang;
        root.setAttribute('lang', lang);
        root.setAttribute('data-lang', lang);

        const dict = locales[lang] || {};

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key] != null) el.textContent = dict[key];
        });

        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (dict[key] != null) el.setAttribute('title', dict[key]);
        });

        document.querySelectorAll('[data-i18n-aria]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria');
            if (dict[key] != null) el.setAttribute('aria-label', dict[key]);
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (dict[key] != null) el.setAttribute('placeholder', dict[key]);
        });

        if (label) label.textContent = SHORT[lang] || lang.toUpperCase();

        try { localStorage.setItem('recallrx-lang', lang); } catch (e) {}

        // Re-render the exam module in the new language
        if (typeof window.refreshExamLanguage === 'function') {
            try { window.refreshExamLanguage(); } catch (e) {}
        } else if (typeof window.renderShell === 'function') {
            try { window.renderShell(); } catch (e) {}
        }
    }

    apply(current);

    if (btn) {
        btn.addEventListener('click', () => {
            const idx = codes.indexOf(current);
            const next = codes[(idx + 1) % codes.length];
            apply(next);
        });
    }

    window.__i18n__ = {
        apply,
        get: () => current,
        codes,
        t: (key) => (locales[current] && locales[current][key])
                 || (locales[codes[0]] && locales[codes[0]][key])
                 || key
    };
})();