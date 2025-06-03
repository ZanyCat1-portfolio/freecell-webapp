import { renderGame, clearSelection, highlightSelection } from './render.js';
import { showMessage } from './ui.js';
import { currentState, tryMove } from './state.js';
import {
    canMoveStackToTableau,
    canMoveCardToFoundation,
    isValidStack,
    convertLocationToOneBased
} from './rules.js';
import { runAnimationForMultiMove } from './animation.js';

export const isAnimating = { value: false };
let selectedSource = null;

export function selectSourceOrMove(target) {
    const location = target.dataset.location || (target.parentElement && target.parentElement.dataset.location);
    if (!location) return;

    // No source selected: select source
    if (!selectedSource) {
        const cardIdx = target.dataset.cardIdx !== undefined ? parseInt(target.dataset.cardIdx) : null;
        selectedSource = { location, element: target, cardIdx };
        highlightSelection(selectedSource.element);
        showMessage(
            `Selected source: ${convertLocationToOneBased(location)}${cardIdx !== null ? ` (card #${cardIdx + 1})` : ''}`
        );
        return;
    }
    // Clicking again: clear
    if (selectedSource.location === location) {
        clearSelection();
        selectedSource = null;
        return;
    }
    // Try move
    let numCards = 1;
    if (selectedSource.cardIdx !== null && selectedSource.location.startsWith('t')) {
        const srcIdx = parseInt(selectedSource.location.slice(1));
        numCards = currentState.tableau[srcIdx].length - selectedSource.cardIdx;
    }
    doMove(numCards, selectedSource.location, location).finally(() => {
        clearSelection();
        selectedSource = null;
    });
}

async function doMove(numCards, src, dest) {
    // Multi-card tableau-to-tableau: animate if valid
    if (src.startsWith('t') && dest.startsWith('t') && numCards > 1) {
        const srcIdx = parseInt(src.slice(1));
        const destIdx = parseInt(dest.slice(1));
        // Validate move with backend
        const valid = await validateMove(numCards, convertLocationToOneBased(src), convertLocationToOneBased(dest));
        if (!valid) return;
        isAnimating.value = true;
        await runAnimationForMultiMove(numCards, srcIdx, destIdx, currentState);
        isAnimating.value = false;
        await tryMove(numCards, convertLocationToOneBased(src), convertLocationToOneBased(dest));
        return;
    }
    // Single-card or non-tableau-to-tableau
    await tryMove(numCards, convertLocationToOneBased(src), convertLocationToOneBased(dest));
}

// --- Double Click Auto-Move ---
export async function autoMoveOnDoubleClick(cardDiv) {
    const location = cardDiv.dataset.location;
    if (!location) return;

    // === Tableau double click ===
    if (location.startsWith('t')) {
        const srcColIdx = parseInt(location.slice(1));
        const cardIdx = cardDiv.dataset.cardIdx ? parseInt(cardDiv.dataset.cardIdx) : null;
        const col = currentState.tableau[srcColIdx];
        if (!col || col.length === 0 || cardIdx === null) return;

        // 1. Attempt multi-card move (from clicked card to bottom)
        const stack = col.slice(cardIdx);
        if (isValidStack(stack) && stack.length > 1) {
            for (let destColIdx = 0; destColIdx < currentState.tableau.length; destColIdx++) {
                if (destColIdx === srcColIdx) continue;
                const destCol = currentState.tableau[destColIdx];
                if (canMoveStackToTableau(stack, destCol, currentState.freecells)) {
                    const maxMovable = computeMaxMovableStack(srcColIdx, destColIdx);
                    if (stack.length <= maxMovable) {
                        await runAnimationForMultiMove(
                            stack.length,
                            srcColIdx,
                            destColIdx,
                            currentState
                        );
                        if (await tryMove(
                            stack.length,
                            convertLocationToOneBased(`t${srcColIdx}`),
                            convertLocationToOneBased(`t${destColIdx}`)
                        )) return;
                    }
                }
            }
        }
        // 2. Attempt single-card move if clicked card is at bottom
        if (cardIdx === col.length - 1) {
            const singleCard = col[cardIdx];
            if (await tryAutoDestinations(singleCard, location)) return;
        }
        // 3. No move possible
        showMessage('Card cannot be auto-moved');
        return;
    }

    // === Freecell double click ===
    if (location.startsWith('f')) {
        const fcIdx = parseInt(location.slice(1));
        const card = currentState.freecells[fcIdx];
        if (!card) return;

        // 1. Try foundation
        if (canMoveCardToFoundation(card, currentState.foundations)) {
            const dest = convertLocationToOneBased(`d${card.suit}`);
            if (await tryMove(1, convertLocationToOneBased(location), dest)) return;
        }
        // 2. Try tableau
        for (let i = 0; i < currentState.tableau.length; i++) {
            if (canMoveStackToTableau([card], currentState.tableau[i], currentState.freecells)) {
                const dest = convertLocationToOneBased(`t${i}`);
                if (await tryMove(1, convertLocationToOneBased(location), dest)) return;
            }
        }
        // 3. No move possible
        showMessage('Card cannot be auto-moved');
        return;
    }

    // === Foundation double click ===
    if (location.startsWith('d')) {
        const suit = location.slice(1);
        const pile = currentState.foundations[suit];
        if (!pile || pile.length === 0) return;
        const card = pile[pile.length - 1];
        // Try each tableau column as a target
        for (let destColIdx = 0; destColIdx < currentState.tableau.length; destColIdx++) {
            const destCol = currentState.tableau[destColIdx];
            if (canMoveStackToTableau([card], destCol, currentState.freecells)) {
                if (await tryMove(
                    1,
                    convertLocationToOneBased(location),
                    convertLocationToOneBased(`t${destColIdx}`)
                )) return;
            }
        }
        showMessage('Card cannot be auto-moved');
        return;
    }
}

function computeMaxMovableStack(srcColIdx, destColIdx) {
    const emptyFreecells = currentState.freecells.filter(c => c === null).length;
    const emptyCols = currentState.tableau.filter(
        (c, i) => c.length === 0 && i !== srcColIdx && i !== destColIdx
    ).length;
    return (emptyFreecells + 1) * (emptyCols + 1);
}

async function tryAutoDestinations(card, fromLocation, excludeFreecellIdx = null) {
    // Foundation
    if (canMoveCardToFoundation(card, currentState.foundations)) {
        const dest = convertLocationToOneBased(`d${card.suit}`);
        if (await tryMove(1, convertLocationToOneBased(fromLocation), dest)) return true;
    }
    // Tableau
    for (let i = 0; i < currentState.tableau.length; i++) {
        if (canMoveStackToTableau([card], currentState.tableau[i], currentState.freecells)) {
            const dest = convertLocationToOneBased(`t${i}`);
            if (await tryMove(1, convertLocationToOneBased(fromLocation), dest)) return true;
        }
    }
    // Freecell
    for (let i = 0; i < currentState.freecells.length; i++) {
        if (i === excludeFreecellIdx) continue;
        if (currentState.freecells[i] === null) {
            const dest = convertLocationToOneBased(`f${i}`);
            if (await tryMove(1, convertLocationToOneBased(fromLocation), dest)) return true;
        }
    }
    return false;
}

// --- Backend move validation ---
async function validateMove(num, source, dest) {
    const res = await fetch('validate-move', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ num, source, dest })
    });
    const json = await res.json();
    if (!res.ok || !json.valid) {
        showMessage('Illegal move: ' + (json.error || 'Not allowed'));
        clearSelection();
        return false;
    }
    return true;
}
