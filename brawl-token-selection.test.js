const test=require('node:test'),assert=require('node:assert/strict'),selection=require('./brawl-token-selection'),rules=require('./free-pack'),S=require('./creature-brawl-service');
test('ownership and use bonuses are small, per variant, bounded and do not stack with duplicate ownership',()=>{
 const user={stableAnimals:{'rill-species':3},rubyItems:{'pet:dragon':1},creatureBrawl:{usageCounts:{'rill-species':20,rill:2,dragon:999}}};
 assert.equal(selection.weight('rill-species',user),120);assert.equal(selection.weight('rill',user),101);assert.equal(selection.weight('dragon',user),120);assert.equal(selection.weight('tharos',user),100);assert.equal(selection.weight('rill-species',{...user,stableAnimals:{'rill-species':100}}),120);
});
test('weighted draws give exactly the intended modest share to owned frequently played creatures',()=>{
 const user={stableAnimals:{'rill-species':1},creatureBrawl:{usageCounts:{'rill-species':20}}},counts={};for(let roll=0;roll<220;roll++){const kind=selection.choose(['rill-species','rill'],user,n=>{assert.equal(n,220);return roll});counts[kind]=(counts[kind]||0)+1;}assert.deepEqual(counts,{'rill-species':120,rill:100});
});
test('preference only affects the creature inside a selected rarity reward, not its card odds or amount',()=>{
 const config={cards:[{title:'Test',options:[{kind:'brawlToken',id:'rarity:common',min:4,max:4,chance:20},{kind:'footy',id:'',min:7,max:7,chance:80}]}]},catalog={brawlToken:[{id:'rarity:common',members:['rill-species','rill']}]},user={stableAnimals:{'rill-species':1}};
 assert.equal(rules.draw(config,n=>n===1000000?200000:0,catalog,user)[0].kind,'footy');const reward=rules.draw(config,()=>0,catalog,user)[0];assert.equal(reward.id,'rill-species');assert.equal(reward.amount,4);
});
test('usage counts each player variant once per completed ranked battle and survives duplicate settlement',()=>{
 for(const [practice,reason,counted] of [[false,'elimination',true],[false,'draw',true],[true,'elimination',false],[false,'abandoned',false]]){
  const user={},b={rating:0,tokens:{}},match={id:'test',practice,stage:0,state:{phase:'FINISHED',winner:0,reason,units:[{kind:'veyrin',team:0},{kind:'veyrin',team:0},{kind:'tharos',team:1}]}};
  S.settle(user,b,match,Date.now());assert.equal(b.usageCounts?.veyrin,counted?1:undefined);assert.equal(b.usageCounts?.tharos,undefined);S.settle(user,b,match,Date.now());assert.equal(b.usageCounts?.veyrin,counted?1:undefined);
 }
});
