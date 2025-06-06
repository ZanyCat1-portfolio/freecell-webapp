import { setupRender, renderGame, highlightSelection, clearSelection } from './render.js';
import { isAnimating, autoMoveOnDoubleClick, selectSourceOrMove } from './moveLogic.js';
import { fetchInitialState, newGame, undoMove } from './state.js';
import { showMessage } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    setupRender();  // Any initial DOM setup, if needed

    // New Game
    document.getElementById('new-game-btn').addEventListener('click', () => {
        const numberOfGames = 32000
        const randomInt = Math.floor(Math.random() * numberOfGames) + 1;
        newGame(randomInt)
    });
    document.getElementById('new-seed-btn').addEventListener('click', () => {
        const seedInput = document.getElementById('seed-input').value;
        let seed = seedInput ? parseInt(seedInput) : null;
        if (seed === null) {
            const numberOfGames = 32000
            seed = Math.floor(Math.random() * numberOfGames) + 1;
        }
        newGame(seed);
    });

    const seedInput = document.getElementById('seed-input');
    seedInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D+/g, '');
    })

    document.getElementById('cancel-game-btn').addEventListener('click', async () => {
        await fetch('cancel', {
            method: 'POST',
            credentials: 'same-origin'
        });
        // Now clear UI, re-enable checkbox, and clear current state
        await fetchInitialState();
        showMessage('Game cancelled.');
    });

    // Undo
    document.getElementById('undo-btn').addEventListener('click', undoMove);

    // Card and pile click (single)
    document.body.addEventListener('click', e => {
        if (isAnimating.value) return;
        const target = e.target.closest('.card, .pile');
        if (!target) return;
        selectSourceOrMove(target);
    });

    // Double click auto-move
    document.body.addEventListener('dblclick', async e => {
        if (isAnimating.value) return;
        const card = e.target.closest('.card');
        if (!card) return;
        await autoMoveOnDoubleClick(card);
    });

    // Fetch and render initial game state
    fetchInitialState();
});

function updateSeedDisplay(seed) {
    console.log('what?')
    document.getElementById('seed-display').textContent = seed ? `Seed: ${seed}` : '';
}