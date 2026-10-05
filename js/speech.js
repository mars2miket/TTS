// --- DOMAIN 4: SPEECH SYNTHESIS + CHRONO TIMER ---

// ===== TIMER =====
window.startTimer = function() {
    if (timerInterval) clearInterval(timerInterval);
    window.startTime = Date.now() - elapsedTime;
    window.timerInterval = setInterval(() => {
        window.elapsedTime = Date.now() - startTime;
        let totalS = Math.floor(elapsedTime / 1000);
        let m = Math.floor(totalS / 60).toString().padStart(2, '0');
        let s = (totalS % 60).toString().padStart(2, '0');
        let t = Math.floor((elapsedTime % 1000) / 100);
        if (timerDisplay) timerDisplay.textContent = `${m}:${s}.${t}`;
    }, 100);
};

window.stopTimer = function() {
    clearInterval(timerInterval);
    window.timerInterval = null;
};

if (timerResetBtn) timerResetBtn.addEventListener('click', () => {
    stopTimer();
    window.elapsedTime = 0;
    if (timerDisplay) timerDisplay.textContent = "00:00.0";
});

// ===== CLEAR COLUMNS (with confirmation) =====
if (clearBtn) clearBtn.addEventListener('click', () => {
    const runClear = () => {
        if (window.noteActive) {
            if (typeof clearActiveNote === 'function') clearActiveNote();
        } else {
            spreadsheetContainer.querySelectorAll('.data-cell').forEach(c => c.remove());
            if (typeof createRowCells === 'function') createRowCells(1, "", "");
            try { localStorage.setItem('savedSpreadsheetGridData', ''); } catch (err) {}
            if (typeof updateCharacterCount === 'function') updateCharacterCount();
        }
        if (synth.speaking) synth.cancel();
        stopTimer();
        window.lastCharacterIndex = 0;
        if (typeof stopHighlighting === 'function') stopHighlighting();
        window.isVoicePaused = false;
        window.isSpeaking = false;
        setPlayButtonState('idle');

        if (typeof activeExamRows !== 'undefined') window.activeExamRows = [];
        if (typeof isQuestionActive !== 'undefined') window.isQuestionActive = false;
        const examWrapper = recallViewer.querySelector('.exam-question-wrapper');
        if (examWrapper) examWrapper.remove();
    };

    if (typeof window.showConfirm === 'function') {
        window.showConfirm(
            'Clear content',
            'Clear all content from spreadsheet? This cannot be undone.',
            'Clear',
            runClear
        );
    } else if (confirm('Clear all cells in the current list? This cannot be undone.')) {
        runClear();
    }
});

// ===== VOICE HELPERS =====
function guessGender(voiceName) {
    const name = voiceName.toLowerCase();
    return femaleKeywords.some(kw => name.includes(kw)) ? 'female' : 'male';
}

function clearSpeakingHighlight() {
    if (currentSpeakingSpan) {
        currentSpeakingSpan.classList.remove('speaking');
        window.currentSpeakingSpan = null;
    }
}

function stopHighlighting() {
    clearSpeakingHighlight();
    window.didAutoShowViewer = false;
}

function populateVoices() {
    window.allVoices = synth.getVoices();
    if (allVoices.length === 0) return;

    allVoices.sort((a, b) => a.name.localeCompare(b.name));
    const savedGenderFilter = localStorage.getItem('savedGenderFilter') || 'all';
    genderFilter.value = savedGenderFilter;

    const searchQuery = voiceSearch.value.toLowerCase().trim();
    window.filteredVoices = allVoices.filter(v => {
        const matchesG = (savedGenderFilter === 'all') || (guessGender(v.name) === savedGenderFilter);
        return matchesG && `${v.name} ${v.lang}`.toLowerCase().includes(searchQuery);
    });

    voiceSelect.innerHTML = '';
    const savedVoiceName = localStorage.getItem('savedVoiceNameString');
    let targetIdx = 0;

    filteredVoices.forEach((voice, i) => {
        const op = document.createElement('option');
        op.value = i;
        op.textContent = `${voice.name} (${voice.lang}) [${guessGender(voice.name).toUpperCase()}]`;
        if (savedVoiceName === voice.name) targetIdx = i;
        voiceSelect.appendChild(op);
    });

    if (filteredVoices.length > 0) {
        voiceSelect.selectedIndex = targetIdx;
        localStorage.setItem('savedVoiceNameString', filteredVoices[targetIdx].name);
    } else {
        const op = document.createElement('option');
        op.textContent = "No matches found";
        voiceSelect.appendChild(op);
    }
}

