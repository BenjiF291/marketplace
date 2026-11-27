const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { imageFilenames } = require('./card-data');

const browserSource = fs.readFileSync(path.join(__dirname, 'public/app.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const client = browserSource.slice(browserSource.indexOf('async function assignTierCards('),
  browserSource.indexOf('async function openTierCardPicker('));
const route = serverSource.slice(serverSource.indexOf("app.post('/ascend-tier-assignment'"),
  serverSource.indexOf('/* ------------------ PACKS ------------------ */'));

function fixture(catalogue, { legacy = false, cards = [], rejected } = {}) {
  const tier = { id: 'bronze', cards: [...cards], packs: ['pack'] };
  const requests = [];
  let handler;
  const db = {
    collection: () => ({ doc: id => id }),
    runTransaction: callback => callback({
      get: async id => ({ exists: id === tier.id, data: () => tier }),
      update: (id, patch) => Object.assign(tier, patch)
    })
  };
  new Function('app', 'db', 'userIsAdmin', 'imageFilenames', '__dirname', route)(
    { post: (_, callback) => { handler = callback; } }, db, async id => id === 'admin', async () => catalogue, __dirname
  );
  async function fetch(url, options = {}) {
    if (url.endsWith('/ascend-tier-config')) return Response.json([tier]);
    const body = JSON.parse(options.body);
    requests.push(body);
    if (legacy) {
      if (typeof body.value !== 'string' || !body.value.trim() || body.value === rejected) {
        return new Response('Invalid value', { status: 400 });
      }
      tier.cards = [...new Set([...tier.cards, body.value])];
      return Response.json({ success: true, cards: tier.cards });
    }
    let result;
    const response = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      send(message) { result = new Response(message, { status: this.statusCode }); },
      json(value) { result = Response.json(value, { status: this.statusCode }); }
    };
    await handler({ body, header: name => options.headers[name] }, response);
    return result;
  }
  const assign = new Function('fetch', 'API_URL', 'currentUserId', client + '\nreturn assignTierCards;')(
    fetch, 'http://fixture.invalid', 'admin'
  );
  return { assign, requests, tier, fetch };
}

test('legacy rejection is reproduced and mixed selections of 1, 5 and 23 save in order', async () => {
  const catalogue = await imageFilenames(__dirname);
  const short = catalogue.filter(id => !/[a-f0-9]{32}/i.test(id)).slice(0, 12);
  const imported = catalogue.filter(id => /[a-f0-9]{32}/i.test(id)).slice(0, 17);
  const batches = [[short[0]], [...short.slice(1, 3), ...imported.slice(0, 3)],
    [...short.slice(3), ...imported.slice(3)]];
  assert.deepEqual(batches.map(batch => batch.length), [1, 5, 23]);
  const { assign, requests, tier, fetch } = fixture(catalogue, { legacy: true });
  const original = await fetch('/ascend-tier-assignment', {
    body: JSON.stringify({ tierId: tier.id, type: 'card', action: 'add', values: batches[2] })
  });
  assert.equal(original.status, 400);
  assert.equal(await original.text(), 'Invalid value');
  assert.deepEqual(tier.cards, []);
  for (const batch of batches) {
    const start = requests.length;
    assert.deepEqual(await assign(tier.id, batch), { added: batch, alreadyAssigned: [], failed: [] });
    assert.deepEqual(requests[start].values, batch);
    assert.deepEqual(requests.slice(start + 1).map(request => request.value), batch);
  }
  assert.deepEqual((await (await fetch('/ascend-tier-config')).json())[0].cards, batches.flat());
  assert.deepEqual((await assign(tier.id, [short[0]])).alreadyAssigned, [short[0]]);
  assert.equal(tier.cards.length, 29);
});

test('the current handler saves in one transaction and preserves legacy single-card requests', async () => {
  const catalogue = await imageFilenames(__dirname);
  const [first, second] = catalogue;
  const { assign, tier, requests, fetch } = fixture(catalogue, { cards: [first] });
  const unavailable = 'missing-card.png';
  const result = await assign(tier.id, [first, second, unavailable]);
  assert.deepEqual(result.added, [second]);
  assert.deepEqual(result.alreadyAssigned, [first]);
  assert.deepEqual(result.failed, [{ id: unavailable, reason: 'Card is no longer in the catalogue.' }]);
  assert.equal(requests.length, 1);
  assert.deepEqual(tier.cards, [first, second]);
  const post = body => fetch('/ascend-tier-assignment', {
    body: JSON.stringify({ tierId: tier.id, type: 'card', action: 'add', ...body }),
    headers: { 'X-User-Id': 'admin' }
  });
  const single = await post({ value: catalogue[2] });
  assert.equal(single.status, 200);
  assert.deepEqual((await single.json()).cards, catalogue.slice(0, 3));
  for (const invalid of ['../' + first, 'C:\\images\\' + first, 'images/' + first]) {
    assert.equal((await post({ values: [invalid] })).status, 400);
  }
  assert.deepEqual(tier.packs, ['pack']);
});

test('a failed legacy assignment is reported while other selected cards save', async () => {
  const catalogue = await imageFilenames(__dirname);
  const [first, rejected, third] = catalogue;
  const { assign, tier } = fixture(catalogue, { legacy: true, rejected });
  assert.deepEqual(await assign(tier.id, [first, rejected, third]), {
    added: [first, third], alreadyAssigned: [],
    failed: [{ id: rejected, reason: 'The server rejected the selected card identifier.' }]
  });
  assert.deepEqual(tier.cards, [first, third]);
});
