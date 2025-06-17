# game_logic.py:
import cards
import utils

def can_move_stack(stack):
    for i in range(len(stack) - 1):
        top = stack[i]
        below = stack[i + 1]
        if cards.rank_order[top.rank] != cards.rank_order[below.rank] + 1:
            return False, "Cards must be in descending rank."
        if cards.card_color(top) == cards.card_color(below):
            return False, "Cards must alternate colors."
    return True, ""

def can_place_on(dest_col, moving_stack, kings_only_on_empty_tableau=False):
    if not dest_col:
        if kings_only_on_empty_tableau and moving_stack[0].rank != 'K':
            return False, "Only a King can be placed on an empty column."
        return True, ""
    top_dest = dest_col[-1]
    top_move = moving_stack[0]
    if cards.rank_order[top_dest.rank] != cards.rank_order[top_move.rank] + 1:
        return False, "Destination card must be one rank higher."
    if cards.card_color(top_dest) == cards.card_color(top_move):
        return False, "Destination card must be opposite color."
    return True, ""

def can_place_on_foundation(foundation_pile, card):
    if not foundation_pile:
        if card.rank != 'A':
            return False, "Only an Ace can start a foundation."
        return True, ""
    top_card = foundation_pile[-1]
    if card.suit != top_card.suit:
        return False, "Card suit must match foundation suit."
    if cards.rank_order[card.rank] != cards.rank_order[top_card.rank] + 1:
        return False, "Card rank must be one higher than foundation top."
    return True, ""

def move_cards(tableau, num_cards, from_col_idx, to_col_idx, freecells=None, kings_only_on_empty_tableau=False, validate_only=False):
    from_col = tableau[from_col_idx]
    to_col = tableau[to_col_idx]
    if num_cards > len(from_col):
        return False, "Not enough cards to move."
    moving_stack = from_col[-num_cards:]
    valid_stack, reason = can_move_stack(moving_stack)
    if not valid_stack:
        return False, reason
    valid_place, reason = can_place_on(to_col, moving_stack, kings_only_on_empty_tableau=kings_only_on_empty_tableau)
    if not valid_place:
        return False, reason

    if freecells is not None:
        empty_freecells = sum(1 for c in freecells if c is None)
        empty_tableaus = sum(
            1 for i, col in enumerate(tableau)
            if len(col) == 0 and i != from_col_idx and i != to_col_idx
        )
        max_movable = (empty_freecells + 1) * (empty_tableaus + 1)

        if kings_only_on_empty_tableau and len(to_col) == 0 and moving_stack[0].rank != 'K':
            return False, "Only Kings can be moved to empty tableau columns."

        if num_cards > max_movable:
            return False, f"You can only move up to {max_movable} cards at once, based on available freecells and empty tableau columns."

    if validate_only:
        return True, ""
    to_col.extend(moving_stack)
    del from_col[-num_cards:]
    return True, ""


def move_to_freecell(tableau, freecells, from_col_idx, freecell_idx, validate_only=False):
    col = tableau[from_col_idx]
    if not col:
        return False, "Source tableau column is empty."
    if freecells[freecell_idx] is not None:
        return False, "Selected freecell is not empty."
    if validate_only:
        return True, ""
    card = col.pop()
    freecells[freecell_idx] = card
    return True, ""

def move_from_freecell_to_tableau(freecells, tableau, freecell_idx, to_col_idx, kings_only_on_empty_tableau=False, validate_only=False):
    card = freecells[freecell_idx]
    if card is None:
        return False, "Selected freecell is empty."
    valid_place, reason = can_place_on(
        tableau[to_col_idx],
        [card],
        kings_only_on_empty_tableau=kings_only_on_empty_tableau
    )
    if not valid_place:
        return False, reason
    if validate_only:
        return True, ""
    tableau[to_col_idx].append(card)
    freecells[freecell_idx] = None
    return True, ""

def move_to_foundation_from_tableau(tableau, foundations, from_col_idx, suit, validate_only=False):
    col = tableau[from_col_idx]
    if not col:
        return False, "Source tableau column is empty."
    card = col[-1]
    if card.suit != suit:
        return False, "Top card suit does not match foundation suit."
    valid_place, reason = can_place_on_foundation(foundations[suit], card)
    if not valid_place:
        return False, reason
    if validate_only:
        return True, ""
    foundations[suit].append(card)
    col.pop()
    return True, ""

def move_from_freecell_to_foundation(freecells, foundations, freecell_idx, suit, validate_only=False):
    card = freecells[freecell_idx]
    if card is None:
        return False, "Selected freecell is empty."
    if card.suit != suit:
        return False, "Card suit does not match foundation suit."
    valid_place, reason = can_place_on_foundation(foundations[suit], card)
    if not valid_place:
        return False, reason
    if validate_only:
        return True, ""
    foundations[suit].append(card)
    freecells[freecell_idx] = None
    return True, ""

def check_win(foundations):
    return all(len(pile) == 13 for pile in foundations.values())