if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = populateVoices;
populateVoices();

let voiceSearchDebounce;
voiceSearch.addEventListener('input', () => {
    clearTimeout(voiceSearchDebounce);
    voiceSearchDebounce = setTimeout(populateVoices, 150);
});

genderFilter.addEventListener('change', () => {
    localStorage.setItem('savedGenderFilter', genderFilter.value);
    localStorage.removeItem('savedVoiceNameString');
    populateVoices();
});

voiceSelect.addEventListener('change', () => {
    if (filteredVoices[voiceSelect.value]) localStorage.setItem('savedVoiceNameString', filteredVoices[voiceSelect.value].name);
});

// ===== PLAY BUTTON STATE (SVG swap) =====
function setPlayButtonState(state) {
    const targets = [readBtn, mobileReadBtn].filter(Boolean);
    targets.forEach(btn => {
        btn.classList.toggle('is-playing', state === 'playing');
        if (state === 'playing') btn.setAttribute('aria-label', 'Pause');
        else if (state === 'paused') btn.setAttribute('aria-label', 'Resume');
        else btn.setAttribute('aria-label', 'Read');
    });
}

// ===== LOOP BUTTON STATE =====
function setLoopVisual(enabled) {
    const targets = [loopCheck, mobileLoopCheck].filter(Boolean);
    targets.forEach(btn => {
        btn.classList.toggle('loop-on', enabled);
        btn.classList.toggle('loop-off', !enabled);
        btn.setAttribute('aria-label', enabled ? 'Loop on' : 'Loop off');
    });
}

// ===== CHUNKING =====
function splitIntoChunks(text, maxLen) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        if (text.length - start <= maxLen) {
            chunks.push(text.slice(start));
            break;
        }
        let searchEnd = start + maxLen;
        let splitAt = -1;
        for (let i = searchEnd; i > start; i--) {
            if (/[.!?]/.test(text[i - 1])) { splitAt = i; break; }
        }
        if (splitAt === -1) {
            for (let i = searchEnd; i > start; i--) {
                if (/\s/.test(text[i])) { splitAt = i + 1; break; }
            }
        }
        if (splitAt === -1 || splitAt <= start) splitAt = searchEnd;
        chunks.push(text.slice(start, splitAt));
        start = splitAt;
    }
    return chunks;
}

// ===== WATCHDOG + KEEP-ALIVE =====
let chunkWatchdog = null;
let keepAliveTimer = null;

