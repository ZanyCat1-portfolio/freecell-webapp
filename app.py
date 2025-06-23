# app.py
from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
import cards, game_logic, utils
import random
import copy
import uuid
import sys
import json
import os
from datetime import datetime, timezone

games = {}

app = Flask(__name__, static_folder="frontend", static_url_path="/static")
app.secret_key = 'supersecretkey'  # Replace with a secure key!
CORS(app)

# Detect test mode from command line argument
TEST_MODE = (len(sys.argv) > 1 and sys.argv[1] == 'test')

HIGH_SCORES_FILE = "high_scores.json"
MAX_HIGH_SCORES = 20  # or however many you want to keep

def load_high_scores():
    if not os.path.exists(HIGH_SCORES_FILE):
        return []
    with open(HIGH_SCORES_FILE, "r") as f:
        return json.load(f)

def save_high_scores(scores):
    with open(HIGH_SCORES_FILE, "w") as f:
        json.dump(scores, f)

def add_high_score(moves, runtime,seed):
    scores = load_high_scores()
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M")
    new_entry = {
        "date": date_str,
        "time": time_str,
        "moves": moves,
        "runtime": runtime,
        "seed": seed
    }
    scores.append(new_entry)
    # Sort by moves ascending, then by date/time ascending (older is better)
    scores.sort(key=lambda s: (s["moves"], s["date"], s["time"]))
    # Keep only top N
    scores = scores[:MAX_HIGH_SCORES]
    save_high_scores(scores)


def create_new_game(seed=None, kings_only_on_empty_tableau=False):
    deck = [cards.Card(rank, suit) for suit in cards.SUITS for rank in cards.RANKS]
    # Only set seed if valid
    if seed is not None and str(seed).lower() != 'none' and str(seed).strip() != "":
        # Optionally: cast to int if you only want integer seeds
        try:
            random.seed(int(seed))
        except (ValueError, TypeError):
            random.seed(str(seed))
    random.shuffle(deck)
    tableau = [[] for _ in range(8)]
    for i, card in enumerate(deck):
        tableau[i % 8].append(card)
    freecells = [None] * 4
    foundations = {suit: [] for suit in cards.SUITS}
    history = []
    return {
        'tableau': tableau,
        'freecells': freecells,
        'foundations': foundations,
        'history': history,
        'seed': seed,
        'kings_only_on_empty_tableau': kings_only_on_empty_tableau,
        'start_time': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'move_count': 0
    }

def create_test_game():
    tableau = [
        [cards.Card('J', 'C'), cards.Card('10', 'D'), cards.Card('9', 'C'), cards.Card('K', 'H')],
        [cards.Card('10', 'S'), cards.Card('6', 'S'), cards.Card('9', 'H')],
        [],
        [cards.Card('10', 'H'), cards.Card('K', 'C'), cards.Card('A', 'C'), cards.Card('J', 'S'),
         cards.Card('2', 'D'), cards.Card('5', 'D'), cards.Card('9', 'S'), cards.Card('8', 'D'),
         cards.Card('7', 'C'), cards.Card('6', 'H'), cards.Card('5', 'S'), cards.Card('4', 'D'), cards.Card('3', 'C'),
         cards.Card('3', 'S'), cards.Card('5', 'C'), cards.Card('K', 'S'), cards.Card('Q', 'H')],
        [],
        [cards.Card('K', 'D'), cards.Card('Q', 'C'), cards.Card('J', 'D'), cards.Card('10', 'C'),
         cards.Card('9', 'D'), cards.Card('8', 'S'), cards.Card('7', 'D'), cards.Card('6', 'C'),
         cards.Card('5', 'H'), cards.Card('4', 'S'), cards.Card('3', 'D')],
        [cards.Card('8', 'C')],
        [cards.Card('Q', 'S'), cards.Card('8', 'H'), cards.Card('7', 'S'),
         cards.Card('6', 'D'), cards.Card('7', 'H'), cards.Card('J', 'H'), cards.Card('2', 'C')]
    ]
    freecells = [cards.Card('Q', 'D'), cards.Card('4', 'C'), None, None]
    foundations = {
        'H': [cards.Card('A', 'H'), cards.Card('2', 'H'), cards.Card('3', 'H'), cards.Card('4', 'H')],
        'D': [cards.Card('A', 'D')],
        'C': [],
        'S': [cards.Card('A', 'S'), cards.Card('2', 'S')]
    }
    history = []
    return {
        'tableau': tableau,
        'freecells': freecells,
        'foundations': foundations,
        'history': history,
        'seed': 'test',
        'kings_only_on_empty_tableau': False
    }

