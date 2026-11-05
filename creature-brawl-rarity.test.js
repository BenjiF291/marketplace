const test=require('node:test'),assert=require('node:assert/strict'),S=require('./creature-brawl-service');
const ranks=['common','rare','epic','legendary','unique'];
test('every creature combines class stats, modest rarity bonuses and grade scaling; speed stays class based',()=>{
 for(const c of S.catalog.creatures)for(const [rank,rarity] of ranks.entries()){
  const entries={[c.id]:{rarity}},unit=S.unit({kind:c.id,id:'test',grade:2},2,entries);
  for(const key of ['hp','atk','def']){const base=Math.round(c.base[key]*(1+.04*rank));assert.equal(unit.stats[key],Math.round(base*1.08));assert.equal(unit.nextStats[key],Math.round(base*1.16));}
  assert.equal(unit.stats.spd,c.base.spd);assert.equal(unit.stats.specialPower,c.base.specialPower);
 }
});
test('arena rosters follow increasing rarity bands and retain the rarity advantage',()=>{
 const entries=Object.fromEntries(S.catalog.creatures.map((c,i)=>[c.id,{rarity:ranks[Math.floor(i/4)]}])),team=S.catalog.creatures.slice(0,3).map(c=>S.unit({kind:c.id,id:c.id,grade:3},3,entries));
 for(let stage=0;stage<5;stage++)for(let sequence=0;sequence<20;sequence++){
  const enemy=S.opponent(team,'balanced',stage,sequence,entries);assert.equal(new Set(enemy.map(u=>u.kind)).size,3);enemy.forEach((u,i)=>assert.ok(Math.abs(ranks.indexOf(u.rarity)-[Math.max(0,stage-1),stage,stage][i])<=1));
  for(const u of enemy)assert.deepEqual(u.stats,S.unit({kind:u.kind,id:u.id,grade:3},3,entries).stats);
 }
});
test('sparse rarity tiers fall back to closest available creatures without duplicates',()=>{
 const entries=Object.fromEntries(S.catalog.creatures.map(c=>[c.id,{rarity:'rare'}])),team=S.catalog.creatures.slice(0,3).map(c=>S.unit({kind:c.id,id:c.id,grade:1}));
 for(const stage of [0,4]){const enemy=S.opponent(team,'balanced',stage,1,entries);assert.equal(new Set(enemy.map(u=>u.kind)).size,3);assert.ok(enemy.every(u=>u.rarity==='rare'));}
});

test('Arena 1 varies its lineups and prefers common creatures without requiring three commons',()=>{
 const entries=Object.fromEntries(S.catalog.creatures.map((c,i)=>[c.id,{rarity:ranks[Math.floor(i/4)]}]));
 const team=S.catalog.creatures.slice(0,3).map(c=>S.unit({kind:c.id,id:c.id,grade:1}));
 const lineups=new Set();let common=0;
 for(let n=0;n<200;n++){
  const enemy=S.opponent(team,'balanced',0,n,entries);
  lineups.add(enemy.map(u=>u.kind).sort().join(','));
  for(const u of enemy){assert.ok(['common','rare'].includes(u.rarity));if(u.rarity==='common')common++;}
 }
 assert.ok(lineups.size>10);assert.ok(common>400);
});
