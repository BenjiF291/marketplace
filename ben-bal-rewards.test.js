'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const { once } = require('node:events');
const register = require('./ben-bal-routes');
const { applyMove, dayKey, settle } = require('./ben-bal-rewards');
const { prepareCard, slots } = require('./public/ben-bal-match-engine');
const rules = require('./ben-bal-leagues');
const { imageFilenames, createCardReader } = require('./card-data');
const { createBenBalReader } = require('./ben-bal-allocations');

const pairs = {
  attack: { primary: 'pow', secondary: 'ama' },
  dribble: { primary: 'size', secondary: 'rang' },
  defence: { primary: 'loy', secondary: 'acu' },
  naturalPosition: 'attack'
};
function team(prefix, value) {
  const stats = Object.fromEntries(['pow', 'ama', 'size', 'rang', 'loy', 'acu'].map(key => [key, value]));
  return slots.map(({ slot, role }) => prepareCard({ id: prefix + slot, overall: value, stats, benBal: pairs }, slot, role));
}

function memoryDatabase() {
  const records = new Map();
  let sequence = 0, queue = Promise.resolve(), fail = false;
  function collection(path, conditions = []) {
    return { doc(id = String(++sequence).padStart(20, '0')) {
      const key = path + '/' + id;
      return { id, key, get: async () => ({ id, data: () => structuredClone(records.get(key)) }),
        set: async value => records.set(key, structuredClone(value)), collection: name => collection(key + '/' + name) };
    }, where(field, operator, value) { return collection(path, [...conditions, [field, value]]); }, async get() {
      return { docs: [...records].filter(([key]) => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1)
        .filter(([, record]) => conditions.every(([field, value]) => record[field] === value))
        .map(([key, value]) => ({ id: key.split('/').at(-1), data: () => structuredClone(value) })) };
    } };
  }
  return {
    collection, records, failNext() { fail = true; },
    runTransaction(fn) {
      const run = queue.then(async () => {
        const writes = new Map();
        const result = await fn({
          get: async ref => ref.get(),
          set: (ref, value) => writes.set(ref.key, value),
          update: (ref, patch) => writes.set(ref.key, { ...records.get(ref.key), ...patch })
        });
        if (fail) { fail = false; throw Error('Simulated failed commit'); }
        for (const [key, value] of writes) records.set(key, structuredClone(value));
        return result;
      });
      queue = run.catch(() => {});
      return run;
    }
  };
}

test('Amsterdam dates reset at local midnight across both DST changes', () => {
  const cases = [
    ['2026-03-28T22:59:59Z', '2026-03-28'], ['2026-03-28T23:00:00Z', '2026-03-29'],
    ['2026-03-29T21:59:59Z', '2026-03-29'], ['2026-03-29T22:00:00Z', '2026-03-30'],
    ['2026-10-24T22:00:00Z', '2026-10-25'], ['2026-10-25T00:30:00Z', '2026-10-25'],
    ['2026-10-25T01:30:00Z', '2026-10-25'], ['2026-10-25T23:00:00Z', '2026-10-26']
  ];
  for (const [utc, expected] of cases) assert.equal(dayKey(new Date(utc)), expected);
});

