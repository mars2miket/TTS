/**
 * exam-v2.js — classic script.
 * -----------------------------------------------------------------------------
 * Speed-Grill exam engine. Wires the Start Test button and renders the exam.
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  // ─── i18n helper ─────────────────────────────────────────────────────────
  function t(key) {
    return (window.__i18n__ && window.__i18n__.t) ? window.__i18n__.t(key) : key;
  }

  var RESULTS_KEY = '__TEST_RESULTS__';
  var MISSED_KEY  = '__MISSED_QUESTIONS__';

  // ─── Module state ────────────────────────────────────────────────────────
  var deck = [];
  var currentItem = null;
  var mode = window.storage.get('examMode') || 'choice';
  var modesUsed = [];
  var skipped = [];
  var totalCount = 0;
  var reverse = window.storage.get('examReverse') === true || window.storage.get('examReverse') === 'true';
  var counter = 0;
  var correct = 0;
  var answered = 0;
  var missed = [];
  var listName = null;
  var active = false;
  var examComplete = false;

  // ─── DOM refs ────────────────────────────────────────────────────────────
  var startBtn, backBtn, picker, viewer, grid, gridFooter, hintCard, counterStrip, counterWrap;
  var gridContainer, viewSwitch;

  // ─── Init ────────────────────────────────────────────────────────────────
  function initExam() {
    startBtn      = document.getElementById('start-test-btn');
    backBtn       = document.getElementById('exam-back-btn');
    picker        = document.getElementById('exam-list-picker');
    viewer        = document.getElementById('recall-viewer');
    counterStrip  = document.getElementById('exam-counter');
    counterWrap   = document.querySelector('.exam-counter-strip');
    gridContainer = document.getElementById('grid-workspace');
    gridFooter    = document.querySelector('.grid-footer');
    hintCard      = document.getElementById('onboarding-hint');
    viewSwitch    = document.querySelector('.view-switch');

    if (startBtn) startBtn.addEventListener('click', function () { startExam(); });
    if (backBtn)  backBtn.addEventListener('click', exitExam);

    // Exit exam if the user switches away from Lists view
    window.subscribe(function (state, prev) {
      if (state.viewMode !== prev.viewMode && state.viewMode !== 'lists' && active) {
        exitExam();
      }
    });

    window.addEventListener('load', function () {
      setTimeout(function () {
        if (window.storage.get('mode') === 'exam') {
          window.storage.remove('examPartial');
          var sess = window.storage.get('examSession');
          var st0 = window.getState();
          if (sess && Array.isArray(sess.deck) && (sess.examComplete || sess.activeList === st0.activeList)) {
            resumeExam(sess);
          } else {
            startExam();
          }
        }
      }, 200);
    });
  }

  // ─── Start / Exit ────────────────────────────────────────────────────────
  function startExam() {
    var state = window.getState();
    var rows = state.rows || [];

    deck = buildItems(rows, reverse);

    if (deck.length === 0) {
      alert('No testable rows. Fill both columns first.');
      return;
    }

    deck = shuffle(deck);

    listName = window.getDisplayName ? window.getDisplayName(state.activeList, 'lists') : (state.activeList || 'Untitled');
    totalCount = deck.length;
    skipped = [];
    counter = 0;
    correct = 0;
    answered = 0;
    missed = [];
    modesUsed = [mode];
    servedItems = {};
    active = true;
    examComplete = false;
    window.storage.remove('examSession');

    enterExamUI();

    window.storage.set('mode', 'exam');
    refreshPicker();
    renderExamShell();

    nextQuestion();
  }

  // ─── Question building (rows sharing a prompt = ONE question) ────────────
  function norm(x) { return String(x || '').trim().toLowerCase(); }

  function buildItems(rows, rev) {
    var groups = {}, order = [];
    (rows || []).forEach(function (r) {
      var a = (r.a || '').trim(), b = (r.b || '').trim();
      if (!a || !b) return;
      var p = rev ? b : a, ans = rev ? a : b;
      var k = norm(p);
      if (!groups[k]) { groups[k] = { prompt: p, answers: [] }; order.push(k); }
      var g = groups[k];
      if (!g.answers.some(function (x) { return norm(x) === norm(ans); })) g.answers.push(ans);
    });
    return order.map(function (k) {
      var g = groups[k];
      g.answer = g.answers.join(' / ');
      return g;
    });
  }

  function validAnswers(item) {
    return (item.answers && item.answers.length) ? item.answers : [item.answer];
  }

  // Distractors: every answer in the list that is NOT a valid answer for this item
  function wrongPoolFor(item) {
    var valid = {}, seen = {}, pool = [];
    validAnswers(item).forEach(function (x) { valid[norm(x)] = true; });
    (window.getState().rows || []).forEach(function (r) {
      var a = (r.a || '').trim(), b = (r.b || '').trim();
      if (!a || !b) return;
      var ans = reverse ? a : b;
      var k = norm(ans);
      if (valid[k] || seen[k]) return;
      seen[k] = true;
      pool.push(ans);
    });
    return pool;
  }

  function itemPairs(item, rev) {
    return validAnswers(item).map(function (x) {
      return rev ? { a: x, b: item.prompt } : { a: item.prompt, b: x };
    });
  }

  function enableNext(btn) {
    if (btn) btn.disabled = false;
    var sk = document.getElementById('exam-skip-btn');
    if (sk) sk.disabled = true;
  }

  function skipCurrent() {
    var nb = document.getElementById('exam-next-btn');
    if (!currentItem || !nb || !nb.disabled) return; // already answered
    var entry = { prompt: currentItem.prompt, answer: currentItem.answer,
                  answers: validAnswers(currentItem), rev: reverse, skipped: true };
    skipped.push(entry);
    missed.push(entry);   // a skip counts as incorrect everywhere
    addToMissedList(entry);
    markServed(currentItem);
    nextQuestion();
  }

  function enterExamUI() {
    if (gridContainer) gridContainer.classList.add('exam-hidden');
    if (gridFooter)    gridFooter.classList.add('exam-hidden');
    if (hintCard)      hintCard.classList.add('exam-hidden');
    if (viewSwitch)    viewSwitch.classList.add('exam-hidden');
    if (viewer)        viewer.classList.add('exam-active');
    if (counterWrap)   counterWrap.classList.add('exam-active');
  }

  // ─── Resume after refresh ────────────────────────────────────────────────
  function persistSession(answeredCurrent) {
    if (!active && !examComplete) return;
    window.storage.set('examSession', {
      activeList: window.getState().activeList,
      listName: listName,
      deck: deck,
      currentItem: currentItem,
      counter: counter,
      correct: correct,
      answered: answered,
      missed: missed,
      skipped: skipped,
      totalCount: totalCount,
      modesUsed: modesUsed,
      served: servedItems,
      examComplete: !!examComplete,
      answeredCurrent: !!answeredCurrent
    });
  }

  function resumeExam(s) {
    deck = s.deck || [];
    currentItem = s.currentItem || null;
    counter = s.counter || 0;
    correct = s.correct || 0;
    answered = s.answered || 0;
    missed = s.missed || [];
    skipped = s.skipped || [];
    totalCount = s.totalCount || ((s.deck || []).length + (s.counter || 0));
    modesUsed = (s.modesUsed && s.modesUsed.length) ? s.modesUsed : [mode];
    if (modesUsed.indexOf(mode) === -1) modesUsed.push(mode);
    servedItems = s.served || {};
    listName = s.listName || listName;
    examComplete = !!s.examComplete;
    active = !examComplete;

    enterExamUI();
    window.storage.set('mode', 'exam');
    refreshPicker();
    renderExamShell();

    if (examComplete) {
      renderCompleteCard();
      return;
    }

    if (s.answeredCurrent || !currentItem) {
      nextQuestion();
    } else {
      renderQuestion();
      updateCounter();
    }
  }

  function exitExam() {
    savePartial();
    active = false;

    if (gridContainer) gridContainer.classList.remove('exam-hidden');
    if (gridFooter)    gridFooter.classList.remove('exam-hidden');
    if (hintCard && !window.storage.get('hintDismissed')) {
      hintCard.classList.remove('exam-hidden');
    }
    if (viewSwitch) viewSwitch.classList.remove('exam-hidden');
    if (viewer) viewer.classList.remove('exam-active');
    if (counterWrap) counterWrap.classList.remove('exam-active');

    window.storage.set('mode', 'grid');
    window.storage.remove('examPartial');
    window.storage.remove('examSession');
  }

  // ─── Deck helpers ────────────────────────────────────────────────────────
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function nextQuestion() {
    if (deck.length === 0) {
      completeExam();
      return;
    }
    currentItem = deck.pop();
    counter++;
    renderQuestion();
    updateCounter();
    persistSession(false);
  }

  // ─── Counter ─────────────────────────────────────────────────────────────
  function totalQuestions() {
    return buildItems(window.getState().rows || [], reverse).length;
  }
  function totalLabel() {
    var v = t('examTotal');
    return (v && v !== 'examTotal') ? v : 'Total';
  }

  function updateCounter() {
    if (!counterStrip) return;
    counterStrip.textContent =
      t('examQuestionLabel') + ' ' + counter + ' · ' +
      correct + ' ' + t('examTallyCorrect') + ' / ' +
      answered + ' ' + t('examTallyAnswered') + ' · ' + totalLabel() + ': ' + (totalCount || totalQuestions()) +
      (skipped.length ? ' · ' + t('resultSkipped') + ': ' + skipped.length : '');
  }

  // ─── Render shell ────────────────────────────────────────────────────────
  function renderExamShell() {
    if (!viewer) return;

    var topbar = viewer.querySelector('.exam-topbar');
    viewer.innerHTML = '';
    if (topbar) viewer.appendChild(topbar);

    var wrap = document.createElement('div');
    wrap.className = 'exam-question-wrapper';
    viewer.appendChild(wrap);
  }

  function getWrapper() {
    return viewer ? viewer.querySelector('.exam-question-wrapper') : null;
  }

  // ─── Render current question ─────────────────────────────────────────────
  function renderQuestion() {
    var wrap = getWrapper();
    if (!wrap) {
      renderExamShell();
      wrap = getWrapper();
    }
    wrap.innerHTML = '';

    wrap.appendChild(buildModeRow());
    wrap.appendChild(buildDirectionBtn());

    var prompt = document.createElement('div');
    prompt.className = 'prompt-line';
    prompt.innerHTML = '<strong>' + t('examPrompt') + ': </strong>' + escapeHtml(currentItem.prompt);
    wrap.appendChild(prompt);

    var body = document.createElement('div');
    body.className = 'exam-body mode-' + mode;
    wrap.appendChild(body);

    var feedback = document.createElement('div');
    feedback.className = 'exam-feedback';
    wrap.appendChild(feedback);

    var nextRow = document.createElement('div');
    nextRow.className = 'next-row';
    var nextBtn = document.createElement('button');
    nextBtn.className = 'answer-btn primary';
    nextBtn.id = 'exam-next-btn';
    nextBtn.textContent = t('examNext') + ' →';
    nextBtn.disabled = true;
    nextBtn.addEventListener('click', function () {
      nextQuestion();
    });
    var skipBtn = document.createElement('button');
    skipBtn.className = 'answer-btn';
    skipBtn.id = 'exam-skip-btn';
    skipBtn.textContent = t('examSkip');
    skipBtn.addEventListener('click', skipCurrent);
    nextRow.appendChild(skipBtn);
    nextRow.appendChild(nextBtn);
    wrap.appendChild(nextRow);

    if (mode === 'choice') buildChoice(body, feedback, nextBtn);
    else if (mode === 'tf') buildTF(body, feedback, nextBtn);
    else buildType(body, feedback, nextBtn);
  }

  function buildModeRow() {
    var row = document.createElement('div');
    row.className = 'mode-row';

    var modes = [
      { id: 'choice', labelKey: 'examMultiChoice' },
      { id: 'tf',     labelKey: 'examTF' },
      { id: 'type',   labelKey: 'examFillBlank' }
    ];

    modes.forEach(function (m) {
      var b = document.createElement('button');
      b.className = 'mode-btn' + (m.id === mode ? ' active' : '');
      b.textContent = t(m.labelKey);
      b.addEventListener('click', function () {
        if (mode === m.id) return;
        mode = m.id;
        window.storage.set('examMode', mode);
        if (modesUsed.indexOf(mode) === -1) modesUsed.push(mode);
        renderQuestion();
      });
      row.appendChild(b);
    });

    return row;
  }

  function buildDirectionBtn() {
    var btn = document.createElement('button');
    btn.className = 'dir-btn';
    btn.textContent = reverse ? 'B → A' : 'A → B';
    btn.addEventListener('click', function () {
      reverse = !reverse;
      window.storage.set('examReverse', reverse);
      var nb = document.getElementById('exam-next-btn');
      if (currentItem && nb && nb.disabled) {
        var firstAns = norm(validAnswers(currentItem)[0]);
        var oldPrompt = currentItem.prompt;
        var found = buildItems(window.getState().rows || [], reverse).filter(function (g) {
          return norm(g.prompt) === firstAns;
        })[0];
        currentItem = found || {
          prompt: validAnswers(currentItem)[0], answers: [oldPrompt], answer: oldPrompt
        };
        markServed(currentItem);
      }
      rebuildRemainingDeck();
      renderQuestion();
    });
    return btn;
  }

  function rebuildRemainingDeck() {
    var allItems = buildItems(window.getState().rows || [], reverse);

    deck = allItems.filter(function (item) {
      return !isServed(item);
    });
    deck = shuffle(deck);
  }

  var servedItems = {};
  function pairKey(p) { return p.a + '\u0001' + p.b; }
  function markServed(item) {
    itemPairs(item, reverse).forEach(function (p) { servedItems[pairKey(p)] = true; });
  }
  function isServed(item) {
    return itemPairs(item, reverse).every(function (p) { return !!servedItems[pairKey(p)]; });
  }

  // ─── Answer builders ─────────────────────────────────────────────────────
  function buildChoice(body, feedback, nextBtn) {
    var valid = validAnswers(currentItem);
    var correctText = valid[Math.floor(Math.random() * valid.length)];
    var wrongPool = shuffle(wrongPoolFor(currentItem)).slice(0, 3);
    var options = shuffle([correctText].concat(wrongPool));

    options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.textContent = opt;
      btn.addEventListener('click', function () {
        var isRight = opt === correctText;
        body.querySelectorAll('.answer-btn').forEach(function (b) {
          b.disabled = true;
          if (b.textContent === correctText) b.classList.add('correct');
        });
        if (!isRight) {
          btn.classList.add('wrong');
          recordMiss();
        } else {
          correct++;
        }
        answered++;
        updateCounter();
        markServed(currentItem);
        savePartial();
        showFeedback(feedback, isRight, currentItem.answer);
        enableNext(nextBtn);
      });
      body.appendChild(btn);
    });
  }

  function buildTF(body, feedback, nextBtn) {
    var valid = validAnswers(currentItem);
    var wrongPool = wrongPoolFor(currentItem);

    var isTrue = wrongPool.length === 0 || Math.random() < 0.5;
    var shown = isTrue
      ? valid[Math.floor(Math.random() * valid.length)]
      : wrongPool[Math.floor(Math.random() * wrongPool.length)];

    var statement = document.createElement('div');
    statement.className = 'tf-statement';
    statement.textContent = shown;
    body.appendChild(statement);

    [
      { labelKey: 'examTrue',  val: true  },
      { labelKey: 'examFalse', val: false }
    ].forEach(function (entry) {
      var btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.textContent = t(entry.labelKey);
      btn.addEventListener('click', function () {
        var isCorrect = entry.val === isTrue;
        body.querySelectorAll('.answer-btn').forEach(function (b) {
          b.disabled = true;
          var correctBtn = (b.textContent === t('examTrue')) === isTrue;
          if (correctBtn) b.classList.add('correct');
        });
        if (!isCorrect) {
          btn.classList.add('wrong');
          recordMiss();
        } else {
          correct++;
        }
        answered++;
        updateCounter();
        markServed(currentItem);
        savePartial();
        showFeedback(feedback, isCorrect, isTrue ? t('examTrue') : t('examFalse'));
        enableNext(nextBtn);
      });
      body.appendChild(btn);
    });
  }

  function buildType(body, feedback, nextBtn) {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'answer-input';
    input.placeholder = t('examYourAnswer');
    input.autocomplete = 'off';

    var submit = document.createElement('button');
    submit.className = 'answer-btn primary';
    submit.textContent = t('examCheck');
    submit.addEventListener('click', function () {
      var given = input.value.trim().toLowerCase();
      var isCorrect = validAnswers(currentItem).some(function (v) { return norm(v) === given; });

      input.disabled = true;
      submit.disabled = true;

      if (!isCorrect) {
        recordMiss();
        submit.classList.add('wrong');
      } else {
        correct++;
      }
      answered++;
      updateCounter();
      markServed(currentItem);
      savePartial();
      showFeedback(feedback, isCorrect, currentItem.answer);
      enableNext(nextBtn);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submit.click(); }
    });

    body.appendChild(input);
    body.appendChild(submit);
    input.focus();
  }

  function showFeedback(el, correct, expected) {
    el.innerHTML = correct
      ? '<span class="ok">' + t('examCorrect') + '</span>'
      : '<span class="bad">' + t('examIncorrect') + '</span> <strong>' + escapeHtml(expected) + '</strong>';
  }

  function recordMiss() {
    var entry = { prompt: currentItem.prompt, answer: currentItem.answer,
                  answers: validAnswers(currentItem), rev: reverse };
    missed.push(entry);
    addToMissedList(entry);
  }

  // ─── Save partial ────────────────────────────────────────────────────────
  function savePartial() {
    window.storage.set('examPartial', {
      listName: listName,
      correct: correct,
      answered: answered,
      missed: missed.slice(),
      skipped: skipped.slice(),
      modes: modesUsed.slice()
    });
    persistSession(true);
  }

  // ─── Complete ────────────────────────────────────────────────────────────
  function completeExam() {
    active = false;
    examComplete = true;

    writeResultsToNote({
      listName: listName,
      correct: correct,
      answered: answered,
      missed: missed.slice(),
      skipped: skipped.slice(),
      modes: modesUsed.slice()
    }, false);

    renderCompleteCard();

    window.storage.set('mode', 'exam');
    window.storage.remove('examPartial');
    persistSession(true);
  }

  function renderCompleteCard() {
    var wrap = getWrapper();
    if (!wrap) return;
    wrap.innerHTML = '';

    var total = answered + skipped.length;
    var pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    var wrongCount = Math.max(0, missed.length - skipped.length);
    var ringClass = pct >= 80 ? 'ring-good' : (pct >= 50 ? 'ring-mid' : 'ring-low');
    var R = 52, C = 2 * Math.PI * R;

    var card = document.createElement('div');
    card.className = 'exam-complete-card';

    var title = document.createElement('h3');
    title.textContent = t('examComplete');
    card.appendChild(title);

    var sub = document.createElement('p');
    sub.className = 'result-title';
    sub.textContent = listName || '';
    card.appendChild(sub);

    var chips = document.createElement('div');
    chips.className = 'mode-chips';
    (modesUsed.length ? modesUsed : [mode]).forEach(function (id) {
      var chip = document.createElement('span');
      chip.className = 'mode-chip';
      chip.textContent = modeLabel(id);
      chips.appendChild(chip);
    });
    card.appendChild(chips);

    var ring = document.createElement('div');
    ring.className = 'score-ring ' + ringClass;
    ring.innerHTML =
      '<svg viewBox="0 0 120 120" aria-hidden="true">' +
        '<circle class="ring-bg" cx="60" cy="60" r="' + R + '"></circle>' +
        '<circle class="ring-fg" cx="60" cy="60" r="' + R + '" ' +
          'stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '"></circle>' +
      '</svg><div class="ring-text"><span class="ring-pct">0%</span></div>';
    card.appendChild(ring);

    var ringSub = document.createElement('p');
    ringSub.className = 'ring-sub';
    ringSub.textContent = correct + ' / ' + total + ' ' + t('examTallyCorrect');
    card.appendChild(ringSub);

    var tiles = document.createElement('div');
    tiles.className = 'stat-tiles';
    [
      { n: correct,    label: t('tileCorrect'),   cls: 'tile-good' },
      { n: wrongCount, label: t('tileIncorrect'), cls: 'tile-bad' }
    ].concat(skipped.length ? [{ n: skipped.length, label: t('resultSkipped'), cls: 'tile-skip' }] : [])
     .forEach(function (x) {
      var tile = document.createElement('div');
      tile.className = 'stat-tile ' + x.cls;
      tile.innerHTML = '<strong>' + x.n + '</strong><span></span>';
      tile.querySelector('span').textContent = x.label;
      tiles.appendChild(tile);
    });
    card.appendChild(tiles);

    if (missed.length > 0) {
      var h = document.createElement('h4');
      h.textContent = t('examMissed');
      card.appendChild(h);

      var ul = document.createElement('ul');
      ul.className = 'missed-list';
      missed.forEach(function (m) {
        var li = document.createElement('li');
        var txt = document.createElement('span');
        txt.textContent = m.prompt + ' → ' + m.answer;
        li.appendChild(txt);
        if (m.skipped) {
          var badge = document.createElement('em');
          badge.className = 'skip-badge';
          badge.textContent = t('resultSkipped');
          li.appendChild(badge);
        }
        ul.appendChild(li);
      });
      card.appendChild(ul);
    } else if (total > 0) {
      var perfect = document.createElement('p');
      perfect.className = 'perfect-msg';
      perfect.textContent = t('resultPerfect');
      card.appendChild(perfect);
    }

    var actions = document.createElement('div');
    actions.className = 'result-actions';

    var missedN = missedListCount();
    if (missedN > 0) {
      var retry = document.createElement('button');
      retry.className = 'answer-btn primary';
      retry.textContent = t('examTestMissedBtn') + ' (' + missedN + ')';
      retry.addEventListener('click', startMissedTest);
      actions.appendChild(retry);
    }

    var back = document.createElement('button');
    back.className = 'answer-btn' + (missedN > 0 ? '' : ' primary');
    back.textContent = t('examBackToList');
    back.addEventListener('click', function () {
      window.storage.set('mode', 'grid');
      window.storage.remove('examPartial');
      exitExam();
    });
    actions.appendChild(back);
    card.appendChild(actions);

    var hint = document.createElement('p');
    hint.className = 'exam-complete-subtitle';
    hint.textContent = t('examCompleteHint');
    card.appendChild(hint);

    wrap.appendChild(card);

    // Animate ring + count-up
    var fg = ring.querySelector('.ring-fg');
    var pctEl = ring.querySelector('.ring-pct');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(function () {
      fg.style.strokeDashoffset = String(C * (1 - pct / 100));
    });
    if (reduce) {
      pctEl.textContent = pct + '%';
    } else {
      var t0 = null;
      var step = function (ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min((ts - t0) / 900, 1);
        pctEl.textContent = Math.round(p * pct) + '%';
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }

  // ─── Results note ────────────────────────────────────────────────────────
  function modeLabel(id) {
    if (id === 'choice') return t('examMultiChoice');
    if (id === 'tf') return t('examTF');
    return t('examFillBlank');
  }

  function writeResultsToNote(result, isPartial) {
    var state = window.getState();
    var notes = Object.assign({}, state.notes);
    var existing = notes[RESULTS_KEY] || '';

    var skippedList = result.skipped || [];
    var total = result.answered + skippedList.length;
    var pct = total > 0 ? Math.round((result.correct / total) * 100) : 0;
    var modes = (result.modes && result.modes.length ? result.modes : [mode]).map(modeLabel).join(', ');

    var body = t('resultDate') + ': ' + formatDate(new Date()) + '\n'
             + t('resultTitle') + ': ' + result.listName + '\n'
             + t('resultMode') + ': ' + modes + '\n'
             + t('resultScore') + ': ' + result.correct + ' ' + t('examScoreOutOf') + ' '
             + total + ' ' + t('examTallyCorrect') + ' (' + pct + '%)\n';

    if (result.missed && result.missed.length > 0) {
      body += t('resultIncorrect') + ':\n';
      result.missed.forEach(function (m) {
        body += '\t' + m.prompt + ' → ' + m.answer + '\n';
      });
    }
    body += '---\n';

    notes[RESULTS_KEY] = (existing ? existing + '\n' : '') + body;
    window.setState({ notes: notes });
  }

  // ─── Missed Questions list ───────────────────────────────────────────────
  function cleanCell(v) { return String(v).replace(/[\t\n]+/g, ' '); }

  // Adds a missed/skipped item to the persistent "Missed Questions" list (no duplicates)
  function addToMissedList(entry) {
    var st = window.getState();
    if (st.activeList === MISSED_KEY) return;   // already in the list being tested

    var lists = Object.assign({}, st.lists);
    var rows = lists[MISSED_KEY] ? window.parseList(lists[MISSED_KEY]).filter(function (r) {
      return r.a || r.b;
    }) : [];

    var changed = false;
    itemPairs(entry, entry.rev).forEach(function (p) {
      var a = cleanCell(p.a), b = cleanCell(p.b);
      var exists = rows.some(function (r) { return r.a === a && r.b === b; });
      if (!exists) { rows.push({ a: a, b: b }); changed = true; }
    });
    if (!changed) return;

    lists[MISSED_KEY] = rows.map(function (r) { return r.a + '\t' + r.b; }).join('\n');
    window.setState({ lists: lists });
  }

  function missedListCount() {
    var st = window.getState();
    var text = (st.activeList === MISSED_KEY && typeof window.serializeGrid === 'function')
      ? window.serializeGrid() : (st.lists || {})[MISSED_KEY];
    if (!text) return 0;
    return window.parseList(text).filter(function (r) { return r.a && r.b; }).length;
  }

  function startMissedTest() {
    var st = window.getState();
    if (st.activeList !== MISSED_KEY) {
      if (!(st.lists && MISSED_KEY in st.lists)) return;
      var lists = Object.assign({}, st.lists);
      lists[st.activeList] = window.serializeGrid();
      window.setState({
        lists: lists,
        activeList: MISSED_KEY,
        rows: window.parseList(lists[MISSED_KEY])
      });
      if (typeof window.__gridRerender__ === 'function') window.__gridRerender__();
      if (typeof window.updateCharCount === 'function') window.updateCharCount();
      if (typeof window.syncStartTestButton === 'function') window.syncStartTestButton();
    }
    startExam();
  }

  function formatDate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // ─── List picker ─────────────────────────────────────────────────────────
  function refreshPicker() {
    if (!picker) return;
    var state = window.getState();
    var names = Object.keys(state.lists || {});
    picker.innerHTML = '';
    names.forEach(function (name) {
      var op = document.createElement('option');
      op.value = name;
      op.textContent = window.getDisplayName ? window.getDisplayName(name, 'lists') : name;
      picker.appendChild(op);
    });
    if (state.activeList) picker.value = state.activeList;
    picker.onchange = onPickerChange;
  }

  function onPickerChange() {
    var newName = picker.value;
    var state = window.getState();
    if (newName === state.activeList) return;

    savePartial();
    var partial = window.storage.get('examPartial');
    if (partial && partial.answered > 0) {
      writeResultsToNote(partial, true);
    }
    window.storage.remove('examPartial');

    var lists = Object.assign({}, state.lists);
    lists[state.activeList] = window.serializeGrid();
    window.setState({
      lists: lists,
      activeList: newName,
      rows: window.parseList(lists[newName])
    });

    active = false;
    startExam();
  }

  // ─── Language reactivity ─────────────────────────────────────────────────
  function refreshExamLanguage() {
    var wrap = getWrapper();
    if (!wrap) return;

    if (examComplete) {
      renderCompleteCard();
    } else if (active && currentItem) {
      renderQuestion();
      updateCounter();
    } else {
      renderExamShell();
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  window.initExam = initExam;
  window.refreshExamLanguage = refreshExamLanguage;
})();