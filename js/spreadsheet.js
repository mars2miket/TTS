// --- DOMAIN 2: GRID CONTROL SYSTEM & CONTENT INGESTION ---

window.textBox = {
    get value() { return window.noteActive ? document.getElementById('note-area').value : getSpreadsheetText(); },
    set value(val) { if (window.noteActive) document.getElementById('note-area').value = val; else setSpreadsheetText(val); },
    get offsetHeight() { return window.noteActive ? document.getElementById('note-area').offsetHeight : spreadsheetContainer.offsetHeight; }
};

function getSpreadsheetText() {
    const cells = spreadsheetContainer.querySelectorAll('.data-cell');
    let combinedText = "";
    cells.forEach((cell, index) => {
        const text = cell.textContent.trim();
        combinedText += text + (index % 2 === 0 ? "\t" : "\n");
    });
    return combinedText;
}

function setSpreadsheetText(text) {
    spreadsheetContainer.querySelectorAll('.data-cell').forEach(c => c.remove());
    const lines = text.split(/\r?\n/);
    let validRowCounter = 1;

    lines.forEach((line) => {
        const cols = line.split('\t');
        createRowCells(validRowCounter, cols[0] || "", cols[1] || "");
        validRowCounter++;
    });
    updateCharacterCount();
}

function createRowCells(rowNum, valA = "", valB = "") {
    const cellA = document.createElement('div');
    cellA.className = 'cell data-cell';
    cellA.contentEditable = 'true';
    cellA.dataset.row = rowNum;
    cellA.dataset.col = 'A';
    cellA.textContent = valA;

    const cellB = document.createElement('div');
    cellB.className = 'cell data-cell';
    cellB.contentEditable = 'true';
    cellB.dataset.row = rowNum;
    cellB.dataset.col = 'B';
    cellB.textContent = valB;

    spreadsheetContainer.appendChild(cellA);
    spreadsheetContainer.appendChild(cellB);

    if (colHiddenState.A && valA) maskCell(cellA);
    if (colHiddenState.B && valB) maskCell(cellB);
}

spreadsheetContainer.addEventListener('input', (e) => {
    if (e.target.classList.contains('data-cell')) {
        const raw = e.target.textContent;
        if (raw.includes('\t') || raw.includes('\n')) {
            e.target.textContent = '';
            distributePastedText(e.target, raw);
            return;
        }
        window.isTextDirty = true;
        updateCharacterCount();
        try {
            localStorage.setItem('savedSpreadsheetGridData', textBox.value);
        } catch (err) {
            console.warn('localStorage save failed:', err);
        }

        if (typeof isQuestionActive !== 'undefined' && !isQuestionActive && typeof generateMockTest === 'function') {
            generateMockTest();
        }
    }
});

function updateCharacterCount() {
    let charCount = 0;
    if (window.noteActive) {
        charCount = document.getElementById('note-area').value.length;
    } else if (window.spreadsheetContainer) {
        window.spreadsheetContainer.querySelectorAll('.data-cell').forEach(c => charCount += c.textContent.length);
    }
    charCountDisplay.textContent = charCount;
    const totalMinutes = charCount / 1000;
    const minutes = Math.floor(totalMinutes);
    const remainderSeconds = Math.floor((totalMinutes - minutes) * 60);
    timeEstimateDisplay.textContent = `${minutes}m ${remainderSeconds}s`;
}

spreadsheetContainer.addEventListener('beforeinput', (e) => {
    if (e.inputType !== 'insertFromPaste' && e.inputType !== 'insertText') return;
    if (!e.target.classList.contains('data-cell')) return;

    const text = extractClipboardText(e.dataTransfer);
    if (!text) return;

    if (text.includes('\t') || text.includes('\n')) {
        e.preventDefault();
        distributePastedText(e.target, text);
    }
});

