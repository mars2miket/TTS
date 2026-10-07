/**
 * onboarding.js — classic script.
 * -----------------------------------------------------------------------------
 * Handles:
 *   • First-run seed: writes sample data to localStorage once
 *   • Onboarding hint card dismiss (persists to localStorage)
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  function initOnboarding() {
    seedSampleData();
    initHintDismiss();
  }

  // ─── Sample data seed (first run only) ───────────────────────────────────
  function seedSampleData() {
    try {
      if (window.storage.get('onboarded')) return;

      // Only seed if the user has no real data yet
      var existingRows = window.storage.get('rows', []);
      var hasRealData = Array.isArray(existingRows) && existingRows.some(function (r) {
        return (r.a && r.a.trim()) || (r.b && r.b.trim());
      });
      if (hasRealData) return;

      var lang = document.documentElement.getAttribute('data-lang') || 'en';
      var sample = (window.SAMPLE_DATA && window.SAMPLE_DATA[lang])
                || (window.SAMPLE_DATA && window.SAMPLE_DATA.en);
      if (!sample) return;

      // Convert sample (array of [a, b] pairs) → rows shape
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

  // ─── Hint card dismiss ───────────────────────────────────────────────────
  function initHintDismiss() {
    var hint = document.getElementById('onboarding-hint');
    var btn = document.getElementById('onboarding-dismiss');
    if (!hint || !btn) return;

    if (window.storage.get('hintDismissed')) {
      hint.remove();
      return;
    }

    btn.addEventListener('click', function () {
      hint.remove();
      window.storage.set('hintDismissed', true);
    });
  }

  // Expose
  window.initOnboarding = initOnboarding;
})();