def serialize_card(card):
    if card is None:
        return None
    return {'rank': card.rank, 'suit': card.suit}

def serialize_state(state):
    def serialize_pile(pile):
        return [serialize_card(c) for c in pile]
    return {
        'tableau': [serialize_pile(col) for col in state['tableau']],
        'freecells': [serialize_card(c) for c in state['freecells']],
        'foundations': {suit: serialize_pile(pile) for suit, pile in state['foundations'].items()},
        'seed': state.get('seed'),
        'kings_only_on_empty_tableau': state.get('kings_only_on_empty_tableau', False),
        'move_count': state.get('move_count', 0),
        'start_time': state.get('start_time')
    }

def deep_copy_game(state):
    return {
        'tableau': copy.deepcopy(state['tableau']),
        'freecells': copy.deepcopy(state['freecells']),
        'foundations': copy.deepcopy(state['foundations']),
        'history': copy.deepcopy(state['history']),
        'seed': state.get('seed'),
        'kings_only_on_empty_tableau': state.get('kings_only_on_empty_tableau', False)
    }

def deep_copy_game_for_history(state):
    return {
        'tableau': copy.deepcopy(state['tableau']),
        'freecells': copy.deepcopy(state['freecells']),
        'foundations': copy.deepcopy(state['foundations']),
        'seed': state.get('seed'),
        'kings_only_on_empty_tableau': state.get('kings_only_on_empty_tableau', False)
    }

@app.before_request
def ensure_session_id():
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())

def get_game_state():
    sid = session['session_id']
    state = games.get(sid)
    if state is None and TEST_MODE:
        state = create_test_game()
        games[sid] = state
    return state

def save_game_state(state):
    sid = session['session_id']
    games[sid] = state


@app.route('/high-scores', methods=['GET'])
def get_high_scores():
    return jsonify(load_high_scores())

@app.route('/clear-high-scores', methods=['POST'])
def clear_high_scores():
    save_high_scores([])
    return jsonify({"message": "High scores cleared!"}), 200




@app.route('/newgame', methods=['POST'])
def new_game():
    if TEST_MODE:
        # Don't start a random game in test mode
        return jsonify({'error': 'Cannot start new game in test mode.'}), 400

    data = request.json or {}
    seed = data.get('seed')
    kings_only = data.get('kings_only_on_empty_tableau', False)

    try:
        seed = int(seed)
    except (ValueError, TypeError):
        return jsonify({'error': 'Seed must be an integer'}), 400
    
    if not (1 <= seed <= 32000):
        return jsonify({'error': 'Seed must be between 1 and 32000'}), 400

    state = create_new_game(seed, kings_only_on_empty_tableau=kings_only)
    save_game_state(state)
    return jsonify({
        'message': 'New game started',
        'seed': seed,
        'state': serialize_state(state)
    }), 200

@app.route('/cancel', methods=['POST'])
def cancel_game():
    sid = session.get('session_id')
    if sid and sid in games:
        del games[sid]
    # Respond as “no game in progress”
    return jsonify({'message': 'Game cancelled.'}), 200

@app.route('/state', methods=['GET'])
def get_state():
    state = get_game_state()
    if not state:
        return jsonify({'error': 'No game in progress'}), 400
    return jsonify(serialize_state(state))

