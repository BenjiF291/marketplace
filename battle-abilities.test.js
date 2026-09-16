const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('./public/practice-engine');
const card=(name,n,ownerId='computer')=>({name,top:n,right:n,bottom:n,left:n,ownerId});
test('special abilities recognize existing image filenames',()=>{
  for(const [file,power] of [['Low_naomi.png','low-pointer'],['Genious_ben.png','genius'],['zz3-Fighter_seb.png','fighter'],['Mini_truus.png','mini']])assert.equal(engine.ability({linkedCardImage:file}),power);
});
test('Fighter removes its captured neighbor only after the opponent turn, even if recaptured',()=>{
  const board=Array(16).fill(null);board[5]=card('Normal',2);
  const next=engine.play(board,card('Fighter',6),6,'player');
  assert.equal(next[5].ownerId,'player');assert.equal(board[5].ownerId,'computer');
  assert.throws(()=>engine.play(next,card('Normal',9),5,'computer'));
  const after=engine.play(next,card('Normal',9),1,'computer');assert.equal(after[5],null);
  assert.equal(engine.play(after,card('Normal',5),5,'player')[5].playedBy,'player');
});
test('Mini dodges all losing placement comparisons but can be captured later',()=>{
  const board=Array(16).fill(null);board[5]=card('Normal',8);board[7]=card('Normal',9);
  const next=engine.play(board,card('Mini',2),6,'player');assert.equal(next[6].ownerId,'player');
  assert.equal(engine.play(next,card('Normal',3),10,'computer')[6].ownerId,'computer');
});
test('Low Pointer debuffs every victor without negative stats or mutating the source',()=>{
  const board=Array(16).fill(null);board[5]=card('Normal',5);board[7]=card('Normal',6);
  const next=engine.play(board,card('Low pointer',1),6,'player');
  for(const side of ['top','right','bottom','left']){assert.equal(next[5][side],4);assert.equal(next[7][side],5);}
  assert.equal(board[5].top,5);
  const defended=Array(16).fill(null);defended[5]=card('Low pointer',0);
  const attacker={...card('Normal',0),left:1};const after=engine.play(defended,attacker,6,'player');
  assert.equal(after[6].left,0);assert.equal(after[6].top,0);
});
test('Genius wins ties on attack and defence; two geniuses draw',()=>{
  const board=Array(16).fill(null);board[5]=card('Normal',5);
  assert.equal(engine.play(board,card('Genious',5),6,'player')[5].ownerId,'player');
  board[5]=card('Genius',5);
  assert.equal(engine.play(board,card('Normal',5),6,'player')[6].ownerId,'computer');
  const draw=engine.play(board,card('Genius',5),6,'player');assert.equal(draw[5].ownerId,'computer');assert.equal(draw[6].ownerId,'player');
});
test('shared combat preserves custom PvP ownership colors',()=>{
  const board=Array(16).fill(null);board[5]=card('Normal',1,'user-b');
  const next=engine.play(board,card('Fighter',6),6,'user-a',{'user-a':'#123456','user-b':'#654321'});
  assert.equal(next[5].color,'#123456');assert.equal(next[6].playedBy,'user-a');
});
