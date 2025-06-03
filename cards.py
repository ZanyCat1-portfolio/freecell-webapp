from colorama import Fore, Style, init

# Initialize colorama
init(autoreset=True)

SUITS = ['S', 'H', 'D', 'C']
RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
suits_symbols = {'S': '♠', 'H': '♥', 'D': '♦', 'C': '♣'}
rank_order = {r: i for i, r in enumerate(RANKS, start=1)}

class Card:
    def __init__(self, rank, suit):
        self.rank = rank
        self.suit = suit
    
    def __str__(self):
        return f"{self.rank}{self.suit}"

def card_color(card):
    return 'red' if card.suit in ['H', 'D'] else 'black'

def colored_suit(card):
    if card.suit in ['H', 'D']:
        color = Fore.RED
    else:
        color = Fore.BLACK
    return color + suits_symbols[card.suit] + Style.RESET_ALL

def ascii_card(card):
    rank = card.rank
    suit = card.suit
    left = rank if rank != '10' else '10'
    right = rank if rank != '10' else '10'
    symbol = colored_suit(card)

    lines = [
        "┌─────────┐",
        f"│{left:<2}       │",
        "│         │",
        f"│    {symbol}    │",
        "│         │",
        f"│       {right:>2}│",
        "└─────────┘"
    ]
    return lines

def empty_card_lines():
    return [
        "┌─────────┐",
        "│         │",
        "│         │",
        "│         │",
        "│         │",
        "│         │",
        "└─────────┘"
    ]