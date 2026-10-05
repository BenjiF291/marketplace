const test = require('node:test');
const assert = require('node:assert/strict');
const { workshopAction, DYE_AREAS } = require('./gem-workshop-utils');
const tiers = ['Bronze', 'Rare Bronze', 'Silver', 'Rare Silver', 'Gold', 'Rare Gold', 'Platinum', 'Lightning', 'Ultra', 'Special'].map((name, i) => ({ name, id: String(i) }));
test('refinery starts at Ruby and upgrades with five new gems and ten of every lower tier',()=>{
 let user={gems:Object.fromEntries(tiers.map(t=>[require('./gem-utils').gemIdentity(t).gemKey,200]))};
 const {refineryProgress}=require('./gem-workshop-utils');assert.equal(refineryProgress(user,tiers).level,0);
 assert.throws(()=>workshopAction(user,tiers,'compress',{gemKey:'bronze',quantity:1}),/Upgrade/);
 for(let level=1;level<tiers.length;level++){const next=refineryProgress(user,tiers).nextUpgrade,old={...user.gems};assert.equal(next.costs.length,level+1);const update=workshopAction(user,tiers,'upgrade',{tierId:next.tierId});assert.equal(update.gemRefineryLevel,level);for(let i=0;i<=level;i++){const key=require('./gem-utils').gemIdentity(tiers[i]).gemKey;assert.equal(update.gems[key],old[key]-(i===level?5:10));}user={...user,...update};assert.throws(()=>workshopAction(user,tiers,'upgrade',{tierId:next.tierId}),/no longer/);}
 assert.equal(refineryProgress(user,tiers).nextUpgrade,null);assert.throws(()=>workshopAction({gems:{bronze:10,'rare-bronze':4}},tiers,'upgrade',{tierId:'1'}),/5 Garnet/);assert.throws(()=>workshopAction(user,tiers,'craft',{}),/no longer/);
});
test('a refinery upgrade only unlocks the new output, not later gems',()=>{const u={gemRefineryLevel:1,gems:{bronze:10,'rare-bronze':8}};assert.equal(workshopAction(u,tiers,'compress',{gemKey:'bronze',quantity:2}).gems['rare-bronze'],10);assert.throws(()=>workshopAction(u,tiers,'compress',{gemKey:'rare-bronze',quantity:1}),/Upgrade/);});

test('legacy all-tier machines retain recipes, refinement spends 5 per output and follows next configured tier', () => {
  const user = { gemCompressor: true, gems: { bronze: 11, 'rare-bronze': 1, ultra: 5 } };
  const result = workshopAction(user, tiers, 'compress', { gemKey: 'bronze', quantity: 2 });
  assert.equal(result.gems.bronze, 1); assert.equal(result.gems['rare-bronze'], 3);
  assert.equal(workshopAction(user, tiers, 'compress', { gemKey: 'ultra', quantity: 1 }).gems['tier-9'], 1);
  for (const quantity of [0, -1, 1.5, 3, Number.MAX_SAFE_INTEGER]) assert.throws(() => workshopAction(user, tiers, 'compress', { gemKey: 'bronze', quantity }));
  assert.throws(() => workshopAction({ ...user, gemCompressor: false }, tiers, 'compress', { gemKey: 'bronze', quantity: 1 }));
  assert.throws(() => workshopAction(user, tiers, 'compress', { gemKey: 'tier-9', quantity: 1 }));
});
test('one gem crafts five consumable dyes; each application spends one and reset is free', () => {
  const crafted = workshopAction({ gems: { bronze: 2 } }, tiers, 'craft-dye', { gemKey: 'bronze' });
  assert.equal(crafted.gems.bronze, 1); assert.equal(crafted.gemDyes.bronze, 5);
  let user = crafted;
  for (let i = 0; i < 5; i++) user = { ...user, ...workshopAction(user, tiers, 'dye', { area: 'all', gemKey: 'bronze' }) };
  assert.equal(user.gemDyes.bronze, 0);
  assert.equal(Object.keys(user.gemTheme).length, Object.keys(DYE_AREAS).length);
  assert.throws(() => workshopAction(user, tiers, 'dye', { area: 'buttons', gemKey: 'bronze' }));
  assert.equal(user.gemTheme.buttons, 'bronze');
  const reset = workshopAction(user, tiers, 'dye', { area: 'all', gemKey: '' });
  assert.deepEqual(reset.gemTheme, {}); assert.equal(reset.gemDyes.bronze, 0);
  const recrafted = workshopAction(user, tiers, 'craft-dye', { gemKey: 'bronze' });
  assert.equal(recrafted.gemDyes.bronze, 5); assert.equal(recrafted.gems.bronze, 0);
  assert.throws(() => workshopAction(recrafted, tiers, 'craft-dye', { gemKey: 'bronze' }));
  assert.throws(() => workshopAction(crafted, tiers, 'dye', { area: 'cards', gemKey: 'bronze' }));
  assert.equal(crafted.gemDyes.bronze, 5);
});
test('legacy permanent dyes become five uses once without changing applied colors', () => {
  const { dyeInventory } = require('./gem-workshop-utils');
  const user = { gemDyes: ['bronze'], gemTheme: { header: 'bronze' } };
  assert.equal(dyeInventory(user).bronze, 5);
  const update = workshopAction(user, tiers, 'dye', { area: 'buttons', gemKey: 'bronze' });
  assert.equal(update.gemDyes.bronze, 4);
  assert.equal(update.gemTheme.header, 'bronze');
  assert.equal(dyeInventory(update).bronze, 4);
});
test('special gems have stable distinct colors', () => {
  const { color } = require('./public/gem-colors');
  const keys = ['tier-special', 'tier-mythic', 'tier-cosmic', 'tier-legendary'];
  assert.equal(new Set(keys.map(color)).size, keys.length);
  assert.equal(color(keys[0]), color(keys[0]));
  assert.equal(color('bronze'), '#ef4266');
});

