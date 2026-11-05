const test=require('node:test'),assert=require('node:assert/strict'),economy=require('./village-economy'),bank=require('./time-bank');
const now=1000000,minute=60000;
const user=()=>({townHallXP:8000,townHallProgressVersion:3,gems:{bronze:1000,gold:5},villageLayout:{'house:0':0,'house:1':2},villageHouseTiers:{'house:0':3,'house:1':3}});
const apply=(u,body,time=now)=>Object.assign(u,economy.action(u,body,time));
test('mine upgrades unlock at exactly Town Hall 7, cost 600 rubies per mine and require Town Hall 9 for the next upgrade',()=>{
 const u=user(),before=structuredClone(u);assert.throws(()=>apply({...u,townHallXP:7999},{action:'upgrade-mine',mine:0}),/level 7/);assert.throws(()=>apply({...u,gems:{bronze:599}},{action:'upgrade-mine',mine:0}),/600/);assert.deepEqual(u,before);
 apply(u,{action:'upgrade-mine',mine:0});assert.deepEqual(u.gems,{bronze:400,gold:5});const p=economy.profile(u,now);assert.equal(p.mines[0].limit,25);assert.equal(p.mines[0].requiredWorkers,12);assert.equal(p.mines[0].upgrade.level,9);assert.equal(p.mines[1].limit,20);assert.equal(p.mines[1].requiredWorkers,3);
 const saved=structuredClone(u);assert.throws(()=>apply(u,{action:'upgrade-mine',mine:0}),/level 9/);assert.deepEqual(u,saved);
 for(const mine of [-1,4,99,'0'])assert.throws(()=>apply(u,{action:'upgrade-mine',mine}),/not unlocked/);
});
test('upgraded shifts require 12 distinct available villagers and last 125 minutes',()=>{
 const u=user();apply(u,{action:'upgrade-mine',mine:0});assert.throws(()=>apply({...u,villageLayout:{'house:0':0}},{action:'start-mine',mine:0}),/12 available/);
 apply(u,{action:'start-mine',mine:0});assert.equal(new Set(u.rubyMineShifts[0].workers).size,12);assert.equal(u.rubyMineShifts[0].tier,1);
 let p=economy.profile(u,now+100*minute);assert.equal(p.mines[0].claimable,20);assert.equal(p.mines[0].active,true);assert.equal(p.workforce.busy.length,12);
 p=economy.profile(u,now+124*minute);assert.equal(p.mines[0].claimable,24);assert.equal(p.workforce.busy.length,12);
 p=economy.profile(u,now+125*minute);assert.equal(p.mines[0].claimable,25);assert.equal(p.mines[0].active,false);assert.equal(p.workforce.busy.length,0);
 apply(u,{action:'collect-mine',mine:0},now+500*minute);assert.equal(u.gems.bronze,425);assert.throws(()=>apply(u,{action:'collect-mine',mine:0},now+500*minute),/No rubies/);
});
test('upgrading requires recall and completed legacy shifts retain their old payout',()=>{
 const u=user();apply(u,{action:'start-mine',mine:0});assert.throws(()=>apply(u,{action:'upgrade-mine',mine:0}),/Call back/);
 apply(u,{action:'upgrade-mine',mine:0},now+100*minute);assert.equal(economy.profile(u,now+100*minute).mines[0].claimable,20);
 apply(u,{action:'start-mine',mine:0},now+100*minute);assert.equal(u.gems.bronze,420);assert.equal(u.rubyMineShifts[0].workers.length,12);assert.equal(economy.profile(u,now+225*minute).mines[0].claimable,25);
});
test('boosts advance upgraded mine timers and recall collects only the earned output',()=>{
 const u=user();u.timeBoosts={leap:2};apply(u,{action:'upgrade-mine',mine:0});apply(u,{action:'start-mine',mine:0});
 assert.equal(bank.targets(u,now).find(t=>t.id==='mine/0').remaining,125*minute);
 apply(u,{action:'time-use',target:'mine/0',token:'leap',count:2});let p=economy.profile(u,now);assert.equal(p.mines[0].claimable,24);assert.equal(p.mines[0].active,true);assert.equal(p.workforce.busy.length,12);assert.equal(bank.targets(u,now).find(t=>t.id==='mine/0').remaining,5*minute);
 apply(u,{action:'recall-mine',mine:0});assert.equal(u.gems.bronze,424);assert.equal(economy.profile(u,now).workforce.busy.length,0);
});

