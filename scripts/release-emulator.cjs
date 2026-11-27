const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');

async function main() {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const project = process.env.GCLOUD_PROJECT;
  assert.match(host ?? '', /^127\.0\.0\.1:\d+$/);
  assert.match(project ?? '', /^demo-[a-z0-9-]+$/);
  const port = process.env.PORT || '34343';
  assert.match(port, /^\d+$/);
  const { db, admin } = require('../firebase-server');
  const origin = 'http://127.0.0.1:' + port;
  const documents = 'http://' + host + '/v1/projects/' + project + '/databases/(default)/documents/';
  const server = spawn(process.execPath, ['server.js'], {
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, PORT: port,
      FIRESTORE_EMULATOR_HOST: host, GCLOUD_PROJECT: project, DOTENV_CONFIG_PATH: '.emulator-no-env' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  const exited = once(server, 'exit');
  try {
    let ready = false;
    for (let i = 0; i < 50 && server.exitCode === null; i++) {
      if (await fetch(origin + '/health', { signal: AbortSignal.timeout(500) }).then(response => response.ok, () => false)) {
        ready = true;
        break;
      }
      await delay(200);
    }
    assert.ok(ready, 'Marketplace did not start on the local emulator');
    assert.equal((await db.collection('users').get()).empty, true, 'Startup created an account');
    const post = (path, body, headers = {}) => fetch(origin + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body)
    });
    const createAccount = async () => {
      const username = 'release-smoke-' + randomUUID();
      const password = randomUUID();
      const signup = await post('/signup', { username, password });
      assert.equal(signup.status, 200);
      const signedUp = await signup.json();
      const login = await post('/login', { username, password });
      assert.equal(login.status, 200);
      const account = await login.json();
      assert.equal(account.id, signedUp.id);
      return account;
    };
    const account = await createAccount();
    assert.equal(account.isAdmin, false);
    const item = db.collection('items').doc();
    await item.set({ buyerId: account.id, sold: true, itemType: 'card', imageUrl: '/images/Bronze_emma.png' });

    const patch = { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { balance: { integerValue: '1' }, isAdmin: { booleanValue: true },
        buyerId: { stringValue: account.id } } }) };
    for (const path of ['users/' + account.id, 'items/' + item.id, 'items/untrusted-card',
      'cardUpgrades/' + item.id, 'cardEffectiveness/' + item.id, 'cardFavourites/' + account.id,
      'upgradeWallets/' + account.id, 'benBalMatches/untrusted-match', 'loginSessions/untrusted-session']) {
      assert.equal((await fetch(documents + path)).status, 403, 'Direct Firestore read: ' + path.split('/')[0]);
      assert.equal((await fetch(documents + path, patch)).status, 403, 'Direct Firestore write: ' + path.split('/')[0]);
    }
    assert.equal((await fetch(documents + 'items/' + item.id, { method: 'DELETE' })).status, 403);
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + account.sessionToken, 'X-User-Id': account.id };
    const inventory = await fetch(origin + '/inventory', { headers });
    assert.equal(inventory.status, 200);
    assert.ok((await inventory.json()).some(entry => entry.id === item.id));
    const favourite = await fetch(origin + '/upgraders/favourites', {
      method: 'POST', headers, body: JSON.stringify({ slot: 0, itemId: item.id })
    });
    assert.equal(favourite.status, 200);
    assert.equal((await favourite.json()).slots[0], item.id);
    assert.equal((await db.collection('users').doc(account.id).get()).data().isAdmin, false);
    const recipient = await createAccount();
    const operator = await createAccount();
    const authenticated = actor => ({ Authorization: 'Bearer ' + actor.sessionToken, 'X-User-Id': actor.id });
    await db.collection('users').doc(account.id).update({ balance: 25 });
    await db.collection('users').doc(recipient.id).update({ balance: 8 });
    await db.collection('users').doc(operator.id).update({ isAdmin: true });
    const transfer = { toUsername: recipient.username, amount: 5 };
    const grant = { username: account.username, cardId: 'Bronze_emma.png', quantity: 1 };
    assert.equal((await post('/transfer', { ...transfer, fromId: account.id })).status, 401);
    assert.equal((await post('/transfer', { ...transfer, fromId: operator.id }, headers)).status, 403);
    assert.equal((await post('/transfer', { ...transfer, amount: -5 }, headers)).status, 400);
    assert.equal((await post('/transfer', { ...transfer, amount: 26 }, headers)).status, 400);
    assert.equal((await post('/transfer', transfer, headers)).status, 200);
    assert.equal((await db.collection('users').doc(account.id).get()).data().balance, 20);
    assert.equal((await db.collection('users').doc(recipient.id).get()).data().balance, 13);
    assert.equal((await post('/grant-item', grant, { 'X-User-Id': operator.id })).status, 401);
    assert.equal((await post('/grant-item', grant, { ...headers, 'X-User-Id': operator.id })).status, 401);
    assert.equal((await post('/grant-item', grant, headers)).status, 403);
    assert.equal((await post('/admin/grant-resource', {}, headers)).status, 403);
    assert.equal((await fetch(origin + '/amulets', { headers: { 'X-User-Id': account.id } })).status, 401);
    assert.equal((await fetch(origin + '/packs', { headers })).status, 403);
    assert.equal((await fetch(origin + '/inventory?buyerId=' + account.id, { headers: authenticated(recipient) })).status, 403);
    assert.equal((await post('/items', { sellerId: account.id, sourceItemId: item.id, name: 'Card', price: 1 },
      authenticated(recipient))).status, 403);
    assert.equal((await post('/upgraders/favourites', { slot: 0, itemId: item.id }, authenticated(recipient))).status, 400);
    assert.equal((await post('/upgraders/apply', { requestId: randomUUID(), itemId: item.id, token: 'epic:bronze',
      points: 20, effectiveness: 100 }, headers)).status, 400);
    assert.equal((await db.collection('cardUpgrades').doc(item.id).get()).exists, false);
    const directory = await (await fetch(origin + '/users?userId=' + recipient.id, { headers })).json();
    assert.equal(directory[0].balance, undefined);
    assert.equal(directory[0].isAdmin, undefined);
    assert.equal((await post('/grant-item', grant, authenticated(operator))).status, 200);
    assert.equal((await db.collection('items').where('buyerId', '==', account.id).get()).size, 2);
    console.log('Emulator passed startup, login, transfers, admin grants, inventory, Favourite Cards, and direct-access denial.');
  } finally {
    server.kill();
    await Promise.allSettled([exited, admin.app().delete()]);
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