function distributePastedText(targetCell, pastedText) {
    if (!targetCell.classList.contains('data-cell')) return;
    const rows = pastedText.split(/\r?\n/).filter(r => r.trim() !== '');
    const startRow = parseInt(targetCell.dataset.row, 10);
    const startCol = targetCell.dataset.col;

    rows.forEach((rowText, rowIndex) => {
        const currentRowNum = startRow + rowIndex;
        let cellA = spreadsheetContainer.querySelector(`.data-cell[data-row="${currentRowNum}"][data-col="A"]`);
        if (!cellA) {
            createRowCells(currentRowNum, "", "");
        }

        const columns = rowText.split('\t');
        columns.forEach((cellText, colIndex) => {
            let targetColLetter = (startCol === 'A') ? (colIndex === 0 ? 'A' : 'B') : 'B';
            const destinationCell = spreadsheetContainer.querySelector(
                `.data-cell[data-row="${currentRowNum}"][data-col="${targetColLetter}"]`
            );
            if (destinationCell) {
                destinationCell.textContent = cellText.trim();
            }
        });
    });

    window.isTextDirty = true;
    updateCharacterCount();
    try { localStorage.setItem('savedSpreadsheetGridData', textBox.value); } catch (err) { console.warn('localStorage save failed:', err); }

    if (typeof isQuestionActive !== 'undefined' && !isQuestionActive && typeof generateMockTest === 'function') {
        generateMockTest();
    }

    targetCell.dispatchEvent(new Event('input', { bubbles: true }));
}

function htmlTableToDelimitedText(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return null;
    const rows = Array.from(table.querySelectorAll('tr'));
    if (!rows.length) return null;
    return rows.map(tr =>
        Array.from(tr.querySelectorAll('td, th')).map(cell => cell.textContent.trim()).join('\t')
    ).join('\n');
}

function extractClipboardText(dataSource) {
    if (!dataSource) return '';
    const plain = dataSource.getData('text/plain') || dataSource.getData('text') || '';
    if (plain.includes('\t') || plain.includes('\n')) return plain;
    const html = dataSource.getData('text/html');
    if (html) {
        const fromTable = htmlTableToDelimitedText(html);
        if (fromTable) return fromTable;
    }
    return plain;
}

spreadsheetContainer.addEventListener('paste', (e) => {
    if (!e.target.classList.contains('data-cell')) return;
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedText = extractClipboardText(clipboardData);
    if (!pastedText) return;
    e.preventDefault();
    distributePastedText(e.target, pastedText);
});

// --- COLUMN RESIZE ---
(function setupColumnResize() {
    const resizer = spreadsheetContainer.querySelector('.resizer');
    if (!resizer) return;
    resizer.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        resizer.setPointerCapture(e.pointerId);
        const startX = e.clientX;
        const containerWidth = spreadsheetContainer.getBoundingClientRect().width;
        const colAEl = spreadsheetContainer.querySelector('.header-cell[data-col="A"]');
        const startWidthA = colAEl.getBoundingClientRect().width;
        resizer.classList.add('resizing');

        function onPointerMove(e2) {
            const delta = e2.clientX - startX;
            const minWidth = 60;
            let newA = Math.min(Math.max(minWidth, startWidthA + delta), containerWidth - minWidth);
            const newB = containerWidth - newA;
            spreadsheetContainer.style.gridTemplateColumns = `${newA}px ${newB}px`;
        }
        function onPointerUp(e2) {
            resizer.classList.remove('resizing');
            resizer.releasePointerCapture(e2.pointerId);
            resizer.removeEventListener('pointermove', onPointerMove);
            resizer.removeEventListener('pointerup', onPointerUp);
        }
        resizer.addEventListener('pointermove', onPointerMove);
        resizer.addEventListener('pointerup', onPointerUp);
    });
})();

// --- ROW AREA (HEIGHT) RESIZE ---
(function setupRowResize() {
    const handle = document.querySelector('.row-resizer');
    if (!handle) return;
    handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        const startY = e.clientY;
        const startHeight = spreadsheetContainer.getBoundingClientRect().height;
        handle.classList.add('resizing');

        function onPointerMove(e2) {
            const delta = e2.clientY - startY;
            const newHeight = Math.max(80, startHeight + delta);
            spreadsheetContainer.style.maxHeight = 'none';
            spreadsheetContainer.style.height = `${newHeight}px`;
        }
        function onPointerUp(e2) {
            handle.classList.remove('resizing');
            handle.releasePointerCapture(e2.pointerId);
            handle.removeEventListener('pointermove', onPointerMove);
            handle.removeEventListener('pointerup', onPointerUp);
        }
        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerUp);
    });
})();

