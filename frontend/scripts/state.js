import { renderGame, clearSelection, gameState } from './render.js';
import { showMessage } from './ui.js';
import { runAutoMoveToFoundation, resetSelection } from './moveLogic.js';
import { startGameTimer, stopGameTimer, gameTimerInterval } from './main.js';

// Global move count for session
let moveCount = 0;

// Exported state objects
export let currentState = null;
export const state = { autoMoveEnabled: true };

// Move count helpers
export function setMoveCount(n) {
    moveCount = n;
    window.updateMoveCountDisplay(moveCount);
}
export function incrementMoveCount() {
    moveCount++;
    window.updateMoveCountDisplay(moveCount);
}

// Helper to always keep setting in sync
export function getKingsOnlySetting() {
    return currentState?.kings_only_on_empty_tableau ??
        document.getElementById('kingsOnlyCheckbox').checked;
}

// Load from backend and update UI
export async function fetchInitialState() {
    const res = await fetch('state', { credentials: 'same-origin' });
    if (res.ok) {
        const json = await res.json();
        currentState = json;

        // === Start or update the game timer ===
        if (json.start_time) {
            startGameTimer(json.start_time);
        }

        // Move count
        setMoveCount(json.move_count || 0);

        // Kings Only
        if ('kings_only_on_empty_tableau' in json) {
            document.getElementById('kingsOnlyCheckbox').checked = !!json.kings_only_on_empty_tableau;
        }
        document.getElementById('kingsOnlyCheckbox').disabled = true;

        // Seed
        const seedDigits = document.getElementById('seed-digits');
        if (json.seed !== undefined && json.seed !== null && json.seed !== "") {
            seedDigits.textContent = json.seed;
        } else {
            seedDigits.textContent = "";
        }

        renderGame(json);
        resetSelection();
        showMessage('');
    } else {
        showMessage('No game in progress. Start a new game!');
        document.getElementById('kingsOnlyCheckbox').disabled = false;
        setMoveCount(0);
        document.getElementById('seed-digits').textContent = "";
        stopGameTimer(); // Stop timer if there's no game
    }
}


// New game (with optional seed)
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
        currentState = data.state || {};
        currentState.kings_only_on_empty_tableau = kingsOnly;

        showMessage('New game started!');
        // Display the seed if present
        const seedDigits = document.getElementById('seed-digits');
        if (data.seed !== undefined && data.seed !== null && data.seed !== "") {
            seedDigits.textContent = data.seed;
        } else {
            seedDigits.textContent = "";
        }
        // Sync checkbox in case backend returns a canonical value
        if ('kings_only_on_empty_tableau' in data) {
            document.getElementById('kingsOnlyCheckbox').checked = !!data.kings_only_on_empty_tableau;
        }
        fetchInitialState();
    } else {
        showMessage('Failed to start a new game.');
    }
}

// Restart current game (same seed, same rules)
export async function restartGame() {
    // Use current seed and kings only setting
    if (!currentState || !currentState.seed) {
        showMessage("No game to restart.");
        return;
    }
    const res = await fetch('newgame', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            seed: currentState.seed,
            kings_only_on_empty_tableau: getKingsOnlySetting()
        })
    });
    if (res.ok) {
        await fetchInitialState();
        showMessage("Game restarted.");
    } else {
        showMessage("Failed to restart game.");
    }
}

// Undo last move
export async function undoMove() {
    const res = await fetch('undo', {
        method: 'POST',
        credentials: 'same-origin'
    });
    const json = await res.json();
    if (res.ok) {
        currentState = json.state;

        // Move count from backend, or decrement if allowed
        if ('move_count' in json.state) {
            setMoveCount(json.state.move_count);
        }

        if ('kings_only_on_empty_tableau' in json.state) {
            document.getElementById('kingsOnlyCheckbox').checked = !!json.state.kings_only_on_empty_tableau;
        }
        renderGame(json.state);
        resetSelection();
        showMessage(json.message);
    } else {
        showMessage('Undo failed: ' + json.error);
    }
}

// Main move handler, increments move count on success
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
        // Move count
        if ('move_count' in json.state) {
            setMoveCount(json.state.move_count);
        }
        if ('kings_only_on_empty_tableau' in json.state) {
            document.getElementById('kingsOnlyCheckbox').checked = !!json.state.kings_only_on_empty_tableau;
        }
        renderGame(json.state);
        resetSelection();


        // --- WIN DETECTION: auto-show high scores modal ---
        if (json.message && json.message.includes('You won')) {
            await fetch('game-won', { method: 'POST', credentials: 'same-origin' });
            const mins = Math.floor(json.runtime / 60);
            const secs = Math.round(json.runtime % 60);
            document.getElementById('game-runtime').textContent =
            `Time: ${mins}:${secs.toString().padStart(2, '0')}`;
            clearInterval(gameTimerInterval)
            setTimeout(() => {
                // Trigger the high scores modal as if user clicked the button
                document.getElementById('high-scores-btn').click();
            }, 800); // Adjust delay as desired for nice UX
        }


        showMessage(json.message);
        await runAutoMoveToFoundation();
        return true;
    } else {
        showMessage('Move failed: ' + json.error);
        resetSelection();
        return false;
    }
}
