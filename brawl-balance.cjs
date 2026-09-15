// Reproducible starter-deck calibration; numeric policy models player decisions.
// Usage: node brawl-balance.cjs 300
const e=require('./public/practice-engine');
const count=Number(process.argv[2]||300);
if(!Number.isInteger(count)||count<1||count>10000)throw new Error('Choose 1 to 10000 games per skill level');
for(const skill of [100,300,600,900]){
 let wins=0,close=0,totalMargin=0;
 for(let seed=1;seed<=count;seed++){
  let board=Array(16).fill(null);board[5]={top:5,right:5,bottom:5,left:5,ownerId:'starter'};
  const hands={player:e.trainingCards(),computer:e.trainingCards()};let side=seed%2?'player':'computer',n=0;
  while(hands.player.length||hands.computer.length){
   const other=side==='player'?'computer':'player';const view=side==='player'?board.map(c=>c?{...c,ownerId:c.ownerId==='player'?'computer':c.ownerId==='computer'?'player':c.ownerId}:null):board;
   const rng=e.seeded(seed*89239+n++*713);
   const move=side==='player'?e.chooseMove(view,hands[side],hands[other],skill,rng):e.chooseMove(board,hands[side],hands[other],{policy:'adaptive-v2',skill},rng);
   board=e.play(board,hands[side][move.cardIndex],move.cell,side);hands[side].splice(move.cardIndex,1);side=hands[other].length?other:side;
  }
  const score=e.score(board,'player');if(score>0)wins++;if(Math.abs(score)<=3)close++;totalMargin+=Math.abs(score);
 }
 console.log({skill,wins,count,close,meanMargin:totalMargin/count});
}
