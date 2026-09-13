const test = require('node:test');
const assert = require('node:assert/strict');
const { workshopAction, DYE_AREAS } = require('./gem-workshop-utils');
const tiers = ['Bronze', 'Rare Bronze', 'Silver', 'Rare Silver', 'Gold', 'Rare Gold', 'Platinum', 'Lightning', 'Ultra', 'Special'].map((name, i) => ({ name, id: String(i) }));
test('craft consumes exact recipe once and rejects insufficient materials', () => {
  const user = { gems: { 'rare-silver': 10, gold: 5, 'rare-gold': 2, bronze: 12 } };
  const result = workshopAction(user, tiers, 'craft', {});
  assert.equal(result.gemCompressor, true);
  assert.deepEqual(result.gems, { 'rare-silver': 0, gold: 0, 'rare-gold': 0, bronze: 12 });
  assert.throws(() => workshopAction(result, tiers, 'craft', {}));
  assert.throws(() => workshopAction({ gems: { ...user.gems, gold: 4 } }, tiers, 'craft', {}));
  assert.equal(user.gems.gold, 5);
});
test('compression requires machine, spends 4 per output and follows next configured tier', () => {
  const user = { gemCompressor: true, gems: { bronze: 11, 'rare-bronze': 1, ultra: 4 } };
  const result = workshopAction(user, tiers, 'compress', { gemKey: 'bronze', quantity: 2 });
  assert.equal(result.gems.bronze, 3); assert.equal(result.gems['rare-bronze'], 3);
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
