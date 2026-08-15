const synth = window.speechSynthesis;
const genderFilter = document.getElementById('gender-filter');
const voiceSearch = document.getElementById('voice-search'); 
const voiceSelect = document.getElementById('voice-select');
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
const loopCheck = document.getElementById('loop-check');
const readBtn = document.getElementById('read-btn');
const stopBtn = document.getElementById('stop-btn');
const clearBtn = document.getElementById('clear-btn');
const rewindBtn = document.getElementById('rewind-btn');
const forwardBtn = document.getElementById('forward-btn');

let allVoices = [];
let filteredVoices = [];
let isLoopEnabled = false;

let currentUtterance = null;
let lastCharacterIndex = 0;
let isVoicePaused = false; 

let currentSpeakingSpan = null; // the word span currently highlighted as "being read"
let didAutoShowViewer = false;  // whether we temporarily revealed the recall-viewer just to show the highlight
const SEEK_WORD_COUNT = 5;      // how many words Rewind/Fast Forward jump per press

// --- Chunked playback (fixes mobile browsers cutting off / failing on long utterances) ---
// Many mobile TTS engines (notably Android Chrome) silently fail once a single
// utterance passes roughly 4000 characters. To stay safe across devices, any text
// being read is split into smaller pieces and played back-to-back as a queue.
// Kept intentionally small (well under the ~4000-char mobile safety limit).
// Mobile browsers (notably Android Chrome) often don't fire onboundary word
// events reliably, so lastCharacterIndex can't always be tracked word-by-word
// on those devices. Smaller chunks give a fallback "resume point" at roughly
// sentence granularity instead of restarting from the very beginning.
const CHUNK_CHAR_LIMIT = 250;
let speechChunks = [];
let currentChunkIndex = 0;
let chunkBaseIndex = 0;          // absolute offset (in the full textbox value) where speechChunks[0] begins
let isChunkTransitionCancelled = false; // true when synth.cancel() was triggered manually (pause/stop/seek), so onend should NOT auto-advance to the next chunk

const femaleKeywords = [ 
    'adri', 'amala', 'andrea', 'anna', 'aria', 'asilia', 'ava', 'belkys', 
    'catalina', 'christel', 'clara', 'elena', 'elsa', 'emily', 'emma', 
    'ezinne', 'female', 'google uk english female', 'hazel', 'heera', 
    'imani', 'ingrid', 'ja', 'jenny', 'joana', 'karen', 'katja', 'leah', 
    'leni', 'libby', 'luna', 'maria', 'michelle', 'moira', 'molly', 
    'natasha', 'nia', 'ramona', 'rosa', 'salome', 'samantha', 'seraphina', 
    'sofia', 'sonia', 'tessa', 'vesna', 'victoria', 'vlasta', 'yan', 'zira'
];

function guessGender(voiceName) {
    const name = voiceName.toLowerCase();
    return femaleKeywords.some(keyword => name.includes(keyword)) ? 'female' : 'male';
}

clearBtn.addEventListener('click', () => {
    textBox.value = '';
    localStorage.setItem('savedTextBoxContent', '');
    updateCharacterCount();
    if (synth.speaking) synth.cancel(); 
    stopTimer(); 
    resetReadButtonState();
    lastCharacterIndex = 0;
    stopHighlighting();
    if (typeof resetHideMode === 'function') {
        resetHideMode();
    }
});

loopCheck.addEventListener('click', () => {
    isLoopEnabled = !isLoopEnabled;
    loopCheck.textContent = isLoopEnabled ? "Loop: ON" : "Loop: OFF";
    loopCheck.classList.toggle('loop-on', isLoopEnabled);
});

readBtn.addEventListener('click', () => {
    if (allVoices.length === 0) populateVoices();

    if (synth.speaking && !isVoicePaused) {
        stopTimer();
        isChunkTransitionCancelled = true;
        synth.cancel();
        isVoicePaused = true;
        readBtn.textContent = "Read";
        readBtn.classList.remove('is-active');
    } else if (isVoicePaused) {
        isVoicePaused = false;
        readBtn.textContent = "Pause ⏸";
        readBtn.classList.add('is-active');
        
        const fullText = textBox.value;
        const remainingText = fullText.substring(lastCharacterIndex);
        if (remainingText.trim() !== "") {
            speakText(remainingText, true);
        }
    } else {
        speakText();
    }
});

function resetReadButtonState() {
    isVoicePaused = false;
    readBtn.textContent = "Read";
    readBtn.classList.remove('is-active');
}

// --- Read-along word highlighting ---
// Reuses the recall-viewer overlay (built by hider.js) so the currently-spoken
// word can be highlighted without a second overlapping overlay. Only runs
// when Hide Words mode isn't actively hiding text, to avoid the two features fighting.
function clearSpeakingHighlight() {
    if (currentSpeakingSpan) {
        currentSpeakingSpan.classList.remove('speaking');
        currentSpeakingSpan = null;
    }
}

