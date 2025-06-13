import { renderGame, renderTableauWithFakeFreecells } from './render.js';
import { sleep } from './utils.js';

export const DOUBLE_CLICK_ANIM_DELAY = 30;
export const AUTO_MOVE_ANIM_DELAY = 250;

export async function runAnimationForMultiMove(numCards, srcIdx, destIdx, state, delay = 60) {
    let animTableau = state.tableau.map(col => col.slice());
    let animFreecells = state.freecells.slice();
    let steps = buildAnimStepsGreedy(numCards, srcIdx, destIdx, animTableau, animFreecells);
    if (!steps) {
        throw new Error('Not enough freecells or empty columns to move that many cards!');
    }

    for (const step of steps) {
        await sleep(delay);

        let card = null;
        let fromType = step.from.type;
        let toType = step.to.type;
        let fromIdx = step.from.idx;
        let toIdx = step.to.idx;

        // === Remove from source ===
        if (fromType === 'tableau') {
            card = animTableau[fromIdx]?.pop();
        } else if (fromType === 'freecell') {
            card = animFreecells[fromIdx];
            animFreecells[fromIdx] = null;
        } else {
            console.warn('Unknown fromType:', fromType);
        }

        // === Place in destination ===
        if (toType === 'tableau') {
            if (!animTableau[toIdx]) animTableau[toIdx] = [];
            animTableau[toIdx].push(card);
        } else if (toType === 'freecell') {
            animFreecells[toIdx] = card;
        } else {
            console.warn('Unknown toType:', toType);
        }

        // === Log move ===
        if (card) {
            console.log(`Move ${card.rank}${card.suit} from ${fromType} ${fromIdx + 1} to ${toType} ${toIdx + 1}`);
        }

        renderTableauWithFakeFreecells(animTableau, animFreecells);
    }
}



function buildAnimStepsGreedy(numCards, srcColIdx, destColIdx, animTableau, animFreecells) {
    const steps = [];
    const parked = [];

    for (let i = 0; i < numCards - 1; i++) {
        let parkedAt = false;
        for (let j = 0; j < animFreecells.length; j++) {
            if (animFreecells[j] === null) {
                steps.push({ from: { type: 'tableau', idx: srcColIdx }, to: { type: 'freecell', idx: j } });
                animFreecells[j] = {};  // placeholder
                parked.push({ type: 'freecell', idx: j });
                parkedAt = true;
                break;
            }
        }
        if (!parkedAt) {
            for (let j = 0; j < animTableau.length; j++) {
                if (j !== srcColIdx && j !== destColIdx && animTableau[j].length === 0) {
                    steps.push({ from: { type: 'tableau', idx: srcColIdx }, to: { type: 'tableau', idx: j } });
                    animTableau[j].push({});  // placeholder
                    parked.push({ type: 'tableau', idx: j });
                    parkedAt = true;
                    break;
                }
            }
        }
        if (!parkedAt) return false;
    }

    // Final move
    const destType = destColIdx === -1 ? 'foundation' : 'tableau';
    steps.push({ from: { type: 'tableau', idx: srcColIdx }, to: { type: destType, idx: destColIdx } });

    // Restore parked
    for (let i = parked.length - 1; i >= 0; i--) {
        const helper = parked[i];
        steps.push({ from: { ...helper }, to: { type: destType, idx: destColIdx } });
    }

    return steps;
}
