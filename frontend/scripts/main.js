import { setupRender, renderGame, highlightSelection, clearSelection } from './render.js';
import { isAnimating, autoMoveOnDoubleClick, selectSourceOrMove, runAutoMoveToFoundation, resetSelection } from './moveLogic.js';
import { fetchInitialState, newGame, undoMove, restartGame, setMoveCount, incrementMoveCount } from './state.js';
import { showMessage } from './ui.js';
import { state } from './state.js';

// ========== Move Count Display ==========
function updateMoveCountDisplay(count) {
    document.getElementById('move-count').textContent = `Moves: ${count > 9999 ? '9999+' : count}`;
}
window.updateMoveCountDisplay = updateMoveCountDisplay; // Expose globally for state.js

// ========== Auto-Move Toggle ==========
const toggleBtn = document.getElementById('toggle-auto-move-btn');
const autoMovePref = localStorage.getItem('autoMoveEnabled');
state.autoMoveEnabled = autoMovePref !== null ? autoMovePref === 'true' : true;
toggleBtn.textContent = `Auto-Move: ${state.autoMoveEnabled ? "ON" : "OFF"}`;

toggleBtn.addEventListener('click', () => {
    state.autoMoveEnabled = !state.autoMoveEnabled;
    localStorage.setItem('autoMoveEnabled', state.autoMoveEnabled);
    toggleBtn.textContent = `Auto-Move: ${state.autoMoveEnabled ? "ON" : "OFF"}`;
    resetSelection();
    if (state.autoMoveEnabled) runAutoMoveToFoundation();
});

// ========== Menu Modal ==========
const menuBtn = document.getElementById('menu-btn');
const menuModal = document.getElementById('menu-modal');
const modalOverlay = document.getElementById('modal-overlay');
const closeMenuBtn = document.getElementById('close-menu-btn');

function openMenu() {
    menuModal.classList.remove('hidden');
    modalOverlay.classList.remove('hidden');
    setTimeout(() => {
        const btn = menuModal.querySelector('button:not(:disabled)');
        if (btn) btn.focus();
    }, 0);
}
function closeMenu() {
    menuModal.classList.add('hidden');
    modalOverlay.classList.add('hidden');
    menuBtn.focus();
}
menuBtn.addEventListener('click', openMenu);
modalOverlay.addEventListener('click', closeMenu);
closeMenuBtn.addEventListener('click', closeMenu);

document.addEventListener('keydown', e => {
    if (!menuModal.classList.contains('hidden') && (e.key === 'Escape' || e.key === 'Esc')) closeMenu();
});

// ========== Animation Delay Sliders ==========
const doubleClickDelaySlider = document.getElementById('doubleClickDelaySlider');
const autoMoveDelaySlider = document.getElementById('autoMoveDelaySlider');
const doubleClickDelayValue = document.getElementById('doubleClickDelayValue');
const autoMoveDelayValue = document.getElementById('autoMoveDelayValue');

// LocalStorage keys for persistence
const DOUBLE_CLICK_DELAY_KEY = 'doubleClickAnimDelay';
const AUTO_MOVE_DELAY_KEY = 'autoMoveAnimDelay';

// Set up initial values
function getSavedDelay(key, fallback) {
    const val = localStorage.getItem(key);
    return val !== null ? Number(val) : fallback;
}

// Default values
let DOUBLE_CLICK_ANIM_DELAY = getSavedDelay(DOUBLE_CLICK_DELAY_KEY, 240);
let AUTO_MOVE_ANIM_DELAY = getSavedDelay(AUTO_MOVE_DELAY_KEY, 250);

doubleClickDelaySlider.value = DOUBLE_CLICK_ANIM_DELAY;
autoMoveDelaySlider.value = AUTO_MOVE_ANIM_DELAY;
doubleClickDelayValue.textContent = `${DOUBLE_CLICK_ANIM_DELAY}ms`;
autoMoveDelayValue.textContent = `${AUTO_MOVE_ANIM_DELAY}ms`;

// Listen for slider changes
doubleClickDelaySlider.addEventListener('input', () => {
    DOUBLE_CLICK_ANIM_DELAY = Number(doubleClickDelaySlider.value);
    doubleClickDelayValue.textContent = `${DOUBLE_CLICK_ANIM_DELAY}ms`;
    localStorage.setItem(DOUBLE_CLICK_DELAY_KEY, DOUBLE_CLICK_ANIM_DELAY);
    // Optionally, broadcast to animation.js
    window.DOUBLE_CLICK_ANIM_DELAY = DOUBLE_CLICK_ANIM_DELAY;
});
autoMoveDelaySlider.addEventListener('input', () => {
    AUTO_MOVE_ANIM_DELAY = Number(autoMoveDelaySlider.value);
    autoMoveDelayValue.textContent = `${AUTO_MOVE_ANIM_DELAY}ms`;
    localStorage.setItem(AUTO_MOVE_DELAY_KEY, AUTO_MOVE_ANIM_DELAY);
    window.AUTO_MOVE_ANIM_DELAY = AUTO_MOVE_ANIM_DELAY;
});

