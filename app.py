from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
import cards, game_logic, utils
import random
import copy
import uuid

games = {}

app = Flask(__name__, static_folder="frontend", static_url_path="/static")
app.secret_key = 'supersecretkey'  # Replace with a secure key!
CORS(app)

def create_new_game(seed=None):
    deck = [cards.Card(rank, suit) for suit in cards.SUITS for rank in cards.RANKS]
    if seed is not None:
        random.seed(seed)
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
        'seed': seed
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
        'foundations': {suit: serialize_pile(pile) for suit, pile in state['foundations'].items()}
    }

def deep_copy_game(state):
    return {
        'tableau': copy.deepcopy(state['tableau']),
        'freecells': copy.deepcopy(state['freecells']),
        'foundations': copy.deepcopy(state['foundations']),
        'history': copy.deepcopy(state['history']),
        'seed': state['seed']
    }


def deep_copy_game_for_history(state):
    return {
        'tableau': copy.deepcopy(state['tableau']),
        'freecells': copy.deepcopy(state['freecells']),
        'foundations': copy.deepcopy(state['foundations']),
        'seed': state['seed']
    }

@app.before_request
def ensure_session_id():
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())

def get_game_state():
    sid = session['session_id']
    return games.get(sid)

def save_game_state(state):
    sid = session['session_id']
    games[sid] = state

@app.route('/newgame', methods=['POST'])
def new_game():
    data = request.json or {}
    seed = data.get('seed')
    state = create_new_game(seed)
    save_game_state(state)
    return jsonify({
        'message': 'New game started',
        'seed': seed,
        'state': serialize_state(state)
    }), 200

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

    # Save only the relevant state
    state['history'].append(deep_copy_game_for_history(state))
    print("Undo history length:", len(state['history']))

    success = False
    reason = ''

    if source_type == 'tableau' and dest_type == 'freecell':
        if num != 1:
            return jsonify({'error': 'Can only move one card at a time to freecells'}), 400
        success, reason = game_logic.move_to_freecell(state['tableau'], state['freecells'], source_idx, dest_idx)

    elif source_type == 'freecell' and dest_type == 'tableau':
        if num != 1:
            return jsonify({'error': 'Can only move one card at a time from freecells'}), 400
        success, reason = game_logic.move_from_freecell_to_tableau(state['freecells'], state['tableau'], source_idx, dest_idx)

    elif source_type == 'foundation' and dest_type == 'tableau':
        if num != 1:
            return jsonify({'error': 'Can only move one card at a time from foundation'}), 400
        success, reason = game_logic.move_from_foundation_to_tableau(state['foundations'], state['tableau'], source_idx, dest_idx)

    elif source_type == 'tableau' and dest_type == 'foundation':
        if num != 1:
            return jsonify({'error': 'Can only move one card at a time to foundations'}), 400
        success, reason = game_logic.move_to_foundation_from_tableau(state['tableau'], state['foundations'], source_idx, dest_idx)

    elif source_type == 'freecell' and dest_type == 'foundation':
        if num != 1:
            return jsonify({'error': 'Can only move one card at a time from freecells to foundations'}), 400
        success, reason = game_logic.move_from_freecell_to_foundation(state['freecells'], state['foundations'], source_idx, dest_idx)

    elif source_type == 'tableau' and dest_type == 'tableau':
        if num > len(state['tableau'][source_idx]):
            return jsonify({'error': 'Not enough cards to move'}), 400
        moving_stack = state['tableau'][source_idx][-num:]
        valid_stack, stack_reason = game_logic.can_move_stack(moving_stack)
        if not valid_stack:
            return jsonify({'error': stack_reason}), 400
        valid_place, place_reason = game_logic.can_place_on(state['tableau'][dest_idx], moving_stack)
        if not valid_place:
            return jsonify({'error': place_reason}), 400
        success, reason = game_logic.move_cards(state['tableau'], num, source_idx, dest_idx, state['freecells'])
    else:
        return jsonify({'error': 'Unsupported move type'}), 400

    if not success:
        # Undo the history append
        state['history'].pop()
        return jsonify({'error': reason}), 400

    # Check win condition
    if game_logic.check_win(state['foundations']):
        return jsonify({'message': 'You won!', 'state': serialize_state(state)})

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

    # Parse source/dest just like in /move
    source_type, source_idx = utils.parse_location(source)
    dest_type, dest_idx = utils.parse_location(dest)
    if source_type is None or dest_type is None:
        return jsonify({'valid': False, 'error': 'Invalid source or destination'}), 400

    # Now check the move, but do NOT change the game state!
    try:
        # All logic duplicated from /move, but only validation (not actual move/history).
        if source_type == 'tableau' and dest_type == 'freecell':
            if num != 1:
                return jsonify({'valid': False, 'error': 'Can only move one card at a time to freecells'}), 400
            success, reason = game_logic.move_to_freecell(
                copy.deepcopy(state['tableau']), 
                copy.deepcopy(state['freecells']), 
                source_idx, dest_idx
            )
        elif source_type == 'freecell' and dest_type == 'tableau':
            if num != 1:
                return jsonify({'valid': False, 'error': 'Can only move one card at a time from freecells'}), 400
            success, reason = game_logic.move_from_freecell_to_tableau(
                copy.deepcopy(state['freecells']),
                copy.deepcopy(state['tableau']),
                source_idx, dest_idx
            )
        # ...repeat for each move type, always using deepcopy of state...
        elif source_type == 'tableau' and dest_type == 'tableau':
            tableau = copy.deepcopy(state['tableau'])
            freecells = copy.deepcopy(state['freecells'])
            if num > len(tableau[source_idx]):
                return jsonify({'valid': False, 'error': 'Not enough cards to move'}), 400
            moving_stack = tableau[source_idx][-num:]
            valid_stack, stack_reason = game_logic.can_move_stack(moving_stack)
            if not valid_stack:
                return jsonify({'valid': False, 'error': stack_reason}), 400
            valid_place, place_reason = game_logic.can_place_on(tableau[dest_idx], moving_stack)
            if not valid_place:
                return jsonify({'valid': False, 'error': place_reason}), 400
            # Check for multi-move rules here, just like your move_cards logic:
            success, reason = game_logic.move_cards(
                tableau, num, source_idx, dest_idx, freecells
            )
        else:
            return jsonify({'valid': False, 'error': 'Unsupported move type'}), 400

        if not success:
            return jsonify({'valid': False, 'error': reason}), 400

        return jsonify({'valid': True}), 200

    except Exception as e:
        return jsonify({'valid': False, 'error': str(e)}), 400





@app.route('/undo', methods=['POST'])
def undo():
    state = get_game_state()
    if not state:
        return jsonify({'error': 'No game in progress'}), 400

    if not state['history']:
        return jsonify({'error': 'No moves to undo'}), 400

    prev = state['history'].pop()
    # Restore each field, keep the same history/seed
    state['tableau'] = prev['tableau']
    state['freecells'] = prev['freecells']
    state['foundations'] = prev['foundations']
    state['seed'] = prev['seed']
    save_game_state(state)
    print("Undo performed, history length now:", len(state['history']))
    return jsonify({'message': 'Undo successful', 'state': serialize_state(state)})


@app.route('/')
def index():
    return app.send_static_file('index.html')


if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)