def move_from_foundation_to_tableau(foundations, tableau, suit, to_col_idx, validate_only=False):
    pile = foundations[suit]
    if not pile:
        return False, "Selected foundation pile is empty."
    card = pile[-1]
    valid_place, reason = can_place_on(tableau[to_col_idx], [card], kings_only_on_empty_tableau=False)
    if not valid_place:
        return False, reason
    if validate_only:
        return True, ""
    tableau[to_col_idx].append(card)
    pile.pop()
    return True, ""

import time  # Only needed for CLI if you want delays

def auto_move_to_foundation(state):
    """Auto-moves eligible cards to foundations. Each move is recorded in history."""
    moved_any = False

    while True:
        moved = False

        # Snapshot for undo
        snapshot = {
            'tableau': utils.copy.deepcopy(state['tableau']),
            'freecells': utils.copy.deepcopy(state['freecells']),
            'foundations': utils.copy.deepcopy(state['foundations']),
            'seed': state.get('seed'),
            'kings_only_on_empty_tableau': state.get('kings_only_on_empty_tableau', False)
        }

        snapshot['seed'] = state.get('seed')
        snapshot['kings_only_on_empty_tableau'] = state.get('kings_only_on_empty_tableau', False)

        # Tableau → Foundation
        for idx, col in enumerate(state['tableau']):
            if col:
                card = col[-1]
                suit = card.suit
                foundation = state['foundations'][suit]
                expected_rank = cards.RANKS[len(foundation)]
                if card.rank == expected_rank:
                    state['foundations'][suit].append(col.pop())
                    state['history'].append(snapshot)
                    moved = True
                    moved_any = True
                    break  # Restart outer loop

        if moved:
            continue

        # Freecell → Foundation
        for idx, cell in enumerate(state['freecells']):
            if cell:
                card = cell
                suit = card.suit
                foundation = state['foundations'][suit]
                expected_rank = cards.RANKS[len(foundation)]
                if card.rank == expected_rank:
                    state['foundations'][suit].append(card)
                    state['freecells'][idx] = None
                    state['history'].append(snapshot)
                    moved = True
                    moved_any = True
                    break

        if not moved:
            break

    return moved_any

def dispatch_move(state, num, source_type, source_idx, dest_type, dest_idx, validate_only=False):
    kings_only = state.get('kings_only_on_empty_tableau', False)

    # TABLEAU → FREECELL
    if source_type == 'tableau' and dest_type == 'freecell':
        if num != 1:
            return False, 'Can only move one card at a time to freecells'
        return move_to_freecell(state['tableau'], state['freecells'], source_idx, dest_idx, validate_only=validate_only)

    # FREECELL → TABLEAU
    elif source_type == 'freecell' and dest_type == 'tableau':
        if num != 1:
            return False, 'Can only move one card at a time from freecells'
        return move_from_freecell_to_tableau(
            state['freecells'], state['tableau'], source_idx, dest_idx,
            kings_only_on_empty_tableau=kings_only, validate_only=validate_only
        )

    # FOUNDATION → TABLEAU
    elif source_type == 'foundation' and dest_type == 'tableau':
        if num != 1:
            return False, 'Can only move one card at a time from foundation'
        return move_from_foundation_to_tableau(
            state['foundations'], state['tableau'], source_idx, dest_idx,
            validate_only=validate_only
        )

    # FOUNDATION → FREECELL
    elif source_type == 'foundation' and dest_type == 'freecell':
        if num != 1:
            return False, 'Can only move one card at a time from foundation'
        suit = source_idx  # If this is a string (e.g., 'h'), it matches your style
        card = state['foundations'][suit][-1] if state['foundations'][suit] else None
        if not card:
            return False, 'No card to move from foundation'
        if state['freecells'][dest_idx] is not None:
            return False, 'Target freecell is not empty'
        if validate_only:
            return True, ''
        state['foundations'][suit].pop()
        state['freecells'][dest_idx] = card
        return True, ''

    # TABLEAU → FOUNDATION
    elif source_type == 'tableau' and dest_type == 'foundation':
        if num != 1:
            return False, 'Can only move one card at a time to foundations'
        suit = dest_idx  # Assumes dest_idx is the suit string
        return move_to_foundation_from_tableau(
            state['tableau'], state['foundations'], source_idx, suit, validate_only=validate_only
        )

    # FREECELL → FOUNDATION
    elif source_type == 'freecell' and dest_type == 'foundation':
        if num != 1:
            return False, 'Can only move one card at a time from freecells to foundations'
        suit = dest_idx
        return move_from_freecell_to_foundation(
            state['freecells'], state['foundations'], source_idx, suit, validate_only=validate_only
        )

    # TABLEAU → TABLEAU
    elif source_type == 'tableau' and dest_type == 'tableau':
        if num > len(state['tableau'][source_idx]):
            return False, 'Not enough cards to move'
        return move_cards(
            state['tableau'], num, source_idx, dest_idx, state.get('freecells'),
            kings_only_on_empty_tableau=kings_only, validate_only=validate_only
        )

    else:
        return False, 'Unsupported move type'
