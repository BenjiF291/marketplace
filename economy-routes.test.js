const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { effects, discounted, round } = require('./amulet-utils');
function harness(seed) {
  let records = structuredClone(seed);
  const handlers = {};
  const app = { get: (url, fn) => handlers[url] = fn, post: (url, fn) => handlers[url] = fn };
  const ref = key => ({ key, id: key.split('/').pop(), get: async () => snap(key) });
  const snap = key => ({ exists: !!records[key], id: key.split('/').pop(), ref: ref(key), data: () => structuredClone(records[key]) });
  function query(name, filters = []) {
    return { name, filters, doc: id => ref(`${name}/${id || 'new-item'}`),
      where: (field, op, value) => query(name, [...filters, [field, value]]), orderBy: () => query(name, filters) };
  }
  const db = { collection: query, runTransaction: async fn => {
    const writes = [];
    const get = async target => {
      assert.equal(writes.length, 0, 'transaction reads precede writes');
      if (target.key) return snap(target.key);
      const docs = Object.keys(records).filter(key => key.startsWith(target.name + '/') && target.filters.every(([field, value]) => records[key][field] === value)).map(snap);
      return { docs, empty: !docs.length };
    };
    const result = await fn({ get, getAll: (...refs) => Promise.all(refs.map(get)),
      update: (ref, value) => writes.push(() => records[ref.key] = { ...records[ref.key], ...value }),
      set: (ref, value) => writes.push(() => records[ref.key] = value), delete: ref => writes.push(() => delete records[ref.key]) });
    writes.forEach(write => write()); return result;
  } };
  require('./amulet-routes')(app, db, async () => []);
  const source = fs.readFileSync('server.js', 'utf8');
  const start = source.indexOf("app.post('/buy',"); const end = source.indexOf('/* ------------------ HISTORY', start);
  vm.runInNewContext(source.slice(start, end), { app, db, console: { error() {} }, amuletEffects: effects, discounted, roundFooty: round, ...require('./marketplace-utils') });
  for (const route of ['/spin-wheel', '/buy-vip', '/gem-converter', '/open-pack']) {
    const index = source.indexOf(`app.post('${route}',`);
    const code = source.slice(index, source.indexOf('\n});', index) + 5);
    vm.runInNewContext(code, { app, db, console: { error() {} }, amuletEffects: effects, discounted, roundFooty: round, crypto: require('node:crypto'), ...require('./gem-utils') });
  }
  const invoke = async (url, body, user = 'buyer', action) => {
    let status = 200, payload;
    const res = { status(code) { status = code; return this; }, send(value) { payload = value; }, json(value) { payload = value; } };
    await handlers[url]({ body, header: () => user, params: { action } }, res);
    return { status, payload };
  };
  return { invoke, data: () => records };
}
function seed(currency = 'bronze') {
  return { 'users/buyer': { balance: 100, gems: { bronze: 20 } }, 'users/seller': { balance: 50, gems: { bronze: 2 } },
    'items/card': { sellerId: 'seller', sold: false, price: 7, currency, currencyName: 'Ruby' } };
}
test('gem purchase debits and credits matching gems, leaves Footy unchanged, rejects second purchase', async () => {
  const h = harness(seed());
  const result = await h.invoke('/buy', { itemId: 'card', buyerId: 'buyer' });
  assert.equal(result.status, 200);
  assert.equal(h.data()['users/buyer'].gems.bronze, 13); assert.equal(h.data()['users/seller'].gems.bronze, 9);
  assert.equal(h.data()['users/buyer'].balance, 100); assert.equal(h.data()['users/seller'].balance, 50);
  assert.equal((await h.invoke('/buy', { itemId: 'card', buyerId: 'buyer' })).status, 400);
});
test('insufficient gems and mismatched requester do not mutate balances or item', async () => {
  const data = seed(); data['users/buyer'].gems.bronze = 1;
  const h = harness(data);
  assert.equal((await h.invoke('/buy', { itemId: 'card', buyerId: 'buyer' })).status, 400);
  assert.deepEqual(h.data(), data);
  assert.equal((await h.invoke('/buy', { itemId: 'card', buyerId: 'buyer' }, 'intruder')).status, 403);
});
test('market amulet discounts Footy host purchases while preserving seller payment; gems never discounted', async () => {
  for (const currency of ['footy', 'bronze']) {
    const data = seed(currency); data['users/seller'].isAdmin = true;
    data['users/buyer'].amuletSlots = [{ power: 'market', value: 5 }];
    const h = harness(data); assert.equal((await h.invoke('/buy', { itemId: 'card', buyerId: 'buyer' })).status, 200);
    if (currency === 'footy') { assert.equal(h.data()['users/buyer'].balance, 93.35); assert.equal(h.data()['users/seller'].balance, 57); }
    else assert.equal(h.data()['users/buyer'].gems.bronze, 13);
  }
});
test('Footy grants require admin and reject invalid quantities without mutations', async () => {
  const h = harness(seed());
  const body = { userId: 'buyer', kind: 'footy', quantity: 50 };
  assert.equal((await h.invoke('/admin/grant-resource', body)).status, 403);
  assert.equal(h.data()['users/buyer'].balance, 100);
  const data = seed(); data['users/seller'].isAdmin = true;
  const admin = harness(data);
  assert.equal((await admin.invoke('/admin/grant-resource', body, 'seller')).status, 200);
  assert.equal(admin.data()['users/buyer'].balance, 150);
  assert.equal((await admin.invoke('/admin/grant-resource', { ...body, quantity: -1 }, 'seller')).status, 400);
});

