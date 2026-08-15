const textBox = document.getElementById('text-box');
const charCountDisplay = document.getElementById('char-count');
const timeEstimateDisplay = document.getElementById('time-estimate');
const tabReplaceBtn = document.getElementById('tab-replace-btn');

let startTime = 0;
let elapsedTime = 0;
let timerInterval = null;

function updateCharacterCount() {
    const charCount = textBox.value.length;
    charCountDisplay.textContent = charCount;
    const totalMinutes = charCount / 1000;
    const minutes = Math.floor(totalMinutes);
    const remainderSeconds = Math.floor((totalMinutes - minutes) * 60);
    timeEstimateDisplay.textContent = `${minutes}m ${remainderSeconds}s`;
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateTimerDisplay, 100); 
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function resetTimer() {
    stopTimer();
    elapsedTime = 0;
    document.getElementById('timer-display').textContent = "00:00.0";
}

function updateTimerDisplay() {
    elapsedTime = Date.now() - startTime;
    let totalSeconds = Math.floor(elapsedTime / 1000);
    let minutes = Math.floor(totalSeconds / 60);
    let seconds = totalSeconds % 60;
    let tenths = Math.floor((elapsedTime % 1000) / 100);
    
    let minStr = minutes.toString().padStart(2, '0');
    let secStr = seconds.toString().padStart(2, '0');
    
    document.getElementById('timer-display').textContent = `${minStr}:${secStr}.${tenths}`;
}

document.getElementById('timer-reset-btn').addEventListener('click', resetTimer);

tabReplaceBtn.addEventListener('click', () => {
    let currentText = textBox.value;
    currentText = currentText.replace(/\t/g, ' ');
    const cleanText = currentText.replace(/ +/g, ' ');
    textBox.value = cleanText;
    localStorage.setItem('savedTextBoxContent', cleanText);
    updateCharacterCount();
});

// Load persistence text instantly on startup
const savedText = localStorage.getItem('savedTextBoxContent');
if (savedText !== null && savedText !== '') {
    textBox.value = savedText;
}
updateCharacterCount();

textBox.addEventListener('input', () => {
    localStorage.setItem('savedTextBoxContent', textBox.value);
    updateCharacterCount();
});
