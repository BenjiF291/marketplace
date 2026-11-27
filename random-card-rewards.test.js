const assert = require('node:assert/strict');
const { test } = require('node:test');
const { kind, definitions, pools } = require('./random-card-rewards');
const { validate } = require('./pack-builder');
const { draw } = require('./free-pack');

function fixture() {
  const tiers = new Map();
  const cards = definitions.flatMap(({ id, tier, category }) => {
    const entries = [1, 2].map(index => {
      const filename = id.replace(':', '-') + '-' + index + '.png';
      return { filename, card: { id: filename, name: tier + ' Player ' + index,
        tier: category === 'special' ? 'Mirror' : category === 'rare' ? 'Rare ' + tier : tier === 'Lightning' ? 'Lightling' : tier } };
    });
    if (category === 'special') tiers.set(tier, { name: tier, cards: entries.map(entry => entry.filename) });
    return entries;
  });
  return { cards, tiers };
}

function reward(id, min = 1, max = min, chance = 100) {
  return { kind, id, min, max, chance };
}

test('every named category draws only its own cards, with independently sampled duplicates', () => {
  const { cards, tiers } = fixture();
  const entries = pools(cards, [...tiers.values()]);
  assert.equal(entries.length, 15);
  assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length);
  assert.ok(entries.every(entry => entry.count === 2));
  const catalog = { [kind]: entries };
  for (const entry of entries) {
    const saved = validate({ name: entry.name, cardIds: [], rewardCards: [
      { title: 'Draw', options: [reward(entry.id, 3)] }
    ] }, catalog);
    assert.deepEqual(saved.rewardCards[0].options[0], reward(entry.id, 3));
    const picks = [0, 1, 0];
    const result = draw({ cards: saved.rewardCards }, bound => bound === 2 ? picks.shift() : 0, catalog);
    assert.deepEqual(result.map(item => item.id), [entry.members[0].filename, entry.members[1].filename, entry.members[0].filename]);
    assert.ok(result.every(item => item.kind === 'card' && item.amount === 1 && item.cardName));
  }
  assert.ok(JSON.parse(JSON.stringify(entries)).every(entry => !Object.hasOwn(entry, 'members')));
});

test('new cards and changed Special assignments update pools without re-saving the pack', () => {
  const { cards, tiers } = fixture();
  const [moved] = tiers.get('Gold').cards.splice(0, 1);
  tiers.get('Platinum').cards.push(moved);
  cards.push({ filename: 'unclassified-filename.png', card: { id: 'added', name: 'New Gold', tier: 'Gold' } });
  tiers.get('Ultra').cards.push(...tiers.get('Silver').cards);
  const entries = pools(cards, [...tiers.values()]);
  const get = id => entries.find(entry => entry.id === id);
  assert.equal(get('gold:regular').count, 3);
  assert.equal(get('gold:special').count, 1);
  assert.equal(get('platinum:special').count, 3);
  assert.equal(get('silver:special').count, 0);
  assert.throws(() => draw({ cards: [{ title: 'Empty', options: [reward('silver:special')] }] },
    () => 0, { [kind]: entries }), { code: 'EMPTY_RANDOM_CARD_POOL' });
});

test('specific cards and random cards share the existing odds and quantity checks', () => {
  const { cards, tiers } = fixture();
  const catalog = { [kind]: pools(cards, [...tiers.values()]), card: [{ id: 'fixed.png', name: 'Fixed card' }] };
  const options = [{ kind: 'card', id: 'fixed.png', min: 1, max: 1, chance: 25 }, reward('bronze:regular', 1, 2, 75)];
  const body = { name: 'Mixed', rewardCards: [{ title: 'Choice', options }] };
  const saved = validate(body, catalog);
  assert.deepEqual(saved.rewardCards[0].options, options);
  assert.equal(draw({ cards: saved.rewardCards }, () => 0, catalog)[0].id, 'fixed.png');
  const rolls = [250000, 1, 1, 0];
  assert.equal(draw({ cards: saved.rewardCards }, () => rolls.shift(), catalog).length, 2);
  const invalid = option => ({ ...body, rewardCards: [{ title: 'Invalid', options: [option] }] });
  assert.throws(() => validate(invalid(reward('ultra:rare')), catalog), /available/);
  assert.throws(() => validate(invalid(reward('bronze:regular', 21)), catalog), /amounts/);
});
