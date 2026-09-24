const test = require('node:test');
const assert = require('node:assert/strict');
const { catalog, effects, changeAmulets, LOCK_MS, SLOT_PRICES } = require('./amulet-utils');
const tiers = ['Bronze', 'Rare Bronze', 'Silver', 'Rare Silver', 'Gold', 'Rare Gold', 'Platinum', 'Lightning', 'Ultra'].map((name, index) => ({ id: String(index), name }));
const entries = catalog(tiers);
const entry = entries[0];
test('five curated amulets per tier with unique designs and preserved trophy exclusives', () => {
 assert.equal(entries.length,49);assert.equal(new Set(entries.map(e=>e.id)).size,49);
 for(const tier of tiers)assert.equal(entries.filter(e=>e.tierId===tier.id).length,5);
 assert.equal(new Set(entries.filter(e=>!e.exclusive).map(e=>JSON.stringify([e.bonuses,e.condition]))).size,45);
 assert.equal(entries.filter(e=>e.exclusive).length,4);
});

test('shop charges matching gems, rejects insufficient and wrong-tier gems', () => {
  assert.throws(() => changeAmulets({ gems: { gold: 1000 } }, 'buy', { amuletId: entry.id }, entries));
  const user = { gems: { bronze: entry.price, gold: 30 } };
  const update = changeAmulets(user, 'buy', { amuletId: entry.id }, entries);
  assert.equal(update.gems.bronze, 0); assert.equal(update.gems.gold, 30);
  assert.equal(update.amulets[entry.id], 1); assert.equal(user.gems.bronze, entry.price);
});
test('slots unlock in order for exact prices and reject duplicate/stale unlocks', () => {
  let user = { balance: 1700 };
  assert.deepEqual(SLOT_PRICES, [0, 50, 150, 500, 1000]);
  for (let count = 1; count < 5; count++) {
    const update = changeAmulets(user, 'unlock', { expectedCount: count }, entries);
    assert.equal(user.balance - update.balance, SLOT_PRICES[count]); user = { ...user, ...update };
    assert.throws(() => changeAmulets(user, 'unlock', { expectedCount: count }, entries));
  }
  assert.equal(user.balance, 0);
  assert.throws(() => changeAmulets(user, 'unlock', { expectedCount: 5 }, entries));
});
test('equip requires ownership and an empty unlocked slot; no duplicate copy reuse', () => {
  const user = { amulets: { [entry.id]: 1 } };
  assert.throws(() => changeAmulets(user, 'equip', { slot: 1, amuletId: entry.id }, entries));
  const update = changeAmulets(user, 'equip', { slot: 0, amuletId: entry.id }, entries, 100);
  assert.equal(update.amulets[entry.id], 0);
  assert.throws(() => changeAmulets(update, 'equip', { slot: 0, amuletId: entry.id }, entries));
  assert.equal(update.amuletSlots.length, 5);
  assert.equal(update.amuletSlots[4], null);
});
test('five-day removal boundary, permanent equip until removed, admin bypass and re-equip lock', () => {
  const equipped = changeAmulets({ amulets: { [entry.id]: 1 } }, 'equip', { slot: 0, amuletId: entry.id }, entries, 100);
  assert.throws(() => changeAmulets(equipped, 'remove', { slot: 0 }, entries, 100 + LOCK_MS - 1));
  assert.equal(effects(equipped).wheel, entry.value);
  const removed = changeAmulets(equipped, 'remove', { slot: 0 }, entries, 100 + LOCK_MS);
  assert.equal(removed.amulets[entry.id], 1); assert.equal(removed.amuletSlots[0], null);
  const again = changeAmulets(removed, 'equip', { slot: 0, amuletId: entry.id }, entries, 200 + LOCK_MS);
  assert.equal(again.amuletSlots[0].removableAt, 200 + LOCK_MS * 2);
  assert.equal(changeAmulets({ ...equipped, isAdmin: true }, 'remove', { slot: 0 }, entries, 101).amulets[entry.id], 1);
});
test('strongest power only; unequipped amulets and locked slots give no effects', () => {
  assert.deepEqual(effects({ amulets: { [entry.id]: 5 } }), {});
  assert.equal(effects({ amuletSlotCount: 3, amuletSlots: [{ power: 'wheel', value: 2 }, { power: 'wheel', value: 5 }, { power: 'wheel', value: 3 }] }).wheel, 5);
  assert.equal(effects({ amuletSlots: [null, { power: 'wheel', value: 10 }] }).wheel, undefined);
});

