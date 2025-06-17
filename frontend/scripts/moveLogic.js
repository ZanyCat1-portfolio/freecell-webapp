// moveLogic.js
import { renderGame, clearSelection, highlightSelection } from './render.js';
import { showMessage } from './ui.js';
import { currentState, getKingsOnlySetting, tryMove } from './state.js';

import {
    canMoveStackToTableau,
    canMoveCardToFoundation,
    isValidStack,
    convertLocationToOneBased
} from './rules.js';
import { runAnimationFromFreecell, runAnimationFromTableau, DOUBLE_CLICK_ANIM_DELAY, AUTO_MOVE_ANIM_DELAY } from './animation.js';
import { sleep } from './utils.js';
import { state } from './state.js';

export const isAnimating = { value: false };
let selectedSource = null;

export function resetSelection() {
    selectedSource = null;
    clearSelection();
}

let suppressAutoMoveCard = null;



export async function runAutoMoveToFoundation() {
    if (!state.autoMoveEnabled) return false;

    // Tableau top cards
    for (let i = 0; i < currentState.tableau.length; i++) {
        const col = currentState.tableau[i];
        if (col.length === 0) continue;
        const card = col[col.length - 1];

        if (
            card &&
            (!suppressAutoMoveCard || !isSameCard(card, suppressAutoMoveCard)) &&
            canMoveCardToFoundation(card, currentState.foundations) &&
            isSafeToAutoMove(card, currentState.foundations)
        ) {
            await runAnimationFromTableau(1, i, -1, currentState, AUTO_MOVE_ANIM_DELAY);
            await tryMove(1, `t${i + 1}`, `d${card.suit}`);
            return true;
        }
    }

    // Freecell cards
    for (let i = 0; i < currentState.freecells.length; i++) {
        const card = currentState.freecells[i];
        if (!card) continue;

        if (
            (!suppressAutoMoveCard || !isSameCard(card, suppressAutoMoveCard)) &&
            canMoveCardToFoundation(card, currentState.foundations) &&
            isSafeToAutoMove(card, currentState.foundations)
        ) {
            await runAnimationFromFreecell('freecell', i, 'foundation', card.suit, currentState, AUTO_MOVE_ANIM_DELAY);
            await tryMove(1, `f${i + 1}`, `d${card.suit}`);
            return true;
        }
    }

    // No auto-move performed
    return false;
}

function isSafeToAutoMove(card, foundations) {
    const rankValues = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
                         '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };
    const rank = rankValues[card.rank];
    const suit = card.suit;

    if (rank === 1 || rank === 2) return true;

    const oppositeColorSuits = {
        H: ['C', 'S'],
        D: ['C', 'S'],
        C: ['H', 'D'],
        S: ['H', 'D']
    };

    const requiredSuits = oppositeColorSuits[suit];
    if (!requiredSuits) return false;

    for (const s of requiredSuits) {
        const pile = foundations[s];
        if (!Array.isArray(pile)) return false;

        const topCard = pile[pile.length - 1];
        const topRank = topCard ? rankValues[topCard.rank] : 0;

        if (topRank < rank - 1) return false;
    }

    return true;
}









