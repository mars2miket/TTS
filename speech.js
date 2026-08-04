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
const testVoiceBtn = document.getElementById('test-voice-btn'); // New element hook

let allVoices = [];
let filteredVoices = [];
let isLoopEnabled = false;

let currentUtterance = null;
let lastCharacterIndex = 0;
let isVoicePaused = false; 

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
    if (typeof resetHideMode === 'function') {
        resetHideMode();
    }
});

loopCheck.addEventListener('click', () => {
    isLoopEnabled = !isLoopEnabled;
    if (isLoopEnabled) {
        loopCheck.textContent = "Loop: ON";
        loopCheck.style.backgroundColor = "#fff9c4";
    } else {
        loopCheck.textContent = "Loop: OFF";
        loopCheck.style.backgroundColor = "";
    }
});

readBtn.addEventListener('click', () => {
    if (allVoices.length === 0) populateVoices();

    if (synth.speaking && !isVoicePaused) {
        stopTimer();
        synth.cancel();
        isVoicePaused = true;
        readBtn.textContent = "Read";
        readBtn.style.backgroundColor = ""; 
    } else if (isVoicePaused) {
        isVoicePaused = false;
        readBtn.textContent = "Pause ⏸";
        readBtn.style.backgroundColor = "#fef08a"; 
        
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
    readBtn.style.backgroundColor = "";
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

// --- NEW: QUICK AUDIO AUDIBILITY TEST TRIGGER ---
testVoiceBtn.addEventListener('click', () => {
    const selectedVoiceIndex = voiceSelect.value;
    if (!filteredVoices[selectedVoiceIndex]) return;
    
    // Stop any current reading channel immediately
    synth.cancel();
    
    // Create an isolated short audio sentence chunk test
    const testUtterance = new SpeechSynthesisUtterance("Testing voice engine channel output.");
    testUtterance.voice = filteredVoices[selectedVoiceIndex];
    testUtterance.rate = 1.0;
    
    synth.speak(testUtterance);
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
    readBtn.style.backgroundColor = "#fef08a";

    currentUtterance = new SpeechSynthesisUtterance(textToRead);
    const selectedVoiceIndex = voiceSelect.value;
    if (filteredVoices[selectedVoiceIndex]) {
        currentUtterance.voice = filteredVoices[selectedVoiceIndex];
    }

    currentUtterance.rate = parseFloat(speedSlider.value);
    startTimer();

    currentUtterance.onboundary = (event) => {
        if (event.name === 'word') {
            lastCharacterIndex = isMidSentenceResume ? lastCharacterIndex + event.charIndex : event.charIndex;
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
            }
        }
    };

    synth.speak(currentUtterance);
}

stopBtn.addEventListener('click', () => {
    isLoopEnabled = false;
    loopCheck.textContent = "Loop: OFF";
    loopCheck.style.backgroundColor = "";
    synth.cancel();
    stopTimer(); 
    resetReadButtonState();
    lastCharacterIndex = 0; 
});
