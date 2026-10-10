const test=require('node:test'),assert=require('node:assert/strict'),hall=require('./town-hall-progress');
test('private XP clamps, crosses thresholds and never inherits a shared level',()=>{assert.equal(hall.profile({}).level,1);assert.equal(hall.profile({townHallXP:-10}).xp,0);assert.equal(hall.profile({townHallXP:100}).level,2);assert.equal(hall.profile({townHallXP:999999}).level,10);assert.equal(hall.profile({level:10}).level,1);});
test('gameplay rewards continue across days and unknown activities grant nothing',()=>{const now=Date.UTC(2026,8,26);let u={isAdmin:true};for(let i=0;i<10;i++)u={...u,...hall.gameplay(u,'ranked win',now)};assert.equal(u.townHallXP,100);assert.deepEqual(hall.gameplay(u,'training',now),{});u={...u,...hall.gameplay(u,'pack',now+86400000)};assert.equal(u.townHallXP,105);assert.equal(hall.gameplay({isAdmin:false},'pack').townHallXP,5);});
test('direct resource-for-XP projects are retired',()=>{assert.deepEqual(hall.PROJECTS,[]);assert.throws(()=>hall.project({gems:{bronze:100}},'stonework'),/retired/);});

test('gameplay has no daily cap including accounts already at the old cap',()=>{const now=Date.UTC(2026,9,1);let u={townHallXP:100,townHallGameplayDay:'2026-10-01',townHallGameplayXP:100};for(let i=0;i<20;i++)u={...u,...hall.gameplay(u,'ranked win',now)};assert.equal(u.townHallXP,300);});

test('XP reset starts everyone at their existing level without changing unlocks and cannot run twice',()=>{
 for(const u of [{townHallXP:100},{townHallXP:50,townHallProgressVersion:3,townHallRetainedLevel:7},{townHallXP:17500,townHallProgressVersion:3},{townHallXP:999999}]){
  const before=hall.profile(u),update=hall.resetToLevelStart(u),after=hall.profile({...u,...update});
  assert.equal(after.level,before.level);assert.equal(after.progress,0);assert.equal(after.xp,hall.THRESHOLDS[before.level-1]);
  assert.deepEqual(hall.resetToLevelStart({...u,...update}),{});
  assert.ok(!('balance' in update));assert.ok(!('advancements' in update));
 }
});

test('tutorial Town Hall ends at 200 XP and subsequent levels use shifted thresholds',()=>{
 assert.deepEqual(hall.THRESHOLDS,[0,200,1000,4000,8000,14000,22000,34000,50000,70000]);
 for(let i=1;i<hall.THRESHOLDS.length;i++){
  const xp=hall.THRESHOLDS[i];
  assert.equal(hall.profile({townHallXP:xp-1,townHallProgressVersion:3}).level,i);
  const at=hall.profile({townHallXP:xp,townHallProgressVersion:3});
  assert.equal(at.level,i+1);assert.equal(at.progress,0);
 }
});
