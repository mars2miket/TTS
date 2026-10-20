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

  // ─── Accordion (single-open with persistence) ─────────────────────────────
  function initAccordion() {
    var sections = document.querySelectorAll('.acc-section');
    if (!sections.length) return;

    // 1. RESTORE STATE FROM REFRESH
    // Pull the saved accordion dictionary or default to an empty object
    var savedAccordionState = window.getState().accordionState || {};

    sections.forEach(function (section, index) {
      // Ensure each section has an identifier (use ID if present, otherwise fall back to index)
      var sectionId = section.id || 'acc-sec-' + index; 
      var header = section.querySelector('.acc-header');
      if (!header) return;

      // Apply saved open state on boot
      if (savedAccordionState[sectionId] === true) {
        section.classList.add('open');
      } else {
        section.classList.remove('open');
      }

      // 2. SAVE STATE ON CLICK
      header.addEventListener('click', function () {
        var currentState = window.getState().accordionState || {};
        var isNowOpen = !section.classList.contains('open');
        
        // Create an updated copy of the state object
        var updatedState = Object.assign({}, currentState);
        updatedState[sectionId] = isNowOpen;

        // Set the global application state (which triggers the storage.js save)
        window.setState({ accordionState: updatedState });
      });
    });

    // 3. RE-RENDER WHEN STATE CHANGES
    window.subscribe(function (state, prev) {
      if (JSON.stringify(state.accordionState) !== JSON.stringify(prev.accordionState)) {
        var currentAccordionState = state.accordionState || {};
        sections.forEach(function (section, index) {
          var sectionId = section.id || 'acc-sec-' + index;
          section.classList.toggle('open', !!currentAccordionState[sectionId]);
        });
      }
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