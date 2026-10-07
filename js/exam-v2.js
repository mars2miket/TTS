/**
 * exam.js — classic script.
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

  // ─── Module state ────────────────────────────────────────────────────────
  var deck = [];
  var currentItem = null;
  var mode = 'choice';
  var reverse = false;
  var counter = 0;
  var correct = 0;
  var answered = 0;
  var missed = [];
  var listName = null;
  var active = false;

  // ─── DOM refs ────────────────────────────────────────────────────────────
  var startBtn, backBtn, picker, viewer, grid, gridFooter, hintCard, counterStrip, counterWrap;
  var gridContainer;

  // ─── Init ────────────────────────────────────────────────────────────────
  function initExam() {
    startBtn      = document.getElementById('start-test-btn');
    backBtn       = document.getElementById('exam-back-btn');
    picker        = document.getElementById('exam-list-picker');
    viewer        = document.getElementById('recall-viewer');
    counterStrip  = document.getElementById('exam-counter');
    counterWrap   = document.querySelector('.exam-counter-strip');
    gridContainer = document.getElementById('spreadsheet-container');
    gridFooter    = document.querySelector('.grid-footer');
    hintCard      = document.getElementById('onboarding-hint');

    if (startBtn) startBtn.addEventListener('click', startExam);
    if (backBtn)  backBtn.addEventListener('click', exitExam);

    window.addEventListener('load', function () {
      setTimeout(function () {
        if (window.storage.get('mode') === 'exam') {
          window.storage.remove('examPartial');
          startExam();
        }
      }, 200);
    });
  }

  // ─── Start / Exit ────────────────────────────────────────────────────────
  function startExam() {
    var state = window.getState();
    var rows = state.rows || [];

    deck = rows
      .filter(function (r) { return (r.a || '').trim() && (r.b || '').trim(); })
      .map(function (r) {
        var a = r.a.trim(), b = r.b.trim();
        return reverse
          ? { prompt: b, answer: a }
          : { prompt: a, answer: b };
      });

    if (deck.length === 0) {
      alert('No testable rows. Fill both columns first.');
      return;
    }

    deck = shuffle(deck);

    listName = state.activeList || 'Untitled';
    counter = 0;
    correct = 0;
    answered = 0;
    missed = [];
    active = true;

    if (gridContainer) gridContainer.classList.add('exam-hidden');
    if (gridFooter)    gridFooter.classList.add('exam-hidden');
    if (hintCard)      hintCard.classList.add('exam-hidden');
    if (viewer)        viewer.classList.add('exam-active');
    if (counterWrap)   counterWrap.classList.add('exam-active');

    window.storage.set('mode', 'exam');
    refreshPicker();
    renderExamShell();

    nextQuestion();
  }

  function exitExam() {
    savePartial();
    active = false;

    if (gridContainer) gridContainer.classList.remove('exam-hidden');
    if (gridFooter)    gridFooter.classList.remove('exam-hidden');
    if (hintCard && !window.storage.get('hintDismissed')) {
      hintCard.classList.remove('exam-hidden');
    }
    if (viewer) viewer.classList.remove('exam-active');
    if (counterWrap) counterWrap.classList.remove('exam-active');

    window.storage.set('mode', 'grid');
    window.storage.remove('examPartial');
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
  }

  // ─── Counter ─────────────────────────────────────────────────────────────
  function updateCounter() {
    if (!counterStrip) return;
    counterStrip.textContent =
      t('examQuestionLabel') + ' ' + counter + ' · ' +
      correct + ' ' + t('examTallyCorrect') + ' / ' +
      answered + ' ' + t('examTallyAnswered');
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
      rebuildRemainingDeck();
      renderQuestion();
    });
    return btn;
  }

  function rebuildRemainingDeck() {
    var state = window.getState();
    var rows = state.rows || [];
    var allItems = rows
      .filter(function (r) { return (r.a || '').trim() && (r.b || '').trim(); })
      .map(function (r) {
        var a = r.a.trim(), b = r.b.trim();
        return reverse
          ? { prompt: b, answer: a }
          : { prompt: a, answer: b };
      });

    deck = allItems.filter(function (item) {
      return !isServed(item);
    });
    deck = shuffle(deck);
  }

  var servedItems = {};
  function markServed(item) {
    servedItems[item.prompt + '|' + item.answer] = true;
  }
  function isServed(item) {
    return !!servedItems[item.prompt + '|' + item.answer];
  }

  // ─── Answer builders ─────────────────────────────────────────────────────
  function buildChoice(body, feedback, nextBtn) {
    var all = window.getState().rows || [];
    var wrongPool = [];
    var seen = {};
    all.forEach(function (r) {
      var a = (r.a || '').trim(), b = (r.b || '').trim();
      if (!a || !b) return;
      var ans = reverse ? a : b;
      if (ans === currentItem.answer) return;
      if (seen[ans]) return;
      seen[ans] = true;
      wrongPool.push(ans);
    });
    wrongPool = shuffle(wrongPool).slice(0, 3);

    var options = shuffle([currentItem.answer].concat(wrongPool));

    options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.textContent = opt;
      btn.addEventListener('click', function () {
        body.querySelectorAll('.answer-btn').forEach(function (b) {
          b.disabled = true;
          if (b.textContent === currentItem.answer) b.classList.add('correct');
        });
        if (opt !== currentItem.answer) {
          btn.classList.add('wrong');
          recordMiss();
        } else {
          correct++;
        }
        answered++;
        updateCounter();
        markServed(currentItem);
        savePartial();
        showFeedback(feedback, opt === currentItem.answer, currentItem.answer);
        if (nextBtn) nextBtn.disabled = false;
      });
      body.appendChild(btn);
    });
  }

  function buildTF(body, feedback, nextBtn) {
    var state = window.getState();
    var rows = state.rows || [];
    var wrongPool = [];
    var seen = {};
    rows.forEach(function (r) {
      var a = (r.a || '').trim(), b = (r.b || '').trim();
      if (!a || !b) return;
      var ans = reverse ? a : b;
      if (ans === currentItem.answer) return;
      if (seen[ans]) return;
      seen[ans] = true;
      wrongPool.push(ans);
      if (nextBtn) nextBtn.disabled = false;
    });

    var isTrue = wrongPool.length === 0 || Math.random() < 0.5;
    var shown = isTrue
      ? currentItem.answer
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
      var expected = currentItem.answer.trim().toLowerCase();
      var isCorrect = given === expected;

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
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submit.click(); }
    });

    body.appendChild(input);
    body.appendChild(submit);
    input.focus();
    if (nextBtn) nextBtn.disabled = false;
  }

  function showFeedback(el, correct, expected) {
    el.innerHTML = correct
      ? '<span class="ok">' + t('examCorrect') + '</span>'
      : '<span class="bad">' + t('examIncorrect') + '</span> <strong>' + escapeHtml(expected) + '</strong>';
  }

  function recordMiss() {
    missed.push({ prompt: currentItem.prompt, answer: currentItem.answer });
  }

  // ─── Save partial ────────────────────────────────────────────────────────
  function savePartial() {
    window.storage.set('examPartial', {
      listName: listName,
      correct: correct,
      answered: answered,
      missed: missed.slice()
    });
  }

  // ─── Complete ────────────────────────────────────────────────────────────
  function completeExam() {
    active = false;

    writeResultsToNote({
      listName: listName,
      correct: correct,
      answered: answered,
      missed: missed.slice()
    }, false);

    var wrap = getWrapper();
    if (!wrap) return;
    wrap.innerHTML = '';

    var card = document.createElement('div');
    card.className = 'exam-complete-card';

    var title = document.createElement('h3');
    title.textContent = t('examComplete');
    card.appendChild(title);

    var score = document.createElement('p');
    score.className = 'exam-score';
    score.textContent = correct + ' / ' + answered;
    card.appendChild(score);

    if (missed.length > 0) {
      var h = document.createElement('h4');
      h.textContent = t('examMissed');
      card.appendChild(h);

      var ul = document.createElement('ul');
      ul.className = 'missed-list';
      missed.forEach(function (m) {
        var li = document.createElement('li');
        li.textContent = m.prompt + ' → ' + m.answer;
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }

    var back = document.createElement('button');
    back.className = 'answer-btn primary';
    back.textContent = t('examBackToList');
    back.addEventListener('click', function () {
      window.storage.set('mode', 'grid');
      window.storage.remove('examPartial');
      exitExam();
    });
    card.appendChild(back);

    wrap.appendChild(card);

    window.storage.set('mode', 'grid');
    window.storage.remove('examPartial');
  }

  // ─── Results note ────────────────────────────────────────────────────────
  function writeResultsToNote(result, isPartial) {
    var state = window.getState();
    var notes = Object.assign({}, state.notes);
    var existing = notes['Test Results'] || '';

    var date = formatDate(new Date());
    var line = date + ', ' + result.listName + ' — ' + result.correct + '/' + result.answered;
    var body = line + '\n';

    if (result.missed && result.missed.length > 0) {
      result.missed.forEach(function (m) {
        body += m.prompt + ' → ' + m.answer + '\n';
      });
    }
    body += '---\n';

    notes['Test Results'] = (existing ? existing + '\n' : '') + body;
    window.setState({ notes: notes });
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
      op.textContent = name;
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
  // Called by i18n.js on language change. Re-renders the active question
  // (or the empty shell) so all labels pick up the new language.
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