test('batch confirmation charges final changed areas only and replay does not charge twice', () => {
  const user = { gemDyes: { bronze: 3, gold: 1 }, gemTheme: { header: 'bronze' } };
  const body = { originalTheme: user.gemTheme, changes: { header: 'bronze', buttons: 'bronze', background: 'gold' } };
  const update = workshopAction(user, tiers, 'confirm-dyes', body);
  assert.deepEqual(update.gemDyes, { bronze: 2, gold: 0 });
  assert.equal(update.gemTheme.buttons, 'bronze');
  assert.deepEqual(workshopAction(update, tiers, 'confirm-dyes', body), update);
  assert.equal(user.gemDyes.gold, 1);
});
test('batch rejects insufficient dyes, invalid areas and conflicting saved changes atomically', () => {
  const user = { gemDyes: { bronze: 1 }, gemTheme: { header: 'gold' } };
  assert.throws(() => workshopAction(user, tiers, 'confirm-dyes', { changes: { buttons: 'bronze', background: 'bronze' } }));
  assert.throws(() => workshopAction(user, tiers, 'confirm-dyes', { changes: { cards: 'bronze' } }));
  assert.throws(() => workshopAction(user, tiers, 'confirm-dyes', { originalTheme: {}, changes: { header: 'bronze' } }));
  assert.deepEqual(user, { gemDyes: { bronze: 1 }, gemTheme: { header: 'gold' } });
  const reset = workshopAction(user, tiers, 'confirm-dyes', { originalTheme: user.gemTheme, changes: { header: '' } });
  assert.deepEqual(reset.gemTheme, {}); assert.equal(reset.gemDyes.bronze, 1);
});

test('one final upgrade unlocks every tier after Ultra and charges five of each special',()=>{const all=[...tiers,{name:'Mini',id:'mini'},{name:'Mirror',id:'mirror'}],{refineryProgress}=require('./gem-workshop-utils'),{gemIdentity}=require('./gem-utils');let u={gemRefineryLevel:8,gems:Object.fromEntries(all.map(t=>[gemIdentity(t).gemKey,20]))};const p=refineryProgress(u,all);assert.equal(p.max,9);assert.equal(p.nextUpgrade.gemName,'All special crystals');assert.deepEqual(p.nextUpgrade.costs.map(c=>c.amount),[10,10,10,10,10,10,10,10,10,5,5,5]);u={...u,...workshopAction(u,all,'upgrade',{tierId:'9'})};assert.equal(refineryProgress(u,all).nextUpgrade,null);assert.equal(refineryProgress(u,all).unlockedIndex,11);assert.equal(refineryProgress({...u,gemRefineryLevel:11},all).level,9);assert.equal(workshopAction(u,all,'compress',{gemKey:'tier-mini',quantity:1}).gems['tier-mirror'],16);assert.throws(()=>workshopAction({gemRefineryLevel:1,gems:{bronze:4}},all,'compress',{gemKey:'bronze',quantity:1}),/Not enough/);});
