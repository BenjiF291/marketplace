const test=require('node:test'),assert=require('node:assert/strict'),catalog=require('./public/creature-brawl-catalog');
let locomotion,planTravel,sampleTravel;
test.before(async()=>{({locomotion,planTravel,sampleTravel}=await import('./public/creature-brawl-locomotion.js'));});
test('every real creature has an appropriate approach and return gait',()=>{assert.deepEqual(Object.keys(locomotion).sort(),catalog.creatures.map(c=>c.id).sort());assert.equal(locomotion.fox.mode,'sprint');assert.equal(locomotion.snail.mode,'crawl');assert.equal(locomotion.kanji.mode,'sprint');for(const kind of ['dragon','fenra','fenra-species'])assert.equal(locomotion[kind].mode,'flight');});
test('movement accelerates, lifts visibly, lands and finishes at the exact destination',()=>{
 for(const kind of Object.keys(locomotion))for(const distance of [.2,4,15]){const plan=planTravel(kind,distance,2),frames=Array.from({length:101},(_,i)=>sampleTravel(plan,i/100));assert.equal(frames[0].along,0);assert.equal(frames.at(-1).along,1);assert.ok(Math.abs(frames[0].lift)<1e-8&&Math.abs(frames.at(-1).lift)<1e-8,kind+' landing');assert.ok(frames.every((f,i)=>Object.values(f).every(Number.isFinite)&&f.lift>=0&&(!i||f.along>=frames[i-1].along-1e-8)));assert.ok(Math.max(...frames.map(f=>f.lift))>(plan.mode==='flight'?.06:.001),kind+' visible lift');assert.ok(plan.duration>=440&&plan.duration<=(['rill','rill-species','defender-rill'].includes(kind)?1700:1100));assert.ok(frames[5].along<.01,'plant feet before takeoff');}
});
test('ground creatures stay planted while flyers sustain altitude between takeoff and landing',()=>{
 for(const kind of ['kanji','krynn','veyrin','tharos','brugar','brugar-species','trusk']){
  const plan=planTravel(kind,5,2);assert.equal(plan.mode,'sprint');
  for(let i=0;i<=100;i++)assert.ok(sampleTravel(plan,i/100).lift<=.02,kind+' must not hop');
 }
 for(const kind of ['dragon','rill','fenra']){const plan=planTravel(kind,5,2);for(const t of [.25,.5,.75])assert.ok(sampleTravel(plan,t).lift>=plan.height*plan.lift*.99);}
});