test('server round validation and atomic daily rewards handle retries, failures and competing matches', async t => {
  const db = memoryDatabase();
  const app = express();
  app.use(express.json());
  const authenticate = req => {
    const uid = req.header('X-Test-User');
    if (!uid) throw Error('No session');
    return uid;
  };
  register(app, db, authenticate, __dirname);
  require('./upgrader-routes')(app, db, authenticate, __dirname);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = 'http://127.0.0.1:' + server.address().port;
  function state(playerScore, robotScore, league = 'Bronze') {
    const state = { userId: 'alice', league, player: team('p', playerScore), robot: team('r', robotScore),
      startedAt: Date.now(), moves: [], seed: 'test-seed', favourites: ['fav-a', 'fav-b', 'fav-c'] };
    let view;
    for (let index = 0; index < 10; index++) {
      const move = { round: index + 1, cardId: state.player[index].card.id, action: index % 2 ? null : 'attack' };
      const applied = applyMove(state, move);
      state.moves.push(applied.move);
      view = applied.next;
    }
    assert.equal(view.round, 11);
    const ref = db.collection('benBalMatches').doc();
    db.records.set(ref.key, state);
    return { ref, move: { round: 11, cardId: state.player[10].card.id, action: 'attack' } };
  }
  const post = ({ ref, move }, user = 'alice') => fetch(url + '/ben-bal/matches/' + ref.id + '/round', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { 'X-Test-User': user } : {}) },
    body: JSON.stringify({ ...move, winner: 'player', reward: { awarded: true } })
  });
  const items = () => [...db.records].filter(([key]) => key.startsWith('items/')).map(([, item]) => item);
  const setFavourite = (slot, itemId, user = 'alice') => fetch(url + '/upgraders/favourites', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { 'X-Test-User': user } : {}) },
    body: JSON.stringify({ slot, itemId, effectiveness: 100 })
  });
  const favouriteValues = () => ['fav-a', 'fav-b', 'fav-c'].map(id => db.records.get('cardEffectiveness/' + id)?.value ?? 0);
  db.records.set('users/admin', { isAdmin: true });
  for (const name of rules.leagues) {
    db.records.set('packs/' + name, { name: name + ' daily', cardIds: ['fixture.png'] });
    db.records.set('ascendTiers/' + name.toLowerCase() + '-id', { name });
  }
  const settings = Object.fromEntries(rules.leagues.map(name => [name, { packId: name, range: null }]));
  const admin = (user, config) => fetch(url + '/ben-bal/admin/leagues', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Test-User': user }, body: JSON.stringify(config)
  });
  assert.equal((await admin('alice', settings)).status, 403);
  assert.equal((await admin('admin', settings)).status, 200);
  const loaded = await (await fetch(url + '/ben-bal/admin/leagues', { headers: { 'X-Test-User': 'admin' } })).json();
  assert.deepEqual(loaded.config, settings);
  const a = state(95, 20), b = state(95, 20), c = state(95, 20), d = state(95, 20);
  assert.equal((await post(a, '')).status, 401);
  assert.equal((await post(a, 'bob')).status, 404);
  assert.equal((await post({ ...a, move: { ...a.move, cardId: 'patt1' } })).status, 409);
  const legacy = state(95, 20);
  const legacyState = db.records.get(legacy.ref.key);
  delete legacyState.league;
  assert.equal((await post(legacy)).status, 409);
  legacyState.moves.push(legacy.move);
  legacyState.reward = { day: dayKey(new Date()), count: 1, limit: 3, awarded: true };
  assert.deepEqual((await (await post(legacy)).json()).reward, legacyState.reward);
  assert.equal(items().length, 0);
  for (const id of ['fav-a', 'fav-b', 'fav-c', 'fav-other']) db.records.set('items/' + id, {
    buyerId: id === 'fav-other' ? 'bob' : 'alice', sold: true, itemType: 'card', imageUrl: '/images/Bronze_fixture.png'
  });
  assert.equal((await setFavourite(0, 'fav-a', '')).status, 401);
  assert.equal((await setFavourite(0, 'fav-other')).status, 400);
  assert.equal((await setFavourite(3, 'fav-a')).status, 400);
  assert.equal((await setFavourite(0, 'fav-a')).status, 200);
  assert.equal((await setFavourite(1, 'fav-a')).status, 400);
  assert.equal((await setFavourite(1, 'fav-b')).status, 200);
  assert.equal((await setFavourite(2, 'fav-c')).status, 200);
  db.records.set('cardEffectiveness/fav-c', { ownerId: 'alice', value: 99 });
  assert.equal((await setFavourite(0, null)).status, 200);
  db.failNext();
  assert.equal((await post(a)).status, 503);
  assert.deepEqual(favouriteValues(), [0, 0, 99]);
  const first = await (await post(a)).json();
  assert.equal(first.next.winner, 'player');
  assert.equal(first.reward.awarded, true);
  assert.equal(first.reward.count, 1);
  assert.deepEqual((await (await post(a)).json()).reward, first.reward);
  assert.deepEqual(favouriteValues(), [3, 3, 100]);
  const outcomes = await Promise.all([b, c, d].map(async match => (await (await post(match)).json()).reward));
  assert.deepEqual(outcomes.map(r => r.count).sort(), [2, 3, 3]);
  assert.equal(outcomes.filter(r => r.awarded).length, 2);
  assert.equal(items().filter(item => item.packId).length, 3);
  assert.ok(items().filter(item => item.packId).every(item => item.buyerId === 'alice' && item.packId === 'Bronze' && item.name === 'Bronze daily'));
  assert.deepEqual(favouriteValues(), [12, 12, 100]);
  for (const [fixture, winner] of [[state(0, 0), 'draw'], [state(20, 95), 'robot']]) {
    const reply = await (await post(fixture)).json();
    assert.equal(reply.next.winner, winner);
    assert.equal(reply.reward.awarded, false);
    assert.equal(reply.reward.count, 3);
  }
  assert.deepEqual(favouriteValues(), [15, 15, 100]);
  for (const league of rules.leagues.slice(1)) {
    const results = await Promise.all(Array.from({ length: 4 }, () => post(state(95, 20, league))));
    const receipts = await Promise.all(results.map(async response => (await response.json()).reward));
    assert.equal(receipts.filter(receipt => receipt.awarded).length, 3);
    assert.ok(receipts.every(receipt => receipt.pack.id === league));
  }
  assert.equal(items().filter(item => item.packId).length, 18);
  assert.deepEqual(favouriteValues(), [75, 75, 100]);
  assert.equal((await setFavourite(0, 'fav-a')).status, 200);
  const favouriteResponse = await fetch(url + '/upgraders/favourites', { headers: { 'X-Test-User': 'alice' } });
  assert.deepEqual((await favouriteResponse.json()).slots.map(card => card.effectiveness), [75, 75, 100]);
  const picker = await fetch(url + '/upgraders/favourites?select=1', { headers: { 'X-Test-User': 'alice' } });
  const pickerData = await picker.json();
  assert.deepEqual(pickerData.slots, ['fav-a', 'fav-b', 'fav-c']);
  assert.deepEqual(pickerData.cards.map(card => [card.itemId, card.effectiveness]),
    [['fav-a', 75], ['fav-b', 75], ['fav-c', 100]]);
  const menu = await (await fetch(url + '/ben-bal/leagues', { headers: { 'X-Test-User': 'alice' } })).json();
  assert.deepEqual(menu.leagues.map(entry => entry.count), [3, 3, 3, 3, 3, 3]);
  assert.equal(menu.leagues[4].tierId, 'lightning-id');
  assert.equal((await admin('admin', { ...settings, Bronze: { packId: 'Gold', range: null },
    Ultra: { packId: null, range: null } })).status, 200);
  assert.deepEqual((await (await post(a)).json()).reward, first.reward);
  const nextDay = new Date(Date.now() + 36 * 60 * 60 * 1000);
  const reset = await db.runTransaction(tx => settle(tx, db, 'alice', d.ref, 'player', nextDay, 'Bronze'));
  assert.equal(reset.count, 1);
  assert.equal(reset.pack.id, 'Gold');
  assert.notEqual(reset.day, first.reward.day);
  const unconfigured = await db.runTransaction(tx => settle(tx, db, 'alice', d.ref, 'player', nextDay, 'Ultra'));
  assert.equal(unconfigured.count, 0);
  assert.equal(unconfigured.awarded, false);
  assert.equal(unconfigured.pack, null);
  assert.equal(items().filter(item => item.packId === 'Bronze').length, 3);

  const read = createBenBalReader(__dirname, createCardReader(__dirname));
  const catalogue = (await Promise.all((await imageFilenames(__dirname)).map(id => read(id)))).filter(Boolean);
  const headers = { 'Content-Type': 'application/json', 'X-Test-User': 'alice' };
  const saved = new Map();
  for (const league of rules.leagues) {
    const pool = catalogue.filter(card => !rules.eligibility(card, league) && !card.tier.startsWith('Rare ')).slice(0, 11);
    assert.equal(pool.length, 11, league);
    for (const card of pool) db.records.set('items/owned-' + card.id,
      { buyerId: 'alice', sold: true, itemType: 'card', imageUrl: card.imageUrl });
    const lineup = Object.fromEntries(slots.map(({ slot }, index) => [slot, pool[index].id]));
    saved.set(league, lineup);
    const response = await fetch(url + '/ben-bal/team?league=' + league,
      { method: 'PUT', headers, body: JSON.stringify({ lineup }) });
    assert.equal(response.status, 200, await response.text());
  }
  const start = (league, lineup) => fetch(url + '/ben-bal/matches',
    { method: 'POST', headers, body: JSON.stringify({ league, lineup }) });
  assert.equal((await start('Bronze', saved.get('Gold'))).status, 409);
  for (const [league, lineup] of saved) {
    const team = await fetch(url + '/ben-bal/team?league=' + league, { headers });
    assert.deepEqual((await team.json()).lineup, lineup);
    const match = await start(league, lineup);
    const setup = await match.json();
    assert.equal(match.status, 200, setup.error);
    assert.equal(setup.league, league);
    const state = db.records.get('benBalMatches/' + setup.id);
    assert.deepEqual(state.favourites, ['fav-a', 'fav-b', 'fav-c']);
    assert.ok(state.robot.every(entry => !rules.eligibility(entry.card, league)));
    assert.equal(state.marketplaceTierId, league.toLowerCase() + '-id');
    const power = entries => entries.reduce((total, entry) => total + entry.total, 0);
    assert.ok(Math.abs(power(state.robot) / power(state.player) - 1) <= .05, league);
  }
  const upgrades = require('./card-upgrades');
  const bronze = saved.get('Bronze');
  const base = catalogue.find(card => card.id === bronze.att1);
  const token = require('./public/upgrader-catalog').get('legendary:bronze');
  const upgraded = upgrades.roll(base, token, () => 0, undefined, 100);
  db.records.set('cardUpgrades/owned-' + base.id, { ...upgraded, ownerId: 'alice' });
  const upgradedTeam = { ...bronze, att1: upgraded.variantId };
  const upgradedMatch = await start('Bronze', upgradedTeam);
  const upgradedSetup = await upgradedMatch.json();
  assert.equal(upgradedMatch.status, 200, upgradedSetup.error);
  const decorated = db.records.get('benBalMatches/' + upgradedSetup.id).player.find(entry => entry.slot === 'att1').card;
  assert.deepEqual(decorated.stats, upgraded.effectiveStats);
  assert.ok(decorated.overall > base.overall);
  assert.equal(decorated.upgrade.baseOverall, base.overall);
  const restored = upgrades.baseCard(decorated);
  assert.deepEqual(restored.stats, base.stats);
  assert.equal(restored.overall, base.overall);
  assert.equal(decorated.tier, base.tier);
  for (const league of ['Bronze', 'Silver', 'Gold']) {
    const rare = catalogue.filter(card => card.benBal && card.tier === 'Rare ' + league).slice(0, 11);
    assert.equal(rare.length, 11);
    for (const card of rare) db.records.set('items/owned-' + card.id,
      { buyerId: 'alice', sold: true, itemType: 'card', imageUrl: card.imageUrl });
    const lineup = Object.fromEntries(slots.map(({ slot }, index) => [slot, rare[index].id]));
    const urlForTeam = url + '/ben-bal/team?league=' + league;
    assert.equal((await fetch(urlForTeam, { method: 'PUT', headers, body: JSON.stringify({ lineup }) })).status, 200);
    const team = await (await fetch(urlForTeam, { headers })).json();
    assert.deepEqual(team.lineup, lineup);
    assert.deepEqual(team.tiers, [league, 'Rare ' + league]);
    assert.ok(rare.every(card => team.owned.some(entry => entry.id === card.id && !entry.special && !entry.eligibility)));
    const response = await start(league, lineup);
    const setup = await response.json();
    assert.equal(response.status, 200, setup.error);
    const state = db.records.get('benBalMatches/' + setup.id);
    assert.ok(state.robot.every(entry => team.tiers.includes(entry.card.tier)));
    const power = entries => entries.reduce((sum, entry) => sum + entry.total, 0);
    assert.ok(Math.abs(power(state.robot) / power(state.player) - 1) <= .05, league);
  }
  const rareBronze = db.records.get('benBalTeams/alice/leagues/Bronze').lineup;
  const mixed = { ...rareBronze, gk: saved.get('Bronze').gk };
  assert.equal((await start('Bronze', mixed)).status, 200);
  const wrongRare = db.records.get('benBalTeams/alice/leagues/Silver').lineup.gk;
  assert.equal((await start('Bronze', { ...mixed, gk: wrongRare })).status, 409);
  assert.equal((await fetch(url + '/ben-bal/team?league=Bronze', {
    method: 'PUT', headers, body: JSON.stringify({ lineup: { ...mixed, gk: wrongRare } })
  })).status, 409);
});

