import { cardImageFile } from './ui.js';
import { currentState } from './state.js'
import { resetSelection } from './moveLogic.js';

export let gameState = null;

export function setupRender() {
    // Optional: put any code needed for the initial setup of containers here.
}

export function renderGame(state, changedCols = null) {
    gameState = state;
    renderFreecells(state.freecells);
    renderFoundations(state.foundations);
    renderTableau(state.tableau, changedCols);
}

export function renderTableauWithFakeFreecells(animTableau, fakeFreecells) {
    renderFreecells(fakeFreecells);
    renderFoundations(gameState.foundations);
    renderTableau(animTableau);
}

export function highlightSelection(element) {
    clearSelection();
    element.classList.add('selected');
}
export function clearSelection() {
    // document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    const el = document.querySelector('.selected');
    if (el) el.classList.remove('selected');
}

function renderFreecells(freecells) {
    const container = document.getElementById('freecells');
    container.innerHTML = '';
    freecells.forEach((card, i) => {
        const pileDiv = document.createElement('div');
        pileDiv.className = 'pile';
        pileDiv.dataset.location = `f${i}`;
        const label = document.createElement('div');
        label.className = 'pile-label';
        label.textContent = `Freecell ${i+1}`;
        pileDiv.appendChild(label);

        if (card) {
            const cardDiv = createCardDiv(card, `f${i}`);
            pileDiv.appendChild(cardDiv);
        }
        container.appendChild(pileDiv);
    });
}
function renderFoundations(foundations) {
    const container = document.getElementById('foundations');
    container.innerHTML = '';
    ['S','H','D','C'].forEach(suit => {
        const pileDiv = document.createElement('div');
        pileDiv.className = 'pile';
        pileDiv.dataset.location = `d${suit}`;
        const label = document.createElement('div');
        label.className = 'pile-label';
        label.textContent = `Foundation ${suit}`;
        pileDiv.appendChild(label);

        const pile = foundations[suit];
        if (pile.length > 0) {
            const card = pile[pile.length-1];
            const cardDiv = createCardDiv(card, `d${suit}`);
            pileDiv.appendChild(cardDiv);
        }
        container.appendChild(pileDiv);
    });
}
function renderTableau(tableau, changedCols = null) {
    const container = document.getElementById('tableau');
    if (!changedCols) {
        container.innerHTML = '';
        tableau.forEach((col, idx) => {
            container.appendChild(createColumnDiv(col, idx));
        });
    } else {
        const allExist = changedCols.every(idx => 
            container.querySelector(`.tableau-column[data-location="t${idx}"]`) !== null
        );
        if (!allExist) {
            container.innerHTML = '';
            tableau.forEach((col, idx) => {
                container.appendChild(createColumnDiv(col, idx));
            });
            adjustTableauHeights(tableau);
            return;
        }
        changedCols.forEach(idx => {
            if (idx < 0 || idx >= tableau.length) return;
            const oldColDiv = container.querySelector(`.tableau-column[data-location="t${idx}"]`);
            const newColDiv = createColumnDiv(tableau[idx], idx);
            container.replaceChild(newColDiv, oldColDiv);
        });
    }
    adjustTableauHeights(tableau);
}

function createColumnDiv(col, idx) {
    const colDiv = document.createElement('div');
    colDiv.className = 'tableau-column pile';
    colDiv.dataset.location = `t${idx}`;
    col.forEach((card, cardIdx) => {
        const cardDiv = createCardDiv(card, `t${idx}`, cardIdx);
        colDiv.appendChild(cardDiv);
    });
    return colDiv;
}

function createCardDiv(card, location, cardIdx = null) {
    const div = document.createElement('div');
    div.className = 'card';
    div.style.backgroundImage = `url(${cardImageFile(card)})`;
    div.dataset.location = location;
    if (cardIdx !== null) {
        div.dataset.cardIdx = cardIdx;
        div.style.setProperty('--card-idx', cardIdx);
        div.style.setProperty('--card-z', cardIdx);
    }
    return div;
}

/**
 * Dynamically adjusts tableau column heights.
 * By default, min-height fits 13 cards (1 full + 12 stacked).
 * If any column has >13 cards, all columns grow to fit the max.
 * Shrinks back down if all have ≤13 cards.
 */
function adjustTableauHeights(tableau) {
    const maxCards = Math.max(...tableau.map(col => col.length));
    // For 13 cards: 1 full + 12 offsets
    const defaultHeight = `calc(var(--card-height) + (12 * var(--card-stack-spacing)))`;
    let dynamicHeight = defaultHeight;
    if (maxCards > 13) {
        dynamicHeight = `calc(var(--card-height) + (${maxCards - 1} * var(--card-stack-spacing)))`;
    }

    document.querySelectorAll('.tableau-column').forEach(colDiv => {
        if (maxCards > 13) {
            colDiv.style.height = dynamicHeight;
        } else {
            colDiv.style.height = '';
        }
    });
}
