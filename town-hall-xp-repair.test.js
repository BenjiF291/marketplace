const test=require('node:test'),assert=require('node:assert/strict');
const {repair}=require('./town-hall-xp-repair'),hall=require('./town-hall-progress');
test('tutorial rebalance repair preserves every original Town Hall level and applies once',()=>{
 const old=[0,1000,4000,8000,14000,22000,34000,50000,70000,100000];
 for(let i=0;i<10;i++){
 const u={townHallXP:old[i],townHallRetainedLevel:i+1,townHallProgressVersion:3,townHallXPResetVersion:1};
 const fixed={...u,...repair(u)};assert.equal(hall.profile(fixed).level,i+1);assert.equal(hall.profile(fixed).progress,0);assert.deepEqual(repair(fixed),{});
 }
});
test('repair keeps relative earned progress, respects genuine old-curve level ups, and ignores new accounts',()=>{
 const u={townHallXP:5500,townHallRetainedLevel:2,townHallXPResetVersion:1};
 const fixed=repair(u);assert.equal(fixed.townHallRetainedLevel,3);assert.equal(fixed.townHallXP,2125);
 assert.deepEqual(repair({townHallXP:200}),{});assert.ok(!('gems' in fixed));assert.ok(!('rubyItems' in fixed));
});
