const test = require('node:test');
const assert = require('node:assert/strict');
const { gemRecipe, validateGemCards } = require('./gem-utils');
const tier = { id: 'bronze-id', name: 'Bronze', sellPrice: 25, cards: ['bronze.png'] };
const card = { buyerId: 'player', sold: true, itemType: 'card', imageUrl: '/images/bronze.png' };
const { converterProgress, upgradeConverter, requireUnlockedTier } = require('./gem-utils');
const tiers = [tier, { id: 'rare', name: 'Rare Bronze' }, { id: 'silver', name: 'Silver' }];
test('existing and new accounts start with only the first tier unlocked', () => {
  assert.equal(converterProgress(tiers, {}).level, 0);
  requireUnlockedTier(tiers, {}, tier.id);
  assert.throws(() => requireUnlockedTier(tiers, {}, 'rare'));
  assert.throws(() => requireUnlockedTier(tiers, {}, 'missing'));
});
test('admins can convert every tier without paying upgrades', () => {
  const user = { isAdmin: true };
  for (const tier of tiers) requireUnlockedTier(tiers, user, tier.id);
  assert.equal(converterProgress(tiers, user).nextUpgrade, null);
  assert.throws(() => requireUnlockedTier(tiers, { isAdmin: 'true' }, 'silver'));
});
test('upgrade after Diamond costs 50 Diamonds and unlocks all remaining and future tiers', () => {
  const extended = [...tiers, { id: 'diamond', name: 'Ultra' }, { id: 'a', name: 'Cosmic' }, { id: 'b', name: 'Mystic' }];
  const user = { gemConverterLevel: 3, gems: { ultra: 55 } };
  assert.equal(converterProgress(extended, user).nextUpgrade.unlockAll, true);
  const upgraded = upgradeConverter(extended, user, 'a');
  assert.equal(upgraded.gems.ultra, 5);
  assert.equal(upgraded.gemConverterAllUnlocked, true);
  requireUnlockedTier(extended, upgraded, 'b');
  assert.equal(converterProgress([...extended, { id: 'c', name: 'Future' }], upgraded).nextUpgrade, null);
  assert.throws(() => upgradeConverter(extended, { ...user, gems: { ultra: 49 } }, 'a'));
});
test('upgrades spend exactly 50 previous-tier gems and preserve other balances', () => {
  const user = { gems: { bronze: 62, 'rare-bronze': 50, gold: 9 }, balance: 300 };
  const first = upgradeConverter(tiers, user, 'rare');
  assert.deepEqual(first, { gemConverterLevel: 1, gems: { bronze: 12, 'rare-bronze': 50, gold: 9 } });
  assert.equal(user.gems.bronze, 62);
  requireUnlockedTier(tiers, first, 'rare');
  assert.throws(() => requireUnlockedTier(tiers, first, 'silver'));
  const second = upgradeConverter(tiers, first, 'silver');
  assert.equal(second.gems['rare-bronze'], 0);
  assert.equal(converterProgress(tiers, second).nextUpgrade, null);
  assert.throws(() => upgradeConverter(tiers, second, 'silver'));
});
test('insufficient gems, skipped tiers and stale duplicate upgrades are rejected', () => {
  assert.throws(() => upgradeConverter(tiers, { gems: { bronze: 49 } }, 'rare'));
  assert.throws(() => upgradeConverter(tiers, { gems: { bronze: 500 } }, 'silver'));
  const upgraded = upgradeConverter(tiers, { gems: { bronze: 100 } }, 'rare');
  assert.throws(() => upgradeConverter(tiers, upgraded, 'rare'));
});
test('rewards and fractional Footy costs for all supported batch sizes', () => {
  assert.deepEqual([1, 2, 3].map(count => { const r = gemRecipe(tier, count); return [r.reward, r.cost]; }), [[3, 37.5], [7, 75], [12, 112.5]]);
  for (const count of [0, 4, 1.5]) assert.throws(() => gemRecipe(tier, count));
  for (const sellPrice of [0, -1, 'bad']) assert.throws(() => gemRecipe({ ...tier, sellPrice }));
});
test('requested gem mappings', () => {
  for (const [name, gem] of [['Bronze', 'Ruby'], ['Gold', 'Citrine'], ['Platinum', 'Sapphire']]) assert.equal(gemRecipe({ ...tier, name }).gemName, gem);
});
test('only distinct owned available cards of selected tier can be consumed', () => {
  validateGemCards([card], ['a'], tier, 'player');
  assert.throws(() => validateGemCards([card, card], ['a', 'a'], tier, 'player'));
  for (const change of [{ buyerId: 'other' }, { sold: false }, { listedForSale: true }, { itemType: 'pack' }, { itemType: 'battle-card' }, { imageUrl: '/gold.png' }]) {
    assert.throws(() => validateGemCards([{ ...card, ...change }], ['a'], tier, 'player'));
  }
  assert.throws(() => validateGemCards([null], ['a'], tier, 'player'));
  assert.throws(() => validateGemCards([], ['a'], tier, 'player'));
});