function armWatchdog(chunkText) {
    clearTimeout(chunkWatchdog);
    const rate = parseFloat(speedSlider.value) || 1;
    const estMs = Math.max(5000, (chunkText.length / 14) * (1000 / rate) + 4000);
    chunkWatchdog = setTimeout(() => {
        if (isChunkTransitionCancelled) return;
        console.warn('[TTS] watchdog fired — forcing next chunk');
        try { synth.cancel(); } catch (err) {}
        setTimeout(() => {
            if (isChunkTransitionCancelled) return;
            window.currentChunkIndex++;
            window.chunkBaseIndex += chunkText.length;
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
    keepAliveTimer = setInterval(() => {
        if (isSpeaking && !synth.paused && !isVoicePaused) {
            try { synth.pause(); synth.resume(); } catch (err) {}
        }
    }, 10000);
}

function stopKeepAlive() {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
}

function finishReading() {
    disarmWatchdog();
    stopKeepAlive();
    if (typeof stopTimer === 'function') stopTimer();
    window.lastCharacterIndex = 0;
    window.isVoicePaused = false;
    window.isSpeaking = false;
    setPlayButtonState('idle');
    stopHighlighting();
}

// ===== READ BUTTON (shared handler for desktop + mobile) =====
function handleReadClick() {
    if (allVoices.length === 0) populateVoices();

    if (allVoices.length === 0) {
        setPlayButtonState('idle');
        setTimeout(() => {
            populateVoices();
            if (allVoices.length > 0) handleReadClick();
        }, 400);
        return;
    }

    // Use our own isSpeaking flag — synth.speaking is unreliable on Android.
    if (isSpeaking && !isVoicePaused) {
        // ---- PAUSE ----
        if (typeof stopTimer === 'function') stopTimer();
        window.isChunkTransitionCancelled = true;
        disarmWatchdog();
        stopKeepAlive();
        try { synth.cancel(); } catch (e) {}
        // Triple-tap cancel to defeat Android's late-queue
        setTimeout(() => { try { synth.cancel(); } catch (e) {} }, 0);
        setTimeout(() => {
            try { synth.cancel(); } catch (e) {}
            window.isChunkTransitionCancelled = false;
        }, 120);
        window.isSpeaking = false;
        window.isVoicePaused = true;
        setPlayButtonState('paused');
    } else if (isVoicePaused) {
        // ---- RESUME ----
        window.isVoicePaused = false;
        window.isSpeaking = true;
        setPlayButtonState('playing');
        const remaining = window.textBox.value.replace(/\t/g, ' ').replace(/\n/g, ' ').substring(lastCharacterIndex);
        if (remaining.trim() !== "") speakText(remaining, true);
    } else {
        // ---- FRESH START ----
        speakText();
    }
}

if (readBtn) readBtn.addEventListener('click', handleReadClick);
if (mobileReadBtn) mobileReadBtn.addEventListener('click', handleReadClick);

function speakText(textOverride = null, isMidSentenceResume = false) {
    if (!isMidSentenceResume && !textOverride) {
        if (isSpeaking) {
            window.isChunkTransitionCancelled = true;
            try { synth.cancel(); } catch (e) {}
            window.isChunkTransitionCancelled = false;
        }
        window.lastCharacterIndex = 0;
        window.isVoicePaused = false;
    }

    const textToRead = textOverride || window.textBox.value.replace(/\t/g, ' ').replace(/\n/g, ' ');
    if (!textToRead.trim()) return;

    window.isSpeaking = true;
    setPlayButtonState('playing');

    const utteranceBaseIndex = isMidSentenceResume ? lastCharacterIndex : 0;
    window.speechChunks = splitIntoChunks(textToRead, CHUNK_CHAR_LIMIT);
    window.currentChunkIndex = 0;
    window.chunkBaseIndex = utteranceBaseIndex;

    if (typeof startTimer === 'function') startTimer();
    startKeepAlive();
    playCurrentChunk();
}

function playCurrentChunk() {
    const chunkText = speechChunks[currentChunkIndex];
    const thisChunkBaseIndex = chunkBaseIndex;
    window.lastCharacterIndex = thisChunkBaseIndex;

    window.currentUtterance = new SpeechSynthesisUtterance(chunkText);
    if (filteredVoices[voiceSelect.value]) currentUtterance.voice = filteredVoices[voiceSelect.value];
    currentUtterance.rate = parseFloat(speedSlider.value);

    currentUtterance.onboundary = (e) => {
        if (e.name === 'word') {
            const absIdx = thisChunkBaseIndex + e.charIndex;
            window.lastCharacterIndex = absIdx;
        }
    };

    currentUtterance.onerror = (e) => {
        if (e.error === 'interrupted' || e.error === 'canceled') {
            window.isChunkTransitionCancelled = false;
            return;
        }
        console.warn('[TTS] utterance error:', e.error);
        disarmWatchdog();
        window.currentChunkIndex++;
        window.chunkBaseIndex = thisChunkBaseIndex + chunkText.length;
        if (currentChunkIndex < speechChunks.length) playCurrentChunk();
        else finishReading();
    };

    currentUtterance.onend = () => {
        disarmWatchdog();
        if (isChunkTransitionCancelled) { window.isChunkTransitionCancelled = false; return; }
        window.currentChunkIndex++;
        window.chunkBaseIndex = thisChunkBaseIndex + chunkText.length;
        if (currentChunkIndex < speechChunks.length) {
            playCurrentChunk();
        } else {
            if (isLoopEnabled) { window.lastCharacterIndex = 0; speakText(); }
            else { finishReading(); }
        }
    };

    armWatchdog(chunkText);
    synth.speak(currentUtterance);
}

// ===== SPEED =====
speedSlider.addEventListener('input', () => {
    const v = speedSlider.value;
    speedValue.textContent = `${v}x`;

    if (isSpeaking && !isVoicePaused) {
        if (typeof stopTimer === 'function') stopTimer();
        window.isChunkTransitionCancelled = true;
        disarmWatchdog();
        stopKeepAlive();
        try { synth.cancel(); } catch (e) {}
        window.isChunkTransitionCancelled = false;
        const rem = window.textBox.value.replace(/\t/g, ' ').replace(/\n/g, ' ').substring(lastCharacterIndex);
        if (rem.trim() !== "") speakText(rem, true);
    }
});

// ===== MOBILE MENU + SPEED POPUP =====
(function initMobileMenuPopup() {
    const menuBtn = document.getElementById('m-menu-btn');
    const menuPopup = document.getElementById('m-menu-popup');
    const speedOpenBtn = document.getElementById('m-speed-open-btn');
    const speedPopup = document.getElementById('m-speed-popup');
    if (!menuBtn || !menuPopup || !speedOpenBtn || !speedPopup) return;

    function closeAll() {
        menuPopup.classList.remove('visible');
        speedPopup.classList.remove('visible');
    }

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = menuPopup.classList.contains('visible');
        closeAll();
        if (!wasOpen) menuPopup.classList.add('visible');
    });

    speedOpenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menuPopup.classList.remove('visible');
        speedPopup.classList.add('visible');
    });

    speedPopup.querySelectorAll('.speed-opt').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = parseFloat(btn.dataset.speed);
            speedSlider.value = val;
            speedSlider.dispatchEvent(new Event('input', { bubbles: true }));
            closeAll();

            // Auto-resume if the slider's input handler paused us mid-read.
            if (isVoicePaused) {
                window.isVoicePaused = false;
                window.isSpeaking = true;
                setPlayButtonState('playing');
                                const remaining = window.textBox.value.replace(/\t/g, ' ').replace(/\n/g, ' ').substring(lastCharacterIndex);
                if (remaining.trim() !== "") speakText(remaining, true);
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (!menuPopup.contains(e.target) && e.target !== menuBtn &&
            !speedPopup.contains(e.target)) {
            closeAll();
        }
    });
})();

