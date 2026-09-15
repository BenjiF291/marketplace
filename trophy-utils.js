const engine = require('./public/practice-engine');
const PATH = [
 {at:25,footy:50,gems:{}}, {at:75,footy:100,gems:{bronze:5}}, {at:150,footy:150,gems:{'rare-bronze':5}},
 {at:250,footy:200,gems:{silver:5}}, {at:400,footy:300,gems:{'rare-silver':5}}, {at:600,footy:400,gems:{gold:5}},
 {at:850,footy:500,gems:{'rare-gold':5}}, {at:1150,footy:650,gems:{platinum:5}},
 {at:1500,footy:800,gems:{lightning:5}}, {at:2000,footy:1000,gems:{ultra:5}}
];
function replay(session, moves, detailed = false) {
 if(!Array.isArray(moves)||moves.length>6)throw new Error('Invalid battle replay');
 const game=structuredClone(session.initial);let index=0,computerTurn=0; const qualities=[];
 while(game.player.length||game.computer.length){
   if(game.turn==='player'){
     const move=moves[index++];if(!move||!Number.isInteger(move.cardIndex)||!game.player[move.cardIndex])throw new Error('Incomplete or invalid battle replay');
     if(session.mode==='skill') {
       const choices=engine.rankMoves(game.board,game.player,game.computer,'player');
       const selected=choices.find(choice=>choice.cardIndex===move.cardIndex&&choice.cell===move.cell);
       if(!selected)throw new Error('Invalid placement');
       // Forced/equivalent choices provide no evidence about decision quality.
       if(choices[0].value-choices.at(-1).value>1) qualities.push(Math.max(0,1-(choices[0].value-selected.value)/300));
     }
     game.board=engine.play(game.board,game.player[move.cardIndex],move.cell,'player');game.player.splice(move.cardIndex,1);
     game.turn=game.computer.length?'computer':'player';
   }else{
     const move=engine.chooseMove(game.board,game.computer,game.player,session.difficulty,engine.seeded(session.seed+computerTurn++));
     if(!move)throw new Error('Invalid computer turn');
     game.board=engine.play(game.board,game.computer[move.cardIndex],move.cell,'computer');game.computer.splice(move.cardIndex,1);
     game.turn=game.player.length?'player':'computer';
   }
 }
 if(index!==moves.length)throw new Error('Extra moves');
 const result=Math.sign(engine.score(game.board,'player'));
 return detailed?{result,quality:qualities.length?qualities.reduce((a,b)=>a+b,0)/qualities.length:null}:result;
}
function trophyUpdate(user,difficulty,result){
 const rule=engine.difficulties[difficulty];if(!rule)throw new Error('Invalid difficulty');
 const before=Number(user.trophies)||0,delta=result>0?rule.win:result<0?-rule.loss:0;
 const trophies=Math.max(0,before+delta);
 return {trophies,trophyPeak:Math.max(user.trophyPeak||0,trophies)};
}
module.exports={PATH,replay,trophyUpdate};
