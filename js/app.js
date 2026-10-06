// --- SIDEBAR TOGGLE (header button, all viewports) ---
(function initSidebarToggle() {
    const wrapper = document.getElementById('sidebar-wrapper');
    const tab = document.getElementById('sidebar-toggle');
    if (!wrapper || !tab) return;

    const mq = window.matchMedia('(max-width: 700px)');
    let lastMatches = mq.matches;

    function updateHoverTitle() {
        const isCollapsed = wrapper.classList.contains('collapsed');
        tab.title = isCollapsed ? 'Open sidebar' : 'Close sidebar';
        tab.setAttribute('aria-label', tab.title);
    }

    function setInitialState() {
        if (mq.matches) {
            wrapper.classList.remove('open');
            wrapper.classList.add('collapsed');
        } else {
            wrapper.classList.add('open');
            wrapper.classList.remove('collapsed');
        }
        updateHoverTitle();
    }

    mq.addEventListener('change', (e) => {
        if (e.matches === lastMatches) return;
        lastMatches = e.matches;
        setInitialState();
    });

    tab.addEventListener('click', () => {
        wrapper.classList.toggle('open');
        wrapper.classList.toggle('collapsed');
        updateHoverTitle();
    });

    setInitialState();
})();

// --- ACCORDION (single-open) ---
(function initAccordion() {
    const sections = document.querySelectorAll('.acc-section');
    if (!sections.length) return;

    sections.forEach(section => {
        const header = section.querySelector('.acc-header');
        if (!header) return;
        header.addEventListener('click', () => {
            const isOpen = section.classList.contains('open');
            sections.forEach(s => s.classList.remove('open'));
            if (!isOpen) section.classList.add('open');
        });
    });
})();

// --- THEME TOGGLE ---
(function initThemeToggle() {
    const root = document.documentElement;
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    const savedTheme = localStorage.getItem('recallrx-theme') || 'dark';
    root.setAttribute('data-theme', savedTheme);

    const syncLabel = () => {
        const isDark = root.getAttribute('data-theme') === 'dark';
        btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    };
    syncLabel();

    btn.addEventListener('click', () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('recallrx-theme', next); } catch (e) {}
        syncLabel();
    });
})();

// --- MOBILE VIEWPORT LOCK ---
let lastWidth = window.innerWidth;

function lockMobileViewport() {
    if (window.innerWidth <= 700) {
        const trueHeight = window.innerHeight;
        document.documentElement.style.setProperty('--app-height', `${trueHeight}px`);
    } else {
        document.documentElement.style.removeProperty('--app-height');
    }
}

lockMobileViewport();
window.addEventListener('load', lockMobileViewport);

window.addEventListener('resize', () => {
    if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        lockMobileViewport();
    }
});

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', lockMobileViewport);
    window.visualViewport.addEventListener('scroll', lockMobileViewport);
}

// --- FIRST-RUN ONBOARDING SEED aka sample data---
(function initOnboardingSeed() {
    try {
        if (localStorage.getItem('recallrx-onboarded')) return;

        const existing = localStorage.getItem('savedSpreadsheetGridData');
        if (existing) return;

        const lang = document.documentElement.getAttribute('data-lang') || 'en';
        const rows = (window.SAMPLE_DATA && window.SAMPLE_DATA[lang]) || (window.SAMPLE_DATA && window.SAMPLE_DATA.en);
        if (!rows) return;

        localStorage.setItem('savedSpreadsheetGridData', JSON.stringify(rows));
        localStorage.setItem('recallrx-onboarded', '1');
    } catch (e) {}
})();

// --- ONBOARDING HINT DISMISS ---
(function initOnboardingHint() {
    const hint = document.getElementById('onboarding-hint');
    const btn = document.getElementById('onboarding-dismiss');
    if (!hint || !btn) return;

    if (localStorage.getItem('recallrx-hint-dismissed')) {
        hint.remove();
        return;
    }

    btn.addEventListener('click', () => {
        hint.remove();
        try { localStorage.setItem('recallrx-hint-dismissed', '1'); } catch (e) {}
    });
})();

// --- ONBOARDING HINT DISMISS ---
(function initOnboardingHint() {
    const hint = document.getElementById('onboarding-hint');
    const btn = document.getElementById('onboarding-dismiss');
    if (!hint || !btn) return;

    if (localStorage.getItem('recallrx-hint-dismissed')) {
        hint.remove();
        return;
    }

    btn.addEventListener('click', () => {
        hint.remove();
        try { localStorage.setItem('recallrx-hint-dismissed', '1'); } catch (e) {}
    });
})();