// ===== LOOP TOGGLE (shared) =====
function handleLoopClick() {
    window.isLoopEnabled = !isLoopEnabled;
    setLoopVisual(isLoopEnabled);
}
if (loopCheck) loopCheck.addEventListener('click', handleLoopClick);
if (mobileLoopCheck) mobileLoopCheck.addEventListener('click', handleLoopClick);

// ===== SEEK =====
function seekBy(wordDelta) {
    const wasActive = isSpeaking && !isVoicePaused;
    const txt = window.textBox.value.replace(/\t/g, ' ').replace(/\n/g, ' ');
    let idx = lastCharacterIndex;

    if (wordDelta > 0) {
        for (let i = 0; i < wordDelta; i++) {
            while (idx < txt.length && !/\s/.test(txt[idx])) idx++;
            while (idx < txt.length && /\s/.test(txt[idx])) idx++;
        }
    } else {
        for (let i = 0; i < -wordDelta; i++) {
            while (idx > 0 && /\s/.test(txt[idx - 1])) idx--;
            while (idx > 0 && !/\s/.test(txt[idx - 1])) idx--;
        }
    }
    window.lastCharacterIndex = Math.max(0, Math.min(idx, txt.length));

    if (wasActive) {
        if (typeof stopTimer === 'function') stopTimer();
        window.isChunkTransitionCancelled = true;
        disarmWatchdog();
        stopKeepAlive();
        try { synth.cancel(); } catch (e) {}
        window.isChunkTransitionCancelled = false;
        const remaining = txt.substring(lastCharacterIndex);
        if (remaining.trim() !== "") speakText(remaining, true);
        else finishReading();
    }
}

function handleRewind() { seekBy(-SEEK_WORD_COUNT); }
function handleForward() { seekBy(SEEK_WORD_COUNT); }

if (rewindBtn) rewindBtn.addEventListener('click', handleRewind);
if (mobileRewindBtn) mobileRewindBtn.addEventListener('click', handleRewind);
if (forwardBtn) forwardBtn.addEventListener('click', handleForward);
if (mobileForwardBtn) mobileForwardBtn.addEventListener('click', handleForward);

// ===== STOP (shared) — Android-proof =====
function handleStop() {
    window.isLoopEnabled = false;
    setLoopVisual(false);

    // Don't trust synth.speaking — always cancel, multiple times.
    window.isChunkTransitionCancelled = true;
    try { synth.cancel(); } catch (e) {}
    setTimeout(() => { try { synth.cancel(); } catch (e) {} }, 0);
    setTimeout(() => {
        try { synth.cancel(); } catch (e) {}
        window.isChunkTransitionCancelled = false;
    }, 200);

    disarmWatchdog();
    stopKeepAlive();
    if (typeof stopTimer === 'function') stopTimer();
    window.isVoicePaused = false;
    window.isSpeaking = false;
    window.currentUtterance = null;
    setPlayButtonState('idle');
    window.lastCharacterIndex = 0;
    stopHighlighting();
}

if (stopBtn) stopBtn.addEventListener('click', handleStop);
if (mobileStopBtn) mobileStopBtn.addEventListener('click', handleStop);