/**
 * js/analytics.js — classic script, no modules.
 * Parses notes['Test Results'] to render the analytics dashboard.
 */
(function () {
  'use strict';

  var container;
  var i18n = function (k, fb) {
    return (window.__i18n__ && window.__i18n__.t) ? window.__i18n__.t(k) : (fb || k);
  };

  function getResultsText(notes) {
    notes = notes || {};
    return notes['__TEST_RESULTS__'] || notes['Test Results'] || '';
  }

  function initAnalytics() {
    container = document.getElementById('analytics-workspace');
    if (!container) {
      container = document.createElement('div');
      container.id = 'analytics-workspace';
      var ws = document.querySelector('.input-workspace') || document.body;
      ws.appendChild(container);
    }

window.subscribe(function (state, prev) {
  if (state.viewMode === 'analytics' &&
     (state.viewMode !== prev.viewMode || state.notes !== prev.notes || state.lang !== prev.lang)) {
    renderDashboard(getResultsText(state.notes));
  }
});

// Initial render if we booted into analytics
var bootState = window.getState();
if (bootState.viewMode === 'analytics') {
  renderDashboard(getResultsText(bootState.notes));
}
  }

  function renderDashboard(rawText) {
    var data = parseResults(rawText);

    if (data.totalSessions === 0) {
      container.innerHTML =
        '<div class="empty-state"><p>' + i18n('analyticsEmpty', 'No test data found. Complete an exam to see analytics!') + '</p></div>';
      return;
    }

    var html = '<div class="analytics-summary-grid">';
    html += '<div class="stat-card"><h3>' + i18n('analyticsTotalTests', 'Total Tests') + '</h3>' +
            '<p class="stat-number">' + data.totalSessions + '</p></div>';

    var avgAccuracy = data.totalQuestions > 0
      ? Math.round((data.totalCorrect / data.totalQuestions) * 100)
      : 0;
    html += '<div class="stat-card"><h3>' + i18n('analyticsAvgAccuracy', 'Average Accuracy') + '</h3>' +
            '<p class="stat-number">' + avgAccuracy + '%</p></div>';
    html += '</div>';

    html += '<div class="stat-card trouble-list-card"><h3>' + i18n('analyticsTopMissed', 'Top 5 Missed Items') + '</h3>';
    if (data.missedTracker.length === 0) {
      html += '<p class="success-message">' + i18n('analyticsPerfect', 'Perfect score! No missed items tracked.') + '</p>';
    } else {
      html += '<ul>';
      data.missedTracker.slice(0, 5).forEach(function (item) {
        html += '<li><span class="missed-word-text">' + escapeHTML(item.word) + '</span> ' +
                '<span class="missed-count">(' + item.count + 'x)</span></li>';
      });
      html += '</ul>';
    }
    html += '</div>';

    container.innerHTML = html;
  }

  function parseResults(text) {
    var logs = text.split('---');
    var totalSessions = 0, totalCorrect = 0, totalQuestions = 0;
    var missedCounts = {};

    logs.forEach(function (log) {
      var lines = log.split('\n')
        .filter(function (l) { return l.trim(); });
      if (!lines.length) return;

      // Score line: "3 out of 5", "3 trên 5" or "3 / 5". Take the last such line
      // (works for old one-line headers and the new multi-line format).
      var m = null;
      lines.forEach(function (l) {
        if (l.indexOf('→') !== -1 || /^[ \t]/.test(l)) return;
        var mm = l.match(/(\d+)\s+(?:out\s+of|trên|\/)\s+(\d+)/i);
        if (mm) m = mm;
      });
      if (!m) return;

      totalSessions++;
      totalCorrect   += parseInt(m[1], 10) || 0;
      totalQuestions += parseInt(m[2], 10) || 0;

      lines.forEach(function (l) {
        if (l.indexOf('→') !== -1) {
          var key = l.split('→')[0].trim();
          if (key) missedCounts[key] = (missedCounts[key] || 0) + 1;
        }
      });
    });

    var missedTracker = Object.keys(missedCounts)
      .map(function (k) { return { word: k, count: missedCounts[k] }; })
      .sort(function (a, b) { return b.count - a.count; });

    return { totalSessions, totalCorrect, totalQuestions, missedTracker };
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  window.initAnalytics = initAnalytics;
})();