import { renderGame, clearSelection } from './render.js';
import { showMessage } from './ui.js';

export let currentState = null;

export async function fetchInitialState() {
    const res = await fetch('state', { credentials: 'same-origin' });
    if (res.ok) {
        const json = await res.json();
        currentState = json;
        renderGame(json);
        clearSelection();
        showMessage('');
    } else {
        showMessage('No game in progress. Start a new game!');
    }
}

export async function newGame(seed=null) {
    const body = seed !== null ? {seed} : {};
    const res = await fetch('newgame', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    });
    if (res.ok) {
        showMessage('New game started!');
        fetchInitialState();
    } else {
        showMessage('Failed to start a new game.');
    }
}
export async function undoMove() {
    const res = await fetch('undo', {
        method: 'POST',
        credentials: 'same-origin'
    });
    const json = await res.json();
    if (res.ok) {
        currentState = json.state;
        renderGame(json.state);
        clearSelection();
        showMessage(json.message);
    } else {
        showMessage('Undo failed: ' + json.error);
    }
}
export async function tryMove(num, source, dest) {
    const res = await fetch('move', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({num, source, dest})
    });
    const json = await res.json();
    if (res.ok) {
        currentState = json.state;
        renderGame(json.state);
        clearSelection();
        showMessage(json.message);
        return true;
    } else {
        showMessage('Move failed: ' + json.error);
        clearSelection();
        return false;
    }
}