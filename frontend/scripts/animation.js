import { renderGame, renderTableauWithFakeFreecells } from './render.js';
import { sleep } from './utils.js';

function getDoubleClickAnimDelay() {
    return (typeof window !== "undefined" && window.DOUBLE_CLICK_ANIM_DELAY !== undefined)
        ? window.DOUBLE_CLICK_ANIM_DELAY
        : 240;
}
function getAutoMoveAnimDelay() {
    return (typeof window !== "undefined" && window.AUTO_MOVE_ANIM_DELAY !== undefined)
        ? window.AUTO_MOVE_ANIM_DELAY
        : 250;
}

// Use dynamic delay for tableau (supermove) animation
export async function runAnimationFromTableau(numCards, srcIdx, destIdx, state, delay) {
    // If delay arg is undefined, use global
    if (typeof delay !== "number") delay = getDoubleClickAnimDelay();

    let animTableau = state.tableau.map(col => col.slice());
    let animFreecells = state.freecells.slice();

    // Helper for "how many cards could be moved in one supermove"
    const maxMovable = countMaxMovable(animTableau, animFreecells, srcIdx, destIdx);
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
    }
}

// Use dynamic delay for auto-move to foundation
export async function runAnimationFromFreecell(fromType, fromIdx, toType, toIdx, state, delay) {
    // If delay arg is undefined, use global
    if (typeof delay !== "number") delay = getAutoMoveAnimDelay();

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
}

// Helper: How many cards can actually be moved via supermove logic?
function countMaxMovable(animTableau, animFreecells, srcColIdx, destColIdx) {
    const emptyFreecells = animFreecells.filter(c => c === null).length;
    const emptyTableaus = animTableau.filter(
        (col, idx) => col.length === 0 && idx !== srcColIdx && idx !== destColIdx
    ).length;
    return (emptyFreecells + 1) * (emptyTableaus + 1);
}