// --- IN-CELL WORD MASKING ---
function maskCell(cell) {
    const text = cell.textContent;
    cell.innerHTML = '';
    text.split(/(\s+)/).forEach(token => {
        if (token === '') return;
        if (/^\s+$/.test(token)) {
            cell.appendChild(document.createTextNode(token));
        } else {
            const span = document.createElement('span');
            span.className = 'recall-word col-hidden';
            span.textContent = token;
            cell.appendChild(span);
        }
    });
}

function unmaskCell(cell) {
    cell.textContent = cell.textContent;
}

function applyCellMaskForColumn(letter) {
    spreadsheetContainer.querySelectorAll(`.data-cell[data-col="${letter}"]`).forEach(cell => {
        if (cell === document.activeElement) return;
        if (colHiddenState[letter]) maskCell(cell); else unmaskCell(cell);
    });
}

spreadsheetContainer.addEventListener('focusin', (e) => {
    if (e.target.classList.contains('data-cell') && e.target.querySelector('.recall-word')) {
        unmaskCell(e.target);
    }
});
spreadsheetContainer.addEventListener('focusout', (e) => {
    if (e.target.classList.contains('data-cell') && colHiddenState[e.target.dataset.col]) {
        maskCell(e.target);
    }
});

// --- PER-COLUMN HIDE TOGGLE INTERCEPT BRIDGE ---
function toggleColumnHide(letter) {
    if (typeof generateMockTest === 'function') {
        generateMockTest();
    }

    colHiddenState[letter] = !colHiddenState[letter];
    const headerEl = spreadsheetContainer.querySelector(`.header-cell[data-col="${letter}"]`);
    if (headerEl) headerEl.classList.toggle('col-hidden-active', colHiddenState[letter]);

    applyCellMaskForColumn(letter);

    if (recallViewer.classList.contains('hidden')) {
        recallViewer.style.height = '50vh';
        recallViewer.classList.remove('hidden');
    }
}

spreadsheetContainer.querySelectorAll('.header-cell').forEach(headerEl => {
    const label = headerEl.querySelector('.header-label');
    if (label) label.addEventListener('click', () => toggleColumnHide(headerEl.dataset.col));
});

try {
    const savedText = localStorage.getItem('savedSpreadsheetGridData');
    if (savedText) {
        textBox.value = savedText;
        if (typeof generateMockTest === 'function') {
            generateMockTest();
        }
    } else {
        updateCharacterCount();
    }
} catch (err) {
    console.warn('localStorage unavailable, skipping restore:', err);
    updateCharacterCount();
}

