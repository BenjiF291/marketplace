// Synthetic calibration, not a promise of a human win rate. All sides use the real 0-10 range.
// Usage: node brawl-balance.cjs 100
const e=require('./public/practice-engine');
const count=Number(process.argv[2]||100);
if(!Number.isInteger(count)||count<1||count>10000)throw new Error('Choose 1 to 10000 games per scenario');
const make=(id,n,i=0)=>({id,battleCardId:id,name:id,averageScore:20,top:n,right:Math.max(0,n-2),bottom:Math.min(10,n+1),left:Math.max(0,n-1)});
const inventory=Array.from({length:12},(_,i)=>make(`owned-${i}`,3+Math.floor(i/3)));
const pool=[...inventory,...Array.from({length:30},(_,i)=>make(`outside-${i}`,2+i%9))];
for(const kind of ['weak','balanced','strong']){
 const selected=kind==='weak'?inventory.slice(0,6):kind==='strong'?inventory.slice(6):inventory.filter((_,i)=>i%2===0);
 const skill=535;let wins=0,draws=0,close=0,bobPower=0;
 for(let seed=1;seed<=count;seed++){
  let board=Array(16).fill(null);board[5]={top:5,right:5,bottom:5,left:5,ownerId:'starter'};
  const random=e.seeded(seed*18773),generated=e.rankedDeck(pool,inventory,selected,random);
  bobPower+=generated.deck.reduce((n,c)=>n+e.cardPower(c),0);
  const hands={player:[...selected],computer:generated.deck};let side=e.startingPlayer(hands.player,hands.computer,random),turn=0;
  while(hands.player.length||hands.computer.length){
   const other=side==='player'?'computer':'player';
   const view=side==='player'?board.map(c=>c?{...c,ownerId:c.ownerId==='player'?'computer':c.ownerId==='computer'?'player':c.ownerId,breakAfterOpponentOf:c.breakAfterOpponentOf==='player'?'computer':c.breakAfterOpponentOf==='computer'?'player':c.breakAfterOpponentOf}:null):board;
   const move=e.chooseMove(view,hands[side],hands[other],side==='player'?skill:{policy:'adaptive-v3',skill},e.seeded(seed*89239+turn++*713));
   board=e.play(board,hands[side][move.cardIndex],move.cell,side);hands[side].splice(move.cardIndex,1);side=hands[other].length?other:side;
  }
  const result=e.score(board,'player');if(result>0)wins++;if(result===0)draws++;if(Math.abs(result)<=3)close++;
 }
 console.log({kind,skill,games:count,wins,draws,close,playerPower:selected.reduce((n,c)=>n+e.cardPower(c),0),bobPower:bobPower/count});
}
