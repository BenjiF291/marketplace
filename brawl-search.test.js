const test=require('node:test');
const assert=require('node:assert/strict');
const e=require('./public/practice-engine');
const card=(s,ownerId)=>({top:s[0],right:s[1],bottom:s[2],left:s[3],...(ownerId?{ownerId}:{})});
const board=[
 [0,6,9,7,7],[1,0,10,5,5],null,null,null,[0,9,7,10,1],null,[1,4,8,9,1],
 [1,10,0,0,3],[0,1,7,10,6],[0,6,0,10,9],[1,8,7,1,3],
 [1,6,6,9,4],[0,4,3,1,10],[1,9,1,9,0],[0,1,2,7,5]
].map(row=>row?card(row.slice(1),row[0]?'player':'computer'):null);
const hand=[card([10,1,1,1]),card([5,6,5,6])],opponent=[card([0,8,0,2]),card([7,9,6,2])];
function exact(b,mine,theirs,turn){
 if(!mine.length&&!theirs.length)return e.score(b,'computer')*100;
 const own=turn==='computer',active=own?mine:theirs,waiting=own?theirs:mine;
 if(!active.length)return exact(b,mine,theirs,own?'player':'computer');
 const values=e.legalMoves(b,active,turn).map(move=>{
  const rest=active.filter((_,i)=>i!==move.cardIndex);
  return exact(move.board,own?rest:mine,own?theirs:rest,own?'player':'computer');
 });
 return own?Math.max(...values):Math.min(...values);
}
test('four-ply search avoids a losing capture against uneven-sided stones',()=>{
 const before=structuredClone({board,hand,opponent});
 const choices=e.searchMoves(board,hand,opponent,'computer',{depth:4,nodes:30000});
 for(const move of choices){
  assert.equal(move.depth,4);
  const next=e.play(board,hand[move.cardIndex],move.cell,'computer',undefined,move.options);
  assert.equal(move.value,exact(next,hand.filter((_,i)=>i!==move.cardIndex),opponent,'player'));
 }
 const greedy=e.rankMoves(board,hand,opponent)[0];
 assert.ok(e.score(e.play(board,hand[greedy.cardIndex],greedy.cell,'computer'),'computer')>e.score(e.play(board,hand[choices[0].cardIndex],choices[0].cell,'computer'),'computer'));
 assert.equal(choices.find(m=>m.cardIndex===greedy.cardIndex&&m.cell===greedy.cell).value,-200);
 assert.equal(choices[0].value,0);
 const ai=e.chooseMove(board,hand,opponent,{policy:'adaptive-v4',skill:1200},e.seeded(8));
 assert.equal(ai.value,0);
 assert.deepEqual(ai,e.chooseMove(board,hand,opponent,{policy:'adaptive-v4',skill:1200},e.seeded(8)));
 assert.deepEqual({board,hand,opponent},before);
});
test('search budgets keep all root choices at the same completed depth',()=>{
 const moves=e.searchMoves(board,hand,opponent,'computer',{depth:5,nodes:1});
 assert.equal(moves.length,e.legalMoves(board,hand,'computer').length);
 assert.ok(moves.every(m=>m.depth===1&&Number.isFinite(m.value)));
});
test('search uses real replacement and reversal abilities without mutating hands',()=>{
 const mine=[{...card([2,3,2,3]),name:'Mirror',mirrorPower:'replace'}];
 const theirs=[{...card([8,7,8,7]),name:'Mirror',mirrorPower:'reversal'}];
 const choices=e.searchMoves(board,mine,theirs,'computer',{depth:2,nodes:30000});
 assert.equal(choices.length,16);
 for(const move of choices){const next=e.play(board,mine[0],move.cell,'computer',undefined,move.options);assert.equal(move.value,exact(next,[],theirs,'player'));}
});
