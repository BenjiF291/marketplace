const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const express = require('express');
const { once } = require('node:events');
const { createEngine, status } = require('./event-manager');

function memory() {
  const data = new Map();
  let serial = 0, queue = Promise.resolve();
  const snapshot = ref => ({ id: ref.id, ref, exists: data.has(ref.path), data: () => structuredClone(data.get(ref.path)) });
  const collection = (path, filter = [], cap = Infinity, sorted = null) => ({
    doc(id = 'id-' + ++serial) {
      const ref = { id, path: path + '/' + id, get: async () => snapshot(ref),
        delete: async () => { data.delete(ref.path); }, collection: name => collection(ref.path + '/' + name) };
      return ref;
    },
    where: (field, op, value) => collection(path, [...filter, [field, op, value]], cap, sorted),
    orderBy: field => collection(path, filter, cap, field),
    limit: size => collection(path, filter, size, sorted),
    async get() {
      const docs = [...data].filter(([id]) => id.startsWith(path + '/') && !id.slice(path.length + 1).includes('/'))
        .filter(([, row]) => filter.every(([field, op, value]) => op === '==' ? row[field] === value
          : op === '>' ? row[field] > value : row[field] <= value));
      if (sorted) docs.sort((a, b) => a[1][sorted] - b[1][sorted]);
      return { docs: docs.slice(0, cap).map(([id]) => snapshot(this.doc(id.split('/').at(-1)))) };
    }
  });
  const db = { data, collection, runTransaction(run) {
    const pending = queue.then(async () => {
      const writes = new Map();
      const result = await run({
        get: async ref => { assert.equal(writes.size, 0, 'all reads must precede writes'); return snapshot(ref); },
        set: (ref, value) => writes.set(ref.path, structuredClone(value)),
        update: (ref, value) => writes.set(ref.path, { ...data.get(ref.path), ...structuredClone(value) }),
        delete: ref => writes.set(ref.path, null)
      });
      for (const [path, record] of writes) {
        if (record === null) data.delete(path);
        else data.set(path, record);
      }
      return result;
    });
    queue = pending.catch(() => {});
    return pending;
  } };
  return db;
}
const pack = { kind: 'pack', id: 'gold', amount: 1 };
const footy = { kind: 'footy', amount: 10 };
const shard = { kind: 'upgradeShard', id: 'shard:gold', amount: 2 };
const objective = (type = 'WIN_BEN_BAL_MATCH', mode = 'repeat', rewards = [pack]) =>
  ({ type, mode, target: 1, rewards, filters: { league: 'Gold' } });
const config = (objectives, limits = {}, schedule = {}) => ({ name: 'Bonanza', description: 'Bonus packs',
  objectives, limits, schedule: { duration: 86400000, ...schedule } });

