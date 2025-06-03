import { renderGame, renderTableauWithFakeFreecells } from './render.js';
import { sleep } from './utils.js';

export async function runAnimationForMultiMove(numCards, srcIdx, destIdx, state) {
    let animTableau = state.tableau.map(col => col.slice());
    let animFreecells = state.freecells.slice();
    let steps = buildAnimStepsGreedy(numCards, srcIdx, destIdx, animTableau, animFreecells);
    if (!steps) {
        throw new Error('Not enough freecells or empty columns to move that many cards!');
    }
    for (const step of steps) {
        let card = null;
        if (step.from.type === 'tableau' && step.to.type === 'freecell') {
            card = animTableau[step.from.idx].pop();
            animFreecells[step.to.idx] = card;
            if (card) {
                console.log(`Move ${card.rank}${card.suit} from tableau ${step.from.idx+1} to freecell ${step.to.idx+1}`);
            }
            renderTableauWithFakeFreecells(animTableau, animFreecells);
        } else if (step.from.type === 'freecell' && step.to.type === 'tableau') {
            card = animFreecells[step.from.idx];
            animFreecells[step.from.idx] = null;
            animTableau[step.to.idx].push(card);
            if (card) {
                console.log(`Move ${card.rank}${card.suit} from freecell ${step.from.idx+1} to tableau ${step.to.idx+1}`);
            }
            renderTableauWithFakeFreecells(animTableau, animFreecells);
        } else if (step.from.type === 'tableau' && step.to.type === 'tableau') {
            card = animTableau[step.from.idx].pop();
            animTableau[step.to.idx].push(card);
            if (card) {
                console.log(`Move ${card.rank}${card.suit} from tableau ${step.from.idx+1} to tableau ${step.to.idx+1}`);
            }
            renderTableauWithFakeFreecells(animTableau, animFreecells);
        } else {
            console.log('Ignoring unknown step type:', step);
        }
        await sleep(60);
    }
}

function buildAnimStepsGreedy(numCards, srcColIdx, destColIdx, animTableau, animFreecells) {
    const steps = [];
    const parked = [];
    for (let i = 0; i < numCards - 1; i++) {
        let parkedAt = null;
        for (let j = 0; j < animFreecells.length; j++) {
            if (animFreecells[j] === null) {
                steps.push({from: {type: 'tableau', idx: srcColIdx}, to: {type: 'freecell', idx: j}});
                animFreecells[j] = {};
                parked.push({type: 'freecell', idx: j});
                parkedAt = true;
                break;
            }
        }
        if (!parkedAt) {
            for (let j = 0; j < animTableau.length; j++) {
                if (j !== srcColIdx && j !== destColIdx && animTableau[j].length === 0) {
                    steps.push({from: {type: 'tableau', idx: srcColIdx}, to: {type: 'tableau', idx: j}});
                    animTableau[j].push({});
                    parked.push({type: 'tableau', idx: j});
                    parkedAt = true;
                    break;
                }
            }
        }
        if (!parkedAt) return false;
    }
    steps.push({from: {type: 'tableau', idx: srcColIdx}, to: {type: 'tableau', idx: destColIdx}});
    for (let i = parked.length - 1; i >= 0; i--) {
        const helper = parked[i];
        steps.push({from: {...helper}, to: {type: 'tableau', idx: destColIdx}});
    }
    return steps;
}