function highlightWordAt(absoluteIndex) {
    if (typeof hideStage !== 'undefined' && hideStage > 0) return;
    if (typeof recallViewer === 'undefined' || typeof preRenderTextGrid !== 'function') return;

    if (isTextDirty) preRenderTextGrid();

    if (recallViewer.classList.contains('hidden')) {
        recallViewer.style.height = `${textBox.offsetHeight}px`;
        recallViewer.classList.remove('hidden');
        didAutoShowViewer = true;
    }

    const span = (typeof getWordSpanAtIndex === 'function') ? getWordSpanAtIndex(absoluteIndex) : null;
    if (span && span !== currentSpeakingSpan) {
        clearSpeakingHighlight();
        span.classList.add('speaking');
        currentSpeakingSpan = span;
    }
}

function stopHighlighting() {
    clearSpeakingHighlight();
    if (didAutoShowViewer) {
        recallViewer.classList.add('hidden');
        didAutoShowViewer = false;
    }
}

function populateVoices() {
    allVoices = synth.getVoices();
    if (allVoices.length === 0) return;
    
    allVoices.sort((a, b) => a.name.localeCompare(b.name));
    
    const savedGenderFilter = localStorage.getItem('savedGenderFilter') || 'all';
    genderFilter.value = savedGenderFilter;

    const searchQuery = voiceSearch.value.toLowerCase().trim();

    filteredVoices = allVoices.filter(voice => {
        const matchesGender = (savedGenderFilter === 'all') || (guessGender(voice.name) === savedGenderFilter);
        const voiceContent = `${voice.name} ${voice.lang}`.toLowerCase();
        const matchesSearch = voiceContent.includes(searchQuery);
        return matchesGender && matchesSearch;
    });

    voiceSelect.innerHTML = '';
    
    // --- STABLE PERSISTENCE LOGIC: Match by static voice name string ---
    const savedVoiceName = localStorage.getItem('savedVoiceNameString');
    let targetIndex = 0;

    filteredVoices.forEach((voice, i) => {
        const option = document.createElement('option');
        option.value = i;
        const genderTag = guessGender(voice.name).toUpperCase();
        option.textContent = `${voice.name} (${voice.lang}) [${genderTag}]`;
        
        if (savedVoiceName === voice.name) {
            targetIndex = i;
        }
        voiceSelect.appendChild(option);
    });

    if (filteredVoices.length > 0) {
        voiceSelect.selectedIndex = targetIndex;
        // Lock the string name directly into storage safely
        localStorage.setItem('savedVoiceNameString', filteredVoices[targetIndex].name);
    } else {
        const option = document.createElement('option');
        option.textContent = "No matches found";
        voiceSelect.appendChild(option);
    }
}

// Voices load asynchronously in most browsers; onvoiceschanged fires once the
// list is ready. DOMContentLoaded is a fallback for browsers that populate
// voices immediately without firing that event.
if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = populateVoices;
populateVoices();
window.addEventListener('DOMContentLoaded', populateVoices);

// Debounce search input so the voice list only rebuilds after the user pauses
// typing, instead of on every keystroke.
let voiceSearchDebounce;
voiceSearch.addEventListener('input', () => {
    clearTimeout(voiceSearchDebounce);
    voiceSearchDebounce = setTimeout(populateVoices, 150);
});

genderFilter.addEventListener('change', () => {
    localStorage.setItem('savedGenderFilter', genderFilter.value);
    localStorage.removeItem('savedVoiceNameString'); // Clear string focus to fall back gracefully
    populateVoices();
});

voiceSelect.addEventListener('change', () => {
    const selectedVoice = filteredVoices[voiceSelect.value];
    if (selectedVoice) {
        localStorage.setItem('savedVoiceNameString', selectedVoice.name);
    }
});


speedSlider.addEventListener('input', () => {
    speedValue.textContent = `${speedSlider.value}x`;
    if (synth.speaking && !isVoicePaused) {
        stopTimer();
        isChunkTransitionCancelled = true;
        synth.cancel();
        const fullText = textBox.value;
        const remainingText = fullText.substring(lastCharacterIndex);
        if (remainingText.trim() !== "") speakText(remainingText, true);
    }
});

// Splits text into pieces no longer than maxLen, cutting at sentence ends or
// whitespace where possible. Guaranteed to reconstruct the original text exactly
// when chunks are concatenated back together, so absolute character offsets
// (used for highlighting, pause/resume, and rewind/forward) stay accurate.
function splitIntoChunks(text, maxLen) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
        if (text.length - start <= maxLen) {
            chunks.push(text.slice(start));
            break;
        }

        const searchEnd = start + maxLen;
        let splitAt = -1;

        // Prefer splitting right after sentence-ending punctuation
        for (let i = searchEnd; i > start; i--) {
            if (/[.!?]/.test(text[i - 1])) {
                splitAt = i;
                break;
            }
        }

        // Fall back to splitting at the nearest whitespace
        if (splitAt === -1) {
            for (let i = searchEnd; i > start; i--) {
                if (/\s/.test(text[i])) {
                    splitAt = i + 1;
                    break;
                }
            }
        }

        // Last resort: hard cut at the limit
        if (splitAt === -1 || splitAt <= start) {
            splitAt = searchEnd;
        }

        chunks.push(text.slice(start, splitAt));
        start = splitAt;
    }

    return chunks;
}