test('event lifecycle, simultaneous objectives, durable retries, limits, snapshots and ordinary inventories', async () => {
  const db = memory();
  const base = Date.UTC(2026, 9, 24, 21, 55);
  let now = base, engine = createEngine(db, __dirname, () => now);
  db.data.set('users/alice', { balance: 20 });
  db.data.set('users/bob', { balance: 100 });
  db.data.set('packs/gold', { name: 'Gold Pack', cardIds: ['Bronze_emma.png'] });
  const draft = await engine.save(null, config([]), 'draft');
  assert.equal(status(db.data.get('fishyEvents/' + draft.id), now), 'draft');
  const scheduled = await engine.save(draft.id, config([objective()], {}, { start: base + 1000 }), 'schedule');
  assert.equal(status(db.data.get('fishyEvents/' + scheduled.id), now), 'upcoming');
  now += 1000;
  assert.equal(status(db.data.get('fishyEvents/' + scheduled.id), now), 'active');
  const bonus = await engine.save(null, config([objective(undefined, 'repeat', [footy, shard])], { global: 1 }), 'activate');
  const milestone = await engine.save(null, config([{ type: 'COMPLETE_BEN_BAL_MATCH', mode: 'milestone',
    milestones: [{ target: 2, rewards: [footy] }, { target: 3, rewards: [shard] }] }]), 'activate');
  const limited = await engine.save(null, config([objective(undefined, 'repeat', [footy])], { player: 2, daily: 1 }), 'activate');
  const participant = (id, name) => db.data.get('fishyEvents/' + id + '/participants/' + name);
  const add = (name, id, won = true, at = now) => db.runTransaction(tx =>
    engine.record(tx, name, id, won ? ['COMPLETE_BEN_BAL_MATCH', 'WIN_BEN_BAL_MATCH'] : ['COMPLETE_BEN_BAL_MATCH'], { league: 'Gold' }, at));
  db.data.delete('packs/gold');
  await add('alice', 'm1');
  await add('bob', 'm2');
  await engine.drain();
  assert.equal(db.data.get('fishyEventStats/' + bonus.id).rewarded, 1);
  assert.equal(participant(scheduled.id, 'alice').rewarded, 1);
  assert.equal(participant(limited.id, 'alice').rewarded, 1);
  assert.equal(participant(milestone.id, 'alice').rewarded, 0);
  const item = [...db.data].find(([id, value]) => id.startsWith('items/') && value.buyerId === 'alice')[1];
  assert.equal(item.itemType, 'pack');
  assert.equal((await engine.packRef(item.packId).get()).data().name, 'Gold Pack');
  assert.ok([30, 40].includes(db.data.get('users/alice').balance));
  await add('alice', 'm1');
  await add('alice', 'm3', false);
  engine = createEngine(db, __dirname, () => now);
  await engine.drain();
  assert.equal(participant(scheduled.id, 'alice').rewarded, 1);
  assert.equal(participant(milestone.id, 'alice').rewarded, 1);
  await add('alice', 'm4');
  await engine.drain();
  assert.equal(participant(milestone.id, 'alice').rewarded, 2);
  assert.equal(participant(limited.id, 'alice').rewarded, 1);
  assert.equal(participant(scheduled.id, 'alice').rewarded, 2);
  now = Date.UTC(2026, 9, 24, 22, 5);
  await add('alice', 'm5');
  await engine.drain();
  assert.equal(participant(scheduled.id, 'alice').rewarded, 3);
  assert.equal(participant(limited.id, 'alice').rewarded, 2);
  assert.equal(db.data.get('upgradeWallets/alice').counts['shard:gold'] >= 2, true);
  const duplicate = await engine.save(scheduled.id, {}, 'duplicate');
  assert.equal(status(db.data.get('fishyEvents/' + duplicate.id), now), 'draft');
  assert.equal(participant(duplicate.id, 'alice'), undefined);
  await assert.rejects(engine.save(scheduled.id, config([objective()]), 'schedule'), /only be edited/);
  await engine.save(scheduled.id, { name: 'Renamed' }, 'presentation');
  assert.equal(db.data.get('fishyEvents/' + scheduled.id).objectives[0].thresholds[0].rewards[0].id, 'gold');
  const end = db.data.get('fishyEvents/' + scheduled.id).end;
  now = end;
  assert.equal(status(db.data.get('fishyEvents/' + scheduled.id), now), 'past');
  await add('alice', 'm6', true, end);
  await add('alice', 'm7', true, end - 1);
  await engine.drain();
  assert.equal(participant(scheduled.id, 'alice').rewarded, 4);
});

test('failed event fulfillment retries independently without granting a successful bundle twice', async () => {
  const db = memory();
  let now = 2000000000000;
  const engine = createEngine(db, __dirname, () => now);
  db.data.set('users/alice', { balance: 0 });
  db.data.set('packs/gold', { name: 'Gold Pack', cardIds: ['Bronze_emma.png'] });
  const fail = await engine.save(null, config([objective()]), 'activate');
  const other = await engine.save(null, config([objective(undefined, 'repeat', [footy])]), 'activate');
  const snapshot = db.data.get('fishyEvents/' + fail.id).objectives[0].thresholds[0].rewards[0].snapshot;
  const ref = 'eventPackSnapshots/' + snapshot, saved = db.data.get(ref);
  db.data.delete(ref);
  await db.runTransaction(tx => engine.record(tx, 'alice', 'match', ['WIN_BEN_BAL_MATCH'], { league: 'Gold' }));
  await engine.drain();
  assert.equal(db.data.get('users/alice').balance, 10);
  assert.equal(db.data.has('fishyEventStats/' + fail.id), false);
  assert.equal(db.data.get('fishyEventStats/' + other.id).rewarded, 1);
  db.data.set(ref, saved);
  now += 5000;
  await engine.drain();
  assert.equal(db.data.get('users/alice').balance, 10);
  assert.equal(db.data.get('fishyEventStats/' + fail.id).rewarded, 1);
  assert.equal([...db.data.keys()].filter(k => k.startsWith('items/')).length, 1);
});