// Export delays for other modules (optional)
window.DOUBLE_CLICK_ANIM_DELAY = DOUBLE_CLICK_ANIM_DELAY;
window.AUTO_MOVE_ANIM_DELAY = AUTO_MOVE_ANIM_DELAY;

// ========== Main Controls ==========
document.getElementById('restart-btn').addEventListener('click', restartGame);
document.getElementById('undo-btn').addEventListener('click', undoMove);
document.getElementById('cancel-game-btn').addEventListener('click', async () => {
    await fetch('cancel', { method: 'POST', credentials: 'same-origin' });
    await fetchInitialState();
    showMessage('Game cancelled.');
});

// ========== Menu Controls ==========
const menuSeedInput = document.getElementById('menu-seed-input');
const menuSeedBtn = document.getElementById('menu-seed-btn');
document.getElementById('new-game-btn').addEventListener('click', () => {
    const numberOfGames = 32000;
    const randomInt = Math.floor(Math.random() * numberOfGames) + 1;
    newGame(randomInt);
    closeMenu();
});
menuSeedInput.addEventListener('input', () => {
    const value = menuSeedInput.value.trim();
    menuSeedBtn.disabled = !(/^\d+$/.test(value) && +value >= 1 && +value <= 32000);
});
menuSeedBtn.addEventListener('click', () => {
    const seed = parseInt(menuSeedInput.value, 10);
    if (seed >= 1 && seed <= 32000) {
        newGame(seed);
        closeMenu();
    }
});

// ========== High Scores ==========
const highScoresBtn = document.getElementById('high-scores-btn');
const highScoresModal = document.getElementById('high-scores-modal');
const closeHighScoresBtn = document.getElementById('close-high-scores-btn');
const highScoresTableBody = document.querySelector('#high-scores-table tbody');
const clearHighScoresBtn = document.getElementById('clear-high-scores-btn');

function renderHighScores(scores) {
    highScoresTableBody.innerHTML = '';
    if (!scores.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5;
        td.textContent = 'No high scores yet!';
        tr.appendChild(td);
        highScoresTableBody.appendChild(tr);
        return;
    }
    scores.forEach((entry, idx) => {
        const tr = document.createElement('tr');
        let formattedRuntime = '';
        if (entry.runtime != null) {
            const mins = Math.floor(entry.runtime / 60);
            const secs = Math.round(entry.runtime % 60);
            formattedRuntime = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${entry.date}</td>
            <td>${entry.time}</td>
            <td>${formattedRuntime}</td>
            <td>${entry.seed !== undefined ? entry.seed : ''}</td>
            <td>${entry.moves}</td>
        `;
        highScoresTableBody.appendChild(tr);
    });
}

function fetchAndShowHighScores() {
    fetch('high-scores')
        .then(res => res.json())
        .then(scores => {
            renderHighScores(scores);
            highScoresModal.classList.remove('hidden');
        });
}

highScoresBtn.addEventListener('click', fetchAndShowHighScores);
closeHighScoresBtn.addEventListener('click', () => {
    highScoresModal.classList.add('hidden');
});

// --- Clear High Scores Button ---
if (clearHighScoresBtn) {
    clearHighScoresBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all high scores?')) {
            fetch('clear-high-scores', { method: 'POST' })
                .then(res => {
                    if (res.ok) fetchAndShowHighScores();
                });
        }
    });
}

// ========== Card Interaction ==========
document.body.addEventListener('click', e => {
    const cardOrPile = e.target.closest('.card, .pile, .freecell, .foundation');
    // Avoid handling clicks if menu is open
    if (!menuModal.classList.contains('hidden') && menuModal.contains(e.target)) return;
    if (cardOrPile) selectSourceOrMove(cardOrPile);
});
document.body.addEventListener('dblclick', async e => {
    if (isAnimating.value) return;
    const card = e.target.closest('.card');
    if (!card) return;
    await autoMoveOnDoubleClick(card);
});

// ========== Initial Setup ==========
document.addEventListener('DOMContentLoaded', () => {
    setupRender();
    fetchInitialState();
    closeMenu();
    // Set slider values in global scope for animation.js
    window.DOUBLE_CLICK_ANIM_DELAY = DOUBLE_CLICK_ANIM_DELAY;
    window.AUTO_MOVE_ANIM_DELAY = AUTO_MOVE_ANIM_DELAY;
});

// === GAME RUNTIME ===
export let gameStartTime = null;
export let gameTimerInterval = null;

function updateGameRuntimeDisplay(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    document.getElementById('game-runtime').textContent = `Time: ${mins}:${secs.toString().padStart(2, '0')}`;
}

// Call this when a new game starts or loads
export function startGameTimer(startTimeIsoString) {
    if (gameTimerInterval) clearInterval(gameTimerInterval);

    gameStartTime = startTimeIsoString ? new Date(startTimeIsoString) : new Date();
    function update() {
        const now = new Date();
        const elapsed = Math.floor((now - gameStartTime) / 1000);
        updateGameRuntimeDisplay(elapsed);
    }
    update(); // set immediately
    gameTimerInterval = setInterval(update, 1000);
}

// Call this to stop timer (e.g. after win/cancel)
export function stopGameTimer() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    gameTimerInterval = null;
}
