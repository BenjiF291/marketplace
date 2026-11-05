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

test('daily-visit Town Hall curve uses exact cumulative threshold boundaries',()=>{
 assert.deepEqual(hall.THRESHOLDS,[0,100,450,1100,2400,4800,8000,12000,16600,22000]);
 for(let i=1;i<hall.THRESHOLDS.length;i++){
  const xp=hall.THRESHOLDS[i];
  assert.equal(hall.profile({townHallXP:xp-1,townHallProgressVersion:3}).level,i);
  const at=hall.profile({townHallXP:xp,townHallProgressVersion:3});
  assert.equal(at.level,i+1);assert.equal(at.progress,0);
 }
});

test('lower thresholds preserve earned XP and never reduce an existing level or balance',()=>{
 const previous=[0,200,1000,4000,8000,14000,22000,34000,50000,70000];
 for(const xp of [0,50,100,199,200,999,4000,14000,22000,34000,50000,70000,99999]){
  const u={townHallXP:xp,townHallProgressVersion:3,balance:123,gems:{bronze:456}},before=structuredClone(u),p=hall.profile(u);let oldLevel=1;while(oldLevel<10&&xp>=previous[oldLevel])oldLevel++;
  assert.equal(p.xp,xp);assert.ok(p.level>=oldLevel);assert.deepEqual(u,before);
  const next=hall.grant(u,5,'pack');assert.ok(next.townHallXP>=xp);assert.equal(next.townHallXP,xp>=hall.MAX_XP?xp:Math.min(hall.MAX_XP,xp+5));
 }
 assert.equal(hall.profile({townHallXP:4800,townHallProgressVersion:3}).level,6);
 assert.equal(hall.profile({townHallXP:50,townHallProgressVersion:3,townHallRetainedLevel:7}).level,7);
});
test('daily-login target reaches TH6 in about 45 days and later levels slow gradually',()=>{
 const income=[53,79,85,111,134,146,166,166,166],days=hall.THRESHOLDS.slice(1).map((xp,i)=>Math.ceil((xp-hall.THRESHOLDS[i])/income[i]));
 assert.equal(days.slice(0,5).reduce((a,b)=>a+b,0),45);assert.deepEqual(days.slice(5),[22,25,28,33]);
});