test('player API cannot write event definitions or forge progress, and receipt acknowledgment is owner-only', async t => {
  const db = memory(), app = express();
  app.use(express.json());
  db.data.set('users/admin', { isAdmin: true });
  require('./event-routes')(app, db, req => {
    const user = req.header('x-test-id');
    if (!user) throw Error('Unauthenticated');
    return user;
  }, __dirname);
  db.data.set('fishyEventReceipts/receipt', { owner: 'alice', acknowledged: false, at: 1 });
  const listener = app.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  t.after(() => new Promise(resolve => listener.close(resolve)));
  const url = 'http://127.0.0.1:' + listener.address().port;
  const post = (path, user, body = {}) => fetch(url + path, { method: 'POST',
    headers: { 'x-test-id': user, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await fetch(url + '/events')).status, 401);
  assert.equal((await post('/admin/events', 'alice', { ...config([]), operation: 'draft' })).status, 403);
  assert.equal((await post('/admin/events', 'admin', { ...config([]), operation: 'draft' })).status, 200);
  assert.equal((await post('/events', 'alice', { type: 'WIN_BEN_BAL_MATCH' })).status, 404);
  assert.equal((await post('/events/receipts/receipt', 'bob')).status, 400);
  assert.equal((await post('/events/receipts/receipt', 'alice')).status, 200);
});

test('verified upgrade, crafting, purchase and sale sources filter independently and grant normal card instances', async () => {
  const db = memory(), now = 2000000000000, engine = createEngine(db, __dirname, () => now);
  db.data.set('users/alice', { balance: 0 });
  db.data.set('users/bob', { balance: 0 });
  const event = await engine.save(null, config([
    { ...objective('UPGRADE_CARD_TO_EPIC', 'once', [{ kind: 'card', id: 'Rare-bronze_jop.png', amount: 1 }]), filters: { tier: 'Gold' } },
    objective('UPGRADE_CARD_TO_LEGENDARY', 'once', [{ kind: 'randomCardByTier', id: 'bronze:regular', amount: 2 }]),
    { ...objective('CRAFT_UPGRADER', 'once', [shard]), filters: { level: 'legendary' } },
    objective('PURCHASE_ITEM', 'once', [footy]), objective('SELL_ITEM', 'once', [footy])
  ]), 'activate');
  const signal = (owner, type, id, filters) => db.runTransaction(tx => engine.record(tx, owner, id, [type], filters));
  await signal('alice', 'UPGRADE_CARD_TO_EPIC', 'wrong-tier', { tier: 'Silver' });
  await signal('alice', 'UPGRADE_CARD_TO_EPIC', 'right-tier', { tier: 'Gold' });
  await signal('alice', 'UPGRADE_CARD_TO_LEGENDARY', 'legendary', { tier: 'Gold' });
  await signal('alice', 'CRAFT_UPGRADER', 'wrong-level', { level: 'epic' });
  await signal('alice', 'CRAFT_UPGRADER', 'right-level', { level: 'legendary' });
  await signal('alice', 'PURCHASE_ITEM', 'purchase', {});
  await signal('bob', 'SELL_ITEM', 'sale', {});
  await engine.drain();
  const awarded = [...db.data].filter(([id]) => id.startsWith('items/'));
  assert.equal(awarded.length, 3);
  assert.ok(awarded.some(([, item]) => item.imageUrl === '/images/Rare-bronze_jop.png'));
  assert.equal(awarded.filter(([, item]) => item.imageUrl.toLowerCase().startsWith('/images/bronze_')).length, 2);
  assert.ok(awarded.every(([, item]) => item.buyerId === 'alice' && item.itemType === 'card' && !item.upgrade));
  assert.deepEqual(db.data.get('fishyEvents/' + event.id + '/participants/alice').progress, { 0: 1, 1: 1, 2: 1, 3: 1 });
  assert.equal(db.data.get('users/alice').balance, 10);
  assert.equal(db.data.get('users/bob').balance, 10);
});
