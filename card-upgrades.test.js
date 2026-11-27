const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const express = require('express');
const catalog = require('./public/upgrader-catalog');
const rules = require('./card-upgrades');
const { createCardReader } = require('./card-data');
const { createBenBalReader } = require('./ben-bal-allocations');
const { roles } = require('./public/ben-bal-card');

function memoryDb() {
  const records = new Map();
  let queue = Promise.resolve();
  const snapshot = (key, id) => ({ id, exists: records.has(key), data: () => structuredClone(records.get(key)) });
  function collection(path, predicates = []) {
    return {
      doc(id) {
        const key = path + '/' + id;
        return { key, id, get: async () => snapshot(key, id), collection: name => collection(key + '/' + name) };
      },
      where(field, operator, value) { return collection(path, [...predicates, [field, value]]); },
      async get() {
        return { docs: [...records].filter(([key, value]) => key.startsWith(path + '/') &&
          key.split('/').length === path.split('/').length + 1 &&
          predicates.every(([field, expected]) => value[field] === expected))
          .map(([key]) => snapshot(key, key.split('/').at(-1))) };
      }
    };
  }
  return { collection, records, runTransaction(callback) {
    const run = queue.then(async () => {
      const writes = [];
      const result = await callback({
        get: ref => { assert.equal(writes.length, 0); return ref.get(); },
        set: (ref, value) => writes.push(() => records.set(ref.key, structuredClone(value))),
        update: (ref, value) => writes.push(() => records.set(ref.key, { ...records.get(ref.key), ...structuredClone(value) }))
      });
      writes.forEach(write => write());
      return result;
    });
    queue = run.catch(() => {});
    return run;
  } };
}

test('six material tiers and exact Epic and Legendary recipes', () => {
  assert.deepEqual(catalog.tiers, ['Bronze', 'Silver', 'Gold', 'Platinum', 'Lightning', 'Ultra']);
  assert.equal(catalog.definitions.length, 27);
  for (const tier of catalog.tiers) {
    const others = catalog.tiers.filter(value => value !== tier);
    assert.equal(rules.recipe('epic', tier, others.slice(0, 2)).output, catalog.id('epic', tier));
    assert.equal(rules.recipe('legendary', tier, others).output, catalog.id('legendary', tier));
    assert.throws(() => rules.recipe('epic', tier, [others[0], others[0]]), /distinct/);
    assert.throws(() => rules.recipe('epic', tier, [tier, others[0]]), /distinct/);
    assert.throws(() => rules.recipe('legendary', tier, others.slice(1)), /distinct/);
  }
});

test('the existing Pack Builder accepts all three upgrade reward kinds with configured amounts and probabilities', () => {
  const rewards = [
    { kind: 'upgradeShard', id: 'shard:silver', min: 1, max: 3, chance: 25 },
    { kind: 'upgradeCore', id: 'core:gold', min: 2, max: 2, chance: 25 },
    { kind: 'upgradeToken', id: 'epic:ultra', min: 1, max: 1, chance: 25 },
    { kind: 'cardXpPotion', id: 'card-xp:50', min: 1, max: 1, chance: 25 }
  ];
  const options = Object.fromEntries(rules.kinds.map(kind => [kind, catalog.definitions.filter(item => item.kind === kind)]));
  const config = require('./pack-builder').validate({ name: 'Custom rewards', cardIds: [],
    rewardCards: [{ title: 'Upgrade supplies', options: rewards }] }, options);
  assert.deepEqual(config.rewardCards[0].options, rewards);
  assert.equal(require('./public/reward-card-art').describe(rewards[2]).name, 'Epic Ultra Upgrader');
  assert.equal(require('./public/reward-card-art').describe(rewards[3]).name, '50% Card XP Potion');
});

