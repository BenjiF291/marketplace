const test = require('node:test');
const assert = require('node:assert/strict');
const { catalog, effects, changeAmulets, LOCK_MS, SLOT_PRICES } = require('./amulet-utils');
const tiers = ['Bronze', 'Rare Bronze', 'Silver', 'Rare Silver', 'Gold', 'Rare Gold', 'Platinum', 'Lightning', 'Ultra'].map((name, index) => ({ id: String(index), name }));
const entries = catalog(tiers);
const entry = entries[0];
test('nine amulets per tier preserve curated designs and trophy exclusives', () => {
 assert.equal(entries.length,85);assert.equal(new Set(entries.map(e=>e.id)).size,85);
 for(const tier of tiers)assert.equal(entries.filter(e=>e.tierId===tier.id).length,9);
 assert.equal(new Set(entries.filter(e=>!e.exclusive&&!['discovery-clock','merchant-clock','token-cache','temporal-lens'].some(key=>e.id.endsWith(':'+key))).map(e=>JSON.stringify([e.bonuses,e.condition]))).size,45);
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
test('equipped bonuses add; unequipped amulets and locked slots give no effects', () => {
  assert.deepEqual(effects({ amulets: { [entry.id]: 5 } }), {});
  assert.equal(effects({ amuletSlotCount: 3, amuletSlots: [{ power: 'wheel', value: 2 }, { power: 'wheel', value: 5 }, { power: 'wheel', value: 3 }] }).wheel, 10);
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
 const brush=find('minimalist');assert.equal(effects({amuletSlots:[brush]}).pigment,2);
 assert.equal(effects({amuletSlotCount:2,amuletSlots:[brush,entry]}).pigment,2);
 const treasury=find('treasury');assert.equal(effects({gems:{bronze:100},amuletSlots:[treasury]}).pack,43);
 assert.equal(effects({gems:{bronze:99},amuletSlots:[treasury]}).pack,undefined);
 const diverse=find('palette');assert.equal(effects({amuletSlotCount:3,amuletSlots:[diverse,entry,find('reclaimer')]}).pigment,3);
 assert.equal(effects({amuletSlotCount:3,amuletSlots:[diverse,entry,find('unsealer')]}).pigment,undefined);
 const royal=find('patronage');assert.equal(effects({vipUntil:new Date(Date.now()+60000),amuletSlots:[royal]}).pack,74);
 assert.equal(effects({amuletSlots:[royal]}).pack,undefined);
});
test('compound effects add shared bonuses across active amulets',()=>{
 const crown=entries.find(e=>e.id.endsWith(':crown'));
 const unsealer=entries.find(e=>e.id.endsWith(':unsealer'));
 const buffs=effects({amuletSlotCount:2,amuletSlots:[crown,unsealer]});
 assert.equal(buffs.pack,crown.bonuses.pack+unsealer.bonuses.pack);assert.equal(buffs.packgem,50);
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

test('all regular and special gem tiers cost 22-42 and Ruby bonuses remain unchanged',()=>{const all=catalog([...tiers,{id:'fighter',name:'Fighter'},{id:'mirror',name:'Mirror'}]);for(const tier of [...tiers,{id:'fighter'},{id:'mirror'}])assert.deepEqual(all.filter(e=>e.tierId===tier.id).map(e=>e.price),[22,27,32,37,42,42,42,42,42]);assert.deepEqual(all.filter(e=>e.tierRank===0).slice(0,5).map(e=>e.bonuses),require('./amulet-designs').SETS[0].map(d=>d[2]));});
test('existing equipped Diamond amulets use rebalanced bonuses without resetting their lock',()=>{const diamond=entries.find(e=>e.id.endsWith(':atelier')),old={...diamond,bonuses:{fullbatch:1,pigment:2,converter:10},equippedAt:10,removableAt:999};const u={amuletSlots:[old]};assert.deepEqual(effects(u),{fullbatch:3,pigment:5,converter:25});const upgraded=require('./amulet-utils').rebalanceAmulet(old);assert.equal(upgraded.removableAt,999);assert.equal(upgraded.price,42);assert.match(upgraded.description,/25 % off/);});

test('all percentage price discounts use the highest value while percentage bonuses add',()=>{
 const discounts={converter:20,vip:10,market:12,gemshop:15,packshop:18};
 const buffs=effects({amuletSlotCount:3,amuletSlots:[{bonuses:discounts},{bonuses:Object.fromEntries(Object.entries(discounts).map(([k,v])=>[k,v/2]))},{bonuses:{salvage:20,battle:30,boostpower:10}}]});
 for(const [power,value] of Object.entries(discounts))assert.equal(buffs[power],value);
 const additive=effects({amuletSlotCount:2,amuletSlots:[{bonuses:{salvage:20,battle:30,boostpower:40,packtokens:5}},{bonuses:{salvage:25,battle:40,boostpower:30,packtokens:4}}]});
 assert.deepEqual(additive,{salvage:45,battle:70,boostpower:70,packtokens:9});
});
test('multiple real owned copies stack after equipping without resetting removal locks',()=>{
 const item=entries.find(e=>e.id.endsWith(':token-cache'));let user={amuletSlotCount:2,amulets:{[item.id]:2}};
 user={...user,...changeAmulets(user,'equip',{slot:0,amuletId:item.id},entries,100)};
 user={...user,...changeAmulets(user,'equip',{slot:1,amuletId:item.id},entries,200)};
 const buffs=effects(user);assert.equal(buffs.packtokens,item.bonuses.packtokens*2);assert.equal(buffs.pigment,item.bonuses.pigment*2);assert.equal(user.amulets[item.id],0);assert.equal(user.amuletSlots[0].removableAt,100+LOCK_MS);assert.equal(user.amuletSlots[1].removableAt,200+LOCK_MS);
});
test('stacked chances and cooldown reductions stop at 100 percent and never reverse timers',()=>{
 const user={amuletSlotCount:5,amuletSlots:Array.from({length:5},()=>({bonuses:{packgem:80,dailycooldown:40,shopcooldown:40}}))};
 assert.deepEqual(effects(user),{packgem:100,dailycooldown:100,shopcooldown:100});
 const timing=require('./pack-timing');assert.equal(timing.dailyDuration(user,{cooldownHours:7}),0);assert.equal(timing.shopDuration(user,90),0);
 const partial={amuletSlotCount:2,amuletSlots:[{bonuses:{dailycooldown:8,shopcooldown:8}},{bonuses:{dailycooldown:8,shopcooldown:8}}]};assert.equal(timing.dailyDuration(partial,{cooldownHours:5}),4.2*3600000);assert.equal(timing.shopDuration(partial,100),84*60000);
});
test('stacking excludes inactive conditional amulets and preserves trophy-exclusive values',()=>{
 const lifeline=entries.find(e=>e.id.endsWith(':lifeline')),forge=entries.find(e=>e.id==='road:forge');
 assert.equal(effects({balance:99,amuletSlotCount:2,amuletSlots:[lifeline,lifeline]}).wheel,12);
 assert.equal(effects({balance:100,amuletSlotCount:2,amuletSlots:[lifeline,lifeline]}).wheel,undefined);
 assert.equal(effects({amuletSlotCount:2,amuletSlots:[forge,forge]}).fullbatch,4);
});

test('each standard tier retains one familiar new amulet and replaces three with varied identities',()=>{
 const oldNames=new Set(['Discovery Hourglass','Merchant Hourglass','Token Cache','Temporal Lens']),keys=['discovery-clock','merchant-clock','token-cache','temporal-lens'];
 const all=require('./amulet-utils').catalog(Array.from({length:9},(_,i)=>({id:'tier'+i,name:'Tier '+i})));
 const replacements=[];
 for(let rank=0;rank<9;rank++){
  const extras=all.filter(e=>e.tierRank===rank&&keys.some(k=>e.id.endsWith(':'+k)));assert.equal(extras.length,4);assert.equal(extras.filter(e=>oldNames.has(e.name)).length,1);
  replacements.push(...extras.filter(e=>!oldNames.has(e.name)).map(e=>e.name));
  for(const entry of extras){const existing={...entry,name:'Old name',equippedAt:10,removableAt:500};const cleaned=require('./amulet-utils').cleanAmulets({amulets:{[entry.id]:2},amuletSlots:[existing]},all);assert.equal(cleaned.amulets[entry.id],2);assert.equal(cleaned.amuletSlots[0].removableAt,500);assert.equal(cleaned.amuletSlots[0].name,entry.name);}
 }
 assert.equal(new Set(replacements).size,27);
});
