let selectedSource = null;
let currentState = null;
let isAnimating = false;

function renderTableauWithFakeFreecells(animTableau, fakeFreecells) {
    renderFreecells(fakeFreecells);
    renderFoundations(currentState.foundations);
    renderTableau(animTableau);
}
function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

function convertLocationToOneBased(loc) {
    if (!loc || loc.length < 2) return loc;
    const prefix = loc[0];
    const idxOrSuit = loc.slice(1);
    if (prefix === 't' || prefix === 'f') {
        const idx = parseInt(idxOrSuit);
        if (isNaN(idx)) return loc;
        return prefix + (idx + 1);
    }
    return loc;
}
function toOneBasedLabel(loc) {
    if (!loc || loc.length < 2) return loc;
    const prefix = loc[0];
    const idxOrSuit = loc.slice(1);
    if (prefix === 't' || prefix === 'f') {
        const idx = parseInt(idxOrSuit);
        if (isNaN(idx)) return loc;
        return prefix + (idx + 1);
    }
    return loc;
}
function cardImageFile(card) {
    if (!card) return 'cards/back.svg';
    const rankMap = {
        'A': 'ace', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
        '7': '7', '8': '8', '9': '9', '10': '10', 'J': 'jack', 'Q': 'queen', 'K': 'king'
    };
    const suitMap = {'S': 'spades', 'H': 'hearts', 'D': 'diamonds', 'C': 'clubs'};
    return `static/cards/${rankMap[card.rank]}_of_${suitMap[card.suit]}.svg`;
}
function clearSelection() {
    if (selectedSource) {
        if (selectedSource.element.classList.contains('selected')) {
            selectedSource.element.classList.remove('selected');
        } else if (selectedSource.element.querySelector('.selected')) {
            selectedSource.element.querySelector('.selected').classList.remove('selected');
        }
        selectedSource = null;
    }
    showMessage('');
}
function showMessage(msg) {
    document.getElementById('message').textContent = msg;
}
function createCardDiv(card, location, cardIdx = null) {
    const div = document.createElement('div');
    div.className = 'card';
    div.style.backgroundImage = `url(${cardImageFile(card)})`;
    div.dataset.location = location;
    if (cardIdx !== null) div.dataset.cardIdx = cardIdx;
    return div;
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
function createColumnDiv(col, idx) {
    const colDiv = document.createElement('div');
    colDiv.className = 'tableau-column pile';
    colDiv.dataset.location = `t${idx}`;
    col.forEach((card, cardIdx) => {
        const cardDiv = createCardDiv(card, `t${idx}`, cardIdx);
        cardDiv.style.top = (cardIdx * 25) + 'px';
        cardDiv.style.zIndex = cardIdx;
        colDiv.appendChild(cardDiv);
    });
    return colDiv;
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
            return;
        }
        changedCols.forEach(idx => {
            if (idx < 0 || idx >= tableau.length) return;
            const oldColDiv = container.querySelector(`.tableau-column[data-location="t${idx}"]`);
            const newColDiv = createColumnDiv(tableau[idx], idx);
            container.replaceChild(newColDiv, oldColDiv);
        });
    }
}
function renderGame(state, changedCols = null) {
    currentState = state;
    renderFreecells(state.freecells);
    renderFoundations(state.foundations);
    renderTableau(state.tableau, changedCols);
}
async function fetchState() {
    const res = await fetch('state', { credentials: 'same-origin' });
    if (res.ok) {
        const json = await res.json();
        renderGame(json);
        clearSelection();
        showMessage('');
    } else {
        showMessage('No game in progress. Start a new game!');
    }
}
async function newGame(seed=null) {
    const body = seed !== null ? {seed} : {};
    const res = await fetch('newgame', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    });
    if (res.ok) {
        showMessage('New game started!');
        fetchState();
    } else {
        showMessage('Failed to start a new game.');
    }
}
async function makeMove(num, source, dest) {
    const res = await fetch('move', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({num, source, dest})
    });
    const json = await res.json();
    if (res.ok) {
        const changedCols = [];
        if (source && source.startsWith('t')) {
            const sourceIdx = parseInt(source.slice(1)) - 1;
            if (!isNaN(sourceIdx)) changedCols.push(sourceIdx);
        }
        if (dest && dest.startsWith('t')) {
            const destIdx = parseInt(dest.slice(1)) - 1;
            if (!isNaN(destIdx) && !changedCols.includes(destIdx)) {
                changedCols.push(destIdx);
            }
        }
        renderGame(json.state, changedCols.length ? changedCols : null);
        clearSelection();
        showMessage(json.message);
    } else {
        showMessage('Move failed: ' + json.error);
        clearSelection();
    }
}
async function undoMove() {
    const res = await fetch('undo', {
        method: 'POST',
        credentials: 'same-origin'
    });
    const json = await res.json();
    if (res.ok) {
        renderGame(json.state);
        clearSelection();
        showMessage(json.message);
    } else {
        showMessage('Undo failed: ' + json.error);
    }
}

