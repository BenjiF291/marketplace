const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { cards } = require('./data/card-statistics.json');
const { createCardReader, registerCardData } = require('./card-data');
const { allocationFile, readAllocations, createBenBalReader } = require('./ben-bal-allocations');
const { packageCardData } = require('./package-card-data.cjs');
const { backgrounds, cardValues, formation, naturalPosition, roles, statKeys } = require('./public/ben-bal-card');
const registerBenBal = require('./ben-bal-routes');
const createSessionAuth = require('./brawl-auth');
const { slots, playable } = require('./public/ben-bal-match-engine');

test('all release cards preserve their statistics and saved allocations', async () => {
  const allocations = await readAllocations(__dirname);
  const read = createBenBalReader(__dirname, createCardReader(__dirname));
  const freshReader = createBenBalReader(__dirname, createCardReader(__dirname));
  assert.ok(cards.length >= 96);
  assert.equal(allocations.size, cards.filter(card => Object.values(card.stats).every(Number.isFinite)).length);
  assert.equal(new Set(cards.map(card => card.tier)).size, 16);
  for (const { filename, ...original } of cards) {
    const { benBal, ...card } = await read(filename);
    assert.deepEqual(card, original);
    assert.ok((await fs.stat(path.join(__dirname, 'public', 'assets', 'ben-bal', backgrounds[card.tier]))).size > 0);
    if (Object.values(card.stats).includes(null)) {
      assert.equal(benBal, null);
      continue;
    }
    assert.deepEqual(benBal, (await freshReader(card.id)).benBal);
    const keys = roles.flatMap(role => [benBal[role].primary, benBal[role].secondary]);
    assert.deepEqual(keys.sort(), [...statKeys].sort());
    for (const role of roles) {
      assert.deepEqual(allocations.get(card.id)[role], benBal[role]);
      assert.ok(card.stats[benBal[role].primary] >= card.stats[benBal[role].secondary], card.id + ' ' + role);
    }
    const primary = card.stats[benBal[benBal.naturalPosition].primary];
    assert.equal(primary, Math.max(...roles.map(role => card.stats[benBal[role].primary])));
    for (const row of formation) {
      const { penalty, values } = cardValues({ ...card, benBal }, row.role);
      assert.equal(penalty, ['keeper', benBal.naturalPosition].includes(row.role) ? 0 : 10);
      for (const { key, base, effective } of Object.values(values).flatMap(Object.values)) {
        assert.equal(base, original.stats[key]);
        assert.equal(effective, Math.max(0, original.stats[key] - penalty));
      }
    }
  }
});

test('primary ties resolve in Attack, Dribble, Defence order', () => {
  const allocation = {
    attack: { primary: 'pow', secondary: 'ama' },
    dribble: { primary: 'size', secondary: 'rang' },
    defence: { primary: 'loy', secondary: 'acu' }
  };
  const stats = { pow: 7, size: 7, loy: 7, ama: 0, rang: 1, acu: 99 };
  assert.equal(naturalPosition(stats, allocation), 'attack');
  assert.equal(naturalPosition({ ...stats, pow: 6 }, allocation), 'dribble');
  assert.equal(naturalPosition({ ...stats, loy: 8 }, allocation), 'defence');
  const { values } = cardValues({ stats, benBal: { ...allocation, naturalPosition: 'attack' } }, 'defence');
  assert.equal(values.attack.primary.effective, 0);
  assert.equal(values.defence.secondary.effective, 89);
});

