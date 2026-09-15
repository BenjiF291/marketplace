// Reproducible varied-deck calibration; numeric policy models player decisions.
// Usage: node brawl-balance.cjs 300
const e=require('./public/practice-engine');
const count=Number(process.argv[2]||300);
if(!Number.isInteger(count)||count<1||count>10000)throw new Error('Choose 1 to 10000 games per skill level');
for(const skill of [100,300,600,900]){
 let wins=0,close=0,totalMargin=0;
 for(let seed=1;seed<=count;seed++){
  let board=Array(16).fill(null);board[5]={top:5,right:5,bottom:5,left:5,ownerId:'starter'};
  const player=e.trainingCards().map(c=>({...c,averageScore:50,top:c.top+45,right:c.right+45,bottom:c.bottom+45,left:c.left+45}));
  const pool=Array.from({length:7},(_,i)=>e.trainingCards().map(c=>({...c,id:`pool-${i}-${c.id}`,battleCardId:`pool-${i}-${c.id}`,averageScore:47+i,top:c.top+42+i,right:c.right+42+i,bottom:c.bottom+42+i,left:c.left+42+i}))).flat();
  const setupRandom=e.seeded(seed*18773);
  const generated=e.computerDeck(pool,player,'hard',setupRandom,true);
  const hands={player,computer:generated.deck};let side=e.startingPlayer(player,generated.deck,setupRandom),n=0;
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
