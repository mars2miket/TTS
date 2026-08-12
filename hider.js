// --- HIGH-SPEED PRE-RENDERED ACTIVE RECALL ENGINE ---
const hiderBtn = document.getElementById('hider-btn');
const recallViewer = document.getElementById('recall-viewer');
const removePunksBtn = document.getElementById('remove-punks-btn');

let hideStage = 0;
let isTextDirty = true; // Flag tracking if text inputs changed since the last pre-render check

// Set up a listener on your main input box so the engine knows exactly when it needs a fresh render pass
textBox.addEventListener('input', () => {
    isTextDirty = true;
});

// High-speed compilation generation that builds the word tokens only once
function preRenderTextGrid() {
    recallViewer.innerHTML = ''; // Single hard wipe execution
    
    const paragraphs = textBox.value.split('\n');
    let runningIndex = 0; // tracks absolute offset into textBox.value as we walk the same split that built it

    paragraphs.forEach((para, pIdx) => {
        const words = para.split(' ');
        
        words.forEach((word, wIdx) => {
            const wordStart = runningIndex;
            runningIndex += word.length + 1; // +1 accounts for the space (or newline) that followed this word

            if (!word.trim()) return;
            
            const span = document.createElement('span');
            span.className = "recall-word";
            span.textContent = word;
            span.dataset.start = wordStart;
            span.dataset.end = wordStart + word.length;
            
            // Inject structural position indices directly into HTML text data tags
            span.setAttribute('data-mod3', wIdx % 3);
            
            // Assign an immutable 50% coin-flip probability attribute tag
            span.setAttribute('data-rand', Math.random() < 0.5 ? "true" : "false");
            
            // Standard interactive click reveal behavior
            span.addEventListener('click', (e) => {
                // Only toggle if the word is actively blacked out by the current stage
                const computedStyle = window.getComputedStyle(span);
                if (computedStyle.backgroundColor === computedStyle.color || span.classList.contains('revealed')) {
                    span.classList.toggle('revealed');
                }
            });
            
            recallViewer.appendChild(span);
            recallViewer.appendChild(document.createTextNode(" "));
        });
        
        if (pIdx < paragraphs.length - 1) {
            recallViewer.appendChild(document.createElement('br'));
        }
    });
    
    isTextDirty = false; // Layout compiled successfully
}

hiderBtn.addEventListener('click', () => {
    hideStage = (hideStage + 1) % 6;
    
    if (hideStage > 0) {
        if (hideStage === 1) hiderBtn.textContent = "Hide x 3";
        if (hideStage === 2) hiderBtn.textContent = "Hide x 2";
        if (hideStage === 3) hiderBtn.textContent = "Hide x 1";
        if (hideStage === 4) hiderBtn.textContent = "Hide Random Words";
        if (hideStage === 5) hiderBtn.textContent = "Hide All";
        
        hiderBtn.style.backgroundColor = "#bae6fd"; 
        recallViewer.style.height = `${textBox.offsetHeight}px`;
        
        // Compile elements only if the user changed the words since their last toggle click pass
        if (isTextDirty) {
            preRenderTextGrid();
        } else {
            // Fast Clear: Remove previous session tap tracking classes instantly without redrawing elements
            const elements = recallViewer.getElementsByClassName('recall-word');
            for (let el of elements) {
                el.classList.remove('revealed');
            }
        }
        
        // HOT REWRITE SWITCH: Instantly swap visibility filtering on the parent layer via your graphics card
        recallViewer.setAttribute('data-stage', hideStage);
        recallViewer.classList.remove('hidden'); 
    } else {
        resetHideMode();
    }
});

// Finds the pre-rendered word span covering a given absolute character index in textBox.value.
// Used by speech.js to highlight the word currently being spoken.
function getWordSpanAtIndex(charIndex) {
    const spans = recallViewer.getElementsByClassName('recall-word');
    for (const span of spans) {
        const start = Number(span.dataset.start);
        const end = Number(span.dataset.end);
        if (charIndex >= start && charIndex < end) return span;
    }
    return null;
}

function resetHideMode() {
    hideStage = 0;
    hiderBtn.textContent = "Hide Words"; 
    hiderBtn.style.backgroundColor = ""; 
    recallViewer.removeAttribute('data-stage');
    recallViewer.classList.add('hidden'); 
}

removePunksBtn.addEventListener('click', () => {
    const currentText = textBox.value;
    const cleanText = currentText.replace(/[^\w\s\n\d]/g, '');
    textBox.value = cleanText;
    localStorage.setItem('savedTextBoxContent', cleanText);
    isTextDirty = true; // Signal text matrix changes safely
    if (typeof updateCharacterCount === 'function') {
        updateCharacterCount();
    }
});
