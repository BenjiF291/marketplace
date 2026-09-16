const engine = require('./public/practice-engine');
const PATH = [
 {at:25,footy:50,gems:{}}, {at:75,footy:100,gems:{bronze:5}}, {at:150,footy:150,gems:{'rare-bronze':5}},
 {at:250,footy:200,gems:{silver:5}}, {at:400,footy:300,gems:{'rare-silver':5}}, {at:600,footy:400,gems:{gold:5}},
 {at:850,footy:500,gems:{'rare-gold':5}}, {at:1150,footy:650,gems:{platinum:5}},
 {at:1500,footy:800,gems:{lightning:5}}, {at:2000,footy:1000,gems:{ultra:5}}
];
function replay(session, moves, detailed = false) {
 if(session.live) {
   if(!session.live.finished)throw new Error('The timed battle is not finished');
   const game=structuredClone(session.initial),qualities=[],moveReviews=[];
   for(const event of session.live.events) {
     if(event.actor==='player') {
       const choices=engine.assessMoves(game.board,game.player,game.computer,'player');
       const assessment=engine.moveAssessment(choices,event.cardIndex,event.cell,event.options);
       if(assessment.quality!==null)qualities.push(assessment.quality);
       moveReviews.push({turn:moveReviews.length+1,card:game.player[event.cardIndex].name,cell:event.cell,quality:assessment.quality===null?null:Math.round(assessment.quality*100),regret:Math.round(assessment.regret),bestCard:game.player[assessment.best.cardIndex].name,bestCell:assessment.best.cell,reply:null,followup:null});
     }
     game.board=engine.play(game.board,game[event.actor][event.cardIndex],event.cell,event.actor,undefined,event.options);game[event.actor].splice(event.cardIndex,1);
   }
   if(game.player.length||game.computer.length)throw new Error('Incomplete timed battle');
   const result=Math.sign(engine.score(game.board,'player'));
   return detailed?{result,quality:qualities.length?qualities.reduce((sum,n)=>sum+n,0)/qualities.length:null,moveReviews}:result;
 }

 if(!Array.isArray(moves)||moves.length>6)throw new Error('Invalid battle replay');
 const game=structuredClone(session.initial);let index=0,computerTurn=0; const qualities=[],moveReviews=[];
 while(game.player.length||game.computer.length){
   if(game.turn==='player'){
     const move=moves[index++];if(!move||move.options?.interrupt||!Number.isInteger(move.cardIndex)||!game.player[move.cardIndex])throw new Error('Incomplete or invalid battle replay');
     if(session.mode==='skill') {
       const strategic=session.assessmentVersion===2;
       const choices=strategic?engine.assessMoves(game.board,game.player,game.computer,'player'):engine.rankMoves(game.board,game.player,game.computer,'player');
       const selected=choices.find(choice=>choice.cardIndex===move.cardIndex&&choice.cell===move.cell&&engine.sameOptions(choice.options,move.options));
       if(!selected)throw new Error('Invalid placement');
       const assessment=strategic?engine.moveAssessment(choices,move.cardIndex,move.cell,move.options):{
         quality:choices[0].value-choices.at(-1).value>1?Math.max(0,1-(choices[0].value-selected.value)/300):null,
         regret:choices[0].value-selected.value,best:choices[0],line:null};
       if(assessment.quality!==null)qualities.push(assessment.quality);
       const remaining=game.player.filter((_,i)=>i!==move.cardIndex);
       moveReviews.push({turn:index,card:game.player[move.cardIndex].name,cell:move.cell,
         quality:assessment.quality===null?null:Math.round(assessment.quality*100),
         regret:Math.round(assessment.regret),bestCard:game.player[assessment.best.cardIndex].name,bestCell:assessment.best.cell,
         reply:assessment.line?{card:game.computer[assessment.line.reply.cardIndex].name,cell:assessment.line.reply.cell}:null,
         followup:assessment.line?.followup?{card:remaining[assessment.line.followup.cardIndex].name,cell:assessment.line.followup.cell}:null});
     }
     game.board=engine.play(game.board,game.player[move.cardIndex],move.cell,'player',undefined,move.options);game.player.splice(move.cardIndex,1);
     game.turn=game.computer.length?'computer':'player';
   }else{
     const move=engine.chooseMove(game.board,game.computer,game.player,session.difficulty,engine.seeded(session.seed+computerTurn++));
     if(!move)throw new Error('Invalid computer turn');
     game.board=engine.play(game.board,game.computer[move.cardIndex],move.cell,'computer',undefined,move.options);game.computer.splice(move.cardIndex,1);
     game.turn=game.player.length?'player':'computer';
   }
 }
 if(index!==moves.length)throw new Error('Extra moves');
 const result=Math.sign(engine.score(game.board,'player'));
 return detailed?{result,quality:qualities.length?qualities.reduce((a,b)=>a+b,0)/qualities.length:null,moveReviews}:result;
}
function trophyUpdate(user,difficulty,result){
 const rule=engine.difficulties[difficulty];if(!rule)throw new Error('Invalid difficulty');
 const before=Number(user.trophies)||0,delta=result>0?rule.win:result<0?-rule.loss:0;
 const trophies=Math.max(0,before+delta);
 return {trophies,trophyPeak:Math.max(user.trophyPeak||0,trophies)};
}
module.exports={PATH,replay,trophyUpdate};
