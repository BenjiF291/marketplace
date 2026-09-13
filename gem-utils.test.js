const test = require('node:test');
const assert = require('node:assert/strict');
const { gemRecipe, validateGemCards } = require('./gem-utils');
const tier = { id: 'bronze-id', name: 'Bronze', sellPrice: 25, cards: ['bronze.png'] };
const card = { buyerId: 'player', sold: true, itemType: 'card', imageUrl: '/images/bronze.png' };
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
