/**
 * --- SPREADSHEET ROW-SYNCHRONIZED SORTING ENGINE ---
 */

function sortSpreadsheetByColumn(letter) {
    const container = window.spreadsheetContainer || document.querySelector('.spreadsheet-container') || document.getElementById('spreadsheetContainer');
    if (!container) return;

    const rowsData = [];

    container.querySelectorAll('.data-cell[data-col="A"]').forEach(cellA => {
        const rowNum = cellA.dataset.row;
        const cellB = container.querySelector(`.data-cell[data-row="${rowNum}"][data-col="B"]`);

        const valA = (cellA.textContent || "").trim();
        const valB = cellB ? (cellB.textContent || "").trim() : "";

        if (valA === "" && valB === "") {
            return;
        }

        rowsData.push({ valA, valB });
    });

    if (rowsData.length === 0) return;

    if (!container.dataset.sortDirA) container.dataset.sortDirA = 'asc';
    if (!container.dataset.sortDirB) container.dataset.sortDirB = 'asc';

    rowsData.sort((rowX, rowY) => {
        const textX = (letter === 'A' ? rowX.valA : rowX.valB).toLowerCase();
        const textY = (letter === 'A' ? rowY.valA : rowY.valB).toLowerCase();

        if (textX === "" && textY !== "") return 1;
        if (textX !== "" && textY === "") return -1;
        if (textX === "" && textY === "") return 0;

        return textX.localeCompare(textY);
    });

    const stateKey = letter === 'A' ? 'sortDirA' : 'sortDirB';
    if (container.dataset[stateKey] === 'asc') {
        rowsData.reverse();
        container.dataset[stateKey] = 'desc';
    } else {
        container.dataset[stateKey] = 'asc';
    }

    container.querySelectorAll('.data-cell').forEach(c => c.remove());

    rowsData.forEach((rowData, index) => {
        createRowCells(index + 1, rowData.valA, rowData.valB);
    });

    if (typeof updateCharacterCount === 'function') {
        updateCharacterCount();
    }

    try {
        if (window.textBox && typeof textBox.value !== 'undefined') {
            localStorage.setItem('savedSpreadsheetGridData', textBox.value);
        }
    } catch (err) {
        console.warn('localStorage save failed inside sorting engine:', err);
    }
}

function initializeSortingControls() {
    const container = window.spreadsheetContainer || document.querySelector('.spreadsheet-container') || document.getElementById('spreadsheetContainer');
    if (!container) return;

    container.querySelectorAll('.header-cell').forEach(headerEl => {
        const columnLetter = headerEl.dataset.col;
        const sortBtn = headerEl.querySelector('.header-sort-btn');

        if (sortBtn) {
            sortBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                sortSpreadsheetByColumn(columnLetter);
            });
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSortingControls);
} else {
    initializeSortingControls();
}