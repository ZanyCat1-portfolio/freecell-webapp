// animation.js
import { renderGame, renderTableauWithFakeFreecells } from './render.js';
import { sleep } from './utils.js';

export const DOUBLE_CLICK_ANIM_DELAY = 180;
export const AUTO_MOVE_ANIM_DELAY = 250;

export async function runAnimationFromTableau(numCards, srcIdx, destIdx, state, delay = 60) {
    let animTableau = state.tableau.map(col => col.slice());
    let animFreecells = state.freecells.slice();

    // Helper for "how many cards could be moved in one supermove"
    const maxMovable = countMaxMovable(animTableau, animFreecells, srcIdx, destIdx);
    console.log("max movable is ", maxMovable)
    console.log("numCards is ", numCards)
    if (numCards > maxMovable) {
        throw new Error('Not enough freecells or empty columns to move that many cards!');
    }

    let steps = buildAnimStepsGreedy(numCards, srcIdx, destIdx, animTableau, animFreecells);
    if (!steps) {
        throw new Error('Not enough freecells or empty columns to move that many cards!');
    }

    // Animate each step (move) in order, one at a time
    for (const step of steps) {
        // Remove card from source
        let card = null;
        const { from, to } = step;

        if (from.type === 'tableau') {
            if (!animTableau[from.idx] || animTableau[from.idx].length === 0) {
                console.warn(`Tried to pop from empty tableau ${from.idx}`);
                continue;
            }
            card = animTableau[from.idx].pop();
        } else if (from.type === 'freecell') {
            card = animFreecells[from.idx];
            animFreecells[from.idx] = null;
        } else {
            console.warn(`Unknown from.type: ${from.type}`);
            continue;
        }

        // Add card to destination
        if (to.type === 'tableau') {
            if (!animTableau[to.idx]) animTableau[to.idx] = [];
            animTableau[to.idx].push(card);
        } else if (to.type === 'freecell') {
            animFreecells[to.idx] = card;
        } else if (to.type === 'foundation') {
            // Not visualized in animation
        } else {
            console.warn(`Unknown to.type: ${to.type}`);
        }

        
        await sleep(delay);
        // Render, then yield to browser for one frame
        renderTableauWithFakeFreecells(animTableau, animFreecells);
        await new Promise(requestAnimationFrame);
        // await sleep(delay);
    }
}

// New: Animate a single card move between any two locations
export async function runAnimationFromFreecell(fromType, fromIdx, toType, toIdx, state, delay = 60) {
    let animTableau = state.tableau.map(col => col.slice());
    let animFreecells = state.freecells.slice();

    // Remove card from source
    let card = null;
    if (fromType === 'tableau') {
        card = animTableau[fromIdx].pop();
    } else if (fromType === 'freecell') {
        card = animFreecells[fromIdx];
        animFreecells[fromIdx] = null;
    } else {
        console.warn(`runAnimationFromFreecell: Unknown fromType ${fromType}`);
        return;
    }

    // Add card to destination
    if (toType === 'tableau') {
        animTableau[toIdx].push(card);
    } else if (toType === 'freecell') {
        animFreecells[toIdx] = card;
    } else if (toType === 'foundation') {
        // Nothing to render for foundation in current visualization
    } else {
        console.warn(`runAnimationFromFreecell: Unknown toType ${toType}`);
        return;
    }

    await sleep(delay);
    renderTableauWithFakeFreecells(animTableau, animFreecells);
    await new Promise(requestAnimationFrame);
    // await sleep(delay);
}

// Helper: How many cards can actually be moved via supermove logic?
function countMaxMovable(animTableau, animFreecells, srcColIdx, destColIdx) {
    const emptyFreecells = animFreecells.filter(c => c === null).length;
    const emptyTableaus = animTableau.filter(
        (col, idx) => col.length === 0 && idx !== srcColIdx && idx !== destColIdx
    ).length;
    return (emptyFreecells + 1) * (emptyTableaus + 1);
}

