// --- GLOBAL CONFIGURATION & APP STATE MATRIX ---
window.synth = window.speechSynthesis;

// Element Selectors Mapping Layout Matrix
window.spreadsheetContainer = document.getElementById('spreadsheet-container');
window.recallViewer = document.getElementById('recall-viewer');
window.clearBtn = document.getElementById('clear-btn');

window.genderFilter = document.getElementById('gender-filter');
window.voiceSearch = document.getElementById('voice-search');
window.voiceSelect = document.getElementById('voice-select');
window.speedSlider = document.getElementById('speed-slider');
window.speedValue = document.getElementById('speed-value');
window.loopCheck = document.getElementById('loop-check');
window.readBtn = document.getElementById('read-btn');
window.stopBtn = document.getElementById('stop-btn');
window.rewindBtn = document.getElementById('rewind-btn');
window.forwardBtn = document.getElementById('forward-btn');

// Mobile mirror controls (share state with desktop)
window.mobileReadBtn = document.getElementById('m-read-btn');
window.mobileStopBtn = document.getElementById('m-stop-btn');
window.mobileRewindBtn = document.getElementById('m-rewind-btn');
window.mobileForwardBtn = document.getElementById('m-forward-btn');
window.mobileLoopCheck = document.getElementById('m-loop-check');

window.charCountDisplay = document.getElementById('char-count');
window.timeEstimateDisplay = document.getElementById('time-estimate');
window.timerDisplay = document.getElementById('timer-display');
window.timerResetBtn = document.getElementById('timer-reset-btn');

// Core Application States Tracker
window.__PASTE_DEBUG__ = true;
window.hideStage = 0;
window.isTextDirty = true;
window.allVoices = [];
window.filteredVoices = [];
window.isLoopEnabled = false;
window.currentUtterance = null;
window.lastCharacterIndex = 0;
window.isVoicePaused = false;
window.isSpeaking = false; // our own speaking flag — don't trust synth.speaking on Android
window.currentSpeakingSpan = null;
window.didAutoShowViewer = false;

window.startTime = 0;
window.elapsedTime = 0;
window.timerInterval = null;

window.speechChunks = [];
window.currentChunkIndex = 0;
window.chunkBaseIndex = 0;
window.isChunkTransitionCancelled = false;

window.CHUNK_CHAR_LIMIT = 250;
window.SEEK_WORD_COUNT = 5;

window.colHiddenState = { A: false, B: false };
window.didColumnShowViewer = false;

window.femaleKeywords = [
    'adri', 'amala', 'andrea', 'anna', 'aria', 'asilia', 'ava', 'belkys',
    'catalina', 'christel', 'clara', 'elena', 'elsa', 'emily', 'emma',
    'ezinne', 'female', 'google uk english female', 'hazel', 'heera',
    'imani', 'ingrid', 'ja', 'jenny', 'joana', 'karen', 'katja', 'leah',
    'leni', 'libby', 'luna', 'maria', 'michelle', 'moira', 'molly',
    'natasha', 'nia', 'ramona', 'rosa', 'salome', 'samantha', 'seraphina',
    'sofia', 'sonia', 'tessa', 'vesna', 'victoria', 'vlasta', 'yan', 'zira'
];