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

// Aggressive startup polling loop ensures names are matched even on slow hardware loads
if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = populateVoices;
populateVoices();

const loopInterval = setInterval(() => {
    if (allVoices.length === 0) {
        populateVoices();
    } else {
        clearInterval(loopInterval);
    }
}, 250);

window.addEventListener('DOMContentLoaded', populateVoices);
voiceSearch.addEventListener('input', populateVoices);

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
        synth.cancel();
        const fullText = textBox.value;
        const remainingText = fullText.substring(lastCharacterIndex);
        if (remainingText.trim() !== "") speakText(remainingText, true);
    }
});

function speakText(textOverride = null, isMidSentenceResume = false) {
    if (!isMidSentenceResume && !textOverride) {
        if (synth.speaking) synth.cancel();
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

    currentUtterance = new SpeechSynthesisUtterance(textToRead);
    const selectedVoiceIndex = voiceSelect.value;
    if (filteredVoices[selectedVoiceIndex]) {
        currentUtterance.voice = filteredVoices[selectedVoiceIndex];
    }

    currentUtterance.rate = parseFloat(speedSlider.value);
    startTimer();

    currentUtterance.onboundary = (event) => {
        if (event.name === 'word') {
            const absoluteIndex = utteranceBaseIndex + event.charIndex;
            lastCharacterIndex = absoluteIndex;
            highlightWordAt(absoluteIndex);
        }
    };

    currentUtterance.onend = () => {
        if (isVoicePaused) return;
        if (synth.speaking === false) {
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
    };

    synth.speak(currentUtterance);
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
    synth.cancel();
    stopTimer(); 
    resetReadButtonState();
    lastCharacterIndex = 0; 
    stopHighlighting();
});
