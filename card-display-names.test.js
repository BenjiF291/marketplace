const assert = require('node:assert/strict');
const { test } = require('node:test');
const names = require('./public/card-display-names');
const rewards = require('./public/reward-card-art');

test('card labels preserve names and strip generated file references', () => {
  const filename = 'bronze_lucas-van-ginkel_' + 'ab'.repeat(32) + '.png';
  assert.equal(names.name(filename, 'Card ' + filename), 'Lucas van Ginkel');
  assert.equal(names.name('/images/Rare%20Gold_Jos%C3%A9_de_Vries.png'), 'José de Vries');
  assert.equal(names.name('zz2-MOTM_seb.png'), 'Seb');
  assert.equal(names.name(filename, 'Lucas van Ginkel-Smit'), 'Lucas van Ginkel-Smit');
  assert.equal(names.name('bronze_anna_2.png'), 'Anna 2');
  assert.equal(names.name('4e14cf56-7108-44c8-b96c-ae9d2d809c2d'), 'Collection card');
  assert.equal(names.item({ itemType: 'pack', name: 'Bronze Pack' }), 'Bronze Pack');
  assert.equal(names.item({ imageUrl: '/images/' + filename, name: 'Card ' + filename }), 'Lucas van Ginkel');
});

test('pack rewards keep the exact card references while sharing a readable name', () => {
  const ids = ['ab', 'cd'].map(stem => 'bronze_lucas-van-ginkel_' + stem.repeat(32) + '.png');
  const reward = ids.map(id => ({ kind: 'card', id, amount: 1, label: '1 Card ' + id }));
  assert.deepEqual(reward.map(entry => rewards.describe(entry).name), ['Lucas van Ginkel', 'Lucas van Ginkel']);
  assert.deepEqual(reward.map(entry => rewards.describe(entry).image), ids.map(id => 'images/' + id));
  assert.equal(rewards.describe({ kind: 'card', id: 'ab'.repeat(32), imageUrl: '/images/' + ids[0], amount: 1 }).name,
    'Lucas van Ginkel');
  assert.deepEqual(rewards.normalize({ rewards: reward }), reward);
});