// Step builder: Generates explicit move-by-move steps for a greedy supermove animation
function buildAnimStepsGreedy(numCards, srcColIdx, destColIdx, animTableau, animFreecells) {
    // Only allow supermove from tableau, not from freecell
    if (srcColIdx < 0 || srcColIdx > 7) {
        console.warn(`Supermove requested from srcColIdx=${srcColIdx}, but that's not a tableau!`);
        return false;
    }

    const steps = [];
    const tableauCopy = animTableau.map(col => col.slice());
    const freecellsCopy = animFreecells.slice();

    const srcStack = tableauCopy[srcColIdx];
    if (srcStack.length < numCards) {
        return false;
    }
    const cardsToMove = srcStack.slice(-numCards);
    const movedToFreecells = [];
    const helperTableaus = [];

    // -- Helper function for moving a stack from a tableau to the dest (could be recursive, but we do it iteratively here)
    function greedyFlushFromHelper(num, fromIdx, destIdx, tableauCopy, freecellsCopy, steps) {
        const localMovedToFreecells = [];
        for (let i = 0; i < num - 1; i++) {
            let parked = false;
            // Use any available freecells first
            for (let fc = 0; fc < freecellsCopy.length; fc++) {
                if (freecellsCopy[fc] === null) {
                    steps.push({ from: { type: 'tableau', idx: fromIdx }, to: { type: 'freecell', idx: fc } });
                    freecellsCopy[fc] = tableauCopy[fromIdx][tableauCopy[fromIdx].length - 1];
                    localMovedToFreecells.push({ card: tableauCopy[fromIdx][tableauCopy[fromIdx].length - 1], fc });
                    tableauCopy[fromIdx].pop();
                    parked = true;
                    break;
                }
            }
            if (!parked) {
                // Try any available empty tableau (not src or dest)
                let foundEmpty = false;
                for (let t = 0; t < tableauCopy.length; t++) {
                    if (t !== fromIdx && t !== destIdx && tableauCopy[t].length === 0) {
                        steps.push({ from: { type: 'tableau', idx: fromIdx }, to: { type: 'tableau', idx: t } });
                        tableauCopy[t].push(tableauCopy[fromIdx][tableauCopy[fromIdx].length - 1]);
                        tableauCopy[fromIdx].pop();
                        foundEmpty = true;
                        // Now flush all local freecells to this tableau, in reverse order
                        for (let j = localMovedToFreecells.length - 1; j >= 0; j--) {
                            const { card, fc } = localMovedToFreecells[j];
                            steps.push({ from: { type: 'freecell', idx: fc }, to: { type: 'tableau', idx: t } });
                            tableauCopy[t].push(card);
                            freecellsCopy[fc] = null;
                        }
                        localMovedToFreecells.length = 0;
                        // Now recursively flush t to dest
                        greedyFlushFromHelper(num - i - 1, t, destIdx, tableauCopy, freecellsCopy, steps);
                        return;
                    }
                }
                if (!foundEmpty) {
                    throw new Error("No freecells or empty tableau to flush helper");
                }
            }
        }
        // Final move: move last card in helper to destination
        steps.push({ from: { type: 'tableau', idx: fromIdx }, to: { type: 'tableau', idx: destIdx } });
        tableauCopy[fromIdx].pop();
        // Flush any left-over cards from local freecells to destination
        for (let j = localMovedToFreecells.length - 1; j >= 0; j--) {
            const { card, fc } = localMovedToFreecells[j];
            steps.push({ from: { type: 'freecell', idx: fc }, to: { type: 'tableau', idx: destIdx } });
            freecellsCopy[fc] = null;
        }
    }

    // PARKING PHASE: just as before
    for (let i = 0; i < numCards - 1; i++) {
        let parked = false;
        for (let fc = 0; fc < freecellsCopy.length; fc++) {
            if (freecellsCopy[fc] === null) {
                steps.push({ from: { type: 'tableau', idx: srcColIdx }, to: { type: 'freecell', idx: fc } });
                freecellsCopy[fc] = cardsToMove[i];
                movedToFreecells.push({ card: cardsToMove[i], fc });
                tableauCopy[srcColIdx].pop();
                parked = true;
                break;
            }
        }
        if (!parked) {
            let foundEmpty = false;
            for (let t = 0; t < tableauCopy.length; t++) {
                if (t !== srcColIdx && t !== destColIdx && tableauCopy[t].length === 0) {
                    steps.push({ from: { type: 'tableau', idx: srcColIdx }, to: { type: 'tableau', idx: t } });
                    tableauCopy[t].push(cardsToMove[i]);
                    tableauCopy[srcColIdx].pop();
                    foundEmpty = true;
                    for (let j = movedToFreecells.length - 1; j >= 0; j--) {
                        const { card, fc } = movedToFreecells[j];
                        steps.push({ from: { type: 'freecell', idx: fc }, to: { type: 'tableau', idx: t } });
                        tableauCopy[t].push(card);
                        freecellsCopy[fc] = null;
                    }
                    // Save how many cards we just put on t (for later flush phase)
                    helperTableaus.push({ idx: t, count: movedToFreecells.length + 1 });
                    movedToFreecells.length = 0;
                    break;
                }
            }
            if (!foundEmpty) {
                return false;
            }
        }
    }

    // FINAL MOVE: last card in stack to destination
    steps.push({
        from: { type: 'tableau', idx: srcColIdx },
        to: { type: destColIdx === -1 ? 'foundation' : 'tableau', idx: destColIdx }
    });
    tableauCopy[srcColIdx].pop();

    // FLUSH REMAINING FREECELLS: (if any left, never flushed to a helper tableau)
    for (let j = movedToFreecells.length - 1; j >= 0; j--) {
        const { card, fc } = movedToFreecells[j];
        steps.push({ from: { type: 'freecell', idx: fc }, to: { type: destColIdx === -1 ? 'foundation' : 'tableau', idx: destColIdx } });
        freecellsCopy[fc] = null;
    }

    // FLUSH HELPERS: Use greedyFlushFromHelper for each helper in reverse order (last helper flushed first, as per Freecell convention)
    for (let h = helperTableaus.length - 1; h >= 0; h--) {
        const { idx, count } = helperTableaus[h];
        greedyFlushFromHelper(count, idx, destColIdx, tableauCopy, freecellsCopy, steps);
    }

    return steps;
}
