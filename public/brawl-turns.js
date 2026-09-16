(function(root){
  const engine=typeof module!=='undefined'?require('./practice-engine'):root.PracticeEngine;
  function create(initial,difficulty,seed,now=Date.now()) {
    return {...structuredClone(initial),difficulty,seed,computerTurn:0,turnStartedAt:now,
      computerDueAt:now+3000+Math.floor(engine.seeded(seed)()*2001),interruptsUsed:{},events:[],finished:false};
  }
  function advance(source,action={},now=Date.now()) {
    const game=structuredClone(source);
    if(game.finished)return game;
    const elapsed=now-game.turnStartedAt;
    let actor,move,interrupt=false;
    if(action.type==='place'&&game.turn==='player'&&elapsed>=15000&&!game.interruptsUsed.computer&&game.computer.some(card=>engine.ability(card)==='mirror-interrupt'))return advance(game,{},now);
    if(action.type==='place') {
      if(action.revision!==game.events.length)throw new Error('The board changed. Choose your move again.');
      actor='player';move=action;
      const card=game.player[move.cardIndex];if(!card)throw new Error('Choose an available card');
      interrupt=game.turn!=='player';
      if(interrupt&&(elapsed<15000||game.interruptsUsed.player||engine.ability(card)!=='mirror-interrupt'))throw new Error('The interrupt is not available');
    }else if(game.turn==='computer'&&now>=game.computerDueAt) {
      actor='computer';move=engine.chooseMove(game.board,game.computer,game.player,game.difficulty,engine.seeded(game.seed+game.computerTurn));
    }else if(game.turn==='player'&&elapsed>=15000&&!game.interruptsUsed.computer) {
      const index=game.computer.findIndex(card=>engine.ability(card)==='mirror-interrupt');
      if(index>=0) {actor='computer';interrupt=true;const choice=engine.chooseMove(game.board,[game.computer[index]],game.player,game.difficulty,engine.seeded(game.seed+game.computerTurn));move=choice&&{...choice,cardIndex:index};}
    }
    if(!move)return game;
    const options={...(move.options||{}),interrupt};
    game.board=engine.play(game.board,game[actor][move.cardIndex],move.cell,actor,undefined,options);
    game[actor].splice(move.cardIndex,1);
    game.events.push({actor,cardIndex:move.cardIndex,cell:move.cell,options,interrupt});
    if(actor==='computer')game.computerTurn++;
    if(interrupt)game.interruptsUsed[actor]=true;
    else {
      const other=actor==='player'?'computer':'player';game.turn=game[other].length?other:actor;
      game.turnStartedAt=now;
      game.computerDueAt=now+3000+Math.floor(engine.seeded(game.seed+game.events.length*997)()*2001);
    }
    game.finished=!game.player.length&&!game.computer.length;
    return game;
  }
  const api={create,advance};if(typeof module!=='undefined')module.exports=api;else root.BrawlTurns=api;
})(typeof self!=='undefined'?self:globalThis);
