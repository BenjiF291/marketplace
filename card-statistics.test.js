const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { createCardReader, imageFilenames, readLocalCard, registerCardData } = require('./card-data');
const { packageCardData } = require('./package-card-data.cjs');

const stats = { pow: 10, ama: 31, size: 79, rang: 40, loy: 53, acu: 20 };
const id = 'ab'.repeat(32);
const filename = 'gold_test_' + id + '.png';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'marketplace-card-data-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const images = path.join(root, 'public', 'images');
  const metadata = path.join(root, '.card-creator');
  await fs.mkdir(images, { recursive: true });
  await fs.mkdir(metadata);
  const write = async (name, changes = {}, stem = 'legacy-' + createHash('sha256').update(name).digest('hex')) => {
    await fs.writeFile(path.join(images, name), 'fixture image');
    await fs.writeFile(path.join(metadata, stem + '.card.json'), JSON.stringify({
      schemaVersion: 1, id: name, filename: name, name: 'Test Card', tier: 'Gold', overall: 57, stats,
      portrait: { image: 'private base64' }, migration: { reviewed: true }, imageUrl: '/private/path',
      ...changes
    }));
  };
  return { root, images, metadata, write };
}

test('card-data uses the existing catalogue and exposes only stored public values', async t => {
  const { root, images, write } = await fixture(t);
  await write(filename, { id }, id);
  const otherId = 'cd'.repeat(32);
  const otherFilename = 'gold_test_' + otherId + '.png';
  await write(otherFilename, { id: otherId }, otherId);
  await write('Mini_test.png', { tier: 'Mini', overall: 90, stats: { ...stats, size: null } });
  await write('Gold_bad.png', { stats: { ...stats, pow: '10' } });
  await fs.writeFile(path.join(images, 'Gold_missing.png'), 'fixture image');
  const app = express();
  registerCardData(app, root);
  const listener = app.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  t.after(() => new Promise(resolve => listener.close(resolve)));
  const request = card => fetch('http://127.0.0.1:' + listener.address().port + '/card-data?' + new URLSearchParams({ card }));
  const names = await (await fetch('http://127.0.0.1:' + listener.address().port + '/card-display-names')).json();
  assert.deepEqual(names.filter(row => row.id === id || row.id === otherId), [
    { filename, id, name: 'Test Card', tier: 'Gold' },
    { filename: otherFilename, id: otherId, name: 'Test Card', tier: 'Gold' }
  ]);
  assert.equal(names.some(row => row.filename === 'Gold_missing.png'), false);
  assert.ok(names.every(row => Object.keys(row).length === 4));
  const expected = { id, name: 'Test Card', tier: 'Gold', overall: 57, stats, imageUrl: '/images/' + filename };
  for (const identifier of [filename, id]) {
    const result = await request(identifier);
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), expected);
  }
  const special = await (await request('Mini_test.png')).json();
  assert.equal(special.overall, 90);
  assert.equal(special.stats.size, null);
  assert.equal(special.stats.pow + special.stats.acu, 30);
  for (const unavailable of ['Gold_bad.png', 'Gold_missing.png', '../.card-creator', 'nonexistent.png']) {
    const result = await request(unavailable);
    assert.equal(result.status, 404);
    assert.deepEqual(await result.json(), { error: 'Card statistics unavailable.' });
  }
});

test('packaging is deterministic, strips private fields, and runs without the source records', async t => {
  const { root, metadata, images, write } = await fixture(t);
  await write(filename, { id }, id);
  await fs.writeFile(path.join(images, 'Gold_missing.png'), 'fixture image');
  assert.deepEqual(await packageCardData(root), { included: 1, missing: 1 });
  const exportPath = path.join(root, 'data', 'card-statistics.json');
  const exported = await fs.readFile(exportPath, 'utf8');
  assert.doesNotMatch(exported, /portrait|migration|base64|private/);
  await packageCardData(root);
  assert.equal(await fs.readFile(exportPath, 'utf8'), exported);
  await fs.writeFile(path.join(metadata, id + '.card.json'), '{malformed');
  assert.equal(await createCardReader(root)(filename), null);
  await assert.rejects(packageCardData(root), /Invalid structured record/);
  assert.equal(await fs.readFile(exportPath, 'utf8'), exported);
  await fs.unlink(path.join(metadata, id + '.card.json'));
  const read = createCardReader(root);
  assert.equal((await read(id)).overall, 57);
  assert.equal(await read('Gold_missing.png'), null);
  await fs.writeFile(path.join(images, 'gold_duplicate_' + id + '.png'), 'fixture image');
  assert.equal(await read(filename), null);
  assert.equal(await read(id), null);
});

test('the shipped catalogue covers every local catalogue image across all 16 tiers', async () => {
  const packaged = JSON.parse(await fs.readFile(path.join(__dirname, 'data', 'card-statistics.json'), 'utf8'));
  assert.ok(packaged.cards.length >= 96);
  const filenames = new Set(await imageFilenames(__dirname));
  assert.deepEqual(new Set(packaged.cards.map(card => card.filename)), filenames);
  assert.equal(packaged.cards.length, filenames.size);
  const read = createCardReader(__dirname);
  const tiers = new Set();
  let nullCount = 0;
  for (const { filename: name, ...expected } of packaged.cards) {
    assert.ok(filenames.has(name), name);
    const local = await readLocalCard(__dirname, name);
    assert.notEqual(local.status, 'invalid', name);
    if (local.card) assert.deepEqual(local.card, expected, name);
    assert.deepEqual(await read(name), expected);
    assert.deepEqual(await read(expected.id), expected);
    assert.equal(typeof expected.overall, 'number');
    assert.equal(Object.keys(expected.stats).length, 6);
    for (const value of Object.values(expected.stats)) {
      if (value === null) nullCount++;
      else assert.equal(typeof value, 'number');
    }
    tiers.add(expected.tier);
  }
  assert.equal(tiers.size, 16);
  assert.ok(nullCount > 0);
});
