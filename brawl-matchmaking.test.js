const test=require('node:test');
const assert=require('node:assert/strict');
const e=require('./public/practice-engine');
test('Bob uses 4-5 owned cards and 1-2 outsiders without hidden high-stat advantages',()=>{
 const owned=e.trainingCards();
 const pool=[...owned,...owned.map((c,i)=>({...c,id:`outside-${i}`,battleCardId:`outside-${i}`})),
 ...owned.map((c,i)=>({...c,id:`overpowered-${i}`,battleCardId:`overpowered-${i}`,averageScore:0,top:10,right:10,bottom:10,left:10}))];
 for(let seed=1;seed<=40;seed++){
  const result=e.rankedDeck(pool,owned,owned,e.seeded(seed));
  assert.equal(new Set(result.deck.map(c=>c.id)).size,6);
  assert.ok([1,2].includes(result.deck.filter(c=>c.id.startsWith('outside-')).length));
  assert.ok(!result.deck.some(c=>c.id.startsWith('overpowered-')));
  assert.ok(result.deck.reduce((n,c)=>n+e.cardPower(c),0)<=owned.reduce((n,c)=>n+e.cardPower(c),0)*1.03+.1);
 }
});
test('one special includes Mirror; Bob also obeys it when the catalogue is mostly specials',()=>{
 const player=e.trainingCards();player[0].linkedCardImage='Fighter_seb.png';
 const pool=Array.from({length:10},(_,i)=>({...player[1],id:`mirror-${i}`,battleCardId:`mirror-${i}`,linkedCardImage:'Mirror_ben.png'}));
 assert.equal(e.validSpecials([player[0],pool[0]]),false);
 const deck=e.rankedDeck(pool,player,player,e.seeded(7)).deck;
 assert.equal(deck.length,6);assert.equal(deck.filter(e.isSpecial).length,1);
 assert.equal(deck.filter(c=>c.id.startsWith('mirror-')).length,1);
});
test('small catalogues fall back safely without inventing or duplicating cards',()=>{
 const player=e.trainingCards(),deck=e.rankedDeck([],player,player,e.seeded(3)).deck;
 assert.equal(new Set(deck.map(c=>c.id)).size,6);assert.ok(deck.every(c=>player.some(p=>p.id===c.id)));
});
