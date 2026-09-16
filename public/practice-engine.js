(function(root) {
  const colors = { player: '#2878d0', computer: '#db6454', starter: '#8a8f98' };
  function neighbors(cell) {
    return [[cell - 4,'top','bottom',cell >= 4],[cell + 4,'bottom','top',cell < 12],[cell - 1,'left','right',cell % 4 !== 0],[cell + 1,'right','left',cell % 4 !== 3]].filter(entry => entry[3]);
  }
  const MIRROR_POWERS = {
    kinship:{name:'Family ties',description:'Gains 1 tooth on every side per adjacent Liesker or Heeren.'},
    spoils:{name:'Spoils of victory',description:'Copies the four sides of a card defeated on placement.'},
    focus:{name:'Focused strike',description:'Choose one attack side; the other three sides become zero.'},
    reach:{name:'Long reach',description:'On placement attacks two cells away and ignores immediate neighbors.'},
    budget:{name:'Extra allowance',description:'Adds 15 points to the six-card deck budget.'},
    replace:{name:'Replacement',description:'May replace an occupied board card.'},
    reversal:{name:'Reversal',description:'Reverses losing comparisons.'},
    interrupt:{name:'Impatience',description:'Can interrupt an opponent who has spent 15 seconds thinking.'},
    mimic:{name:'Mimic',description:'Copies a chosen special ability already on the board.'},
    plain:{name:'Raw talent',description:'No triggered power; high teeth for its printed score.'}
  };
  function isMirror(card) { return /\bmirror\b/i.test(String(card?.linkedCardImage || card?.tierName || card?.name || '').replace(/_/g,' ')); }
  function starterCard(pool, decks, random=Math.random) {
    const target=decks.reduce((sum,card)=>sum+Number(card.averageScore||0),0)/Math.max(1,decks.length);
    const available=pool.length?pool:decks;
    if(!available.length)throw new Error('No starter cards available');
    const distance=card=>Math.abs(Number(card.averageScore||0)-target);
    const nearest=Math.min(...available.map(distance));
    const choices=available.filter(card=>distance(card)<=nearest+Math.max(1,target*.1));
    const card=choices[Math.floor(random()*choices.length)];
    return {...card,cardId:`starter:${card.id||card.battleCardId||card.name}`,ownerId:'starter',playedBy:'starter',neutralStarter:true,color:colors.starter};
  }
  function budgetBonus(cards) { return cards.some(card=>ability(card)==='mirror-budget')?15:0; }
  function ability(card) {
    if(card?.neutralStarter)return '';
    if(card?.copiedAbility)return card.copiedAbility;
    if(isMirror(card)&&MIRROR_POWERS[card.mirrorPower])return `mirror-${card.mirrorPower}`;
    const text = String(card?.linkedCardImage || card?.tierName || card?.name || '').toLowerCase().replace(/_/g,' ');
    if (/\bfighter\b/.test(text)) return 'fighter';
    if (/\bmini\b/.test(text)) return 'mini';
    if (/\blow(?:[ -]*pointer)?\b/.test(text)) return 'low-pointer';
    if (/\b(genious|genius)\b/.test(text)) return 'genius';
    return '';
  }
  const sides = ['top','right','bottom','left'];
  function refreshAuras(board) {
    if(!board.some(card=>card?.mirrorPower==='kinship'||card?.copiedAbility==='mirror-kinship'))return board;
    return board.map((card,cell)=>{
      if(!card)return null;
      const next={...card};
      if(ability(card)==='mirror-kinship') {
        const bonus=neighbors(cell).filter(([index])=> /\b(liesker|heeren)\b/i.test(String(board[index]?.name||'')+' '+String(board[index]?.familyName||''))).length;
        const base=card.baseSides||Object.fromEntries(sides.map(side=>[side,Number(card[side])-Number(card.auraBonus||0)]));
        next.baseSides={...base};next.auraBonus=bonus;
        for(const side of sides)next[side]=Math.max(0,base[side]+bonus);
      }
      return next;
    });
  }
  function placementOptions(board,card) {
    const power=ability(card);
    if(power==='mirror-focus')return sides.map(side=>({side}));
    if(power==='mirror-mimic') {
      const choices=board.map((other,copyCell)=>({other,copyCell})).filter(({other})=>other&&ability(other)&&ability(other)!=='mirror-mimic');
      return choices.length?choices.flatMap(({other,copyCell})=>ability(other)==='mirror-focus'?sides.map(side=>({copyCell,side})):[{copyCell}]):[{}];
    }
    return [{}];
  }
  function effectivePower(board,card,options={}) {
    return ability(card)==='mirror-mimic'&&Number.isInteger(options.copyCell)?ability(board[options.copyCell]):ability(card);
  }
  function canPlace(board,card,cell,options={}) { return Number.isInteger(cell)&&cell>=0&&cell<16&&(!board[cell]||effectivePower(board,card,options)==='mirror-replace'); }
  function play(board, card, cell, player, palette = colors, options = {}) {
    if (!canPlace(board,card,cell,options)) throw new Error('Choose a legal board space');
    let next = board.map(entry => entry ? {...entry} : null);
    let placed = {...card, ownerId: player, playedBy: player, color: palette[player]};
    if(ability(placed)==='mirror-mimic') {
      const source=board[options.copyCell];
      if(placementOptions(board,card).some(option=>Number.isInteger(option.copyCell))) {
        if(!source||!ability(source)||ability(source)==='mirror-mimic')throw new Error('Choose a special card to copy');
        placed.copiedAbility=ability(source);
      }
    }
    const power=ability(placed);
    if(power==='mirror-focus') {
      if(!sides.includes(options.side))throw new Error('Choose an attack side');
      for(const side of sides)if(side!==options.side)placed[side]=0;
      placed.attackSide=options.side;
    }
    next[cell]=placed;
    next=refreshAuras(next);placed=next[cell];
    const breaks = board.map((entry,index) => entry?.breakAfterOpponentOf && entry.breakAfterOpponentOf !== player ? index : -1).filter(index => index >= 0 && index!==cell);
    const penalties = [], defeated=[];
    const directions=power==='mirror-reach'?[
      [cell-8,'top','bottom',cell>=8],[cell+8,'bottom','top',cell<8],
      [cell-2,'left','right',cell%4>=2],[cell+2,'right','left',cell%4<=1]
    ].filter(entry=>entry[3]):neighbors(cell);
    for (const [index, attack, defend] of directions) {
      const other = next[index];
      if (!other || other.ownerId === player) continue;
      let comparison=Math.sign(placed[attack]-other[defend]);
      // One reversal flips a comparison; two reversals cancel each other.
      if((power==='mirror-reversal')!==(ability(other)==='mirror-reversal'))comparison=-comparison;
      const wins=(power!=='mirror-focus'||attack===placed.attackSide)&&(comparison>0 || (comparison===0&&power==='genius'&&ability(other)!=='genius'));
      const loses=comparison<0 || (comparison===0&&ability(other)==='genius'&&power!=='genius');
      if (wins) {
        defeated.push({...other});
        if (ability(other)==='low-pointer') penalties.push(placed);
        other.ownerId = player; other.color = palette[player];
        if (power==='fighter') other.breakAfterOpponentOf = player;
      } else if (loses && other.ownerId !== 'starter' && power!=='mini') {
        placed.ownerId = other.ownerId; placed.color = other.color;
        if (power==='low-pointer') penalties.push(other);
      }
    }
    if(power==='mirror-spoils'&&defeated.length) {
      defeated.sort((a,b)=>sides.reduce((sum,side)=>sum+Number(b[side])-Number(a[side]),0));
      for(const side of sides)placed[side]=defeated[0][side];
    }
    // Simultaneous comparisons: debuffs affect later turns, never neighbor order.
    for (const target of penalties) for (const side of sides) {
      target[side] = Math.max(0,target[side]-1);
      if(target.baseSides)target.baseSides={...target.baseSides,[side]:target.baseSides[side]-1};
    }
    if(!options.interrupt)for (const index of breaks) next[index] = null;
    return refreshAuras(next);
  }
  function legalMoves(board,hand,player) {
    const moves=[];
    hand.forEach((card,cardIndex)=>{
      for(const options of placementOptions(board,card))for(let cell=0;cell<16;cell++)if(canPlace(board,card,cell,options)) {
        moves.push({cardIndex,cell,options,board:play(board,card,cell,player,colors,options)});
      }
    });
    return moves;
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
    const opponent=player==='computer'?'player':'computer';
    return legalMoves(board,hand,player).map(move=>{
      const replies=legalMoves(move.board,opponentHand,opponent);
      const worst=replies.length?Math.min(...replies.map(reply=>hand.length===1&&opponentHand.length===1?score(reply.board,player)*100:evaluate(reply.board,player))):evaluate(move.board,player);
      return {cardIndex:move.cardIndex,cell:move.cell,options:move.options,value:worst+evaluate(move.board,player)*.01};
    }).sort((a,b)=>b.value-a.value);
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
    const other=player==='player'?'computer':'player';
    return legalMoves(board,hand,player).map(move=>{
      const remaining=hand.filter((_,index)=>index!==move.cardIndex);
      return {...move,remaining,value:positionValue(move.board,remaining,otherHand,player),other};
    }).sort((a,b)=>b.value-a.value);
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
      return {cardIndex:move.cardIndex,cell:move.cell,options:move.options,value,line};
    }).sort((a,b) => b.value-a.value);
  }
  function sameOptions(a={},b={}) { return a.side===b.side && a.copyCell===b.copyCell; }
  function moveAssessment(choices, cardIndex, cell, options={}) {
    const selected = choices.find(move => move.cardIndex === cardIndex && move.cell === cell && sameOptions(move.options,options));
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
    if (typeof difficulty === 'number' || ['adaptive-v2','adaptive-v3'].includes(difficulty?.policy)) {
      const level = Math.max(0, Math.min(1000, typeof difficulty === 'number' ? difficulty : difficulty.skill));
      // Keep the numeric policy unchanged for saved matches. The versioned policy
      // gives Bob more fallible decisions while improving continuously with skill.
      const gap = difficulty?.policy === 'adaptive-v3' ? 310 + 200 * (level / 1000) ** 3 : difficulty?.policy === 'adaptive-v2' ? 190 + 220 * (level / 1000) ** 3 : 0;
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
  function isSpecial(card) {
    return !!ability(card) || /\bmirror\b/i.test(String(card?.linkedCardImage || card?.tierName || card?.name || '').replace(/_/g,' '));
  }
  function validSpecials(cards) { return cards.filter(isSpecial).length <= 1; }
  // Side strength and abilities matter independently of the printed deck score.
  function cardPower(card) {
    const sides=['top','right','bottom','left'].map(side=>Number(card[side])||0).sort((a,b)=>b-a);
    return sides[0]*.35+sides[1]*.3+sides[2]*.2+sides[3]*.15+(isSpecial(card)?.65:0);
  }
  function rankedDeck(pool, inventory, player, random=Math.random) {
    const key=card=>card.battleCardId||card.id;
    const unique=cards=>[...new Map(cards.map(card=>[key(card),card])).values()];
    const owned=unique([...inventory,...player]);
    const ownedIds=new Set(owned.map(key));
    const total=cards=>cards.reduce((sum,card)=>sum+cardPower(card),0);
    const average=cards=>cards.reduce((sum,card)=>sum+Number(card.averageScore||0),0)/cards.length;
    const playerPower=total(player);
    const inventoryPower=total(owned)/owned.length*6;
    const targetPower=Math.min(playerPower,playerPower*.85+inventoryPower*.15)*(.98+random()*.04);
    const outside=unique(pool).filter(card=>!ownedIds.has(key(card)) && cardPower(card)<=Math.max(...player.map(cardPower))*1.05);
    const wanted=outside.length ? 1+Math.floor(random()*Math.min(2,outside.length)) : 0;
    let best=null,bestGap=Infinity;
    // Prefer 4-5 familiar cards. Back off only when the catalogue cannot form a legal deck.
    for(let external=wanted;external>=0;external--) {
      for(let attempt=0;attempt<500;attempt++) {
        const chosen=[];
        for(const [source,count] of [[outside,external],[owned,6-external]]) {
          const remaining=[...source];
          for(let i=0;i<count;i++) {
            const legal=remaining.filter(card=>!isSpecial(card)||!chosen.some(isSpecial));
            if(!legal.length)break;
            const card=legal[Math.floor(random()*legal.length)];chosen.push(card);remaining.splice(remaining.indexOf(card),1);
          }
        }
        if(chosen.length!==6)continue;
        const power=total(chosen);
        // A near-identical printed score must never hide a much stronger set of sides.
        if(power>playerPower*1.03+.1)continue;
        const gap=Math.abs(power-targetPower)+Math.abs(average(chosen)-average(player))*.015;
        if(gap<bestGap){best=chosen;bestGap=gap;}
      }
      if(best)break;
    }
    if(!best)best=[...player];
    return {deck:best.map(card=>({...card})),target:average(best),average:average(best),playerAverage:average(player)};
  }
  function startingPlayer(player, computer, random=Math.random) {
    const total = hand => hand.reduce((sum,card) => sum+Number(card.averageScore||0),0);
    const difference = total(player)-total(computer);
    return difference === 0 ? (random()<.5?'player':'computer') : difference>0?'player':'computer';
  }
  function trainingCards() { return [[8,3,5,4],[4,8,3,5],[5,4,8,3],[3,5,4,8],[6,6,4,4],[4,4,6,6]].map((sides,index)=>({id:`training-${index}`,battleCardId:`training-${index}`,name:`Training ${index+1}`,top:sides[0],right:sides[1],bottom:sides[2],left:sides[3],averageScore:5})); }
  const api = {sameOptions, refreshAuras, placementOptions, effectivePower, canPlace, legalMoves, MIRROR_POWERS, isMirror, starterCard, budgetBonus, isSpecial, validSpecials, cardPower, rankedDeck, ability, play, score, rankMoves, assessMoves, moveAssessment, startingPlayer, chooseMove, difficulties, seeded, computerDeck, trainingCards};
  if (typeof module !== 'undefined') module.exports = api; else root.PracticeEngine = api;
})(typeof self !== 'undefined' ? self : globalThis);
