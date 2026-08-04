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

let allVoices = [];
let filteredVoices = [];
let isLoopEnabled = false;

// Dynamic Toggle Tracking State Memory
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

// --- DYNAMIC READ/PAUSE TOGGLE MANAGER ---
readBtn.addEventListener('click', () => {
    if (allVoices.length === 0) {
        populateVoices();
    }

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
    
    // SMART SORTING: Sort alphabetically, but push native/local downloaded voices to the top of the list
    allVoices.sort((a, b) => {
        if (a.localService && !b.localService) return -1;
        if (!a.localService && b.localService) return 1;
        return a.name.localeCompare(b.name);
    });
    
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
    
    // FIXED: Retrieve your last saved voice selection from browser storage memory
    const savedVoiceUri = localStorage.getItem('savedVoiceUri');
    let selectedIndex = 0;

    filteredVoices.forEach((voice, i) => {
        const option = document.createElement('option');
        option.value = i;
        const genderTag = guessGender(voice.name).toUpperCase();
        
        // Visual Anchor: Tag fully downloaded local service voices so you know they are working offline
        const localTag = voice.localService ? "✓ Local" : "Cloud";
        option.textContent = `${voice.name} (${voice.lang}) [${genderTag}] [${localTag}]`;
        
        // If this voice matches the one we saved earlier, mark it to be selected
        if (savedVoiceUri === voice.voiceURI) {
            selectedIndex = i;
        }
        voiceSelect.appendChild(option);
    });

    if (filteredVoices.length > 0) {
        voiceSelect.selectedIndex = selectedIndex;
        // Lock choice immediately into system memory
        localStorage.setItem('savedVoiceUri', filteredVoices[selectedIndex].voiceURI);
    } else {
        const option = document.createElement('option');
        option.textContent = "No matches found";
        voiceSelect.appendChild(option);
    }
}

if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = populateVoices;
populateVoices();

window.addEventListener('DOMContentLoaded', () => {
    populateVoices();
});

voiceSearch.addEventListener('input', populateVoices);

genderFilter.addEventListener('change', () => {
    localStorage.setItem('savedGenderFilter', genderFilter.value);
    localStorage.removeItem('savedVoiceUri'); // Clear specific voice so it auto-selects top available match
    populateVoices();
});

// FIXED: Listen for dropdown changes and permanently save your choice to localStorage
voiceSelect.addEventListener('change', () => {
    const selectedVoice = filteredVoices[voiceSelect.value];
    if (selectedVoice) {
        localStorage.setItem('savedVoiceUri', selectedVoice.voiceURI);
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