test('packaging adds future cards once, preserves legacy allocations, and resolves corrected numeric stats', async t => {
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'ben-bal-release-'));
  t.after(() => fs.rm(project, { recursive: true, force: true }));
  const sidecars = path.join(project, '.card-creator');
  const images = path.join(project, 'public', 'images');
  await fs.mkdir(sidecars);
  await fs.mkdir(images, { recursive: true });
  const filename = 'Mini_new.png';
  const sidecar = path.join(sidecars, 'legacy-' + createHash('sha256').update(filename).digest('hex') + '.card.json');
  const stats = { pow: 8, ama: 9, size: 6, rang: 10, loy: 4, acu: 60 };
  const write = stats => fs.writeFile(sidecar, JSON.stringify({
    schemaVersion: 1, id: filename, filename, name: 'New card', tier: 'Mini', overall: 25, stats
  }));
  const read = () => createBenBalReader(project, createCardReader(project))(filename);
  await fs.writeFile(path.join(images, filename), 'fixture image');
  await write({ ...stats, size: null });
  await packageCardData(project);
  assert.equal((await read()).stats.size, null);
  assert.equal((await read()).benBal, null);
  await write(stats);
  await packageCardData(project);
  const first = await read();
  assert.ok(first.benBal);
  for (const role of roles) {
    assert.ok(stats[first.benBal[role].primary] >= stats[first.benBal[role].secondary]);
  }
  await fs.unlink(sidecar);
  await packageCardData(project);
  assert.deepEqual(await read(), first);

  const { naturalPosition: originalPosition, ...keys } = first.benBal;
  const targetRole = roles.find(role => role !== originalPosition);
  const { primary, secondary } = keys[targetRole];
  const tiedRole = roles.find(role => ![originalPosition, targetRole].includes(role));
  const corrected = { ...stats, [secondary]: 100, [keys[tiedRole].secondary]: stats[keys[tiedRole].primary] };
  const ordered = { ...keys, [targetRole]: { primary: secondary, secondary: primary } };
  await write(corrected);
  assert.deepEqual((await read()).benBal, { ...ordered, naturalPosition: targetRole });
  assert.deepEqual((await readAllocations(project)).get(filename), keys);
  await packageCardData(project);
  const updated = await read();
  assert.deepEqual(updated.stats, corrected);
  assert.deepEqual(updated.benBal, { ...ordered, naturalPosition: targetRole });
  assert.deepEqual((await readAllocations(project)).get(filename), ordered);
  assert.equal(cardValues(updated, 'keeper').values[targetRole].primary.effective, 100);
  const manifest = await fs.readFile(allocationFile(project));
  await packageCardData(project);
  assert.deepEqual(await fs.readFile(allocationFile(project)), manifest);
});

