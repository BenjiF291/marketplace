const test=require('node:test');
const assert=require('node:assert/strict');
const e=require('./public/practice-engine');
const card=(sides,ownerId)=>({top:sides[0],right:sides[1],bottom:sides[2],left:sides[3],ownerId});
const board=rows=>rows.map(row=>row?card(row.slice(1),row[0]?'player':'computer'):null);

test('defending a field and retaining a strong card beats the immediate capture',()=>{
  const b=board([[1,7,10,8,7],null,[0,1,6,1,5],null,[0,4,9,6,6],[0,8,7,9,1],null,[1,4,5,5,3],null,null,[0,5,8,1,1],[1,2,8,5,4],[1,9,2,5,1],[0,2,6,9,8],[1,5,5,1,5],null]);
  const hand=[card([5,4,1,1]),card([9,8,1,4])],opponent=[card([8,3,1,10])];
  const choices=e.assessMoves(b,hand,opponent);
  const defensive=choices.find(m=>m.cardIndex===0&&m.cell===15);
  const greedy=choices.find(m=>m.cardIndex===1&&m.cell===8);
  assert.ok(e.score(e.play(b,hand[0],15,'player'),'player')<e.score(e.play(b,hand[1],8,'player'),'player'));
  assert.ok(defensive.value>greedy.value);
  assert.equal(e.moveAssessment(choices,0,15).quality,1);
  assert.ok(e.moveAssessment(choices,1,8).quality<1);
});

test('an exposed card receives full credit when the retained card can recapture it',()=>{
  const b=board([[0,10,9,5,4],[1,5,2,8,6],[0,7,7,3,5],null,null,[1,4,4,7,10],[0,2,8,9,3],[0,1,1,4,5],null,[0,1,2,7,1],[0,4,9,10,8],null,null,null,[1,8,9,10,7],[1,7,4,10,9]]);
  const hand=[card([6,3,7,7]),card([5,8,1,3])],opponent=[card([5,1,2,3])];
  const before=structuredClone({b,hand,opponent});
  const choices=e.assessMoves(b,hand,opponent),assessment=e.moveAssessment(choices,1,8);
  assert.equal(assessment.quality,1);
  const placed=e.play(b,hand[1],8,'player');
  const reply=e.play(placed,opponent[0],assessment.line.reply.cell,'computer');
  assert.equal(reply[8].ownerId,'computer');
  const recovered=e.play(reply,hand[0],assessment.line.followup.cell,'player');
  assert.equal(recovered[8].ownerId,'player');
  assert.ok(e.score(recovered,'player')>0);
  assert.deepEqual({b,hand,opponent},before);
});

test('near-equivalent choices are not penalized and invalid placements are rejected',()=>{
  const choices=[{cardIndex:0,cell:0,value:100},{cardIndex:0,cell:1,value:80},{cardIndex:0,cell:2,value:-100}];
  assert.equal(e.moveAssessment(choices,0,1).quality,1);
  assert.equal(e.moveAssessment(choices.slice(0,2),0,1).quality,null);
  assert.throws(()=>e.moveAssessment(choices,0,3));
});

test('higher total score starts; equal decks use a coin toss',()=>{
  assert.equal(e.startingPlayer([{averageScore:6}],[{averageScore:5}]),'player');
  assert.equal(e.startingPlayer([{averageScore:4}],[{averageScore:5}]),'computer');
  assert.equal(e.startingPlayer([{averageScore:5}],[{averageScore:5}],()=>.25),'player');
  assert.equal(e.startingPlayer([{averageScore:5}],[{averageScore:5}],()=>.75),'computer');
});

test('ranked deck generation targets a modest variation on either side of player strength',()=>{
  const player=Array.from({length:6},(_,i)=>({id:`p${i}`,averageScore:50}));
  const pool=Array.from({length:99},(_,i)=>Array.from({length:6},(_,j)=>({id:`c${i}-${j}`,averageScore:i+1}))).flat();
  const lower=e.computerDeck(pool,player,'hard',()=>.25,true);
  const higher=e.computerDeck(pool,player,'hard',()=>.75,true);
  assert.ok(lower.average<50);assert.ok(higher.average>50);
  assert.ok(Math.abs(lower.average-50)<=1);assert.ok(Math.abs(higher.average-50)<=1);
});
