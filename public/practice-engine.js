(function(root) {
  const colors = { player: '#2878d0', computer: '#db6454', starter: '#8a8f98' };
  function neighbors(cell) {
    return [[cell - 4,'top','bottom',cell >= 4],[cell + 4,'bottom','top',cell < 12],[cell - 1,'left','right',cell % 4 !== 0],[cell + 1,'right','left',cell % 4 !== 3]].filter(entry => entry[3]);
  }
  function play(board, card, cell, player) {
    if (!Number.isInteger(cell) || cell < 0 || cell > 15 || board[cell]) throw new Error('Choose an empty space');
    const next = board.map(entry => entry ? {...entry} : null);
    const placed = {...card, ownerId: player, playedBy: player, color: colors[player]};
    for (const [index, attack, defend] of neighbors(cell)) {
      const other = next[index];
      if (!other || other.ownerId === player) continue;
      if (placed[attack] > other[defend]) { other.ownerId = player; other.color = colors[player]; }
      else if (placed[attack] < other[defend] && other.ownerId !== 'starter') { placed.ownerId = other.ownerId; placed.color = other.color; }
    }
    next[cell] = placed;
    return next;
  }
  function score(board, player) {
    const other = player === 'computer' ? 'player' : 'computer';
    return board.reduce((sum, card) => sum + (card?.ownerId === player ? 1 : card?.ownerId === other ? -1 : 0), 0);
  }
  function evaluate(board, player) {
    let value = score(board, player) * 100;
    board.forEach((card, cell) => {
      if (!card || card.ownerId === 'starter') return;
      const sign = card.ownerId === player ? 1 : -1;
      for (const [index, side] of neighbors(cell)) if (!board[index]) value += sign * (Number(card[side]) - 5) * 1.5;
    });
    return value;
  }
  function chooseMove(board, hand, opponentHand) {
    let best = null;
    for (let cardIndex = 0; cardIndex < hand.length; cardIndex++) {
      for (let cell = 0; cell < 16; cell++) {
        if (board[cell]) continue;
        const next = play(board, hand[cardIndex], cell, 'computer');
        let worst = Infinity;
        for (const response of opponentHand) {
          for (let reply = 0; reply < 16; reply++) {
            if (next[reply]) continue;
            const after = play(next, response, reply, 'player');
            const value = hand.length === 1 && opponentHand.length === 1 ? score(after, 'computer') * 100 : evaluate(after, 'computer');
            worst = Math.min(worst, value);
          }
        }
        if (worst === Infinity) worst = evaluate(next, 'computer');
        const value = worst + evaluate(next, 'computer') * .01;
        if (!best || value > best.value) best = {cardIndex, cell, value};
      }
    }
    return best;
  }
  const api = {play, score, chooseMove};
  if (typeof module !== 'undefined') module.exports = api; else root.PracticeEngine = api;
})(typeof self !== 'undefined' ? self : globalThis);
