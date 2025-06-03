export function showMessage(msg) {
    document.getElementById('message').textContent = msg;
}
export function cardImageFile(card) {
    if (!card) return 'cards/back.svg';
    const rankMap = {
        'A': 'ace', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
        '7': '7', '8': '8', '9': '9', '10': '10', 'J': 'jack', 'Q': 'queen', 'K': 'king'
    };
    const suitMap = {'S': 'spades', 'H': 'hearts', 'D': 'diamonds', 'C': 'clubs'};
    return `static/cards/${rankMap[card.rank]}_of_${suitMap[card.suit]}.svg`;
}