test('league eligibility uses tier metadata and permits at most one Special in range', () => {
  const card = tier => ({ tier, overall: 50, benBal: pairs });
  const config = { range: { min: 45, max: 50 } };
  assert.equal(rules.eligibility(card('Lightling'), 'Lightning'), '');
  assert.equal(rules.eligibility(card('Rare Bronze'), 'Bronze'), '');
  assert.equal(rules.lineupError([...Array(10).fill(card('Rare Bronze')), card('Mirror')], 'Bronze', config), '');
  for (const league of rules.leagues) {
    for (const tier of ['Bronze', 'Silver', 'Gold']) {
      assert.equal(rules.isSpecial(card('Rare ' + tier)), false);
      assert.equal(!rules.eligibility(card('Rare ' + tier), league), tier === league);
    }
  }
  assert.ok(rules.eligibility(card('Mirror'), 'Bronze'));
  assert.equal(rules.lineupError([card('Bronze'), card('Mirror')], 'Bronze', config), '');
  assert.match(rules.lineupError([card('Mirror'), card('MOTM')], 'Bronze', config), /Only one/);
  assert.match(rules.eligibility(card('Mirror'), 'Bronze', { range: { min: 51, max: 60 } }), /51 to 60/);
});

test('the existing robot balances stronger Rare teams without a rarity multiplier', () => {
  const { generateTeam } = require('./public/ben-bal-robot');
  const field = (prefix, value, tier) => team(prefix, value)
    .map(entry => prepareCard({ ...entry.card, tier }, entry.slot, entry.role));
  const regular = field('bronze-', 40, 'Bronze');
  const rare = field('rare-bronze-', 65, 'Rare Bronze');
  const pool = [...regular, ...rare].map(entry => entry.card);
  const power = entries => entries.reduce((sum, entry) => sum + entry.total, 0);
  const bots = [regular, rare].map(player => {
    const bot = generateTeam(pool, player, () => .4, rules.isSpecial);
    assert.ok(Math.abs(power(bot) / power(player) - 1) <= .05);
    return bot;
  });
  assert.ok(power(bots[1]) > power(bots[0]));
  assert.ok(bots[1].filter(entry => entry.card.tier === 'Rare Bronze').length >= 10);
});

test('robot generator enforces the Special cap in its search and power fallback', () => {
  const { generateTeam } = require('./public/ben-bal-robot');
  const regular = team('regular-', 40).map(entry => ({ ...entry.card, tier: 'Bronze' }));
  const special = team('special-', 95).slice(0, 3).map(entry => ({ ...entry.card, tier: 'Mirror' }));
  for (const target of [3000, 10000]) {
    const lineup = generateTeam([...regular, ...special], target, () => .4, rules.isSpecial);
    assert.equal(lineup.length, 11);
    assert.ok(lineup.filter(entry => rules.isSpecial(entry.card)).length <= 1);
  }
  assert.throws(() => generateTeam([...regular.slice(0, 9), ...special], 3000, () => .4, rules.isSpecial),
    /too few eligible cards/);
});