// =========================================================================
// LIST MANAGEMENT
// =========================================================================
(function initListManagement() {
    function loadListStore() {
        try { return JSON.parse(localStorage.getItem('whLists')) || {}; } catch (err) { return {}; }
    }
    function saveListStore() {
        try { localStorage.setItem('whLists', JSON.stringify(listStore)); } catch (err) { console.warn('list save failed:', err); }
    }

    let listStore = loadListStore();
    let activeList = localStorage.getItem('whActiveList');
    const listSelect = document.getElementById('list-select');

    function commitActiveList() {
        try {
            listStore[activeList] = textBox.value;
            saveListStore();
        } catch (err) {
            console.warn('[lists] commitActiveList failed:', err);
        }
    }

    function loadActiveListIntoGrid() {
        textBox.value = (listStore[activeList] || '').replace(/\s+$/, '');
        try {
            localStorage.setItem('savedSpreadsheetGridData', textBox.value);
            localStorage.setItem('whActiveList', activeList);
        } catch (err) { console.warn('localStorage save failed:', err); }
        window.isTextDirty = true;
    }

    function refreshListSelect() {
        if (!listSelect) return;
        listSelect.innerHTML = '';
        Object.keys(listStore).forEach(name => {
            const op = document.createElement('option');
            op.value = name;
            op.textContent = name;
            listSelect.appendChild(op);
        });
        listSelect.value = activeList;
    }

    function afterListChange() {
        try { if (typeof stopBtn !== 'undefined' && stopBtn) stopBtn.click(); } catch (err) { console.warn('[lists] stopBtn:', err); }
        try { if (typeof resetExam === 'function') resetExam(); } catch (err) { console.warn('[lists] resetExam:', err); }
        try {
            if ((colHiddenState.A || colHiddenState.B) && typeof generateMockTest === 'function') generateMockTest();
        } catch (err) { console.warn('[lists] generateMockTest:', err); }
        refreshListSelect();
    }

    function switchList(name) {
        if (!(name in listStore) || name === activeList) return;
        commitActiveList();
        activeList = name;
        loadActiveListIntoGrid();
        afterListChange();
    }

    window.commitActiveList = commitActiveList;
    window.loadActiveListIntoGrid = loadActiveListIntoGrid;
    window.refreshListSelect = refreshListSelect;
    window.afterListChange = afterListChange;
    window.switchList = switchList;
    window.listStore = listStore;

    try {
        if (Object.keys(listStore).length === 0) {
            activeList = 'List 1';
            listStore[activeList] = localStorage.getItem('savedSpreadsheetGridData') || '';
            saveListStore();
            try { localStorage.setItem('whActiveList', activeList); } catch (err) {}
        } else if (!(activeList in listStore)) {
            activeList = Object.keys(listStore)[0];
            loadActiveListIntoGrid();
        }
        refreshListSelect();
    } catch (err) {
        console.error('[lists] bootstrap failed:', err);
    }

        if (listSelect) {
        listSelect.addEventListener('change', () => {
            const chosen = listSelect.value;
            try { if (window.noteActive && typeof exitNoteMode === 'function') exitNoteMode(); } catch (err) { console.warn('[lists] exitNoteMode:', err); }
            switchList(chosen);
        });
    }

    const listNewBtn = document.getElementById('list-new-btn');
    const listRenameBtn = document.getElementById('list-rename-btn');
    const listDeleteBtn = document.getElementById('list-delete-btn');

    if (listNewBtn) listNewBtn.addEventListener('click', () => {
        try { if (window.noteActive && typeof exitNoteMode === 'function') exitNoteMode(); } catch (err) { console.warn('[lists] exitNoteMode:', err); }

        const raw = window.prompt('New list name:');
        if (raw === null) return;
        const name = raw.trim();
        if (!name) return;
        if (name in listStore) { alert('A list with that name already exists.'); return; }

        try { commitActiveList(); } catch (err) { console.warn('[lists] commitActiveList:', err); }

        listStore[name] = '';
        activeList = name;
        window.listStore = listStore;
        window.activeList = activeList;

        try { saveListStore(); } catch (err) { console.warn('[lists] saveListStore:', err); }
        try { loadActiveListIntoGrid(); } catch (err) { console.warn('[lists] loadActiveListIntoGrid:', err); }
        try { afterListChange(); } catch (err) { console.warn('[lists] afterListChange:', err); }
    });

    
    if (listRenameBtn) listRenameBtn.addEventListener('click', () => {
        try { if (window.noteActive && typeof exitNoteMode === 'function') exitNoteMode(); } catch (err) { console.warn('[lists] exitNoteMode:', err); }
        const raw = window.prompt('Rename list:', activeList);
        if (raw === null) return;
        const name = raw.trim();
        if (!name || name === activeList) return;
        if (name in listStore) { alert('A list with that name already exists.'); return; }

        commitActiveList();
        const renamed = {};
        Object.keys(listStore).forEach(k => { renamed[k === activeList ? name : k] = listStore[k]; });
        listStore = renamed;
        activeList = name;
        window.listStore = listStore;
        window.activeList = activeList;
        saveListStore();
        try { localStorage.setItem('whActiveList', activeList); } catch (err) {}
        refreshListSelect();
    });

    if (listDeleteBtn) listDeleteBtn.addEventListener('click', () => {
        try { if (window.noteActive && typeof exitNoteMode === 'function') exitNoteMode(); } catch (err) { console.warn('[lists] exitNoteMode:', err); }
        if (Object.keys(listStore).length <= 1) { alert('You need at least one list.'); return; }

        const target = activeList;
        const doDelete = () => {
            delete listStore[target];
            activeList = Object.keys(listStore)[0];
            window.listStore = listStore;
            window.activeList = activeList;
            saveListStore();
            loadActiveListIntoGrid();
            afterListChange();
        };

        if (typeof window.showConfirm === 'function') {
            window.showConfirm('Delete list', `Delete "${target}"? This cannot be undone.`, 'Delete', doDelete);
        } else if (confirm(`Delete "${target}"?`)) {
            doDelete();
        }
    });
})();


