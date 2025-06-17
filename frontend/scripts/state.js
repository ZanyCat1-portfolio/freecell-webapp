import { renderGame, clearSelection } from './render.js';
import { showMessage } from './ui.js';
import { runAutoMoveToFoundation } from './moveLogic.js';

export let currentState = null;

// Helper to always keep setting in sync
export function getKingsOnlySetting() {
    // The authoritative setting is on the currentState object
    // If not present, fall back to the checkbox
    return currentState?.kings_only_on_empty_tableau ??
        document.getElementById('kingsOnlyCheckbox').checked;
}

export async function fetchInitialState() {
    const res = await fetch('state', { credentials: 'same-origin' });
    if (res.ok) {
        const json = await res.json();
        currentState = json;

        if ('kings_only_on_empty_tableau' in json) {
            document.getElementById('kingsOnlyCheckbox').checked = !!json.kings_only_on_empty_tableau;
        }
        // Disable the checkbox: game in progress
        document.getElementById('kingsOnlyCheckbox').disabled = true;

        renderGame(json);
        clearSelection();
        showMessage('');
    } else {
        showMessage('No game in progress. Start a new game!');
        // Enable the checkbox: no game in progress
        document.getElementById('kingsOnlyCheckbox').disabled = false;
    }
}

export async function newGame(seed = null) {
    const kingsOnly = document.getElementById('kingsOnlyCheckbox').checked;
    const res = await fetch('newgame', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            seed: seed,
            kings_only_on_empty_tableau: kingsOnly
        })
    });
    if (res.ok) {
        const data = await res.json();
        // Store setting in currentState
        currentState = data.state || {};  // Defensive: data.state may be the canonical game state
        currentState.kings_only_on_empty_tableau = kingsOnly;

        showMessage('New game started!');
        // Display the seed if present, update only the digits
        const seedDigits = document.getElementById('seed-digits');
        if (data.seed !== undefined && data.seed !== null && data.seed !== "") {
            seedDigits.textContent = data.seed;
        } else {
            seedDigits.textContent = "";
        }
        // Sync the checkbox in case backend returns a canonical value
        if ('kings_only_on_empty_tableau' in data) {
            document.getElementById('kingsOnlyCheckbox').checked = !!data.kings_only_on_empty_tableau;
        }

        // Make sure new game state is fetched (overwrites currentState)
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
        // Keep the setting in sync (optional, but safe)
        if ('kings_only_on_empty_tableau' in json.state) {
            document.getElementById('kingsOnlyCheckbox').checked = !!json.state.kings_only_on_empty_tableau;
        }
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
        if ('kings_only_on_empty_tableau' in json.state) {
            document.getElementById('kingsOnlyCheckbox').checked = !!json.state.kings_only_on_empty_tableau;
        }
        renderGame(json.state);
        clearSelection();
        showMessage(json.message);
        await runAutoMoveToFoundation();
        return true;
    } else {
        showMessage('Move failed: ' + json.error);
        clearSelection();
        return false;
    }
}
