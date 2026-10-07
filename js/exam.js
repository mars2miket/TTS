/**
 * exam.js — classic script.
 * -----------------------------------------------------------------------------
 * Speed-Grill exam engine. Wires the Start Test button and renders the exam.
 *
 * Behaviors:
 *   • Deck = rows where BOTH cells have content
 *   • 3 modes: choice | tf | type
 *   • Direction toggle: A→B or B→A (does NOT restart; applies to remaining deck)
 *   • Wrong answers dropped, tallied in counter
 *   • List switching during exam writes partial results first
 *   • Refresh mid-test → writes partial results, returns to grid
 *   • Complete → writes results, shows complete card with missed items
 *   • Results go to a "Results" note (created if missing, appended if not)
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  // ─── Module state ────────────────────────────────────────────────────────
  var deck = [];                    // remaining items
  var currentItem = null;           // { prompt, answer }
  var mode = 'choice';
  var reverse = false;
  var counter = 0;
  var correct = 0;
  var answered = 0;
  var missed = [];                  // [{ prompt, answer }]
  var listName = null;
  var active = false;

  // ─── DOM refs (set in init) ──────────────────────────────────────────────
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

    // Restore exam mode on refresh — restart the exam fresh
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

    // Build deck from rows where both cells have content
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

    // Shuffle
    deck = shuffle(deck);

    listName = state.activeList || 'Untitled';
    counter = 0;
    correct = 0;
    answered = 0;
    missed = [];
    active = true;

    // Show exam view
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
      var t = a[i]; a[i] = a[j]; a[j] = t;
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
      'Question ' + counter + ' · ' + correct + ' correct / ' + answered + ' answered';
  }

  // ─── Render shell (topbar + empty card) ──────────────────────────────────
  function renderExamShell() {
    if (!viewer) return;

    // Preserve topbar
    var topbar = viewer.querySelector('.exam-topbar');
    viewer.innerHTML = '';
    if (topbar) viewer.appendChild(topbar);

    // Wrapper
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

    // Mode row
    wrap.appendChild(buildModeRow());

    // Direction toggle
    wrap.appendChild(buildDirectionBtn());

    // Prompt
    var prompt = document.createElement('div');
    prompt.className = 'prompt-line';
    prompt.innerHTML = '<strong>Exam Prompt: </strong>' + escapeHtml(currentItem.prompt);
    wrap.appendChild(prompt);

    // Answer area
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
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = true;
    nextBtn.addEventListener('click', function () {
      nextQuestion();
    });
    nextRow.appendChild(nextBtn);
    wrap.appendChild(nextRow);

    // Pass the next button into the answer builders so they can enable it
    if (mode === 'choice') buildChoice(body, feedback, nextBtn);
    else if (mode === 'tf') buildTF(body, feedback, nextBtn);
    else buildType(body, feedback, nextBtn);
  }

  function buildModeRow() {
    var row = document.createElement('div');
    row.className = 'mode-row';

    var modes = [
      { id: 'choice', label: 'Multi Choice' },
      { id: 'tf',     label: 'T / F' },
      { id: 'type',   label: 'Fill-in-Blank' }
    ];

    modes.forEach(function (m) {
      var b = document.createElement('button');
      b.className = 'mode-btn' + (m.id === mode ? ' active' : '');
      b.textContent = m.label;
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
      // Rebuild remaining deck in new direction, keep current question as-is
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

    // Keep only items that haven't been served yet (match by prompt+answer)
    var served = {};
    missed.forEach(function (m) { served[m.prompt + '|' + m.answer] = true; });
    if (currentItem) served[currentItem.prompt + '|' + currentItem.answer] = true;

    // We don't have a good way to know which correct items were served.
    // Track served correctly as we go.
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

    ['True', 'False'].forEach(function (label) {
      var val = label === 'True';
      var btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.textContent = label;
      btn.addEventListener('click', function () {
        var isCorrect = val === isTrue;
        body.querySelectorAll('.answer-btn').forEach(function (b) {
          b.disabled = true;
          var correctBtn = (b.textContent === 'True') === isTrue;
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
        showFeedback(feedback, isCorrect, isTrue ? 'True' : 'False');
      });
      body.appendChild(btn);
    });
  }

  function buildType(body, feedback, nextBtn) {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'answer-input';
    input.placeholder = 'Your answer';
    input.autocomplete = 'off';

    var submit = document.createElement('button');
    submit.className = 'answer-btn primary';
    submit.textContent = 'Check Answer';
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
      ? '<span class="ok">✅ Correct</span>'
      : '<span class="bad">❌ Incorrect</span> — correct answer: <strong>' + escapeHtml(expected) + '</strong>';
  }

  function recordMiss() {
    missed.push({ prompt: currentItem.prompt, answer: currentItem.answer });
  }

  // ─── Save partial (refresh/closing safety net) ───────────────────────────
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

    // Write results to Results note
    writeResultsToNote({
      listName: listName,
      correct: correct,
      answered: answered,
      missed: missed.slice()
    }, false);

    // Render complete card
    var wrap = getWrapper();
    if (!wrap) return;
    wrap.innerHTML = '';

    var card = document.createElement('div');
    card.className = 'exam-complete-card';

    var title = document.createElement('h3');
    title.textContent = 'Test complete';
    card.appendChild(title);

    var score = document.createElement('p');
    score.className = 'exam-score';
    score.textContent = 'Score ' + correct + '/' + answered;
    card.appendChild(score);

    if (missed.length > 0) {
      var h = document.createElement('h4');
      h.textContent = 'Missed items';
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
    back.textContent = 'Back to List';
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
    var existing = notes['Results'] || '';

    var date = formatDate(new Date());
    var line = date + ', ' + result.listName + ' — Score ' + result.correct + '/' + result.answered;
    var body = line + '\n';

    if (result.missed && result.missed.length > 0) {
      result.missed.forEach(function (m) {
        body += m.prompt + ' → ' + m.answer + '\n';
      });
    }
    body += '---\n';

    notes['Results'] = (existing ? existing + '\n' : '') + body;
    window.setState({ notes: notes });
  }

  function formatDate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // ─── List picker (topbar) ────────────────────────────────────────────────
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

    // Save partial to Results, then switch
    savePartial();
    var partial = window.storage.get('examPartial');
    if (partial && partial.answered > 0) {
      writeResultsToNote(partial, true);
    }
    window.storage.remove('examPartial');

    // Switch list — reuse lists.js machinery via state mutation
    var lists = Object.assign({}, state.lists);
    lists[state.activeList] = window.serializeGrid();
    window.setState({
      lists: lists,
      activeList: newName,
      rows: window.parseList(lists[newName])
    });

    // Restart exam with new list
    active = false;
    startExam();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // Expose
  window.initExam = initExam;
})();