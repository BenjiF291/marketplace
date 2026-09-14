const test=require('node:test');const assert=require('node:assert/strict');
const engine=require('./public/practice-engine');const {PATH,replay,trophyUpdate}=require('./trophy-utils');
const make=(id,averageScore)=>({id,name:id,averageScore,top:5,right:4,bottom:6,left:5});
test('randomized decks target difficulty average and use six distinct catalog cards',()=>{
 const player=Array.from({length:6},(_,i)=>make(`p${i}`,70));
 const pool=Array.from({length:91},(_,score)=>Array.from({length:6},(_,i)=>make(`${score}-${i}`,score))).flat();
 for(const [difficulty,target] of [['easy',50],['medium',60],['hard',70]]){
  const result=engine.computerDeck(pool,player,difficulty,engine.seeded(123));
  assert.equal(result.target,target);assert.ok(Math.abs(result.average-target)<1);
  assert.equal(new Set(result.deck.map(c=>c.id)).size,6);
 }
 const first=engine.computerDeck(pool,player,'hard',engine.seeded(1)).deck.map(c=>c.id);
 const second=engine.computerDeck(pool,player,'hard',engine.seeded(2)).deck.map(c=>c.id);
 assert.notDeepEqual(first,second);
});
test('win, loss and draw trophy amounts are correct; trophies floor at zero and peak never falls',()=>{
 for(const [difficulty,win,loss] of [['easy',10,5],['medium',25,10],['hard',40,15]]){
  assert.equal(trophyUpdate({trophies:100},difficulty,1).trophies,100+win);
  assert.equal(trophyUpdate({trophies:100,trophyPeak:200},difficulty,-1).trophies,100-loss);
  assert.equal(trophyUpdate({trophies:100,trophyPeak:200},difficulty,-1).trophyPeak,200);
  assert.equal(trophyUpdate({trophies:2},difficulty,-1).trophies,0);
  assert.equal(trophyUpdate({trophies:100},difficulty,0).trophies,100);
 }
 assert.equal(new Set(PATH.map(p=>p.at)).size,PATH.length);
});
test('server replay reproduces complete deterministic computer match and rejects incomplete replay',()=>{
 const initial={board:Array(16).fill(null),player:engine.trainingCards(),computer:engine.trainingCards(),turn:'player'};
 initial.board[5]={...make('starter',5),ownerId:'starter'};
 const game=structuredClone(initial),moves=[];let turn=0;
 while(game.player.length||game.computer.length){
  if(game.turn==='player'){
   const cell=game.board.findIndex(c=>!c);moves.push({cardIndex:0,cell});
   game.board=engine.play(game.board,game.player.shift(),cell,'player');game.turn=game.computer.length?'computer':'player';
  }else{
   const move=engine.chooseMove(game.board,game.computer,game.player,'medium',engine.seeded(987+turn++));
   game.board=engine.play(game.board,game.computer[move.cardIndex],move.cell,'computer');game.computer.splice(move.cardIndex,1);game.turn=game.player.length?'player':'computer';
  }
 }
 const session={initial,seed:987,difficulty:'medium'};
 assert.equal(replay(session,moves),Math.sign(engine.score(game.board,'player')));
 assert.throws(()=>replay(session,moves.slice(1)));
 assert.throws(()=>replay(session,[{cardIndex:99,cell:0}]));
});