test('stat points stack, increase current Overall and preserve base strength and action allocations', async () => {
  const base = await createBenBalReader(__dirname, createCardReader(__dirname))('Bronze_emma.png');
  const epic = catalog.get('epic:bronze');
  const legendary = catalog.get('legendary:bronze');
  const first = rules.roll(base, epic, (min, max) => { assert.deepEqual([min, max], [0, 6]); return 0; });
  assert.equal(first.points, 1);
  assert.equal(catalog.points(50), 11);
  assert.equal(catalog.points(75), 15);
  assert.deepEqual(Object.values(first.bonuses), [1, 0, 0, 0, 0, 0]);
  let pick = 0;
  const last = rules.roll(base, legendary, () => pick++ % 6, first, 100);
  assert.equal(last.points, 20);
  assert.notEqual(first.variantId, last.variantId);
  const result = rules.applyVariant(base, last);
  assert.ok(result.overall > first.currentOverall);
  assert.equal(last.baseOverall, base.overall);
  assert.deepEqual(rules.baseCard(result).stats, base.stats);
  assert.equal(rules.baseCard(result).overall, base.overall);
  for (const role of roles) assert.deepEqual(Object.values(result.benBal[role]).sort(), Object.values(base.benBal[role]).sort());
  for (const key of Object.keys(result.stats)) assert.ok(result.stats[key] > first.effectiveStats[key]);
  assert.equal(Object.values(last.bonuses).reduce((sum, points) => sum + points, 0), 20);
  assert.ok(last.points > first.points);
  const league = require('./ben-bal-leagues');
  assert.match(league.eligibility({ ...result, tier: 'Mirror' }, 'Bronze',
    { range: { min: 0, max: base.overall } }), /Overall must be/);
  const { prepareCard, resolve } = require('./public/ben-bal-match-engine');
  const attacker = prepareCard(result, 'att1', 'keeper');
  const defender = prepareCard(base, 'def1', 'keeper');
  const [matched] = require('./ben-bal-rewards').matchmakingTeam([attacker]);
  assert.equal(matched.total, defender.total);
  assert.equal(matched.card.overall, base.overall);
  assert.equal(resolve(attacker, 'attack', defender, 'defence').player.total, attacker.total);
  assert.ok(attacker.total > defender.total);
  assert.equal(rules.eligible({ ...base, tier: 'Rare Bronze' }, null, epic), 'The token targets a different card tier.');
});