function speakText(textOverride = null, isMidSentenceResume = false) {
    if (!isMidSentenceResume && !textOverride) {
        if (synth.speaking) {
            isChunkTransitionCancelled = true;
            synth.cancel();
        }
        lastCharacterIndex = 0;
        resetReadButtonState();
    }
    
    const textToRead = textOverride || textBox.value;
    if (!textToRead.trim()) return;

    readBtn.textContent = "Pause ⏸";
    readBtn.classList.add('is-active');

    // Absolute offset (within the full textarea value) where this utterance's text begins.
    // Fresh reads start at 0; resumes/seeks start wherever lastCharacterIndex already points.
    const utteranceBaseIndex = isMidSentenceResume ? lastCharacterIndex : 0;

    speechChunks = splitIntoChunks(textToRead, CHUNK_CHAR_LIMIT);
    currentChunkIndex = 0;
    chunkBaseIndex = utteranceBaseIndex;

    startTimer();
    playCurrentChunk();
}

function playCurrentChunk() {
    const chunkText = speechChunks[currentChunkIndex];
    const thisChunkBaseIndex = chunkBaseIndex;

    // Fallback resume point: set immediately, before playback even starts.
    // If onboundary fires during playback (desktop, most of the time) it will
    // overwrite this with more precise word-level positions. If it doesn't
    // fire (common on mobile), this chunk-start position is what pause/resume
    // falls back to — far better than restarting from the very beginning.
    lastCharacterIndex = thisChunkBaseIndex;

    currentUtterance = new SpeechSynthesisUtterance(chunkText);
    const selectedVoiceIndex = voiceSelect.value;
    if (filteredVoices[selectedVoiceIndex]) {
        currentUtterance.voice = filteredVoices[selectedVoiceIndex];
    }
    currentUtterance.rate = parseFloat(speedSlider.value);

    currentUtterance.onboundary = (event) => {
        if (event.name === 'word') {
            const absoluteIndex = thisChunkBaseIndex + event.charIndex;
            lastCharacterIndex = absoluteIndex;
            highlightWordAt(absoluteIndex);
        }
    };

    currentUtterance.onend = () => {
        if (isChunkTransitionCancelled) {
            // This end was caused by a manual cancel (pause/stop/seek/speed change),
            // not natural completion — don't auto-advance to the next chunk.
            isChunkTransitionCancelled = false;
            return;
        }

        currentChunkIndex++;
        chunkBaseIndex = thisChunkBaseIndex + chunkText.length;

        if (currentChunkIndex < speechChunks.length) {
            playCurrentChunk();
        } else {
            finishReading();
        }
    };

    synth.speak(currentUtterance);
}

function finishReading() {
    if (isLoopEnabled) {
        lastCharacterIndex = 0;
        speakText(); 
    } else {
        stopTimer(); 
        lastCharacterIndex = 0;
        resetReadButtonState();
        stopHighlighting();
    }
}

// --- Fast Forward / Rewind ---
// Jumps playback position by whole words in either direction. If speech is
// actively playing, it restarts immediately from the new spot; if paused or
// stopped, it just moves the resume point (and the highlight, if visible).
function skipWordsFrom(fromIndex, wordDelta) {
    const text = textBox.value;
    let idx = fromIndex;

    if (wordDelta > 0) {
        for (let i = 0; i < wordDelta; i++) {
            while (idx < text.length && !/\s/.test(text[idx])) idx++;
            while (idx < text.length && /\s/.test(text[idx])) idx++;
        }
    } else {
        for (let i = 0; i < -wordDelta; i++) {
            while (idx > 0 && /\s/.test(text[idx - 1])) idx--;
            while (idx > 0 && !/\s/.test(text[idx - 1])) idx--;
        }
    }
    return Math.max(0, Math.min(idx, text.length));
}

function seekBy(wordDelta) {
    const wasActive = synth.speaking && !isVoicePaused;
    const newIndex = skipWordsFrom(lastCharacterIndex, wordDelta);
    lastCharacterIndex = newIndex;

    if (wasActive) {
        stopTimer();
        isChunkTransitionCancelled = true;
        synth.cancel();
        const remaining = textBox.value.substring(newIndex);
        if (remaining.trim() !== "") {
            speakText(remaining, true);
        } else {
            resetReadButtonState();
            stopHighlighting();
        }
    } else {
        highlightWordAt(newIndex);
    }
}

rewindBtn.addEventListener('click', () => seekBy(-SEEK_WORD_COUNT));
forwardBtn.addEventListener('click', () => seekBy(SEEK_WORD_COUNT));

stopBtn.addEventListener('click', () => {
    isLoopEnabled = false;
    loopCheck.textContent = "Loop: OFF";
    loopCheck.classList.remove('loop-on');
    isChunkTransitionCancelled = true;
    synth.cancel();
    stopTimer(); 
    resetReadButtonState();
    lastCharacterIndex = 0; 
    stopHighlighting();
});