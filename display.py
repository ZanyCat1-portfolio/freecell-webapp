from cards import *

def print_freecells_and_foundations(freecells, foundations):
    freecell_lines_list = []
    for card in freecells:
        if card:
            freecell_lines_list.append(ascii_card(card))
        else:
            freecell_lines_list.append(empty_card_lines())

    foundation_lines_list = []
    for suit in SUITS:
        pile = foundations[suit]
        if pile:
            foundation_lines_list.append(ascii_card(pile[-1]))
        else:
            foundation_lines_list.append(empty_card_lines())

    print("\nFreecells" + " " * 50 + "Foundations")
    for i in range(7):
        left_part = "  ".join(freecell_lines_list[j][i] for j in range(4))
        right_part = "  ".join(foundation_lines_list[j][i] for j in range(4))
        space_between = " " * 20
        print(left_part + space_between + right_part)
    print("\n")

def print_tableau(tableau):
    max_height = max(len(col) for col in tableau)

    columns_lines = []

    for col in tableau:
        if not col:
            columns_lines.append([" " * 11] * (4 * (max_height - 1) + 7))
            continue

        col_lines = []
        num_cards = len(col)

        for i, card in enumerate(col):
            card_lines = ascii_card(card)
            if i < num_cards - 1:
                col_lines.extend(card_lines[:4])
            else:
                col_lines.extend(card_lines)

        total_lines = 4 * (num_cards - 1) + 7
        desired_lines = 4 * (max_height - 1) + 7

        if total_lines < desired_lines:
            col_lines.extend([" " * 11] * (desired_lines - total_lines))

        columns_lines.append(col_lines)

    for i in range(len(columns_lines[0])):
        line = ""
        for col_lines in columns_lines:
            line += col_lines[i] + "  "
        print(line)