export function selectSourceOrMove(target) {
    const location = target.dataset.location || (target.parentElement && target.parentElement.dataset.location);
    if (!location) return;

    if (!selectedSource) {
        // Prevent selecting an empty tableau, freecell, or foundation as source
        let isEmptySource = false;

        if (location.startsWith('t')) {
            const idx = parseInt(location.slice(1));
            isEmptySource = !currentState.tableau[idx] || currentState.tableau[idx].length === 0;
        } else if (location.startsWith('f')) {
            const idx = parseInt(location.slice(1));
            isEmptySource = !currentState.freecells[idx];
        } else if (location.startsWith('d')) {
            const suit = location.slice(1);
            isEmptySource = !currentState.foundations[suit] || currentState.foundations[suit].length === 0;
        }

        if (isEmptySource) {
            showMessage("Can't select an empty pile.");
            return;
        }

        const cardIdx = target.dataset.cardIdx !== undefined ? parseInt(target.dataset.cardIdx) : null;
        selectedSource = { location, element: target, cardIdx };
        highlightSelection(selectedSource.element);
        showMessage(
            `Selected source: ${convertLocationToOneBased(location)}${cardIdx !== null ? ` (card #${cardIdx + 1})` : ''}`
        );
        return;
    }

    if (selectedSource.location === location) {
        resetSelection();
        selectedSource = null;
        return;
    }

    let numCards = 1;
    if (selectedSource.cardIdx !== null && selectedSource.location.startsWith('t')) {
        const srcIdx = parseInt(selectedSource.location.slice(1));
        numCards = currentState.tableau[srcIdx].length - selectedSource.cardIdx;
    }

    doMove(numCards, selectedSource.location, location).finally(() => {
        resetSelection();
        // selectedSource = null;
    });
}


function isSameCard(cardA, cardB) {
    return cardA && cardB && cardA.rank === cardB.rank && cardA.suit === cardB.suit;
}

export async function doMove(numCards, src, dest) {
    // Suppress auto-move if source is foundation
    if (src.startsWith('d')) {
        const suit = src.slice(1);
        const pile = currentState.foundations[suit];
        if (pile && pile.length > 0) {
            suppressAutoMoveCard = pile[pile.length - 1];
        }
    } else {
        suppressAutoMoveCard = null; // Clear suppression for any other source
    }

    if (src.startsWith('t') && dest.startsWith('t') && numCards > 1) {
        const srcIdx = parseInt(src.slice(1));
        const destIdx = parseInt(dest.slice(1));
        const valid = await validateMove(numCards, convertLocationToOneBased(src), convertLocationToOneBased(dest));
        if (!valid) return;
        isAnimating.value = true;
        await runAnimationFromTableau(numCards, srcIdx, destIdx, currentState, DOUBLE_CLICK_ANIM_DELAY);
        isAnimating.value = false;
    }

    await tryMove(numCards, convertLocationToOneBased(src), convertLocationToOneBased(dest));
    // await runAutoMoveToFoundation();
}


export async function autoMoveOnDoubleClick(cardDiv) {
    const location = cardDiv.dataset.location;
    if (!location) return;

    const tableau = currentState.tableau;

    if (location.startsWith('t')) {
        const srcColIdx = parseInt(location.slice(1));
        const cardIdx = cardDiv.dataset.cardIdx ? parseInt(cardDiv.dataset.cardIdx) : null;
        const col = tableau[srcColIdx];
        if (!col || col.length === 0 || cardIdx === null) return;

        const stack = col.slice(cardIdx);

        // Try multi-card stack move
        if (isValidStack(stack) && stack.length > 1) {
            // Pass 1: occupied tableau columns
            for (let destColIdx = 0; destColIdx < tableau.length; destColIdx++) {
                if (destColIdx === srcColIdx) continue;
                const destCol = tableau[destColIdx];
                if (destCol.length === 0) continue;
                if (canMoveStackToTableau(stack, destCol, currentState.freecells, getKingsOnlySetting(), tableau, srcColIdx, destColIdx)) {
                    await doMove(stack.length, `t${srcColIdx}`, `t${destColIdx}`);
                    return;
                }
            }
            // Pass 2: empty tableau columns
            for (let destColIdx = 0; destColIdx < tableau.length; destColIdx++) {
                if (destColIdx === srcColIdx) continue;
                const destCol = tableau[destColIdx];
                if (destCol.length !== 0) continue;
                if (canMoveStackToTableau(stack, destCol, currentState.freecells, getKingsOnlySetting(), tableau, srcColIdx, destColIdx)) {
                    await doMove(stack.length, `t${srcColIdx}`, `t${destColIdx}`);
                    return;
                }
            }
        }

        // Try single-card move
        if (cardIdx === col.length - 1) {
            const singleCard = col[cardIdx];
            if (await tryAutoDestinations(singleCard, `t${srcColIdx}`, tableau, srcColIdx)) return;

            // Pass 1: occupied tableau columns
            for (let destColIdx = 0; destColIdx < tableau.length; destColIdx++) {
                if (destColIdx === srcColIdx) continue;
                const destCol = tableau[destColIdx];
                if (destCol.length === 0) continue;
                if (canMoveStackToTableau([singleCard], destCol, currentState.freecells, getKingsOnlySetting(), tableau, srcColIdx, destColIdx)) {
                    await doMove(1, `t${srcColIdx}`, `t${destColIdx}`);
                    return;
                }
            }

            // Pass 2: empty tableau columns
            for (let destColIdx = 0; destColIdx < tableau.length; destColIdx++) {
                if (destColIdx === srcColIdx) continue;
                const destCol = tableau[destColIdx];
                if (destCol.length !== 0) continue;
                if (canMoveStackToTableau([singleCard], destCol, currentState.freecells, getKingsOnlySetting(), tableau, srcColIdx, destColIdx)) {
                    await doMove(1, `t${srcColIdx}`, `t${destColIdx}`);
                    return;
                }
            }
        }

        showMessage('Card cannot be auto-moved');
        return;
    }

    if (location.startsWith('f')) {
        const fcIdx = parseInt(location.slice(1));
        const card = currentState.freecells[fcIdx];
        if (!card) return;

        const dest = `d${card.suit}`;
        if (canMoveCardToFoundation(card, currentState.foundations)) {
            await doMove(1, `f${fcIdx}`, dest);
            return;
        }

        // Pass 1: occupied tableau columns
        for (let destColIdx = 0; destColIdx < tableau.length; destColIdx++) {
            const destCol = tableau[destColIdx];
            if (destCol.length === 0) continue;
            if (canMoveStackToTableau([card], destCol, currentState.freecells, getKingsOnlySetting(), tableau, fcIdx, destColIdx)) {
                await doMove(1, `f${fcIdx}`, `t${destColIdx}`);
                return;
            }
        }

        // Pass 2: empty tableau columns
        for (let destColIdx = 0; destColIdx < tableau.length; destColIdx++) {
            const destCol = tableau[destColIdx];
            if (destCol.length !== 0) continue;
            if (canMoveStackToTableau([card], destCol, currentState.freecells, getKingsOnlySetting(), tableau, fcIdx, destColIdx)) {
                await doMove(1, `f${fcIdx}`, `t${destColIdx}`);
                return;
            }
        }

        showMessage('Card cannot be auto-moved');
        return;
    }

    if (location.startsWith('d')) {
        const suit = location.slice(1);
        const pile = currentState.foundations[suit];
        if (!pile || pile.length === 0) return;
        const card = pile[pile.length - 1];

        for (let destColIdx = 0; destColIdx < tableau.length; destColIdx++) {
            const destCol = tableau[destColIdx];
            if (canMoveStackToTableau([card], destCol, currentState.freecells, getKingsOnlySetting(), tableau, null, destColIdx)) {
                await doMove(1, `d${suit}`, `t${destColIdx}`);
                return;
            }
        }

        showMessage('Card cannot be auto-moved');
        return;
    }
}

// Refactor tryAutoDestinations to accept tableau, srcIdx, and pass destColIdx as i
async function tryAutoDestinations(card, fromLocation, tableau, srcIdx, excludeFreecellIdx = null) {
    // 1. Foundation
    if (canMoveCardToFoundation(card, currentState.foundations)) {
        await doMove(1, fromLocation, `d${card.suit}`);
        return true;
    }

    // 2. Tableau (non-empty stacks only)
    for (let i = 0; i < tableau.length; i++) {
        const destCol = tableau[i];
        if (destCol.length === 0) continue; // skip empty columns
        if (canMoveStackToTableau([card], destCol, currentState.freecells, getKingsOnlySetting(), tableau, srcIdx, i)) {
            await doMove(1, fromLocation, `t${i}`);
            return true;
        }
    }

    // 3. Tableau (empty columns only)
    for (let i = 0; i < tableau.length; i++) {
        const destCol = tableau[i];
        if (destCol.length !== 0) continue; // skip non-empty
        if (canMoveStackToTableau([card], destCol, currentState.freecells, getKingsOnlySetting(), tableau, srcIdx, i)) {
            await doMove(1, fromLocation, `t${i}`);
            return true;
        }
    }

    // 4. Freecells
    for (let i = 0; i < currentState.freecells.length; i++) {
        if (i === excludeFreecellIdx) continue;
        if (currentState.freecells[i] === null) {
            await doMove(1, fromLocation, `f${i}`);
            return true;
        }
    }

    return false;
}



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
        resetSelection();
        return false;
    }
    return true;
}