@app.route('/move', methods=['POST'])
def move():
    state = get_game_state()
    if not state:
        return jsonify({'error': 'No game in progress'}), 400
    
    if state.get('game_over'):
        return jsonify({'error': 'Game is over. Start a new game!'}), 400

    data = request.json
    num = data.get('num')
    source = data.get('source')  # e.g. 't3'
    dest = data.get('dest')      # e.g. 'f1'

    if not num or not source or not dest:
        return jsonify({'error': 'Missing move parameters'}), 400

    source_type, source_idx = utils.parse_location(source)
    dest_type, dest_idx = utils.parse_location(dest)

    if source_type is None or dest_type is None:
        return jsonify({'error': 'Invalid source or destination'}), 400

    # Save undo state before mutation
    state['history'].append(deep_copy_game_for_history(state))
    print("Undo history length:", len(state['history']))

    success, reason = game_logic.dispatch_move(
        state, num, source_type, source_idx, dest_type, dest_idx, validate_only=False
    )

    if not success:
        state['history'].pop()
        return jsonify({'error': reason}), 400
    
    state['move_count'] = state.get('move_count', 0) + 1

    # Set auto-move trigger only if not pulling a card from a foundation
    state['last_action_was_manual_move'] = (source_type != 'foundation')

    # Check win
    if game_logic.check_win(state['foundations']):
        state['game_over'] = True
        # Calculate runtime in seconds
        if 'start_time' in state:
            started = datetime.fromisoformat(state['start_time'])
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            runtime = (now - started).total_seconds()
        else:
            runtime = None  # fallback

        add_high_score(
            moves=state.get('move_count', 0),
            runtime=runtime,
            seed=state.get('seed')
        )
        return jsonify({'message': 'You won!', 'state': serialize_state(state), 'runtime': runtime})


    # Attempt auto-moves
    if state.get('last_action_was_manual_move', False):
        state['last_action_was_manual_move'] = False
        if game_logic.check_win(state['foundations']):
            state['game_over'] = True
            return jsonify({'message': 'You won!', 'state': serialize_state(state), 'runtime': runtime})

    save_game_state(state)
    return jsonify({'message': 'Move successful', 'state': serialize_state(state)})

@app.route('/validate-move', methods=['POST'])
def validate_move():
    state = get_game_state()
    if not state:
        return jsonify({'error': 'No game in progress'}), 400

    data = request.json
    num = data.get('num')
    source = data.get('source')
    dest = data.get('dest')

    source_type, source_idx = utils.parse_location(source)
    dest_type, dest_idx = utils.parse_location(dest)
    if source_type is None or dest_type is None:
        return jsonify({'valid': False, 'error': 'Invalid source or destination'}), 400

    # Use a deepcopy so we never mutate the real state during validation
    import copy
    state_copy = copy.deepcopy(state)

    success, reason = game_logic.dispatch_move(
        state_copy, num, source_type, source_idx, dest_type, dest_idx, validate_only=True
    )

    if success:
        return jsonify({'valid': True}), 200
    else:
        return jsonify({'valid': False, 'error': reason}), 400

@app.route('/undo', methods=['POST'])
def undo():
    state = get_game_state()
    if not state:
        return jsonify({'error': 'No game in progress'}), 400

    if state.get('game_over'):
        return jsonify({'error': 'Game is over. Start a new game!'}), 400

    if not state['history']:
        return jsonify({'error': 'No moves to undo'}), 400

    prev = state['history'].pop()
    # Restore each field, keep the same history/seed
    state['tableau'] = prev['tableau']
    state['freecells'] = prev['freecells']
    state['foundations'] = prev['foundations']
    state['seed'] = prev['seed']
    state['kings_only_on_empty_tableau'] = prev.get('kings_only_on_empty_tableau', False)
    save_game_state(state)
    print("Undo performed, history length now:", len(state['history']))
    return jsonify({'message': 'Undo successful', 'state': serialize_state(state)})

@app.route('/')
def index():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)
