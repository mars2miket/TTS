/**
 * speech.js — classic script.
 * -----------------------------------------------------------------------------
 * Speech synthesis module. Wires:
 *   • Voice enumeration (with gender filter + search)
 *   • Play / pause / stop / rewind / forward
 *   • Loop toggle
 *   • Speed slider (desktop) + speed popup (mobile)
 *   • Chrono timer
 *   • Chunked speech with watchdog + keep-alive (Android-proof)
 *   • Mobile playback bar (shares the same handler as desktop)
 * -----------------------------------------------------------------------------
 */
(function () {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────────────────
  var CHUNK_CHAR_LIMIT = 250;
  var SEEK_WORD_COUNT = 5;

  // ─── DOM refs ────────────────────────────────────────────────────────────
  var synth, readBtn, stopBtn, rewindBtn, forwardBtn, loopCheck;
  var mobileReadBtn, mobileStopBtn, mobileRewindBtn, mobileForwardBtn, mobileLoopCheck;
  var speedSlider, speedValue, genderFilter, voiceSearch, voiceSelect;
  var timerDisplay, timerResetBtn;
  var menuBtn, menuPopup, speedOpenBtn, speedPopup;

  // ─── Runtime ─────────────────────────────────────────────────────────────
  var allVoices = [];
  var filteredVoices = [];
  var currentUtterance = null;
  var speechChunks = [];
  var currentChunkIndex = 0;
  var chunkBaseIndex = 0;
  var isChunkTransitionCancelled = false;
  var chunkWatchdog = null;
  var keepAliveTimer = null;
  var sessionTimerInterval = null;
  var sessionStartMs = 0;
  var elapsedMs = 0;

  var femaleKeywords = [
    'adri','amala','andrea','anna','aria','asilia','ava','belkys','catalina',
    'christel','clara','elena','elsa','emily','emma','ezinne','female',
    'google uk english female','hazel','heera','imani','ingrid','ja','jenny',
    'joana','karen','katja','leah','leni','libby','luna','maria','michelle',
    'moira','molly','natasha','nia','ramona','rosa','salome','samantha',
    'seraphina','sofia','sonia','tessa','vesna','victoria','vlasta','yan','zira'
  ];

  // ─── Init ────────────────────────────────────────────────────────────────
  function initSpeech() {
    synth              = window.speechSynthesis;
    readBtn            = document.getElementById('read-btn');
    stopBtn            = document.getElementById('stop-btn');
    rewindBtn          = document.getElementById('rewind-btn');
    forwardBtn         = document.getElementById('forward-btn');
    loopCheck          = document.getElementById('loop-check');
    mobileReadBtn      = document.getElementById('m-read-btn');
    mobileStopBtn      = document.getElementById('m-stop-btn');
    mobileRewindBtn    = document.getElementById('m-rewind-btn');
    mobileForwardBtn   = document.getElementById('m-forward-btn');
    mobileLoopCheck    = document.getElementById('m-loop-check');
    speedSlider        = document.getElementById('speed-slider');
    speedValue         = document.getElementById('speed-value');
    genderFilter       = document.getElementById('gender-filter');
    voiceSearch        = document.getElementById('voice-search');
    voiceSelect        = document.getElementById('voice-select');
    timerDisplay       = document.getElementById('timer-display');
    timerResetBtn      = document.getElementById('timer-reset-btn');
    menuBtn            = document.getElementById('m-menu-btn');
    menuPopup          = document.getElementById('m-menu-popup');
    speedOpenBtn       = document.getElementById('m-speed-open-btn');
    speedPopup         = document.getElementById('m-speed-popup');

    if (!synth) {
      console.warn('[speech] SpeechSynthesis not supported');
      return;
    }

    // ─── Voices ───
    populateVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = populateVoices;
    }

    // ─── Desktop controls ───
    if (readBtn)      readBtn.addEventListener('click', handleReadClick);
    if (stopBtn)      stopBtn.addEventListener('click', handleStop);
    if (rewindBtn)    rewindBtn.addEventListener('click', function () { seekBy(-SEEK_WORD_COUNT); });
    if (forwardBtn)   forwardBtn.addEventListener('click', function () { seekBy(SEEK_WORD_COUNT); });
    if (loopCheck)    loopCheck.addEventListener('click', handleLoopClick);

    // ─── Mobile controls ───
    if (mobileReadBtn)    mobileReadBtn.addEventListener('click', handleReadClick);
    if (mobileStopBtn)    mobileStopBtn.addEventListener('click', handleStop);
    if (mobileRewindBtn)  mobileRewindBtn.addEventListener('click', function () { seekBy(-SEEK_WORD_COUNT); });
    if (mobileForwardBtn) mobileForwardBtn.addEventListener('click', function () { seekBy(SEEK_WORD_COUNT); });
    if (mobileLoopCheck)  mobileLoopCheck.addEventListener('click', handleLoopClick);

    // ─── Speed slider ───
    if (speedSlider) {
      speedSlider.addEventListener('input', onSpeedChange);
      speedValue.textContent = speedSlider.value + 'x';
      window.setState({ speed: parseFloat(speedSlider.value) });
    }

    // ─── Voices UI ───
    if (genderFilter) genderFilter.addEventListener('change', onGenderFilterChange);
    if (voiceSearch) {
      var searchDebounce;
      voiceSearch.addEventListener('input', function () {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(populateVoices, 150);
      });
    }
    if (voiceSelect) voiceSelect.addEventListener('change', onVoiceSelectChange);

    // ─── Timer ───
    if (timerResetBtn) {
      timerResetBtn.addEventListener('click', function () {
        stopTimer();
        elapsedMs = 0;
        window.setState({ timerElapsedMs: 0, timerRunning: false });
        if (timerDisplay) timerDisplay.textContent = '00:00.0';
      });
    }

    // ─── Mobile popups ───
    initMobilePopups();

    // ─── React to state changes ───
    window.subscribe(function (state, prev) {
      if (state.speed !== prev.speed && speedSlider) {
        if (parseFloat(speedSlider.value) !== state.speed) {
          speedSlider.value = state.speed;
          speedValue.textContent = state.speed + 'x';
        }
      }
      if (state.genderFilter !== prev.genderFilter) {
        populateVoices();
      }
    });

    // Init from current state
    var st = window.getState();
    if (st.speed && speedSlider) {
      speedSlider.value = st.speed;
      speedValue.textContent = st.speed + 'x';
    }
    if (st.genderFilter && genderFilter) {
      genderFilter.value = st.genderFilter;
    }
  }

  // ─── Voices ──────────────────────────────────────────────────────────────
  function guessGender(name) {
    var lower = name.toLowerCase();
    for (var i = 0; i < femaleKeywords.length; i++) {
      if (lower.indexOf(femaleKeywords[i]) !== -1) return 'female';
    }
    return 'male';
  }

  function populateVoices() {
    allVoices = synth.getVoices();
    if (allVoices.length === 0) return;

    allVoices.sort(function (a, b) { return a.name.localeCompare(b.name); });

    var state = window.getState();
    var gender = state.genderFilter || 'all';
    var query = (voiceSearch && voiceSearch.value || '').toLowerCase().trim();

    filteredVoices = allVoices.filter(function (v) {
      var matchesG = (gender === 'all') || (guessGender(v.name) === gender);
      return matchesG && ((v.name + ' ' + v.lang).toLowerCase().indexOf(query) !== -1);
    });

    if (!voiceSelect) return;
    voiceSelect.innerHTML = '';
    var savedName = window.getState().selectedVoiceName;
    var targetIdx = 0;

    filteredVoices.forEach(function (voice, i) {
      var op = document.createElement('option');
      op.value = i;
      op.textContent = voice.name + ' (' + voice.lang + ') [' + guessGender(voice.name).toUpperCase() + ']';
      if (savedName === voice.name) targetIdx = i;
      voiceSelect.appendChild(op);
    });

    if (filteredVoices.length > 0) {
      voiceSelect.selectedIndex = targetIdx;
      window.setState({ selectedVoiceName: filteredVoices[targetIdx].name });
    } else {
      var empty = document.createElement('option');
      empty.textContent = 'No matches found';
      voiceSelect.appendChild(empty);
    }

    window.setState({ voices: allVoices, filteredVoices: filteredVoices });
  }

  function onGenderFilterChange() {
    window.setState({ genderFilter: genderFilter.value, selectedVoiceName: null });
  }

  function onVoiceSelectChange() {
    var idx = parseInt(voiceSelect.value, 10);
    if (filteredVoices[idx]) {
      window.setState({ selectedVoiceName: filteredVoices[idx].name });
    }
  }

  // ─── Playback state visuals ──────────────────────────────────────────────
  function setPlayButtonState(state) {
    var targets = [readBtn, mobileReadBtn].filter(Boolean);
    targets.forEach(function (btn) {
      btn.classList.toggle('is-playing', state === 'playing');
      if (state === 'playing') btn.setAttribute('aria-label', 'Pause');
      else if (state === 'paused') btn.setAttribute('aria-label', 'Resume');
      else btn.setAttribute('aria-label', 'Read');
    });
  }

  function setLoopVisual(enabled) {
    var targets = [loopCheck, mobileLoopCheck].filter(Boolean);
    targets.forEach(function (btn) {
      btn.classList.toggle('loop-on', enabled);
      btn.classList.toggle('loop-off', !enabled);
      btn.setAttribute('aria-label', enabled ? 'Loop on' : 'Loop off');
    });
  }

  // ─── Read button ─────────────────────────────────────────────────────────
  function handleReadClick() {
    if (allVoices.length === 0) populateVoices();
    if (allVoices.length === 0) {
      setPlayButtonState('idle');
      setTimeout(function () {
        populateVoices();
        if (allVoices.length > 0) handleReadClick();
      }, 400);
      return;
    }

    var st = window.getState();

    if (st.isSpeaking && !st.isPaused) {
      // ─── PAUSE ───
      stopTimer();
      isChunkTransitionCancelled = true;
      disarmWatchdog();
      stopKeepAlive();
      try { synth.cancel(); } catch (e) {}
      setTimeout(function () { try { synth.cancel(); } catch (e) {} }, 0);
      setTimeout(function () {
        try { synth.cancel(); } catch (e) {}
        isChunkTransitionCancelled = false;
      }, 120);
      window.setState({ isSpeaking: false, isPaused: true });
      setPlayButtonState('paused');
    } else if (st.isPaused) {
      // ─── RESUME ───
      window.setState({ isPaused: false, isSpeaking: true });
      setPlayButtonState('playing');
      var text = getReadableText();
      var remaining = text.substring(st.lastIndex || 0);
      if (remaining.trim() !== '') speakText(remaining, true);
    } else {
      // ─── FRESH START ───
      speakText();
    }
  }

  function getReadableText() {
    var st = window.getState();
    if (st.viewMode === 'notes') {
      var noteArea = document.getElementById('note-area');
      return noteArea ? noteArea.value.replace(/\t/g, ' ').replace(/\n/g, ' ') : '';
    }
    var rows = st.rows || [];
    var parts = [];
    rows.forEach(function (r) {
      if (r.a) parts.push(r.a);
      if (r.b) parts.push(r.b);
    });
    return parts.join(' ').replace(/\t/g, ' ').replace(/\n/g, ' ');
  }

  // ─── Speak ───────────────────────────────────────────────────────────────
  function speakText(textOverride, isMidSentenceResume) {
    if (!isMidSentenceResume && !textOverride) {
      if (window.getState().isSpeaking) {
        isChunkTransitionCancelled = true;
        try { synth.cancel(); } catch (e) {}
        isChunkTransitionCancelled = false;
      }
      window.setState({ lastIndex: 0, isPaused: false });
    }

    var textToRead = textOverride || getReadableText();
    if (!textToRead.trim()) return;

    window.setState({ isSpeaking: true });
    setPlayButtonState('playing');

    var utteranceBaseIndex = isMidSentenceResume ? (window.getState().lastIndex || 0) : 0;
    speechChunks = splitIntoChunks(textToRead, CHUNK_CHAR_LIMIT);
    currentChunkIndex = 0;
    chunkBaseIndex = utteranceBaseIndex;

    startTimer();
    startKeepAlive();
    playCurrentChunk();
  }

  function playCurrentChunk() {
    var chunkText = speechChunks[currentChunkIndex];
    var thisChunkBaseIndex = chunkBaseIndex;
    window.setState({ lastIndex: thisChunkBaseIndex });

    currentUtterance = new SpeechSynthesisUtterance(chunkText);

    var filtered = window.getState().filteredVoices || [];
    var selIdx = voiceSelect ? parseInt(voiceSelect.value, 10) : 0;
    if (filtered[selIdx]) currentUtterance.voice = filtered[selIdx];
    currentUtterance.rate = window.getState().speed || 0.75;

    currentUtterance.onboundary = function (e) {
      if (e.name === 'word') {
        window.setState({ lastIndex: thisChunkBaseIndex + e.charIndex });
      }
    };

    currentUtterance.onerror = function (e) {
      if (e.error === 'interrupted' || e.error === 'canceled') {
        isChunkTransitionCancelled = false;
        return;
      }
      console.warn('[speech] utterance error:', e.error);
      disarmWatchdog();
      currentChunkIndex++;
      chunkBaseIndex = thisChunkBaseIndex + chunkText.length;
      if (currentChunkIndex < speechChunks.length) playCurrentChunk();
      else finishReading();
    };

    currentUtterance.onend = function () {
      disarmWatchdog();
      if (isChunkTransitionCancelled) { isChunkTransitionCancelled = false; return; }
      currentChunkIndex++;
      chunkBaseIndex = thisChunkBaseIndex + chunkText.length;
      if (currentChunkIndex < speechChunks.length) {
        playCurrentChunk();
      } else {
        if (window.getState().isLooping) {
          window.setState({ lastIndex: 0 });
          speakText();
        } else {
          finishReading();
        }
      }
    };

    armWatchdog(chunkText);
    synth.speak(currentUtterance);
  }

  function finishReading() {
    disarmWatchdog();
    stopKeepAlive();
    stopTimer();
    window.setState({ lastIndex: 0, isPaused: false, isSpeaking: false });
    setPlayButtonState('idle');
  }

  // ─── Chunking ────────────────────────────────────────────────────────────
  function splitIntoChunks(text, maxLen) {
    var chunks = [];
    var start = 0;
    while (start < text.length) {
      if (text.length - start <= maxLen) {
        chunks.push(text.slice(start));
        break;
      }
      var searchEnd = start + maxLen;
      var splitAt = -1;
      for (var i = searchEnd; i > start; i--) {
        if (/[.!?]/.test(text[i - 1])) { splitAt = i; break; }
      }
      if (splitAt === -1) {
        for (var j = searchEnd; j > start; j--) {
          if (/\s/.test(text[j])) { splitAt = j + 1; break; }
        }
      }
      if (splitAt === -1 || splitAt <= start) splitAt = searchEnd;
      chunks.push(text.slice(start, splitAt));
      start = splitAt;
    }
    return chunks;
  }

  // ─── Watchdog + Keep-alive ───────────────────────────────────────────────
  function armWatchdog(chunkText) {
    clearTimeout(chunkWatchdog);
    var rate = window.getState().speed || 1;
    var estMs = Math.max(5000, (chunkText.length / 14) * (1000 / rate) + 4000);
    chunkWatchdog = setTimeout(function () {
      if (isChunkTransitionCancelled) return;
      console.warn('[speech] watchdog fired — forcing next chunk');
      try { synth.cancel(); } catch (e) {}
      setTimeout(function () {
        if (isChunkTransitionCancelled) return;
        currentChunkIndex++;
        chunkBaseIndex += chunkText.length;
        if (currentChunkIndex < speechChunks.length) playCurrentChunk();
        else finishReading();
      }, 60);
    }, estMs);
  }

  function disarmWatchdog() {
    clearTimeout(chunkWatchdog);
    chunkWatchdog = null;
  }

  function startKeepAlive() {
    stopKeepAlive();
    keepAliveTimer = setInterval(function () {
      var st = window.getState();
      if (st.isSpeaking && !st.isPaused) {
        try { synth.pause(); synth.resume(); } catch (e) {}
      }
    }, 10000);
  }

  function stopKeepAlive() {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }

  // ─── Stop ────────────────────────────────────────────────────────────────
  function handleStop() {
    window.setState({ isLooping: false });
    setLoopVisual(false);

    isChunkTransitionCancelled = true;
    try { synth.cancel(); } catch (e) {}
    setTimeout(function () { try { synth.cancel(); } catch (e) {} }, 0);
    setTimeout(function () {
      try { synth.cancel(); } catch (e) {}
      isChunkTransitionCancelled = false;
    }, 200);

    disarmWatchdog();
    stopKeepAlive();
    stopTimer();
    window.setState({ isPaused: false, isSpeaking: false, lastIndex: 0 });
    currentUtterance = null;
    setPlayButtonState('idle');
  }

  // ─── Loop ────────────────────────────────────────────────────────────────
  function handleLoopClick() {
    var next = !window.getState().isLooping;
    window.setState({ isLooping: next });
    setLoopVisual(next);
  }

  // ─── Seek ────────────────────────────────────────────────────────────────
  function seekBy(wordDelta) {
    var st = window.getState();
    var wasActive = st.isSpeaking && !st.isPaused;
    var txt = getReadableText();
    var idx = st.lastIndex || 0;

    if (wordDelta > 0) {
      for (var i = 0; i < wordDelta; i++) {
        while (idx < txt.length && !/\s/.test(txt[idx])) idx++;
        while (idx < txt.length && /\s/.test(txt[idx])) idx++;
      }
    } else {
      for (var j = 0; j < -wordDelta; j++) {
        while (idx > 0 && /\s/.test(txt[idx - 1])) idx--;
        while (idx > 0 && !/\s/.test(txt[idx - 1])) idx--;
      }
    }
    idx = Math.max(0, Math.min(idx, txt.length));
    window.setState({ lastIndex: idx });

    if (wasActive) {
      stopTimer();
      isChunkTransitionCancelled = true;
      disarmWatchdog();
      stopKeepAlive();
      try { synth.cancel(); } catch (e) {}
      isChunkTransitionCancelled = false;
      var remaining = txt.substring(idx);
      if (remaining.trim() !== '') speakText(remaining, true);
      else finishReading();
    }
  }

  // ─── Speed ───────────────────────────────────────────────────────────────
  function onSpeedChange() {
    var v = parseFloat(speedSlider.value);
    speedValue.textContent = v + 'x';
    window.setState({ speed: v });

    var st = window.getState();
    if (st.isSpeaking && !st.isPaused) {
      stopTimer();
      isChunkTransitionCancelled = true;
      disarmWatchdog();
      stopKeepAlive();
      try { synth.cancel(); } catch (e) {}
      isChunkTransitionCancelled = false;
      var remaining = getReadableText().substring(st.lastIndex || 0);
      if (remaining.trim() !== '') speakText(remaining, true);
    }
  }

  // ─── Timer ───────────────────────────────────────────────────────────────
  function startTimer() {
    stopTimer();
    sessionStartMs = Date.now() - elapsedMs;
    sessionTimerInterval = setInterval(function () {
      elapsedMs = Date.now() - sessionStartMs;
      var totalS = Math.floor(elapsedMs / 1000);
      var m = String(Math.floor(totalS / 60)).padStart(2, '0');
      var s = String(totalS % 60).padStart(2, '0');
      var t = Math.floor((elapsedMs % 1000) / 100);
      if (timerDisplay) timerDisplay.textContent = m + ':' + s + '.' + t;
    }, 100);
    window.setState({ timerRunning: true });
  }

  function stopTimer() {
    clearInterval(sessionTimerInterval);
    sessionTimerInterval = null;
    window.setState({ timerRunning: false, timerElapsedMs: elapsedMs });
  }

  // ─── Mobile popups ───────────────────────────────────────────────────────
  function initMobilePopups() {
    if (!menuBtn || !menuPopup || !speedOpenBtn || !speedPopup) return;

    function closeAll() {
      menuPopup.classList.remove('visible');
      speedPopup.classList.remove('visible');
    }

    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var wasOpen = menuPopup.classList.contains('visible');
      closeAll();
      if (!wasOpen) menuPopup.classList.add('visible');
    });

    speedOpenBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      menuPopup.classList.remove('visible');
      speedPopup.classList.add('visible');
    });

    speedPopup.querySelectorAll('.speed-opt').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var val = parseFloat(btn.dataset.speed);
        speedSlider.value = val;
        speedSlider.dispatchEvent(new Event('input', { bubbles: true }));
        closeAll();
      });
    });

    document.addEventListener('click', function (e) {
      if (!menuPopup.contains(e.target) && e.target !== menuBtn &&
          !speedPopup.contains(e.target)) {
        closeAll();
      }
    });
  }

  // Expose
  window.initSpeech = initSpeech;
})();