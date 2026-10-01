const test=require('node:test'),assert=require('node:assert/strict'),economy=require('./village-economy'),hall=require('./town-hall-progress');
const now=Date.UTC(2026,9,1),minute=60000;
const user=()=>({townHallXP:650,gems:{bronze:200},balance:0,villageLayout:{'house:0':0,'house:1':2},rubyItems:{'pet:fox':1,food:1}});
const apply=(u,b,t=now)=>Object.assign(u,economy.action(u,b,t));
test('mining XP follows new output, including partial recall and automatic restart collection',()=>{
 let u=user();apply(u,{action:'start-mine'});assert.equal(u.townHallXP,650);
 apply(u,{action:'collect-mine',mine:0},now+5*minute);assert.equal(u.townHallXP,651);
 assert.throws(()=>apply(u,{action:'collect-mine',mine:0},now+5*minute),/No rubies/);
 apply(u,{action:'recall-mine',mine:0},now+12*minute);assert.equal(u.townHallXP,652);
 u=user();apply(u,{action:'start-mine'});apply(u,{action:'recall-mine',mine:0},now+minute);assert.equal(u.townHallXP,650);
 apply(u,{action:'start-mine'},now+minute);apply(u,{action:'start-mine',mine:0},now+101*minute);assert.equal(u.townHallXP,670);
});
test('farm XP is per ingredient, independent of collection frequency and resource interval',()=>{
 for(const resource of ['water','carrot','corn','milk','meat']){
  const interval=require('./pet-care').RESOURCES[resource].minutes*minute;
  const a={...user(),farmLevel:3},b={...user(),farmLevel:3};
  for(const u of [a,b])apply(u,{action:'farm-start',resource});
  apply(a,{action:'farm-collect',resource},now+interval);assert.equal(a.townHallXP,651);
  apply(a,{action:'farm-collect',resource},now+interval);assert.equal(a.townHallXP,651);
  apply(a,{action:'farm-recall',resource},now+interval*3);
  apply(b,{action:'farm-collect',resource},now+interval*3);
  assert.equal(a.townHallXP,653);assert.equal(b.townHallXP,653);
  assert.throws(()=>apply(b,{action:'farm-collect',resource},now+interval*3),/not found/);
 }
});
test('cooking, care and upgrades award XP only after successful actions',()=>{
 const u={...user(),farmIngredients:{water:1,carrot:1}};
 apply(u,{action:'farm-cook',food:'food'});assert.equal(u.townHallXP,652);
 assert.throws(()=>apply(u,{action:'farm-cook',food:'food'}),/need/);assert.equal(u.townHallXP,652);
 apply(u,{action:'station-send',pet:'pet:fox'});assert.equal(u.townHallXP,652);
 apply(u,{action:'pet-feed',pet:'pet:fox',food:'food'});apply(u,{action:'pet-play',pet:'pet:fox'});assert.equal(u.townHallXP,654);
 apply(u,{action:'farm-upgrade',level:1});assert.equal(u.townHallXP,659);
 apply(u,{action:'upgrade-house',house:'house:0',revision:0});assert.equal(u.townHallXP,664);
});
test('vault wages earn two XP per Footy and empty recalls earn none',()=>{
 const u=user();apply(u,{action:'vault-start'});assert.equal(u.townHallXP,650);
 apply(u,{action:'vault-recall'},now+minute);assert.equal(u.townHallXP,650);
 apply(u,{action:'vault-start'},now+minute);apply(u,{action:'vault-collect'},now+241*minute);assert.equal(u.townHallXP,654);
 assert.throws(()=>apply(u,{action:'vault-collect'},now+241*minute),/No Footy/);
});
test('batch rewards respect shared daily and maximum XP caps without withholding output',()=>{
 const u={...user(),townHallGameplayDay:'2026-10-01',townHallGameplayXP:99};
 apply(u,{action:'start-mine'});apply(u,{action:'collect-mine',mine:0},now+100*minute);
 assert.equal(u.townHallXP,651);assert.equal(u.gems.bronze,220);assert.equal(u.townHallGameplayXP,100);
 assert.equal(hall.gameplay({townHallXP:8499},'ruby mining',now,20).townHallXP,8500);
 assert.deepEqual(hall.gameplay(u,'ruby mining',now,20),{});
 assert.equal(hall.gameplay(u,'ruby mining',now+86400000,20).townHallXP,671);
});
