const test=require('node:test'),assert=require('node:assert/strict');
const e=require('./public/practice-engine'),turns=require('./public/brawl-turns');
const card=(n=5,name='Normal',power)=>({id:name,name,top:n,right:n,bottom:n,left:n,averageScore:n,...(power?{linkedCardImage:'Mirror_test.png',mirrorPower:power}:{})});
const enemy=(n=5,name='Normal',power)=>({...card(n,name,power),ownerId:'computer'});
const blank=()=>Array(16).fill(null);
test('starter is a real randomized card near the average and has no neutral special triggers',()=>{
 const pool=[card(1,'Weak'),card(5,'Near A'),card(5,'Near B','reversal'),card(10,'Strong')];
 const a=e.starterCard(pool,[card(5)],()=>0),b=e.starterCard(pool,[card(5)],()=>.99);
 assert.equal(a.name,'Near A');assert.equal(b.name,'Near B');assert.equal(e.ability(b),'');assert.equal(b.ownerId,'starter');
});
test('family bonus updates when neighbors are replaced without compounding or mutating input',()=>{
 const board=blank();board[5]=enemy(2,'Olivia Liesker');board[7]={...enemy(2,'Ben'),familyName:'Heeren'};
 const after=e.play(board,card(3,'Kin','kinship'),6,'player');assert.equal(after[6].top,5);
 const replaced=e.play(after,card(1,'Replace','replace'),5,'computer');assert.equal(replaced[6].top,4);assert.equal(after[6].top,5);
});
test('spoils copies strongest defeated sides after all comparisons, not printed score',()=>{
 const board=blank();board[5]=enemy(2);board[7]={...enemy(3),top:8};
 const after=e.play(board,card(6,'Copy','spoils'),6,'player');assert.equal(after[6].top,8);assert.equal(after[6].left,3);assert.equal(after[5].ownerId,'player');
});
test('focused strike preserves chosen teeth, zeros others and still defends their zero edges',()=>{
 const board=blank();board[5]=enemy(2);board[2]=enemy(1);
 assert.throws(()=>e.play(board,card(7,'Focus','focus'),6,'player'),/attack side/);
 const after=e.play(board,card(7,'Focus','focus'),6,'player',undefined,{side:'left'});
 assert.equal(after[5].ownerId,'player');assert.equal(after[6].left,7);assert.equal(after[6].top,0);assert.equal(after[6].ownerId,'computer');
});
test('reach skips neighbors on placement, does not wrap rows, and defends normally later',()=>{
 const board=blank();board[5]=enemy(9);board[4]=enemy(2);board[8]=enemy(1);
 const after=e.play(board,card(5,'Reach','reach'),6,'player');assert.equal(after[4].ownerId,'player');assert.equal(after[5].ownerId,'computer');assert.equal(after[6].ownerId,'player');assert.equal(after[8].ownerId,'computer');
 assert.equal(e.play(after,card(8),7,'computer')[6].ownerId,'computer');
});
test('budget adds exactly 15 total and replacement removes any occupied card',()=>{
 assert.equal(e.budgetBonus([card(2,'Budget','budget')]),15);assert.equal(e.budgetBonus([card()]),0);
 const board=blank();board[5]=enemy(9);assert.equal(e.play(board,card(1,'Replace','replace'),5,'player')[5].name,'Replace');assert.equal(board[5].name,'Normal');
});
test('reversal swaps both non-draw outcomes; two reversals cancel',()=>{
 const board=blank();board[5]=enemy(8);
 assert.equal(e.play(board,card(2,'Reverse','reversal'),6,'player')[5].ownerId,'player');
 assert.equal(e.play(board,card(9,'Reverse','reversal'),6,'player')[6].ownerId,'computer');
 board[5]=enemy(8,'Reverse','reversal');assert.equal(e.play(board,card(2,'Reverse','reversal'),6,'player')[6].ownerId,'computer');
});
test('mimic uses a chosen on-board special and rejects unavailable targets',()=>{
 const board=blank();board[0]=enemy(5,'Genious');board[5]=enemy(5);
 const after=e.play(board,card(5,'Mimic','mimic'),6,'player',undefined,{copyCell:0});assert.equal(after[5].ownerId,'player');assert.equal(e.ability(after[6]),'genius');
 assert.throws(()=>e.play(board,card(5,'Mimic','mimic'),6,'player',undefined,{copyCell:5}),/special/);
 const empty=e.play(blank(),card(5,'Mimic','mimic'),6,'player');assert.equal(e.ability(empty[6]),'mirror-mimic');
});
test('AI explores chosen sides and replacement spaces with replayable options',()=>{
 const board=blank();board[5]=enemy(9);
 const moves=e.rankMoves(board,[card(2,'Replace','replace')],[],'player');assert.ok(moves.some(m=>m.cell===5));
 const focus=e.rankMoves(blank(),[card(5,'Focus','focus')],[],'player');assert.equal(focus.length,64);assert.ok(focus.every(m=>m.options.side));
});
test('15-second interrupt is once-only, preserves the interrupted turn, and rejects forged timing/revisions',()=>{
 let game=turns.create({board:blank(),player:[card(5,'Impatient','interrupt'),card()],computer:[card()],turn:'computer'},'hard',1,1000);
 assert.throws(()=>turns.advance(game,{type:'place',cardIndex:0,cell:0,revision:0},15999),/not available/);
 game=turns.advance(game,{type:'place',cardIndex:0,cell:0,revision:0},16000);assert.equal(game.turn,'computer');assert.equal(game.turnStartedAt,1000);assert.equal(game.interruptsUsed.player,true);
 assert.throws(()=>turns.advance(game,{type:'place',cardIndex:0,cell:1,revision:1},17000),/not available/);
 game=turns.advance(game,{},17000);assert.equal(game.turn,'player');assert.equal(game.player.length,1);assert.equal(game.computer.length,0);
 assert.throws(()=>turns.advance(game,{type:'place',cardIndex:0,cell:2,revision:0},18000),/board changed/);
});
test('Bob interrupts a slow player before accepting their late move',()=>{
 const initial={board:blank(),player:[card()],computer:[card(5,'Impatient','interrupt'),card()],turn:'player'};
 const game=turns.create(initial,'hard',1,0);
 assert.equal(turns.advance(game,{},14999).events.length,0);
 const next=turns.advance(game,{type:'place',cardIndex:0,cell:0,revision:0},15000);
 assert.equal(next.events[0].actor,'computer');assert.equal(next.events[0].interrupt,true);assert.equal(next.turn,'player');assert.equal(next.player.length,1);
});
