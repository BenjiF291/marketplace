const test = require('node:test');
const assert = require('node:assert/strict');
const { catalog, effects, changeAmulets, LOCK_MS, SLOT_PRICES } = require('./amulet-utils');
const tiers = ['Bronze', 'Rare Bronze', 'Silver', 'Rare Silver', 'Gold', 'Rare Gold', 'Platinum', 'Lightning', 'Ultra'].map((name, index) => ({ id: String(index), name }));
const entries = catalog(tiers);
const entry = entries[0];
test('five distinct amulets per tier, unique IDs and ten working power families', () => {
  assert.equal(entries.length, 45);
  assert.equal(new Set(entries.map(e => e.id)).size, 45);
  assert.equal(new Set(entries.map(e => e.power)).size, 10);
  for (const tier of tiers) assert.equal(new Set(entries.filter(e => e.tierId === tier.id).map(e => e.power)).size, 5);
  for (const power of new Set(entries.map(e => e.power))) {
    const versions = entries.filter(e => e.power === power);
    for (let i = 1; i < versions.length; i++) assert.ok(versions[i].value >= versions[i - 1].value);
  }
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
