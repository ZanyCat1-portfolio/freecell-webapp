export const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
export const SUIT_COLOR = { 'S': 'B', 'C': 'B', 'H': 'R', 'D': 'R' };

// Get 'R' or 'B' for a card object {suit: ...}
export function getCardColor(card) {
    return SUIT_COLOR[card.suit];
}

// Return true if card can be placed on baseCard in tableau (alternating color, descending rank)
export function cardFollows(card, baseCard) {
    return getCardColor(card) !== getCardColor(baseCard) &&
           RANKS.indexOf(card.rank) + 1 === RANKS.indexOf(baseCard.rank);
}

// Return true if card can go to foundation pile (must be next in sequence for its suit)
export function canMoveCardToFoundation(card, foundations) {
    const pile = foundations[card.suit];
    if (!pile || pile.length === 0) return card.rank === 'A';
    return RANKS.indexOf(card.rank) === RANKS.indexOf(pile[pile.length - 1].rank) + 1;
}

// Return true if an array of cards forms a valid FreeCell stack (descending by 1, alternating color)
export function isValidStack(stack) {
    if (stack.length < 1) return false;
    return stack.slice(0, -1).every((card, i) => {
        const next = stack[i+1];
        return RANKS.indexOf(card.rank) === RANKS.indexOf(next.rank) + 1 &&
               getCardColor(card) !== getCardColor(next);
    });
}

// Return true if a stack can legally move onto tableauCol, considering FreeCell rules and freecells count
export function canMoveStackToTableau(stack, tableauCol, freecells) {
    const emptyFreeCells = freecells.filter(cell => cell === null).length;
    // Only allow moving onto empty tableau if moving full stack led by a King and enough freecells
    if (tableauCol.length === 0) {
        return stack.length > 0 && stack[0].rank === 'K' && stack.length <= emptyFreeCells + 1;
    }
    // For non-empty tableau, check if stack[0] can be placed on destination's top card
    return stack.length > 0 && cardFollows(stack[0], tableauCol[tableauCol.length - 1]);
}

// Utility: convert location string to one-based index for backend/API
export function convertLocationToOneBased(loc) {
    if (!loc || loc.length < 2) return loc;
    const prefix = loc[0];
    const idxOrSuit = loc.slice(1);
    if (prefix === 't' || prefix === 'f') {
        const idx = parseInt(idxOrSuit);
        if (isNaN(idx)) return loc;
        return prefix + (idx + 1);
    }
    return loc;
}
