// --- GLOBAL EXAM MODULE CONTEXT ENGINE ---
let activeExamRows = [];
let isQuestionActive = false;
let examMode = 'choice';
let examReverse = false;
let examDeck = [];
let lastExamItem = null;
let examSignature = '';
let currentItem = null;

function t(key) {
    return (window.__i18n__ && window.__i18n__.t) ? window.__i18n__.t(key) : key;
}

function getExamModes() {
    return [
        { id: 'choice', label: t('examMultiChoice') },
        { id: 'tf',     label: t('examTF') },
        { id: 'type',   label: t('examFillBlank') }
    ];
}

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function buildModeBar() {
    const modeBar = document.createElement('div');
    modeBar.className = 'exam-mode-row';
    getExamModes().forEach(m => {
        const b = document.createElement('button');
        b.className = 'exam-mode-btn' + (m.id === examMode ? ' active' : '');
        b.dataset.mode = m.id;
        b.textContent = m.label;
        b.addEventListener('click', () => {
            examMode = m.id;
            if (currentItem) {
                drawActiveQuestion(currentItem);
            } else {
                renderShell();
            }
        });
        modeBar.appendChild(b);
    });

    const dirBtn = document.createElement('button');
    dirBtn.className = 'exam-mode-btn';
    dirBtn.id = 'exam-dir-btn';
    dirBtn.style.flex = '0 0 auto';
    dirBtn.textContent = examReverse ? 'B → A' : 'A → B';
    dirBtn.addEventListener('click', () => {
        examReverse = !examReverse;
        isQuestionActive = false;
        currentItem = null;
        examSignature = '';
        generateMockTest();
    });
    modeBar.appendChild(dirBtn);
    return modeBar;
}

function buildShell() {
    const wrapper = document.createElement('div');
    wrapper.className = 'exam-question-wrapper';

    wrapper.appendChild(buildModeBar());

    const promptP = document.createElement('p');
    promptP.id = 'exam-prompt-line';
    promptP.innerHTML = `<strong>${t('examPrompt')}:</strong> <span id="exam-prompt-text"></span>`;
    wrapper.appendChild(promptP);

    const body = document.createElement('div');
    body.id = 'exam-body';
    body.className = 'exam-body';
    wrapper.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'exam-actions-row';
    actions.style.cssText = 'display: flex; gap: 8px;';

    const checkBtn = document.createElement('button');
    checkBtn.id = 'exam-submit-btn';
    checkBtn.className = 'primary-btn';
    checkBtn.style.flex = '1';
    checkBtn.textContent = t('examCheck');
    actions.appendChild(checkBtn);

    const nextBtn = document.createElement('button');
    nextBtn.id = 'exam-next-btn';
    nextBtn.className = 'primary-btn';
    nextBtn.style.flex = '1';
    nextBtn.textContent = t('examNext');
    actions.appendChild(nextBtn);
    wrapper.appendChild(actions);

    const feedback = document.createElement('p');
    feedback.id = 'exam-feedback';
    feedback.style.cssText = 'margin-top: 12px; font-weight: bold; min-height: 20px;';
    wrapper.appendChild(feedback);

    return wrapper;
}

function getShell() {
    return recallViewer.querySelector('.exam-question-wrapper');
}

function refreshShellChrome(wrapper) {
    // Refresh the Exam Prompt label, Check Answer, and Next buttons
    const promptLine = wrapper.querySelector('#exam-prompt-line');
    if (promptLine) {
        const existingText = promptLine.querySelector('#exam-prompt-text');
        const preservedPrompt = existingText ? existingText.innerHTML : '';
        promptLine.innerHTML = `<strong>${t('examPrompt')}:</strong> <span id="exam-prompt-text">${preservedPrompt}</span>`;
    }
    const checkBtn = wrapper.querySelector('#exam-submit-btn');
    if (checkBtn) checkBtn.textContent = t('examCheck');
    const nextBtn = wrapper.querySelector('#exam-next-btn');
    if (nextBtn) nextBtn.textContent = t('examNext');
}