async function validateMove(num, source, dest) {
    const reqBody = { num, source, dest };
    const validateRes = await fetch('validate-move', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
    });
    const validateJson = await validateRes.json();
    if (!validateRes.ok || !validateJson.valid) {
        showMessage('Illegal move: ' + (validateJson.error || 'Not allowed'));
        clearSelection();
        return false;
    }
    return true;
}

function canMoveCardToFoundation(card, foundations) {
    const rankOrder = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    const pile = foundations[card.suit];
    if (!pile || pile.length === 0) {
        return card.rank === 'A';
    }
    const top = pile[pile.length - 1];
    return rankOrder.indexOf(card.rank) === rankOrder.indexOf(top.rank) + 1;
}

function canPlaceCardOnTableau(card, tableauCol) {
    if (tableauCol.length === 0) {
        return card.rank === 'K';
    }
    const top = tableauCol[tableauCol.length - 1];
    const isOppositeColor = (['H','D'].includes(card.suit) !== ['H','D'].includes(top.suit));
    const rankOrder = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    return isOppositeColor && (rankOrder.indexOf(card.rank) + 1 === rankOrder.indexOf(top.rank));
}

function isValidStack(stack) {
    if (stack.length < 1) return false;
    const rankOrder = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    function color(suit) { return (['H','D'].includes(suit)) ? 'R' : 'B'; }
    for (let i = 0; i < stack.length - 1; i++) {
        const a = stack[i], b = stack[i+1];
        const isDesc = rankOrder.indexOf(a.rank) === rankOrder.indexOf(b.rank) + 1;
        const isAltColor = color(a.suit) !== color(b.suit);
        if (!isDesc || !isAltColor) return false;
    }
    return true;
}
function canPlaceOn(destCol, movingStack) {
    if (destCol.length === 0) {
        return movingStack[0].rank === 'K';
    }
    const top = destCol[destCol.length - 1];
    const rankOrder = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    const moving = movingStack[0];
    const isAltColor = (['H','D'].includes(top.suit) !== ['H','D'].includes(moving.suit));
    const isNextRank = rankOrder.indexOf(moving.rank) + 1 === rankOrder.indexOf(top.rank);
    return isAltColor && isNextRank;
}

//------------------- EVENT LISTENER (CLICK) -------------------
document.body.addEventListener('click', async e => {
    if (isAnimating) return;
    let target = e.target;
    if (!target.classList.contains('card') && !target.classList.contains('pile')) return;

    let location = target.dataset.location;
    if (!location && target.parentElement) location = target.parentElement.dataset.location;
    if (!location) return;

    if (!selectedSource) {
        if (location.startsWith('t')) {
            const idx = parseInt(location.slice(1));
            const cardIdx = target.dataset.cardIdx !== undefined ? parseInt(target.dataset.cardIdx) : null;
            if (!isNaN(idx) && currentState && currentState.tableau) {
                const col = currentState.tableau[idx];
                if (!col || col.length === 0) {
                    showMessage('Cannot select empty tableau column as source.');
                    return;
                }
            }
            selectedSource = { location, element: target, cardIdx: cardIdx };
            target.classList.add('selected');
            showMessage(`Selected source: ${toOneBasedLabel(location)}` + (cardIdx !== null ? ` (stack from card #${cardIdx + 1})` : ''));
        } else {
            selectedSource = { location, element: target, cardIdx: null };
            target.classList.add('selected');
            showMessage(`Selected source: ${toOneBasedLabel(location)}`);
        }
    } else if (selectedSource.location === location) {
        clearSelection();
    } else {
        let numCards = 1;
        let srcIdx, destIdx;
        let destLocation = location;

        if (selectedSource.cardIdx !== null && selectedSource.location.startsWith('t')) {
            srcIdx = parseInt(selectedSource.location.slice(1));
            numCards = currentState.tableau[srcIdx].length - selectedSource.cardIdx;
        }

        if (selectedSource.location.startsWith('t') && destLocation.startsWith('t')) {
            destIdx = parseInt(destLocation.slice(1));
            if (numCards > 1) {
                // 1. Validate move first
                const valid = await validateMove(
                    numCards,
                    convertLocationToOneBased(selectedSource.location),
                    convertLocationToOneBased(destLocation)
                );
                if (!valid) return; // Do not animate illegal moves

                // 2. Animate if valid
                isAnimating = true;
                let animTableau = currentState.tableau.map(col => col.slice());
                let animFreecells = currentState.freecells.slice();
                let steps = buildAnimStepsGreedy(numCards, srcIdx, destIdx, animTableau, animFreecells);

                if (!steps) {
                    showMessage('Not enough freecells or empty columns to move that many cards!');
                    isAnimating = false;
                    clearSelection();
                    return;
                }
                await runAnimSteps(
                    steps,
                    currentState.tableau.map(col => col.slice()),
                    currentState.freecells.slice()
                );
                isAnimating = false;
                // 3. Actually make the move on the backend
                await makeMove(numCards, convertLocationToOneBased(selectedSource.location), convertLocationToOneBased(destLocation));
                return;
            }
        }
        await makeMove(numCards, convertLocationToOneBased(selectedSource.location), convertLocationToOneBased(destLocation));
    }
});

