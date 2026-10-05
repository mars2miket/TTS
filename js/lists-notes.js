// --- LIST EXPORT / IMPORT ---
(function () {
    const exportBtn = document.getElementById('list-export-btn');
    const importBtn = document.getElementById('list-import-btn');
    const importInput = document.getElementById('list-import-input');

    if (!exportBtn || !importBtn || !importInput) return;

    exportBtn.addEventListener('click', () => {
        if (typeof textBox === 'undefined' || !textBox) {
            alert('Grid not ready yet.');
            return;
        }

        const text = textBox.value || '';
        if (!text.trim()) {
            alert('This list is empty — nothing to export.');
            return;
        }

        const name = (typeof activeList === 'string' && activeList.trim()) || 'list';
        const safeName = name.replace(/[\\/:*?"<>|]/g, '_');

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        URL.revokeObjectURL(url);
    });

    importBtn.addEventListener('click', () => importInput.click());

    importInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (ev) => {
            const raw = String(ev.target.result || '').replace(/\r\n/g, '\n');

            if (!raw.trim()) {
                alert('That file is empty.');
                importInput.value = '';
                return;
            }

            let baseName = file.name.replace(/\.[^.]+$/, '').trim() || 'Imported';
            let name = baseName;
            let n = 2;
            while (name in listStore) {
                name = `${baseName} (${n++})`;
            }

            if (typeof window !== 'undefined' && window.noteActive && typeof exitNoteMode === 'function') {
                exitNoteMode();
            }

            if (typeof commitActiveList === 'function') commitActiveList();

            listStore[name] = raw.replace(/\s+$/, '');
            if (typeof saveListStore === 'function') saveListStore();

            if (typeof activeList !== 'undefined') {
                window.activeList = name;
            }
            if (typeof loadActiveListIntoGrid === 'function') {
                loadActiveListIntoGrid();
            }
            if (typeof afterListChange === 'function') {
                afterListChange();
            }
            if (typeof switchList === 'function') {
                switchList(name);
            }
        };

        reader.onerror = () => alert('Could not read that file.');
        reader.readAsText(file);

        importInput.value = '';
    });
})();

// --- NOTES: textarea mode ---
window.noteActive = false;

const noteArea = document.getElementById('note-area');
const noteSelect = document.getElementById('note-select');
const noteResizer = document.getElementById('note-resizer');
const noteWorkspace = document.querySelector('.input-workspace');
const noteNewBtn = document.getElementById('note-new-btn');
const noteRenameBtn = document.getElementById('note-rename-btn');
const noteDeleteBtn = document.getElementById('note-delete-btn');

function loadNoteStore() {
    try { return JSON.parse(localStorage.getItem('whNotes')) || {}; } catch (err) { return {}; }
}
function saveNoteStore() {
    try { localStorage.setItem('whNotes', JSON.stringify(noteStore)); } catch (err) { console.warn('note save failed:', err); }
}

let noteStore = loadNoteStore();
let activeNote = null;

function refreshNoteSelect() {
    noteSelect.innerHTML = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '';
    noteSelect.appendChild(blank);
    Object.keys(noteStore).forEach(name => {
        const op = document.createElement('option');
        op.value = name;
        op.textContent = name;
        noteSelect.appendChild(op);
    });
    noteSelect.value = window.noteActive ? activeNote : '';
}

function stopReadingAndExam() {
    if (typeof stopBtn !== 'undefined' && stopBtn) stopBtn.click();
    if (typeof resetExam === 'function') resetExam();
}

function enterNote(name) {
    if (!(name in noteStore)) return;
    activeNote = name;
    window.noteActive = true;
    noteArea.value = noteStore[name];
    noteWorkspace.classList.add('note-mode');
    if (typeof addRowBtn !== 'undefined' && addRowBtn) addRowBtn.disabled = true;
    stopReadingAndExam();
    const ls = document.getElementById('list-select');
    if (ls) ls.selectedIndex = -1;
    refreshNoteSelect();
    try {
        localStorage.setItem('whMode', 'note');
        localStorage.setItem('whActiveNote', name);
    } catch (err) {}
    updateCharacterCount();
}

function exitNoteMode() {
    if (!window.noteActive) return;
    window.noteActive = false;
    noteWorkspace.classList.remove('note-mode');
    if (typeof addRowBtn !== 'undefined' && addRowBtn) addRowBtn.disabled = false;
    stopReadingAndExam();
    refreshNoteSelect();
    if (typeof refreshListSelect === 'function') refreshListSelect();
    if (typeof colHiddenState !== 'undefined' && (colHiddenState.A || colHiddenState.B) && typeof generateMockTest === 'function') generateMockTest();
    try { localStorage.setItem('whMode', 'list'); } catch (err) {}
    updateCharacterCount();
}

function clearActiveNote() {
    if (!window.noteActive) return;
    noteArea.value = '';
    noteStore[activeNote] = '';
    saveNoteStore();
    updateCharacterCount();
}

noteSelect.addEventListener('change', () => {
    if (!noteSelect.value) exitNoteMode();
    else enterNote(noteSelect.value);
});

noteArea.addEventListener('input', () => {
    if (!window.noteActive) return;
    noteStore[activeNote] = noteArea.value;
    saveNoteStore();
    updateCharacterCount();
});

noteNewBtn.addEventListener('click', () => {
    const name = (prompt('New note name:') || '').trim();
    if (!name) return;
    if (name in noteStore) { alert('A note with that name already exists.'); return; }
    noteStore[name] = '';
    saveNoteStore();
    enterNote(name);
});

noteRenameBtn.addEventListener('click', () => {
    if (!window.noteActive) { alert('Select a note first.'); return; }
    const name = (prompt('Rename note:', activeNote) || '').trim();
    if (!name || name === activeNote) return;
    if (name in noteStore) { alert('A note with that name already exists.'); return; }
    const renamed = {};
    Object.keys(noteStore).forEach(k => { renamed[k === activeNote ? name : k] = noteStore[k]; });
    noteStore = renamed;
    activeNote = name;
    saveNoteStore();
    try { localStorage.setItem('whActiveNote', name); } catch (err) {}
    refreshNoteSelect();
});

noteDeleteBtn.addEventListener('click', () => {
    if (!window.noteActive) { alert('Select a note first.'); return; }
    const target = activeNote;
    const doDelete = () => {
        delete noteStore[target];
        saveNoteStore();
        activeNote = null;
        exitNoteMode();
    };
    if (typeof window.showConfirm === 'function') {
        window.showConfirm('Delete note', `Delete "${target}"? This cannot be undone.`, 'Delete', doDelete);
    } else if (confirm(`Delete "${target}"?`)) {
        doDelete();
    }
});

noteResizer.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    noteResizer.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const startHeight = noteArea.getBoundingClientRect().height;
    noteResizer.classList.add('resizing');

    function onPointerMove(e2) {
        noteArea.style.height = `${Math.max(80, startHeight + (e2.clientY - startY))}px`;
    }
    function onPointerUp(e2) {
        noteResizer.classList.remove('resizing');
        noteResizer.releasePointerCapture(e2.pointerId);
        noteResizer.removeEventListener('pointermove', onPointerMove);
        noteResizer.removeEventListener('pointerup', onPointerUp);
    }
    noteResizer.addEventListener('pointermove', onPointerMove);
    noteResizer.addEventListener('pointerup', onPointerUp);
});

(function initNotes() {
    refreshNoteSelect();
    const savedName = localStorage.getItem('whActiveNote');
    if (localStorage.getItem('whMode') === 'note' && savedName && savedName in noteStore) enterNote(savedName);
})();