test('team routes bind sessions to users and validate current ownership, slot identities and eligibility', async t => {
  const first = cards.find(card => Object.values(card.stats).every(Number.isFinite));
  const second = cards.find(card => card.id !== first.id && Object.values(card.stats).every(Number.isFinite));
  const incomplete = cards.find(card => Object.values(card.stats).includes(null));
  const teams = new Map();
  const tokens = { alice: 'aa'.repeat(32), bob: 'bb'.repeat(32), nextAlice: 'ab'.repeat(32) };
  const digest = token => createHash('sha256').update(token).digest('hex');
  const session = userId => ({ userId, expiresAt: Date.now() + 60000 });
  const sessions = new Map([[digest(tokens.alice), session('alice')], [digest(tokens.bob), session('bob')]]);
  const makeItem = (card, buyerId, fields = {}) => ({
    imageUrl: card.imageUrl, name: card.name, buyerId, sold: true, itemType: 'card', ...fields
  });
  const inventory = [
    makeItem(first, 'alice'), makeItem(first, 'alice'), makeItem(second, 'bob'),
    makeItem(second, 'alice', { listedForSale: true }), makeItem(second, 'alice', { itemType: 'battle-card' }),
    makeItem(incomplete, 'alice'), makeItem(second, 'alice', { sold: false })
  ];
  const db = {
    collection(name) {
      if (name === 'benBalTeams') return { doc: id => ({ id }) };
      if (name === 'loginSessions') return { doc: id => ({
        get: async () => ({ exists: sessions.has(id), data: () => sessions.get(id) })
      }) };
      assert.equal(name, 'items');
      function query(filters) {
        return { filters, get: async () => ({ docs: inventory
          .filter(item => filters.every(([key, value]) => item[key] === value))
          .map(item => ({ data: () => item })) }), where(key, op, value) {
          assert.equal(op, '==');
          return query([...filters, [key, value]]);
        } };
      }
      return query([]);
    },
    runTransaction: fn => fn({
      get: async ref => ref.filters
        ? { docs: inventory.filter(item => ref.filters.every(([key, value]) => item[key] === value))
          .map(item => ({ data: () => item })) }
        : { data: () => teams.get(ref.id) },
      set: (ref, value) => teams.set(ref.id, structuredClone(value))
    })
  };
  const app = express();
  app.use(express.json());
  registerCardData(app, __dirname);
  registerBenBal(app, db, createSessionAuth(db).authenticate, __dirname);
  const listener = app.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  t.after(() => new Promise(resolve => listener.close(resolve)));
  const base = 'http://127.0.0.1:' + listener.address().port;
  const request = (user, token, body) => fetch(base + '/ben-bal/team', {
    method: body === undefined ? 'GET' : 'PUT',
    headers: { 'X-User-Id': user, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const put = lineup => request('alice', tokens.alice, { lineup, userId: 'bob', stats: { pow: 1000 } });
  const dataQuery = id => fetch(base + '/card-data?' + new URLSearchParams({ card: id, mode: 'ben-bal' }));
  assert.ok((await (await dataQuery(first.id)).json()).benBal);
  assert.equal((await (await dataQuery(incomplete.id)).json()).benBal, null);
  assert.equal((await request('bob', tokens.alice)).status, 401);
  assert.equal((await request('alice', 'invalid')).status, 401);
  assert.equal((await request('bob', tokens.alice, { lineup: { gk: second.id } })).status, 401);
  const initial = await (await request('alice', tokens.alice)).json();
  assert.deepEqual(initial.owned.map(card => card.id), [first.id, incomplete.id]);
  assert.equal((await put({ gk: first.id, att1: first.id })).status, 400);
  assert.equal((await put({ att4: first.id })).status, 400);
  assert.equal((await put({ gk: second.id })).status, 409);
  assert.equal((await put({ gk: incomplete.id })).status, 409);
  assert.equal((await put({ gk: first.id })).status, 200);
  assert.deepEqual(teams.get('alice'), { schemaVersion: 1, lineup: { gk: first.id } });
  assert.equal(teams.has('bob'), false);
  sessions.get(digest(tokens.alice)).expiresAt = Date.now() - 1;
  sessions.set(digest(tokens.nextAlice), session('alice'));
  assert.equal((await request('alice', tokens.alice)).status, 401);
  assert.deepEqual((await (await request('alice', tokens.nextAlice)).json()).lineup, { gk: first.id });
  assert.deepEqual((await (await request('bob', tokens.bob)).json()).lineup, {});
  inventory[0].buyerId = 'bob';
  inventory[1].listedForSale = true;
  const afterSale = await (await request('alice', tokens.nextAlice)).json();
  assert.equal(afterSale.removed, 1);
  assert.deepEqual(afterSale.lineup, {});
  assert.deepEqual(teams.get('alice').lineup, {});
  inventory[1].listedForSale = false;
  assert.deepEqual((await (await request('alice', tokens.nextAlice)).json()).lineup, {});

  const eligible = cards.filter(card => Object.values(card.stats).every(Number.isFinite));
  const draft = Object.fromEntries(slots.map(({ slot }, i) => [slot, eligible[i].id]));
  const setup = (lineup, user = 'alice') => fetch(base + '/ben-bal/robot-setup', {
    method: 'POST',
    headers: { 'X-User-Id': user, Authorization: 'Bearer ' + tokens.nextAlice, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lineup, stats: { pow: 1000 }, overall: 1000 })
  });
  assert.equal((await setup(draft, 'bob')).status, 401);
  assert.equal((await setup({ gk: draft.gk })).status, 400);
  assert.equal((await setup({ ...draft, gk: draft.att1 })).status, 400);
  assert.equal((await setup(draft)).status, 409);
  inventory.push(...eligible.slice(0, 11).map(card => makeItem(card, 'alice')));
  assert.equal((await setup({ ...draft, gk: incomplete.id })).status, 409);
  const inventoryBeforeSetup = structuredClone(inventory);
  const response = await setup(draft);
  assert.equal(response.status, 200);
  const { cards: playerCards, pool } = await response.json();
  assert.deepEqual(playerCards.map(card => card.id), Object.values(draft));
  assert.ok(playerCards.every(playable));
  assert.ok(pool.every(playable));
  assert.ok(pool.length > playerCards.length);
  assert.deepEqual(playerCards[0].stats, eligible[0].stats);
  assert.deepEqual(teams.get('alice').lineup, {});
  assert.deepEqual(inventory, inventoryBeforeSetup);
});