//------------------- EVENT LISTENER (DOUBLE CLICK) -------------------
document.body.addEventListener('dblclick', async e => {
    if (isAnimating) return;
    let target = e.target;
    if (!target.classList.contains('card')) return;
    let location = target.dataset.location;
    if (!location) return;

    const rankOrder = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    function color(suit) { return (['H','D'].includes(suit)) ? 'R' : 'B'; }
    function isValidStack(stack) {
        if (stack.length < 1) return false;
        for (let i = 0; i < stack.length - 1; i++) {
            const a = stack[i], b = stack[i+1];
            const isDesc = rankOrder.indexOf(a.rank) === rankOrder.indexOf(b.rank) + 1;
            const isAltColor = color(a.suit) !== color(b.suit);
            if (!isDesc || !isAltColor) return false;
        }
        return true;
    }
    function canPlaceOn(destCol, movingStack) {
        if (destCol.length === 0) {
            return movingStack[0].rank === 'K';
        }
        const top = destCol[destCol.length - 1];
        const moving = movingStack[0];
        const isAltColor = (['H','D'].includes(top.suit) !== ['H','D'].includes(moving.suit));
        const isNextRank = rankOrder.indexOf(moving.rank) + 1 === rankOrder.indexOf(top.rank);
        return isAltColor && isNextRank;
    }
    function canMoveCardToFoundation(card, foundations) {
        const pile = foundations[card.suit];
        if (!pile || pile.length === 0) {
            return card.rank === 'A';
        }
        const top = pile[pile.length - 1];
        return rankOrder.indexOf(card.rank) === rankOrder.indexOf(top.rank) + 1;
    }

    if (location.startsWith('t')) {
        const colIdx = parseInt(location.slice(1));
        const cardIdx = target.dataset.cardIdx !== undefined ? parseInt(target.dataset.cardIdx) : null;
        if (cardIdx !== null) {
            const col = currentState.tableau[colIdx];
            const movingStack = col.slice(cardIdx);

            if (cardIdx !== col.length - 1) {
                if (isValidStack(movingStack) && movingStack.length > 1) {
                    for (let destIdx = 0; destIdx < currentState.tableau.length; destIdx++) {
                        if (destIdx === colIdx) continue;
                        const destCol = currentState.tableau[destIdx];
                        if (canPlaceOn(destCol, movingStack)) {
                            const emptyFreecells = currentState.freecells.filter(c => c === null).length;
                            const emptyTableauCols = currentState.tableau.filter(
                                (c, i) => c.length === 0 && i !== colIdx && i !== destIdx
                            ).length;
                            const maxMovable = (emptyFreecells + 1) * (emptyTableauCols + 1);
                            if (movingStack.length <= maxMovable) {
                                // 1. Validate move first
                                const valid = await validateMove(
                                    movingStack.length,
                                    convertLocationToOneBased(`t${colIdx}`),
                                    convertLocationToOneBased(`t${destIdx}`)
                                );
                                if (!valid) return;

                                // 2. Animate if valid
                                isAnimating = true;
                                let animTableau = currentState.tableau.map(col => col.slice());
                                let animFreecells = currentState.freecells.slice();
                                let steps = buildAnimStepsGreedy(
                                    movingStack.length, colIdx, destIdx, animTableau, animFreecells
                                );
                                if (!steps) {
                                    showMessage('Not enough freecells or empty columns to move that many cards!');
                                    isAnimating = false;
                                    clearSelection();
                                    return;
                                }
                                await runAnimSteps(
                                    steps,
                                    currentState.tableau.map(col => col.slice()),
                                    currentState.freecells.slice()
                                );
                                isAnimating = false;
                                // 3. Actually make the move on the backend
                                await makeMove(movingStack.length, convertLocationToOneBased(`t${colIdx}`), convertLocationToOneBased(`t${destIdx}`));
                                return;
                            }
                        }
                    }
                }
                return;
            }
        }

        // Single card double click fallback logic unchanged:
        const card = currentState.tableau[colIdx][currentState.tableau[colIdx].length - 1];
        if (!card) return;

        if (canMoveCardToFoundation(card, currentState.foundations)) {
            const foundationDest = `d${card.suit}`;
            const res = await fetch('move', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ num: 1, source: convertLocationToOneBased(location), dest: convertLocationToOneBased(foundationDest) })
            });
            const json = await res.json();
            if (res.ok) {
                renderGame(json.state);
                clearSelection();
                showMessage(json.message);
                return;
            }
        }

        for (let i = 0; i < currentState.tableau.length; ++i) {
            if (i === colIdx) continue;
            if (canPlaceOn(currentState.tableau[i], [card])) {
                const tDest = `t${i}`;
                const res2 = await fetch('move', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ num: 1, source: convertLocationToOneBased(location), dest: convertLocationToOneBased(tDest) })
                });
                const json2 = await res2.json();
                if (res2.ok) {
                    renderGame(json2.state);
                    clearSelection();
                    showMessage(json2.message);
                    return;
                }
            }
        }

        for (let i = 0; i < currentState.freecells.length; ++i) {
            if (currentState.freecells[i] === null) {
                const fcDest = `f${i}`;
                const res3 = await fetch('move', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ num: 1, source: convertLocationToOneBased(location), dest: convertLocationToOneBased(fcDest) })
                });
                const json3 = await res3.json();
                if (res3.ok) {
                    renderGame(json3.state);
                    clearSelection();
                    showMessage(json3.message);
                    return;
                }
                break;
            }
        }
        showMessage('Card cannot be auto-moved');
        clearSelection();
        return;
    }

    // Single card double click for freecell unchanged:
    if (location.startsWith('f')) {
        const fcIdx = parseInt(location.slice(1));
        const card = currentState.freecells[fcIdx];
        if (!card) return;

        if (canMoveCardToFoundation(card, currentState.foundations)) {
            const foundationDest = `d${card.suit}`;
            const res = await fetch('move', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ num: 1, source: convertLocationToOneBased(location), dest: convertLocationToOneBased(foundationDest) })
            });
            const json = await res.json();
            if (res.ok) {
                renderGame(json.state);
                clearSelection();
                showMessage(json.message);
                return;
            }
        }

        for (let i = 0; i < currentState.tableau.length; ++i) {
            if (canPlaceOn(currentState.tableau[i], [card])) {
                const tDest = `t${i}`;
                const res2 = await fetch('move', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ num: 1, source: convertLocationToOneBased(location), dest: convertLocationToOneBased(tDest) })
                });
                const json2 = await res2.json();
                if (res2.ok) {
                    renderGame(json2.state);
                    clearSelection();
                    showMessage(json2.message);
                    return;
                }
            }
        }

        for (let i = 0; i < currentState.freecells.length; ++i) {
            if (i === fcIdx) continue;
            if (currentState.freecells[i] === null) {
                const fcDest = `f${i}`;
                const res3 = await fetch('move', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ num: 1, source: convertLocationToOneBased(location), dest: convertLocationToOneBased(fcDest) })
                });
                const json3 = await res3.json();
                if (res3.ok) {
                    renderGame(json3.state);
                    clearSelection();
                    showMessage(json3.message);
                    return;
                }
                break;
            }
        }
        showMessage('Card cannot be auto-moved');
        clearSelection();
        return;
    }
});

document.getElementById('new-game-btn').addEventListener('click', () => newGame());
document.getElementById('new-seed-btn').addEventListener('click', () => {
    const seedInput = document.getElementById('seed-input').value;
    const seed = seedInput ? parseInt(seedInput) : null;
    if(seedInput && isNaN(seed)) {
        showMessage('Seed must be a valid number');
        return;
    }
    newGame(seed);
});
document.getElementById('undo-btn').addEventListener('click', undoMove);

fetchState();

//------------------- ANIMATION HELPERS -------------------
function getHelpers(animTableau, animFreecells, srcIdx, dstIdx) {
    const helpers = [];
    for (let i = 0; i < animFreecells.length; ++i) {
        if (animFreecells[i] === null) helpers.push({type: 'freecell', idx: i});
    }
    for (let i = 0; i < animTableau.length; ++i) {
        if (animTableau[i].length === 0 && i !== srcIdx && i !== dstIdx)
            helpers.push({type: 'tableau', idx: i});
    }
    return helpers;
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

async function runAnimSteps(animSteps, animTableau, animFreecells) {
    for (const step of animSteps) {
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