test('spin amulet adds a fixed bonus after VIP multiplier, and cooldown still applies', async () => {
  const data = seed();
  data['users/buyer'].vipUntil = new Date(Date.now() + 86400000).toISOString();
  data['users/buyer'].amuletSlots = [{ power: 'wheel', value: 2 }];
  const h = harness(data);
  const result = await h.invoke('/spin-wheel', { userId: 'buyer' });
  assert.equal(result.status, 200);
  assert.equal(result.payload.amount, result.payload.baseReward * 2 + 2);
  assert.equal(h.data()['users/buyer'].balance, 100 + result.payload.amount);
  assert.notEqual((await h.invoke('/spin-wheel', { userId: 'buyer' })).status, 200);
});
test('VIP amulets discount the actual debit and extend duration', async () => {
  const data = seed(); data['users/buyer'].balance = 300;
  data['users/buyer'].amuletSlotCount = 2;
  data['users/buyer'].amuletSlots = [{ power: 'vip', value: 10 }, { power: 'vipdays', value: 2 }];
  const h = harness(data); const start = Date.now();
  const result = await h.invoke('/buy-vip', {});
  assert.equal(result.status, 200); assert.equal(h.data()['users/buyer'].balance, 30);
  assert.ok(new Date(result.payload.vipUntil).getTime() >= start + 32 * 86400000);
});
test('converter amulet discount changes actual Footy cost without changing gem output', async () => {
  const data = seed();
  data['ascendTiers/bronze'] = { name: 'Bronze', order: 0, sellPrice: 25, cards: ['bronze.png'] };
  data['items/owned'] = { buyerId: 'buyer', sold: true, itemType: 'card', imageUrl: '/images/bronze.png' };
  data['users/buyer'].amuletSlots = [{ power: 'converter', value: 10 }];
  const h = harness(data);
  const result = await h.invoke('/gem-converter', { tierId: 'bronze', itemIds: ['owned'] });
  assert.equal(result.status, 200); assert.equal(result.payload.cost, 33.75);
  assert.equal(h.data()['users/buyer'].balance, 66.25); assert.equal(h.data()['users/buyer'].gems.bronze, 23);
  assert.equal(h.data()['items/owned'], undefined);
});
test('admin can grant an amulet, player can equip it, and early removal is rejected', async () => {
  const data = seed(); data['users/seller'].isAdmin = true;
  data['ascendTiers/bronze'] = { name: 'Bronze', order: 0 };
  const h = harness(data);
  assert.equal((await h.invoke('/admin/grant-resource', { userId: 'buyer', kind: 'amulet', quantity: 1, amuletId: 'bronze:wheel' }, 'seller')).status, 200);
  assert.equal((await h.invoke('/amulets/:action', { slot: 0, amuletId: 'bronze:wheel' }, 'buyer', 'equip')).status, 200);
  assert.equal(h.data()['users/buyer'].amulets['bronze:wheel'], 0);
  assert.equal((await h.invoke('/amulets/:action', { slot: 0 }, 'buyer', 'remove')).status, 400);
});