function renderShell() {
    let wrapper = getShell();
    if (!wrapper) {
        wrapper = buildShell();
        recallViewer.appendChild(wrapper);
    }

    const oldModeBar = wrapper.querySelector('.exam-mode-row');
    if (oldModeBar) oldModeBar.replaceWith(buildModeBar());

    refreshShellChrome(wrapper);

    const promptText = wrapper.querySelector('#exam-prompt-text');
    if (promptText) promptText.textContent = '';

    const body = wrapper.querySelector('#exam-body');
    if (body) {
        body.className = 'exam-body mode-' + examMode;
        body.innerHTML = '';

        if (examMode === 'type') {
            const p = document.createElement('p');
            p.innerHTML = `<strong>${t('examYourAnswer')}:</strong> <input type="text" id="exam-user-input" autocomplete="off" style="margin-bottom: 8px; width: 100%; box-sizing: border-box; padding: 8px;" disabled>`;
            body.appendChild(p);
        } else if (examMode === 'choice') {
            for (let i = 0; i < 3; i++) {
                const b = document.createElement('button');
                b.className = 'exam-choice';
                b.disabled = true;
                b.textContent = '\u00A0';
                body.appendChild(b);
            }
        } else if (examMode === 'tf') {
            const p = document.createElement('p');
            p.innerHTML = `<strong>${t('examProposedAnswer')}:</strong> <span></span>`;
            body.appendChild(p);
            [t('examTrue'), t('examFalse')].forEach(label => {
                const b = document.createElement('button');
                b.className = 'exam-choice';
                b.disabled = true;
                b.textContent = label;
                body.appendChild(b);
            });
        } else if (examMode === 'select') {
            for (let i = 0; i < 3; i++) {
                const lbl = document.createElement('label');
                lbl.className = 'exam-check';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.disabled = true;
                const span = document.createElement('span');
                span.innerHTML = '&nbsp;';
                lbl.appendChild(cb);
                lbl.appendChild(span);
                body.appendChild(lbl);
            }
        }
    }

    const checkBtn = wrapper.querySelector('#exam-submit-btn');
    const nextBtn = wrapper.querySelector('#exam-next-btn');
    if (checkBtn) checkBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;

    const feedback = wrapper.querySelector('#exam-feedback');
    if (feedback) feedback.textContent = '';

    isQuestionActive = false;
    currentItem = null;
}

function resetExam() {
    activeExamRows = [];
    examDeck = [];
    examSignature = '';
    lastExamItem = null;
    isQuestionActive = false;
    currentItem = null;
    renderShell();
}

function generateMockTest() {
    activeExamRows = [];
    spreadsheetContainer.querySelectorAll('.data-cell[data-col="A"]').forEach(cellA => {
        const rowNum = cellA.dataset.row;
        const cellB = spreadsheetContainer.querySelector(`.data-cell[data-row="${rowNum}"][data-col="B"]`);
        if (cellA.textContent.trim() && cellB && cellB.textContent.trim()) {
            const valA = cellA.textContent.trim();
            const valB = cellB.textContent.trim();
            activeExamRows.push(examReverse
                ? { prompt: valB, answer: valA }
                : { prompt: valA, answer: valB });
        }
    });

    if (activeExamRows.length === 0) {
        examSignature = '';
        examDeck = [];
        isQuestionActive = false;
        currentItem = null;
        renderShell();
        return;
    }

    const newSignature = JSON.stringify(activeExamRows);
    if (newSignature !== examSignature) {
        examSignature = newSignature;
        examDeck = [];
    }

    const item = drawNextItem();
    drawActiveQuestion(item);
}

function drawNextItem() {
    if (examDeck.length === 0) {
        examDeck = shuffle(activeExamRows);
        const top = examDeck[examDeck.length - 1];
        if (examDeck.length > 1 && lastExamItem &&
            top.prompt === lastExamItem.prompt && top.answer === lastExamItem.answer) {
            [examDeck[0], examDeck[examDeck.length - 1]] = [examDeck[examDeck.length - 1], examDeck[0]];
        }
    }
    lastExamItem = examDeck.pop();
    return lastExamItem;
}

function showFeedback(el, correct, expected) {
    if (correct) {
        el.textContent = t('examCorrect');
        el.style.color = "green";
    } else {
        el.textContent = `${t('examIncorrect')} "${expected}"`;
        el.style.color = "red";
    }
}

