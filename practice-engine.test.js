const test = require('node:test');
const assert = require('node:assert/strict');
const {play, score, chooseMove} = require('./public/practice-engine');
const card = (name, value, ownerId) => ({name,top:value,right:value,bottom:value,left:value,ownerId,color:ownerId==='player'?'#2878d0':'#db6454'});
test('captures stronger adjacent sides, loses weaker placed cards, and never mutates input', () => {
 const board=Array(16).fill(null);board[5]=card('Enemy',4,'player');
 const next=play(board,card('Strong',8),6,'computer');
 assert.equal(next[5].ownerId,'computer'); assert.equal(board[5].ownerId,'player');
 assert.equal(play(board,card('Weak',2),6,'computer')[6].ownerId,'player');
 assert.throws(()=>play(board,card('Strong',8),5,'computer'));
});
test('computer chooses a capturing placement rather than a random empty cell', () => {
 const board=Array(16).fill(null);board[5]=card('Enemy',1,'player');
 const move=chooseMove(board,[card('Strong',8)],[]);
 assert.ok([1,4,6,9].includes(move.cell));
 assert.equal(score(play(board,card('Strong',8),move.cell,'computer'),'computer'),2);
});
test('computer avoids sacrificing a weak card beside an unbeatable opponent', () => {
 const board=Array(16).fill(null);board[5]=card('Enemy',10,'player');
 const move=chooseMove(board,[card('Weak',1)],[card('Reply',2)]);
 assert.ok(![1,4,6,9].includes(move.cell));
});
test('full mirrored-deck game makes twelve legal moves without reusing cards', () => {
 let board=Array(16).fill(null);board[5]=card('Starter',5,'starter');
 const hands={computer:[2,3,4,5,6,7].map((v,i)=>card(`C${i}`,v)),player:[2,3,4,5,6,7].map((v,i)=>card(`P${i}`,v))};
 for(let turn=0;turn<12;turn++) {
  const who=turn%2?'player':'computer';const other=who==='player'?'computer':'player';
  const view=who==='computer'?board:board.map(c=>c?{...c,ownerId:c.ownerId==='player'?'computer':c.ownerId==='computer'?'player':c.ownerId}:null);
  const move=chooseMove(view,hands[who],hands[other]);assert.ok(move);assert.equal(board[move.cell],null);
  board=play(board,hands[who][move.cardIndex],move.cell,who);hands[who].splice(move.cardIndex,1);
 }
 assert.equal(board.filter(Boolean).length,13);assert.equal(hands.player.length+hands.computer.length,0);
});
