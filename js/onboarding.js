/**
 * onboarding.js — classic script.
 * -----------------------------------------------------------------------------
 * Handles:
 *   • First-run seed: writes sample data to localStorage once
 *   • Onboarding hint card dismiss + "show again" (?) button
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  function initOnboarding() {
    seedSampleData();
    initHintCard();
  }

  // ─── Sample data seed (first run only) ───────────────────────────────────
  function seedSampleData() {
    try {
      if (window.storage.get('onboarded')) return;

      var existingRows = window.storage.get('rows', []);
      var hasRealData = Array.isArray(existingRows) && existingRows.some(function (r) {
        return (r.a && r.a.trim()) || (r.b && r.b.trim());
      });
      if (hasRealData) return;

      var lang = document.documentElement.getAttribute('data-lang') || 'en';
      var sample = (window.SAMPLE_DATA && window.SAMPLE_DATA[lang])
                || (window.SAMPLE_DATA && window.SAMPLE_DATA.en);
      if (!sample) return;

      var rows = sample.map(function (pair) {
        return { a: pair[0] || '', b: pair[1] || '' };
      });

      window.storage.set('rows', rows);
      window.setState({ rows: rows });
      window.storage.set('onboarded', true);

      console.log('[onboarding] sample data seeded');
    } catch (err) {
      console.warn('[onboarding] seed failed:', err);
    }
  }

  // ─── Hint card: dismiss + re-show ────────────────────────────────────────
  function initHintCard() {
    var hint = document.getElementById('onboarding-hint');
    var showBtn = document.getElementById('hint-show-btn');
    if (!hint) return;

    // Cache original markup + parent so we can re-inject later
    var hintHTML = hint.outerHTML;
    var hintParent = hint.parentNode;
    var anchor = hintParent.querySelector('.view-switch');

    function bindDismiss(scope) {
      var btn = scope.querySelector('#onboarding-dismiss');
      if (!btn) return;
      btn.addEventListener('click', function () {
        scope.remove();
        window.storage.set('hintDismissed', true);
        if (showBtn) showBtn.style.display = '';
      });
    }

    function applyHintVisibility() {
      var dismissed = !!window.storage.get('hintDismissed');
      var existing = document.getElementById('onboarding-hint');

      if (showBtn) showBtn.style.display = dismissed ? '' : 'none';

      if (dismissed && existing) {
        existing.remove();
      } else if (!dismissed && !existing) {
        var temp = document.createElement('div');
        temp.innerHTML = hintHTML;
        var fresh = temp.firstElementChild;
        if (anchor && anchor.parentNode === hintParent) {
          hintParent.insertBefore(fresh, anchor);
        } else {
          hintParent.appendChild(fresh);
        }
        bindDismiss(fresh);
        if (window.__i18n__ && window.__i18n__.apply) {
          window.__i18n__.apply(window.__i18n__.get());
        }
      }
    }

    // Wire dismiss on the original card
    bindDismiss(hint);

    // Initial state
    applyHintVisibility();

    // Wire "show again" button (only if present in HTML)
    if (showBtn) {
      showBtn.addEventListener('click', function () {
        window.storage.set('hintDismissed', false);
        applyHintVisibility();
      });
    }
  }

  // Expose
  window.initOnboarding = initOnboarding;
})();