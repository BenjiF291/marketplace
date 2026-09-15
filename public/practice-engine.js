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
  function rankMoves(board, hand, opponentHand, player = 'computer') {
    const opponent = player === 'computer' ? 'player' : 'computer';
    const choices = [];
    for (let cardIndex = 0; cardIndex < hand.length; cardIndex++) {
      for (let cell = 0; cell < 16; cell++) {
        if (board[cell]) continue;
        const next = play(board, hand[cardIndex], cell, player);
        let worst = Infinity;
        for (const response of opponentHand) {
          for (let reply = 0; reply < 16; reply++) {
            if (next[reply]) continue;
            const after = play(next, response, reply, opponent);
            const value = hand.length === 1 && opponentHand.length === 1 ? score(after, player) * 100 : evaluate(after, player);
            worst = Math.min(worst, value);
          }
        }
        if (worst === Infinity) worst = evaluate(next, player);
        const value = worst + evaluate(next, player) * .01;
        choices.push({cardIndex, cell, value});
      }
    }
    choices.sort((a,b)=>b.value-a.value);
    return choices;
  }
  // Assessment only: preserve Bob's versioned move policy for saved replays.
  // Value exposed edges against the remaining hands, rather than a fixed stat.
  function positionValue(board, hand, opponentHand, player) {
    let value = score(board, player) * 100;
    if (!hand.length && !opponentHand.length) return value;
    board.forEach((card, cell) => {
      if (!card || card.ownerId === 'starter') return;
      const mine = card.ownerId === player;
      const attackers = mine ? opponentHand : hand;
      let risk = 0;
      for (const [index, defend, attack] of neighbors(cell)) {
        if (board[index] || !attackers.length) continue;
        const threats = attackers.filter(candidate => candidate[attack] > card[defend]).length;
        risk = Math.max(risk, threats / attackers.length);
      }
      // Do not reward huge stats for their own sake, or count one vulnerable
      // card four times. A wall or defended flank has value through safety.
      value += (mine ? -1 : 1) * risk * 55;
    });
    return value;
  }
  function tacticalMoves(board, hand, otherHand, player) {
    const other = player === 'player' ? 'computer' : 'player';
    const moves = [];
    hand.forEach((card, cardIndex) => {
      const remaining = hand.filter((_, index) => index !== cardIndex);
      for (let cell = 0; cell < 16; cell++) {
        if (board[cell]) continue;
        const next = play(board, card, cell, player);
        moves.push({cardIndex, cell, board:next, remaining,
          value:positionValue(next, remaining, otherHand, player), other});
      }
    });
    return moves.sort((a,b) => b.value-a.value);
  }
  function assessMoves(board, hand, opponentHand, player = 'player') {
    const opponent = player === 'player' ? 'computer' : 'player';
    const choices = tacticalMoves(board, hand, opponentHand, player);
    return choices.map(move => {
      // Consider all root placements and the eight strongest immediate replies.
      // Search ALL available follow-ups, so held cards can recapture a sacrifice.
      const replies = tacticalMoves(move.board, opponentHand, move.remaining, opponent).slice(0, 8);
      let value = Infinity;
      let line = null;
      for (const reply of replies) {
        const followups = tacticalMoves(reply.board, move.remaining, reply.remaining, player);
        const nextValue = followups.length ? followups[0].value : positionValue(reply.board, [], reply.remaining, player);
        if (nextValue < value) {
          value = nextValue;
          line = {reply:{cardIndex:reply.cardIndex,cell:reply.cell},
            followup:followups.length?{cardIndex:followups[0].cardIndex,cell:followups[0].cell}:null};
        }
      }
      if (!replies.length) value = move.value;
      return {cardIndex:move.cardIndex,cell:move.cell,value,line};
    }).sort((a,b) => b.value-a.value);
  }
  function moveAssessment(choices, cardIndex, cell) {
    const selected = choices.find(move => move.cardIndex === cardIndex && move.cell === cell);
    if (!selected) throw new Error('Invalid placement');
    const regret = Math.max(0, choices[0].value - selected.value);
    const informative = choices[0].value - choices.at(-1).value > 25;
    // Small heuristic differences are equivalent; percentages are estimates,
    // not capture rates or probabilities of winning.
    return {quality:informative?Math.exp(-Math.max(0,regret-25)/200):null,
      regret, best:{cardIndex:choices[0].cardIndex,cell:choices[0].cell}, line:selected.line};
  }
  function chooseMove(board, hand, opponentHand, difficulty = 'hard', random = Math.random) {
    const choices = rankMoves(board, hand, opponentHand);
    if (!choices.length) return null;
    if (typeof difficulty === 'number' || difficulty?.policy === 'adaptive-v2') {
      const level = Math.max(0, Math.min(1000, typeof difficulty === 'number' ? difficulty : difficulty.skill));
      // Keep the numeric policy unchanged for saved matches. The versioned policy
      // gives Bob more fallible decisions while improving continuously with skill.
      const gap = difficulty?.policy === 'adaptive-v2' ? 190 + 220 * (level / 1000) ** 3 : 0;
      const skill = (level - gap) / 1000;
      // Smooth mixture: stronger opponents increasingly choose the best move.
      if (random() < Math.max(0, .15 + .8 * skill)) return choices[0];
      const temperature = 15 + 260 * (1 - skill) ** 2;
      const weights = choices.map(move => Math.exp((move.value - choices[0].value) / temperature));
      let pick = random() * weights.reduce((sum, weight) => sum + weight, 0);
      for (let i = 0; i < choices.length; i++) { pick -= weights[i]; if (pick <= 0) return choices[i]; }
      return choices[0];
    }
    if (difficulty === 'easy') return choices[Math.min(choices.length-1, 1 + Math.floor(random() * Math.max(1, Math.ceil(choices.length * .3))))];
    if (difficulty === 'medium') {
      const near = choices.filter(move => move.value >= choices[0].value - 110).slice(0, 5);
      return near.length > 1 ? near[1 + Math.floor(random() * (near.length-1))] : choices[0];
    }
    return choices[0];
  }
  const difficulties = {easy:{offset:20,win:10,loss:5},medium:{offset:10,win:25,loss:10},hard:{offset:0,win:40,loss:15}};
  function seeded(seed) { let state=seed>>>0; return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;}; }
  function computerDeck(pool, player, difficulty, random=Math.random, variation=false) {
    if (!difficulties[difficulty] || pool.length < 6) throw new Error('Need six available battle cards');
    const average = cards=>cards.reduce((sum,card)=>sum+Number(card.averageScore||0),0)/cards.length;
    const target = Math.max(0,average(player)-difficulties[difficulty].offset + (variation ? (random()*2-1)*Math.min(1,average(player)*.04) : 0));
    const ids = new Set(player.map(card=>card.battleCardId||card.id));
    const different=pool.filter(card=>!ids.has(card.battleCardId||card.id));
    const candidates=different.length>=6?different:pool;
    let best=null, gap=Infinity;
    for(let attempt=0;attempt<400;attempt++) {
      const remaining=[...candidates],chosen=[];let total=0;
      for(let i=0;i<6;i++){
        const desired=(target*6-total)/(6-i);
        remaining.sort((a,b)=>Math.abs(Number(a.averageScore||0)-desired)-Math.abs(Number(b.averageScore||0)-desired));
        const index=Math.floor(random()*Math.min(10,remaining.length));
        const card=remaining.splice(index,1)[0];chosen.push(card);total+=Number(card.averageScore||0);
      }
      const shuffled=chosen;
      const deck=shuffled.slice(0,6), difference=Math.abs(average(deck)-target);
      if(difference<gap){best=deck;gap=difference;}
      if(gap<.25)break;
    }
    return {deck:best.map(card=>({...card})),target,average:average(best),playerAverage:average(player)};
  }
  function startingPlayer(player, computer, random=Math.random) {
    const total = hand => hand.reduce((sum,card) => sum+Number(card.averageScore||0),0);
    const difference = total(player)-total(computer);
    return difference === 0 ? (random()<.5?'player':'computer') : difference>0?'player':'computer';
  }
  function trainingCards() { return [[8,3,5,4],[4,8,3,5],[5,4,8,3],[3,5,4,8],[6,6,4,4],[4,4,6,6]].map((sides,index)=>({id:`training-${index}`,battleCardId:`training-${index}`,name:`Training ${index+1}`,top:sides[0],right:sides[1],bottom:sides[2],left:sides[3],averageScore:5})); }
  const api = {play, score, rankMoves, assessMoves, moveAssessment, startingPlayer, chooseMove, difficulties, seeded, computerDeck, trainingCards};
  if (typeof module !== 'undefined') module.exports = api; else root.PracticeEngine = api;
})(typeof self !== 'undefined' ? self : globalThis);