test('retired inventory and equipped effects are removed, while new equipment retains its lock',()=>{
 const {cleanAmulets,rebalanceAmulet}=require('./amulet-utils');
 const old={id:'8:ascend',gemKey:'ultra',power:'ascend',value:50};
 assert.deepEqual(effects({amuletSlots:[old]}),{});
 const newSlot={...entry,equippedAt:123,removableAt:456};
 const clean=cleanAmulets({amulets:{[old.id]:2,[entry.id]:1},amuletSlots:[old,newSlot]},entries);
 assert.deepEqual(clean.amulets,{[entry.id]:1});assert.equal(clean.amuletSlots[0],null);
 assert.equal(rebalanceAmulet(newSlot).removableAt,456);
 assert.throws(()=>changeAmulets({amulets:{[old.id]:1}},'equip',{slot:0,amuletId:old.id},entries));
});
test('situational bonuses turn on and off with current account and loadout',()=>{
 const find=key=>entries.find(e=>e.id.endsWith(':'+key));
 const lifeline=find('lifeline');assert.equal(effects({balance:99,amuletSlots:[lifeline]}).wheel,6);
 assert.equal(effects({balance:100,amuletSlots:[lifeline]}).wheel,undefined);
 const brush=find('minimalist');assert.equal(effects({amuletSlots:[brush]}).pigment,1);
 assert.equal(effects({amuletSlotCount:2,amuletSlots:[brush,entry]}).pigment,1);
 const treasury=find('treasury');assert.equal(effects({gems:{bronze:100},amuletSlots:[treasury]}).pack,25);
 assert.equal(effects({gems:{bronze:99},amuletSlots:[treasury]}).pack,undefined);
 const diverse=find('palette');assert.equal(effects({amuletSlotCount:3,amuletSlots:[diverse,entry,find('reclaimer')]}).pigment,2);
 assert.equal(effects({amuletSlotCount:3,amuletSlots:[diverse,entry,find('unsealer')]}).pigment,undefined);
 const royal=find('patronage');assert.equal(effects({vipUntil:new Date(Date.now()+60000),amuletSlots:[royal]}).pack,35);
 assert.equal(effects({amuletSlots:[royal]}).pack,undefined);
});
test('compound effects work together without adding duplicate bonuses',()=>{
 const crown=entries.find(e=>e.id.endsWith(':crown'));
 const unsealer=entries.find(e=>e.id.endsWith(':unsealer'));
 const buffs=effects({amuletSlotCount:2,amuletSlots:[crown,unsealer]});
 assert.equal(buffs.pack,45);assert.equal(buffs.packgem,20);
});

test('trophy-exclusive amulets can be equipped but never purchased with gems',()=>{
 const prize=entries.find(entry=>entry.id==='road:champion');assert.ok(prize.exclusive);
 assert.throws(()=>changeAmulets({gems:{'trophy-road':999}},'buy',{amuletId:prize.id},entries),/trophy road/);
 const update=changeAmulets({amulets:{[prize.id]:1}},'equip',{slot:0,amuletId:prize.id},entries,1000);
 assert.equal(effects(update).trophybonus,3);
});
test('Prism Brush adds dye without altering the one-gem cost',()=>{
 const {workshopAction}=require('./gem-workshop-utils');
 const result=workshopAction({gems:{bronze:2},amuletSlots:[{id:'road:chromatic',power:'pigment',value:2}]},tiers,'craft-dye',{gemKey:'bronze'});
 assert.equal(result.gemDyes.bronze,7);assert.equal(result.gems.bronze,1);
});


test('former solo and pair designs retain IDs and work in full five-slot loadouts',()=>{
 const {rebalanceAmulet}=require('./amulet-utils');
 for(const key of ['apprentice','minimalist','merchant','precision','champion']){
  const item=entries.find(entry=>entry.id.endsWith(':'+key));
  const old={...item,condition:'solo',equippedAt:100,removableAt:200};
  const migrated=rebalanceAmulet(old);assert.equal(migrated.condition,null);assert.equal(migrated.id,old.id);assert.equal(migrated.removableAt,200);
  const fillers=['fortune','unsealer','geode','reclaimer'].map(key=>entries.find(entry=>entry.id.endsWith(':'+key)));
  const buffs=effects({amuletSlotCount:5,amuletSlots:[old,...fillers]});
  for(const [power,value] of Object.entries(item.bonuses))assert.ok(buffs[power]>=value);
 }
 const extended=catalog([...tiers,{id:'special',name:'Special'}]);
 assert.ok(extended.every(item=>!['solo','pair'].includes(item.condition)));
});