function buildAnimStepsGreedy(numCards, srcColIdx, destColIdx, animTableau, animFreecells) {
    // Defensive copy
    const tableauCopy = animTableau.map(col => col.slice());
    const freecellsCopy = animFreecells.slice();
    const steps = [];

    // Setup
    const emptyFreecellIdxs = freecellsCopy
        .map((c, idx) => c === null ? idx : null)
        .filter(idx => idx !== null);
    const reusableFreecellsCount = emptyFreecellIdxs.length;
    const helperTableaus = [];
    const helperTableauIdxs = [];
    for (let t = 0; t < tableauCopy.length; t++) {
        if (
            t !== srcColIdx &&
            t !== destColIdx &&
            tableauCopy[t].length === 0
        ) {
            helperTableauIdxs.push(t);
        }
    }

    let cardsLeftToMove = numCards;

    // === 2. Early Exit Optimization ===
    if (cardsLeftToMove <= reusableFreecellsCount + 1) {
        // Park first (cardsLeftToMove - 1) cards to lowest indices
        let toPark = cardsLeftToMove - 1;
        for (let k = 0; k < toPark; k++) {
            for (let j = 0; j < emptyFreecellIdxs.length; j++) {
                let fcIdx = emptyFreecellIdxs[j];
                if (freecellsCopy[fcIdx] === null && tableauCopy[srcColIdx].length > 0) {
                    let card = tableauCopy[srcColIdx].pop();
                    steps.push({ from: { type: 'tableau', idx: srcColIdx }, to: { type: 'freecell', idx: fcIdx } });
                    freecellsCopy[fcIdx] = card;
                    cardsLeftToMove--;
                    break;
                }
            }
        }
        // Move last card to destination
        if (tableauCopy[srcColIdx].length > 0) {
            steps.push({ from: { type: 'tableau', idx: srcColIdx }, to: { type: 'tableau', idx: destColIdx } });
            tableauCopy[srcColIdx].pop();
            cardsLeftToMove--;
        }
        // Flush all parked cards from freecells to destination (reverse order)
        for (let j = emptyFreecellIdxs.length - 1; j >= 0; j--) {
            let fcIdx = emptyFreecellIdxs[j];
            if (freecellsCopy[fcIdx] !== null) {
                steps.push({ from: { type: 'freecell', idx: fcIdx }, to: { type: 'tableau', idx: destColIdx } });
                freecellsCopy[fcIdx] = null;
            }
        }
        return steps;
    }

    // === 3. Forward Phase ===
    let usedHelperIdxs = [];
    while (cardsLeftToMove > reusableFreecellsCount + 1) {
        // Flush occupied freecells to most recent helper tableau
        if (helperTableaus.length > 0) {
            let helperIdx = helperTableaus[helperTableaus.length - 1].idx;
            for (let j = emptyFreecellIdxs.length - 1; j >= 0; j--) {
                let fcIdx = emptyFreecellIdxs[j];
                if (freecellsCopy[fcIdx] !== null) {
                    let card = freecellsCopy[fcIdx];
                    steps.push({ from: { type: 'freecell', idx: fcIdx }, to: { type: 'tableau', idx: helperIdx } });
                    tableauCopy[helperIdx].push(card);
                    freecellsCopy[fcIdx] = null;
                }
            }
        }
        // Park batch of freecells from srcCol
        let batch = 0;
        for (let k = 0; k < emptyFreecellIdxs.length && cardsLeftToMove > 1; k++) {
            let fcIdx = emptyFreecellIdxs[k];
            if (freecellsCopy[fcIdx] === null && tableauCopy[srcColIdx].length > 0) {
                let card = tableauCopy[srcColIdx].pop();
                steps.push({ from: { type: 'tableau', idx: srcColIdx }, to: { type: 'freecell', idx: fcIdx } });
                freecellsCopy[fcIdx] = card;
                cardsLeftToMove--;
                batch++;
            }
        }
        // Move one card from srcCol to a new helper tableau
        let helperIdx = null;
        for (let i = 0; i < helperTableauIdxs.length; i++) {
            let idx = helperTableauIdxs[i];
            if (!usedHelperIdxs.includes(idx)) {
                helperIdx = idx;
                usedHelperIdxs.push(idx);
                break;
            }
        }
        if (helperIdx === null) break;
        if (tableauCopy[srcColIdx].length > 0) {
            let card = tableauCopy[srcColIdx].pop();
            steps.push({ from: { type: 'tableau', idx: srcColIdx }, to: { type: 'tableau', idx: helperIdx } });
            tableauCopy[helperIdx].push(card);
            cardsLeftToMove--;
            helperTableaus.push({ idx: helperIdx, flushCounts: [batch] });
        }
    }

    // === 4. Threshold Phase ===
    let toFlush = cardsLeftToMove - 1;
    if (helperTableaus.length > 0 && toFlush > 0) {
        let helperIdx = helperTableaus[helperTableaus.length - 1].idx;
        let flushed = 0;
        for (let j = emptyFreecellIdxs.length - 1; j >= 0 && flushed < toFlush; j--) {
            let fcIdx = emptyFreecellIdxs[j];
            if (freecellsCopy[fcIdx] !== null) {
                let card = freecellsCopy[fcIdx];
                steps.push({ from: { type: 'freecell', idx: fcIdx }, to: { type: 'tableau', idx: helperIdx } });
                tableauCopy[helperIdx].push(card);
                freecellsCopy[fcIdx] = null;
                flushed++;
            }
        }
        if (flushed > 0) {
            helperTableaus[helperTableaus.length - 1].flushCounts.push(flushed);
        }
    }

    // Park the next (toFlush) cards from srcCol to freecells
    for (let k = 0; k < toFlush; k++) {
        for (let j = 0; j < emptyFreecellIdxs.length; j++) {
            let fcIdx = emptyFreecellIdxs[j];
            if (freecellsCopy[fcIdx] === null && tableauCopy[srcColIdx].length > 0) {
                let card = tableauCopy[srcColIdx].pop();
                steps.push({ from: { type: 'tableau', idx: srcColIdx }, to: { type: 'freecell', idx: fcIdx } });
                freecellsCopy[fcIdx] = card;
                break;
            }
        }
    }

    // Move last card from srcCol to destination
    if (tableauCopy[srcColIdx].length > 0) {
        steps.push({ from: { type: 'tableau', idx: srcColIdx }, to: { type: 'tableau', idx: destColIdx } });
        tableauCopy[srcColIdx].pop();
    }

    // Flush just-parked freecells to destination
    for (let f = 0; f < toFlush; f++) {
        for (let j = emptyFreecellIdxs.length - 1; j >= 0; j--) {
            let fcIdx = emptyFreecellIdxs[j];
            if (freecellsCopy[fcIdx] !== null) {
                steps.push({ from: { type: 'freecell', idx: fcIdx }, to: { type: 'tableau', idx: destColIdx } });
                freecellsCopy[fcIdx] = null;
                break;
            }
        }
    }

    // Mini-unwind: Move (toFlush) cards from the most recent helper tableau to lowest freecells,
    // then move last helper card to destination, then flush any occupied freecells to destination
    if (helperTableaus.length > 0 && toFlush > 0) {
        let helperIdx = helperTableaus[helperTableaus.length - 1].idx;

        // Park (toFlush) cards from helper tableau to lowest available freecells
        for (let m = 0; m < toFlush; m++) {
            for (let k = 0; k < emptyFreecellIdxs.length; k++) {
                let fcIdx = emptyFreecellIdxs[k];
                if (freecellsCopy[fcIdx] === null && tableauCopy[helperIdx].length > 0) {
                    let card = tableauCopy[helperIdx].pop();
                    steps.push({ from: { type: 'tableau', idx: helperIdx }, to: { type: 'freecell', idx: fcIdx } });
                    freecellsCopy[fcIdx] = card;
                    break;
                }
            }
        }

        // Park all but one remaining card from helper tableau to freecells (if any)
        let cardsToPark = tableauCopy[helperIdx].length - 1;
        for (let m = 0; m < cardsToPark; m++) {
            let parkedOne = false;
            for (let k = 0; k < emptyFreecellIdxs.length; k++) {
                let fcIdx = emptyFreecellIdxs[k];
                if (freecellsCopy[fcIdx] === null && tableauCopy[helperIdx].length > 0) {
                    let card = tableauCopy[helperIdx].pop();
                    steps.push({ from: { type: 'tableau', idx: helperIdx }, to: { type: 'freecell', idx: fcIdx } });
                    freecellsCopy[fcIdx] = card;
                    parkedOne = true;
                    break;
                }
            }
            if (!parkedOne) break;
        }

        // Move last card from helper tableau to destination
        if (tableauCopy[helperIdx].length === 1) {
            steps.push({ from: { type: 'tableau', idx: helperIdx }, to: { type: 'tableau', idx: destColIdx } });
            tableauCopy[helperIdx].pop();
        }

        // Flush all occupied freecells to destination (highest indices first)
        for (let j = emptyFreecellIdxs.length - 1; j >= 0; j--) {
            let fcIdx = emptyFreecellIdxs[j];
            if (freecellsCopy[fcIdx] !== null) {
                steps.push({ from: { type: 'freecell', idx: fcIdx }, to: { type: 'tableau', idx: destColIdx } });
                freecellsCopy[fcIdx] = null;
            }
        }
    }

    // Special case: if toFlush === 0, need to unwind the last helperTableau fully
    if (helperTableaus.length > 0 && toFlush === 0) {
        let helperIdx = helperTableaus[helperTableaus.length - 1].idx;

        // Park all but one remaining card from helper tableau to freecells (if any)
        let cardsToPark = tableauCopy[helperIdx].length - 1;
        for (let m = 0; m < cardsToPark; m++) {
            let parkedOne = false;
            for (let k = 0; k < emptyFreecellIdxs.length; k++) {
                let fcIdx = emptyFreecellIdxs[k];
                if (freecellsCopy[fcIdx] === null && tableauCopy[helperIdx].length > 0) {
                    let card = tableauCopy[helperIdx].pop();
                    steps.push({ from: { type: 'tableau', idx: helperIdx }, to: { type: 'freecell', idx: fcIdx } });
                    freecellsCopy[fcIdx] = card;
                    parkedOne = true;
                    break;
                }
            }
            if (!parkedOne) break;
        }

        // Move last card from helper tableau to destination
        if (tableauCopy[helperIdx].length === 1) {
            steps.push({ from: { type: 'tableau', idx: helperIdx }, to: { type: 'tableau', idx: destColIdx } });
            tableauCopy[helperIdx].pop();
        }

        // Flush all occupied freecells to destination (highest indices first)
        for (let j = emptyFreecellIdxs.length - 1; j >= 0; j--) {
            let fcIdx = emptyFreecellIdxs[j];
            if (freecellsCopy[fcIdx] !== null) {
                steps.push({ from: { type: 'freecell', idx: fcIdx }, to: { type: 'tableau', idx: destColIdx } });
                freecellsCopy[fcIdx] = null;
            }
        }
    }


    // === 5. General Unwind Phase ===
    for (let h = helperTableaus.length - 2; h >= 0; h--) { // -2: skip the last (already handled by mini-unwind)
        let { idx, flushCounts } = helperTableaus[h];
        // For each flushCount, move that many cards from tableau to lowest available freecells
        for (let f = 0; f < flushCounts.length; f++) {
            let numToUnpark = flushCounts[f];
            for (let m = 0; m < numToUnpark; m++) {
                for (let k = 0; k < emptyFreecellIdxs.length; k++) {
                    let fcIdx = emptyFreecellIdxs[k];
                    if (freecellsCopy[fcIdx] === null && tableauCopy[idx].length > 0) {
                        let card = tableauCopy[idx].pop();
                        steps.push({ from: { type: 'tableau', idx }, to: { type: 'freecell', idx: fcIdx } });
                        freecellsCopy[fcIdx] = card;
                        break;
                    }
                }
            }
        }
        // Move the final card from helper tableau to destination
        if (tableauCopy[idx].length > 0) {
            steps.push({ from: { type: 'tableau', idx }, to: { type: 'tableau', idx: destColIdx } });
            tableauCopy[idx].pop();
        }
        // Flush any occupied freecells (highest indices first) to destination
        for (let j = emptyFreecellIdxs.length - 1; j >= 0; j--) {
            let fcIdx = emptyFreecellIdxs[j];
            if (freecellsCopy[fcIdx] !== null) {
                steps.push({ from: { type: 'freecell', idx: fcIdx }, to: { type: 'tableau', idx: destColIdx } });
                freecellsCopy[fcIdx] = null;
            }
        }
    }
    // (Place this block immediately before: return steps;)



    return steps;
}
