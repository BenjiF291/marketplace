const test=require('node:test'),assert=require('node:assert/strict');
const pressure=require('./brawl-deck-pressure'),engine=require('./public/practice-engine');
function play(data,result){return {deckPressure:pressure.settle(data,result)};}
test('three wins activate +5 and subsequent wins add exactly one point',()=>{
 let data={};
 for(const expected of [0,0,5,6,7,8]){data=play(data,1);assert.equal(pressure.matchmaking(data).deckBoost,expected);assert.equal(pressure.matchmaking(data).aiSkill,700);}
});
test('each loss subtracts three, and the third consecutive loss resets even a large boost',()=>{
 let data={deckPressure:{version:2,wins:20,losses:0,boost:22}};
 for(const expected of [19,16,0]){data=play(data,-1);assert.equal(pressure.matchmaking(data).deckBoost,expected);}
 assert.equal(data.deckPressure.losses,3);
});
test('a win breaks the loss streak and resumes a remaining boost; zero requires three wins',()=>{
 let data={deckPressure:{version:2,wins:5,losses:0,boost:7}};
 data=play(data,-1);data=play(data,1);assert.equal(data.deckPressure.boost,5);assert.equal(data.deckPressure.losses,0);
 data=play(play(data,-1),-1);assert.equal(data.deckPressure.boost,0);
 for(const expected of [0,0,5]){data=play(data,1);assert.equal(data.deckPressure.boost,expected);}
});
test('draws preserve the boost and break consecutive streaks; old percentage history resets',()=>{
 const data=play({deckPressure:{version:2,wins:4,losses:2,boost:9}},0);
 assert.deepEqual(data.deckPressure,{version:2,wins:0,losses:0,boost:9});
 assert.equal(pressure.matchmaking({deckPressure:{wins:50,gains:[{at:Date.now(),amount:1000}]}}).deckBoost,0);
});
test('deck target adds points rather than percentages and uses real stronger catalogue cards',()=>{
 const player=engine.trainingCards().map((c,i)=>({...c,id:'p'+i,battleCardId:'p'+i,averageScore:40}));
 const pool=Array.from({length:40},(_,i)=>({...player[i%6],id:'c'+i,battleCardId:'c'+i,averageScore:40+i/4}));
 const original=structuredClone(pool);
 const match=engine.rankedDeck(pool,player,player,engine.seeded(1),5);
 assert.equal(match.target,45);assert.ok(Math.abs(match.average-45)<.2);
 assert.equal(new Set(match.deck.map(c=>c.id)).size,6);assert.ok(engine.validSpecials(match.deck));
 assert.deepEqual(pool,original);assert.ok(match.deck.every(c=>[...pool,...player].some(p=>p.id===c.id&&p.top===c.top)));
 const capped=engine.rankedDeck(pool,player,player,engine.seeded(1),100);
 assert.equal(capped.target,140);assert.ok(capped.average<=49.75);
});