// --- DELETE ROW ICON ---
const rowDeleteBtn = document.createElement('button');
rowDeleteBtn.id = 'row-delete-btn';
rowDeleteBtn.title = 'Delete row';
rowDeleteBtn.textContent = '🗑️';
spreadsheetContainer.appendChild(rowDeleteBtn);

let deleteTargetRow = null;
const noHover = window.matchMedia('(hover: none)').matches;

function showDeleteBtn(cell) {
    const c = spreadsheetContainer.getBoundingClientRect();
    const r = cell.getBoundingClientRect();
    rowDeleteBtn.style.top = `${r.top - c.top - spreadsheetContainer.clientTop + spreadsheetContainer.scrollTop + (r.height - 44) / 2}px`;
    rowDeleteBtn.style.left = `${r.right - c.left - spreadsheetContainer.clientLeft + spreadsheetContainer.scrollLeft - 50}px`;
    rowDeleteBtn.classList.add('visible');
    deleteTargetRow = cell.dataset.row;
}

function hideDeleteBtn() {
    rowDeleteBtn.classList.remove('visible');
    deleteTargetRow = null;
}

function deleteRow(rowNum) {
    const rows = [];
    spreadsheetContainer.querySelectorAll('.data-cell[data-col="A"]').forEach(cellA => {
        if (cellA.dataset.row === String(rowNum)) return;
        const cellB = spreadsheetContainer.querySelector(`.data-cell[data-row="${cellA.dataset.row}"][data-col="B"]`);
        rows.push([cellA.textContent, cellB ? cellB.textContent : '']);
    });

    spreadsheetContainer.querySelectorAll('.data-cell').forEach(c => c.remove());
    if (rows.length === 0) rows.push(['', '']);
    rows.forEach((r, i) => createRowCells(i + 1, r[0], r[1]));

    window.isTextDirty = true;
    updateCharacterCount();
    try { localStorage.setItem('savedSpreadsheetGridData', textBox.value); } catch (err) { console.warn('localStorage save failed:', err); }

    if (typeof isQuestionActive !== 'undefined' && isQuestionActive && typeof generateMockTest === 'function') generateMockTest();
}

spreadsheetContainer.addEventListener('mousemove', (e) => {
    if (noHover || e.target === rowDeleteBtn) return;
    const cell = e.target.closest('.data-cell[data-col="B"]');
    if (cell && e.clientX >= cell.getBoundingClientRect().right - 48) showDeleteBtn(cell);
    else hideDeleteBtn();
});
spreadsheetContainer.addEventListener('mouseleave', () => { if (!noHover) hideDeleteBtn(); });

spreadsheetContainer.addEventListener('focusin', (e) => {
    if (noHover && e.target.matches('.data-cell[data-col="B"]')) showDeleteBtn(e.target);
});
spreadsheetContainer.addEventListener('focusout', (e) => {
    if (noHover && e.relatedTarget !== rowDeleteBtn) hideDeleteBtn();
});

spreadsheetContainer.addEventListener('scroll', hideDeleteBtn);

rowDeleteBtn.addEventListener('mousedown', (e) => e.preventDefault());
rowDeleteBtn.addEventListener('click', () => {
    if (deleteTargetRow) deleteRow(deleteTargetRow);
    hideDeleteBtn();
});

// --- ADD ROW BUTTON ---
const addRowBtn = document.getElementById('add-row-btn');
if (addRowBtn) addRowBtn.addEventListener('click', () => {
    let maxRow = 0;
    spreadsheetContainer.querySelectorAll('.data-cell[data-col="A"]').forEach(c => {
        maxRow = Math.max(maxRow, parseInt(c.dataset.row, 10) || 0);
    });
    createRowCells(maxRow + 1, '', '');
    const newCell = spreadsheetContainer.querySelector(`.data-cell[data-row="${maxRow + 1}"][data-col="A"]`);
    if (newCell) {
        newCell.scrollIntoView({ block: 'nearest' });
        newCell.focus();
    }
});