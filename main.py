import cards, game_logic, display, utils
import random

def create_deck():
    return [cards.Card(rank, suit) for suit in cards.SUITS for rank in cards.RANKS]

def shuffle_deck(deck, seed=None):
    if seed is not None:
        random.seed(seed)
    random.shuffle(deck)

def deal_to_tableau(deck):
    tableau = [[] for _ in range(8)]
    for i, card in enumerate(deck):
        tableau[i % 8].append(card)
    return tableau

def main():
    print("Welcome to ASCII Freecell!")
    print("Type 'random' to play a random deal, or enter a numeric seed to play a reproducible deal.")

    choice = input("Enter your choice: ").strip().lower()

    deck = create_deck()

    if choice == 'random':
        shuffle_deck(deck)
        print("Shuffling deck randomly...\n")
    else:
        try:
            seed = int(choice)
            shuffle_deck(deck, seed)
            print(f"SHuffling deck with seed {seed}...\n")
        except ValueError:
            print("Shuffling randomly...\n")
            shuffle_deck(deck)

    tableau = deal_to_tableau(deck)
    freecells = [None] * 4
    foundations = {suit: [] for suit in cards.SUITS}

    history = []  # for undo

    print("Welcome to ASCII Freecell! Type moves like 'move 1 from t2 to f1', 'undo' to undo last move, or 'quit' to exit.\n")

    while True:
        display.print_freecells_and_foundations(freecells, foundations)
        display.print_tableau(tableau)

        if game_logic.check_win(foundations):
            print("🎉 Congratulations! You won! 🎉")
            break

        command = input("Enter move: ").strip().lower()
        if command == 'quit':
            print("Thanks for playing!")
            break
        if command == 'undo':
            if history:
                tableau, freecells, foundations = history.pop()
                print("Undo successful.\n")
            else:
                print("No moves to undo.\n")
            continue

        parts = command.split()
        if len(parts) == 6 and parts[0] == 'move' and parts[2] == 'from' and parts[4] == 'to':
            try:
                num = int(parts[1])
            except ValueError:
                print("Invalid number of cards.\n")
                continue

            source_type, source_idx = utils.parse_location(parts[3])
            dest_type, dest_idx = utils.parse_location(parts[5])

            if source_type is None or dest_type is None:
                print("Invalid source or destination.\n")
                continue

            # Save current state for undo
            history.append(utils.deep_copy_state(tableau, freecells, foundations))

            success = False
            reason = ""

            if source_type == 'tableau' and dest_type == 'freecell':
                if num != 1:
                    print("Can only move one card at a time to freecells.\n")
                    history.pop()  # Undo not saved
                    continue
                success, reason = game_logic.move_to_freecell(tableau, freecells, source_idx, dest_idx)

            elif source_type == 'freecell' and dest_type == 'tableau':
                if num != 1:
                    print("Can only move one card at a time from freecells.\n")
                    history.pop()
                    continue
                success, reason = game_logic.move_from_freecell_to_tableau(freecells, tableau, source_idx, dest_idx)

            elif source_type == 'foundation' and dest_type == 'tableau':
                if num != 1:
                    print("Can only move one card at a time from foundation.")
                    history.pop()
                    continue
                success, reason = game_logic.move_from_foundation_to_tableau(foundations, tableau, source_idx, dest_idx)


            elif source_type == 'tableau' and dest_type == 'foundation':
                if num != 1:
                    print("Can only move one card at a time to foundations.\n")
                    history.pop()
                    continue
                success, reason = game_logic.move_to_foundation_from_tableau(tableau, foundations, source_idx, dest_idx)

            elif source_type == 'freecell' and dest_type == 'foundation':
                if num != 1:
                    print("Can only move one card at a time from freecells to foundations.\n")
                    history.pop()
                    continue
                success, reason = game_logic.move_from_freecell_to_foundation(freecells, foundations, source_idx, dest_idx)

            elif source_type == 'tableau' and dest_type == 'tableau':
                if num > len(tableau[source_idx]):
                    print("Not enough cards to move.\n")
                    history.pop()
                    continue
                moving_stack = tableau[source_idx][-num:]
                valid_stack, stack_reason = game_logic.can_move_stack(moving_stack)
                if not valid_stack:
                    print(f"Invalid card stack: {stack_reason}\n")
                    history.pop()
                    continue
                valid_place, place_reason = game_logic.can_place_on(tableau[dest_idx], moving_stack)
                if not valid_place:
                    print(f"Invalid move placement: {place_reason}\n")
                    history.pop()
                    continue
                success, reason = game_logic.move_cards(tableau, num, source_idx, dest_idx, freecells)
            else:
                print("Unsupported move type.\n")
                history.pop()
                continue

            if success:
                print("Move successful!\n")
            else:
                print(f"Move failed: {reason}\n")
                history.pop()
        else:
            print("Invalid command format. Use: move N from tX to tY/fZ/dS, 'undo', or 'quit'.\n")

if __name__ == "__main__":
    main()
