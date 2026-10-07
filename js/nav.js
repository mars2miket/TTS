/**
 * nav.js — classic script.
 * -----------------------------------------------------------------------------
 * Wires up:
 *   • Sidebar toggle (hamburger)
 *   • Theme toggle (dark/light)
 *   • Language toggle (EN ↔ VI)
 *   • Accordion sections in the sidebar
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  function initNav() {
    initSidebar();
    initTheme();
    initLang();
    initAccordion();
    initMobileViewport();
  }

  // ─── Sidebar ─────────────────────────────────────────────────────────────
  function initSidebar() {
    var wrapper = document.getElementById('sidebar-wrapper');
    var tab = document.getElementById('sidebar-toggle');
    if (!wrapper || !tab) return;

    var mq = window.matchMedia('(max-width: 700px)');

    function applyOpen() {
      var open = window.getState().sidebarOpen;
      wrapper.classList.toggle('open', open);
      wrapper.classList.toggle('collapsed', !open);

      var title = open ? 'Close sidebar' : 'Open sidebar';
      tab.title = title;
      tab.setAttribute('aria-label', title);
    }

    function setDefault() {
      window.setState({ sidebarOpen: !mq.matches });
    }

    // Default open on desktop, closed on mobile
    setDefault();

    // React to resize
    var lastMatch = mq.matches;
    mq.addEventListener('change', function (e) {
      if (e.matches === lastMatch) return;
      lastMatch = e.matches;
      setDefault();
    });

    tab.addEventListener('click', function () {
      window.setState({ sidebarOpen: !window.getState().sidebarOpen });
    });

    // Re-render whenever sidebarOpen changes
    window.subscribe(function (state, prev) {
      if (state.sidebarOpen !== prev.sidebarOpen) applyOpen();
    });

    applyOpen();
  }

  // ─── Theme ───────────────────────────────────────────────────────────────
  function initTheme() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;

    // Theme already applied to <html> by main.js during hydrate
    btn.addEventListener('click', function () {
      var next = window.getState().theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      window.setState({ theme: next });
    });

    window.subscribe(function (state, prev) {
      if (state.theme !== prev.theme) {
        document.documentElement.setAttribute('data-theme', state.theme);
      }
    });
  }

  // ─── Language ────────────────────────────────────────────────────────────
  function initLang() {
    var btn = document.getElementById('lang-toggle');
    if (!btn) return;
    if (!window.__i18n__) return;

    var codes = window.__i18n__.codes;

    // Apply current language on boot
    var current = window.getState().lang || codes[0];
    window.__i18n__.apply(current);

    btn.addEventListener('click', function () {
      var idx = codes.indexOf(window.__i18n__.get());
      var next = codes[(idx + 1) % codes.length];
      window.__i18n__.apply(next);
    });
  }

  // ─── Accordion (single-open) ─────────────────────────────────────────────
  function initAccordion() {
    var sections = document.querySelectorAll('.acc-section');
    if (!sections.length) return;

    sections.forEach(function (section) {
      var header = section.querySelector('.acc-header');
      if (!header) return;

      header.addEventListener('click', function () {
        var isOpen = section.classList.contains('open');
        sections.forEach(function (s) { s.classList.remove('open'); });
        if (!isOpen) section.classList.add('open');
      });
    });
  }

  // ─── Mobile viewport height lock ─────────────────────────────────────────
  function initMobileViewport() {
    function lock() {
      if (window.innerWidth <= 700) {
        document.documentElement.style.setProperty('--app-height', window.innerHeight + 'px');
      } else {
        document.documentElement.style.removeProperty('--app-height');
      }
    }
    lock();
    window.addEventListener('load', lock);

    var lastW = window.innerWidth;
    window.addEventListener('resize', function () {
      if (window.innerWidth !== lastW) {
        lastW = window.innerWidth;
        lock();
      }
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', lock);
      window.visualViewport.addEventListener('scroll', lock);
    }
  }

  // Expose
  window.initNav = initNav;
})();