test('pack grants, craft receipts and card transformation are atomic on the local routes', async t => {
  const db = memoryDb();
  const app = express();
  app.use(express.json());
  require('./upgrader-routes')(app, db, async req => {
    const user = req.header('X-Test-User');
    if (!['alice', 'fixture-admin'].includes(user)) throw Error('No session');
    return user;
  }, __dirname);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = 'http://127.0.0.1:' + server.address().port + '/upgraders';
  const headers = { 'Content-Type': 'application/json', 'X-Test-User': 'alice' };
  const post = (path, body) => fetch(url + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const wallet = () => db.records.get('upgradeWallets/alice').counts;
  const rewards = [{ kind: 'upgradeCore', id: 'core:bronze', amount: 1 },
    { kind: 'upgradeShard', id: 'shard:silver', amount: 1 }, { kind: 'upgradeShard', id: 'shard:ultra', amount: 1 },
    { kind: 'upgradeToken', id: 'legendary:bronze', amount: 1 }];
  await db.runTransaction(tx => rules.grant(tx, db, 'alice', rewards));
  const recipe = { level: 'epic', tier: 'Bronze', shards: ['Silver', 'Ultra'] };
  const calls = await Promise.all(['craft-1234', 'craft-1234', 'craft-5678'].map(requestId => post('/craft', { ...recipe, requestId })));
  assert.deepEqual(calls.map(response => response.status), [200, 200, 400]);
  assert.deepEqual(wallet(), { 'epic:bronze': 1, 'legendary:bronze': 1 });
  const card = { buyerId: 'alice', sold: true, itemType: 'card', imageUrl: '/images/Bronze_emma.png' };
  db.records.set('items/owned1', card);
  db.records.set('items/owned2', { ...card });
  db.records.set('users/alice', { username: 'Alice' });
  db.records.set('users/fixture-admin', { isAdmin: true });
  const admin = (action, token, requestId, admin = true) => fetch(url + '/admin', {
    method: 'POST', headers: { ...headers, 'X-Test-User': admin ? 'fixture-admin' : 'alice' },
    body: JSON.stringify({ player: 'alice', itemId: 'owned1', action, token, requestId })
  });
  assert.notEqual((await admin('grant', 'card-xp:50', 'deny-0001', false)).status, 200);
  const use = (token, requestId) => post('/potion', { token, itemId: 'owned1', requestId });
  for (const level of [50, 75, 100]) {
    const token = 'card-xp:' + level;
    assert.equal((await admin('grant', token, 'grant-' + level)).status, 200);
    const response = await use(token, 'potion-' + level);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).effectiveness, level);
    assert.equal((await use(token, 'potion-' + level)).status, 200);
    assert.equal((await use(token, 'noeffect-' + level)).status, 400);
  }
  assert.equal((await admin('set', 'card-xp:75', 'set-test75')).status, 200);
  assert.equal(db.records.get('cardEffectiveness/owned1').value, 75);
  const candidates = async token => (await (await fetch(url + '?token=' + token, { headers })).json()).cards;
  assert.deepEqual((await candidates('epic:bronze')).map(card => [card.itemId, card.effectiveness]), [['owned1', 75], ['owned2', 0]]);
  assert.deepEqual(await candidates('legendary:bronze'), []);
  db.records.set('items/transferred', { ...card, imageUrl: '/images/Bronze_jan.png' });
  db.records.set('cardUpgrades/transferred', { ownerId: 'former-owner', level: 'epic', baseCardId: 'Bronze_jan.png' });
  assert.ok(!(await candidates('epic:bronze')).some(card => card.itemId === 'transferred'));
  const apply = (token, requestId, itemId = 'owned1') => post('/apply', { token, requestId, itemId });
  assert.equal((await apply('legendary:bronze', 'apply-1234')).status, 400);
  const epic = await (await apply('epic:bronze', 'apply-5678')).json();
  assert.equal(epic.upgrade.level, 'epic');
  assert.equal(epic.upgrade.preparation, 75);
  assert.equal(db.records.get('cardEffectiveness/owned1').value, 0);
  assert.equal(db.records.get('items/owned2').upgrade, undefined);
  assert.deepEqual((await candidates('legendary:bronze')).map(card => card.itemId), ['owned1']);
  assert.deepEqual(await candidates('epic:bronze'), []);
  assert.deepEqual(await (await apply('epic:bronze', 'apply-5678')).json(), epic);
  const legendary = await (await apply('legendary:bronze', 'apply-9999')).json();
  assert.equal(legendary.upgrade.level, 'legendary');
  assert.deepEqual(legendary.upgrade.baseStats, epic.upgrade.baseStats);
  assert.deepEqual(legendary.upgrade.bonusesByLevel, {
    epic: epic.upgrade.bonuses, legendary: legendary.upgrade.bonuses
  });
  assert.ok(legendary.upgrade.currentOverall > epic.upgrade.currentOverall);
  assert.deepEqual(wallet(), {});
  const reload = await (await fetch(url, { headers })).json();
  assert.deepEqual(reload.counts, {});
  assert.equal((await fetch(url)).status, 401);

  const legendaryShards = catalog.tiers.filter(tier => tier !== 'Gold');
  await db.runTransaction(tx => rules.grant(tx, db, 'alice', [
    { kind: 'upgradeCore', id: 'core:gold', amount: 1 },
    ...legendaryShards.map(tier => ({ kind: 'upgradeShard', id: catalog.id('shard', tier), amount: 1 }))
  ]));
  const minted = await post('/craft', { level: 'legendary', tier: 'Gold', shards: legendaryShards, requestId: 'craft-9999' });
  assert.equal(minted.status, 200);
  assert.deepEqual(wallet(), { 'legendary:gold': 1 });
  const catalogue = require('./data/card-statistics.json').cards;
  for (const tier of catalog.tiers) {
    const key = catalog.tierKey(tier);
    const [normal, epic, legendary] = catalogue.filter(card => catalog.tierKey(card.tier) === key).slice(0, 3);
    for (const [level, entry] of Object.entries({ normal, epic, legendary })) {
      const itemId = key + '-' + level;
      db.records.set('items/' + itemId, { ...card, imageUrl: entry.imageUrl });
      if (level !== 'normal') db.records.set('cardUpgrades/' + itemId, {
        ownerId: 'alice', baseCardId: entry.id, level, baseStats: entry.stats
      });
    }
    const expected = key === 'bronze' ? [key + '-normal', 'owned2'] : [key + '-normal'];
    assert.deepEqual((await candidates('epic:' + key)).map(entry => entry.itemId).sort(), expected.sort());
    assert.deepEqual((await candidates('legendary:' + key)).map(entry => entry.itemId), [key + '-epic']);
  }
  const ineligible = await apply('legendary:gold', 'apply-0000', 'owned2');
  assert.match((await ineligible.json()).error, /different card tier/);
  assert.deepEqual(wallet(), { 'legendary:gold': 1 });
});
