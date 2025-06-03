import { setupRender, renderGame, highlightSelection, clearSelection } from './render.js';
import { isAnimating, autoMoveOnDoubleClick, selectSourceOrMove } from './moveLogic.js';
import { fetchInitialState, newGame, undoMove } from './state.js';
import { showMessage } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    setupRender();  // Any initial DOM setup, if needed

    // New Game
    document.getElementById('new-game-btn').addEventListener('click', newGame);
    document.getElementById('new-seed-btn').addEventListener('click', () => {
        const seedInput = document.getElementById('seed-input').value;
        const seed = seedInput ? parseInt(seedInput) : null;
        if (seedInput && isNaN(seed)) {
            showMessage('Seed must be a valid number');
            return;
        }
        newGame(seed);
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