test('mine level 3 unlocks at TH9, costs 800 and requires the previous upgrade',()=>{
 const u={...user(),townHallXP:16599,gems:{bronze:2000},rubyMineTiers:{0:1}};
 assert.throws(()=>apply(u,{action:'upgrade-mine',mine:0}),/level 9/);u.townHallXP=16600;
 assert.throws(()=>apply({...u,gems:{bronze:799}},{action:'upgrade-mine',mine:0}),/800 rubies/);
 apply(u,{action:'upgrade-mine',mine:0});assert.equal(u.gems.bronze,1200);assert.equal(u.rubyMineTiers[0],2);const mine=economy.profile(u,now).mines[0];assert.equal(mine.limit,35);assert.equal(mine.requiredWorkers,15);assert.equal(mine.upgrade,null);
 const saved=structuredClone(u);assert.throws(()=>apply(u,{action:'upgrade-mine',mine:0}),/fully upgraded/);assert.deepEqual(u,saved);
 const fresh={...user(),townHallXP:16600,gems:{bronze:2000}};apply(fresh,{action:'upgrade-mine',mine:0});assert.equal(fresh.rubyMineTiers[0],1);assert.equal(fresh.gems.bronze,1400);
});
test('level 3 keeps 15 workers reserved for 175 minutes and caps payout at 35',()=>{
 const u={...user(),townHallXP:16600,rubyMineTiers:{0:2}};
 assert.throws(()=>apply({...u,villageLayout:{'house:0':0}},{action:'start-mine',mine:0}),/15 available/);
 apply(u,{action:'start-mine',mine:0});assert.equal(new Set(u.rubyMineShifts[0].workers).size,15);
 for(const elapsed of [100,125,174]){const p=economy.profile(u,now+elapsed*minute);assert.equal(p.mines[0].active,true);assert.equal(p.workforce.busy.length,15);assert.equal(p.mines[0].claimable,Math.floor(elapsed/5));}
 const p=economy.profile(u,now+175*minute);assert.equal(p.mines[0].claimable,35);assert.equal(p.workforce.busy.length,0);apply(u,{action:'collect-mine',mine:0},now+500*minute);assert.equal(u.gems.bronze,1035);assert.throws(()=>apply(u,{action:'collect-mine',mine:0},now+500*minute),/No rubies/);
});
test('level 3 boost timers finish correctly and level 2 completed shifts retain 25-ruby capacity',()=>{
 const u={...user(),townHallXP:16600,gems:{bronze:2000},rubyMineTiers:{0:1},timeBoosts:{leap:3}};apply(u,{action:'start-mine',mine:0});assert.throws(()=>apply(u,{action:'upgrade-mine',mine:0}),/Call back/);
 apply(u,{action:'upgrade-mine',mine:0},now+125*minute);assert.equal(economy.profile(u,now+125*minute).mines[0].claimable,25);apply(u,{action:'start-mine',mine:0},now+125*minute);assert.equal(u.gems.bronze,1225);
 assert.equal(bank.targets(u,now+125*minute).find(t=>t.id==='mine/0').remaining,175*minute);apply(u,{action:'time-use',target:'mine/0',token:'leap',count:3},now+125*minute);const p=economy.profile(u,now+125*minute);assert.equal(p.mines[0].claimable,35);assert.equal(p.mines[0].active,false);assert.equal(p.workforce.busy.length,0);
});