test('buying a linked card awards only the purchased inventory record', async () => {
  const data = seed(); data['items/card'].imageUrl = '/images/bronze.png';
  data['battleCards/linked'] = { linkedCardImage: 'bronze.png' };
  const h = harness(data);
  assert.equal((await h.invoke('/buy', {itemId:'card',buyerId:'buyer'})).status,200);
  assert.equal(Object.keys(h.data()).filter(key => key.startsWith('items/')).length,1);
});
test('retrying a grouped listing cannot buy another stock item', async () => {
  const data = seed(); data['items/card'].listingGroupId = 'g';
  data['items/second'] = {...data['items/card']}; data['marketListingGroups/g'] = {purchaseCounts:{}};
  const h = harness(data);
  assert.equal((await h.invoke('/buy',{itemId:'card',buyerId:'buyer'})).status,200);
  assert.equal((await h.invoke('/buy',{itemId:'card',buyerId:'buyer'})).status,400);
  assert.equal(h.data()['items/second'].sold,false);
  assert.equal(h.data()['users/buyer'].gems.bronze,13);
});
test('opening a pack consumes it once and creates only one normal card', async () => {
  const data = seed(); delete data['items/card'];
  data['items/pack'] = {itemType:'pack',packId:'p',buyerId:'buyer',sold:true,sellerId:'seller'};
  data['packs/p'] = {cardIds:['bronze.png']};
  const h = harness(data);
  assert.equal((await h.invoke('/open-pack',{itemId:'pack'})).status,200);
  assert.equal((await h.invoke('/open-pack',{itemId:'pack'})).status,400);
  const cards = Object.entries(h.data()).filter(([key])=>key.startsWith('items/'));
  assert.equal(cards.length,1); assert.equal(cards[0][1].itemType,'card');
});

test('configured VIP sale charges members only, supports gems and ignores buyer-supplied discounts',async()=>{
 for(const currency of ['footy','bronze'])for(const active of [false,true]) {
  const data=seed(currency);data['users/seller'].isAdmin=true;data['items/card'].price=10;data['items/card'].vipDiscountPercent=25;
  data['users/buyer'].vipUntil=new Date(Date.now()+(active?86400000:-86400000)).toISOString();
  const h=harness(data),result=await h.invoke('/buy',{itemId:'card',buyerId:'buyer',vipDiscountPercent:99});
  assert.equal(result.status,200);assert.equal(result.payload.purchasePrice,active?(currency==='footy'?7.5:8):10);assert.equal(result.payload.discountApplied,active);
 }
});
test('VIP discounts are opt-in and admin-only; stale displayed prices cannot charge more',async()=>{
 for(const admin of [false,true]) {
  const data=seed('footy');data['users/buyer'].vipUntil=new Date(Date.now()+86400000).toISOString();data['users/seller'].isAdmin=admin;
  if(!admin)data['items/card'].vipDiscountPercent=50;
  const h=harness(data),result=await h.invoke('/buy',{itemId:'card',buyerId:'buyer'});assert.equal(result.payload.purchasePrice,7);
 }
 const h=harness(seed('footy'));const result=await h.invoke('/buy',{itemId:'card',buyerId:'buyer',expectedPrice:5});assert.equal(result.status,400);assert.equal(h.data()['items/card'].sold,false);assert.equal(h.data()['users/buyer'].balance,100);
});