function drawActiveQuestion(item) {
    currentItem = item;
    isQuestionActive = true;

    let wrapper = getShell();
    if (!wrapper) {
        wrapper = buildShell();
        recallViewer.appendChild(wrapper);
    }

    const oldModeBar = wrapper.querySelector('.exam-mode-row');
    if (oldModeBar) oldModeBar.replaceWith(buildModeBar());

    refreshShellChrome(wrapper);

    const promptText = wrapper.querySelector('#exam-prompt-text');
    if (promptText) promptText.innerHTML = esc(item.prompt);

    const body = wrapper.querySelector('#exam-body');
    body.className = 'exam-body mode-' + examMode;
    body.innerHTML = '';

    const feedback = wrapper.querySelector('#exam-feedback');
    feedback.textContent = '';
    feedback.style.color = '';

    const checkBtn = wrapper.querySelector('#exam-submit-btn');
    const nextBtn = wrapper.querySelector('#exam-next-btn');

    nextBtn.disabled = false;
    checkBtn.disabled = (examMode !== 'type' && examMode !== 'select');

    if (examMode === 'choice') buildChoiceQuestion(item, body, feedback);
    else if (examMode === 'tf') buildTFQuestion(item, body, feedback);
    else if (examMode === 'select') buildSelectQuestion(item, body, feedback, checkBtn);
    else buildTypeQuestion(item, body, feedback, checkBtn);

    const newNext = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNext, nextBtn);
    newNext.addEventListener('click', () => {
        if (activeExamRows.length === 0) {
            renderShell();
            return;
        }
        const next = drawNextItem();
        drawActiveQuestion(next);
    });
}

function buildTypeQuestion(item, body, feedback, checkBtn) {
    body.innerHTML = `
        <p><strong>${t('examYourAnswer')}:</strong> <input type="text" id="exam-user-input" autocomplete="off" style="margin-bottom: 8px; width: 100%; box-sizing: border-box; padding: 8px;"></p>
    `;
    const input = body.querySelector('#exam-user-input');
    input.focus();

    const newCheck = checkBtn.cloneNode(true);
    newCheck.disabled = false;
    checkBtn.parentNode.replaceChild(newCheck, checkBtn);

    newCheck.addEventListener('click', () => {
        const correct = input.value.trim().toLowerCase() === item.answer.toLowerCase();
        showFeedback(feedback, correct, item.answer);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            newCheck.click();
        }
    });
}

function buildChoiceQuestion(item, body, feedback) {
    const wrong = shuffle([...new Set(activeExamRows.map(r => r.answer))]
        .filter(a => a.toLowerCase() !== item.answer.toLowerCase())).slice(0, 3);
    const options = shuffle([item.answer, ...wrong]);

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'exam-choice';
        btn.textContent = opt;
        btn.addEventListener('click', () => {
            const correct = opt === item.answer;
            body.querySelectorAll('.exam-choice').forEach(b => {
                b.disabled = true;
                if (b.textContent === item.answer) b.classList.add('correct');
            });
            if (!correct) btn.classList.add('wrong');
            showFeedback(feedback, correct, item.answer);
        });
        body.appendChild(btn);
    });
}

function buildTFQuestion(item, body, feedback) {
    const wrongPool = [...new Set(activeExamRows.map(r => r.answer))]
        .filter(a => a.toLowerCase() !== item.answer.toLowerCase());
    const isTrue = wrongPool.length === 0 || Math.random() < 0.5;
    const shown = isTrue ? item.answer : wrongPool[Math.floor(Math.random() * wrongPool.length)];

    const statement = document.createElement('p');
    statement.innerHTML = `<strong>${t('examProposedAnswer')}:</strong> ${esc(shown)}`;
    body.appendChild(statement);

    const trueLabel = t('examTrue');
    const falseLabel = t('examFalse');

    [true, false].forEach(val => {
        const btn = document.createElement('button');
        btn.className = 'exam-choice';
        btn.textContent = val ? trueLabel : falseLabel;
        btn.dataset.tfval = val ? 'true' : 'false';
        btn.addEventListener('click', () => {
            const correct = val === isTrue;
            body.querySelectorAll('.exam-choice').forEach(b => {
                b.disabled = true;
                if ((b.dataset.tfval === 'true') === isTrue) b.classList.add('correct');
            });
            if (!correct) btn.classList.add('wrong');
            showFeedback(feedback, correct, isTrue ? trueLabel : falseLabel);
        });
        body.appendChild(btn);
    });
}

/*
function buildSelectQuestion(item, body, feedback, checkBtn) { ... }
*/

// --- SIDEBAR RESET ON WINDOW RESIZE ---
window.addEventListener('resize', () => {
    const wrapper = document.getElementById('sidebar-wrapper');
    if (!wrapper) return;
    if (window.innerWidth > 700) {
        wrapper.classList.add('open');
        wrapper.classList.remove('collapsed');
    } else {
        wrapper.classList.remove('open');
        wrapper.classList.add('collapsed');
    }
});

(function initExamShell() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!window.noteActive) renderShell();
        });
    } else {
        if (!window.noteActive) renderShell();
    }
})();

window.refreshExamLanguage = function () {
    if (currentItem && isQuestionActive) {
        drawActiveQuestion(currentItem);
    } else {
        renderShell();
    }
};
window.renderShell = renderShell;