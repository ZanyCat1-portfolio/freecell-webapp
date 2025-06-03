from cards import *
import copy

def parse_location(loc):
    loc = loc.lower()
    if loc.startswith('t'):
        try:
            col = int(loc[1:]) - 1
            if 0 <= col < 8:
                return ('tableau', col)
        except ValueError:
            pass
    elif loc.startswith('f'):
        try:
            cell = int(loc[1:]) - 1
            if 0 <= cell < 4:
                return ('freecell', cell)
        except ValueError:
            pass
    elif loc.startswith('d'):
        suit = loc[1:].upper()
        if suit in SUITS:
            return ('foundation', suit)
    return (None, None)

def deep_copy_state(tableau, freecells, foundations):
    return (
        copy.deepcopy(tableau),
        copy.deepcopy(freecells),
        copy.deepcopy(foundations)
    )