const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const builder=require('./pack-builder');
const { MAX_PACK_CARDS } = require('./public/pack-limits');
const catalog={gem:[{id:'bronze',name:'Ruby'}],animal:[{id:'tharos',name:'Tharos',rarity:'unique'}],card:[{id:'Bronze_jan.png',name:'Jan'}],pack:[{id:'bonus',name:'Bonus'}]};
const slot=(kind,id,amount)=>({title:'Reward',options:[{kind,id,min:amount,max:amount,chance:100}]});
function harness({ cardFiles, randomInt = () => 0, authenticate = async () => {}, rewardCatalog = catalog } = {}){
 const records={'packs/main':{name:'Bronze',createdBy:'other-admin',color:'#996633',cardIds:['Bronze_jan.png']},'packs/bonus':{name:'Bonus',cardIds:['Bronze_jan.png']},'users/u':{balance:1,gems:{bronze:2}},'items/owned':{itemType:'pack',packId:'main',buyerId:'u',sold:true,sellerId:'host'}};let serial=0;
 const snap=key=>({exists:!!records[key],data:()=>structuredClone(records[key])});
 const ref=key=>({key,get:async()=>snap(key),update:async data=>records[key]={...records[key],...data}});
 const db={collection:name=>({doc:id=>ref(name+'/'+(id||'new'+serial++)),add:async data=>{const id='new'+serial++;records[name+'/'+id]=data;return {id};}}),runTransaction:async fn=>{const writes=[];const result=await fn({get:async r=>{assert.equal(writes.length,0,'reads must precede writes');return snap(r.key);},set:(r,d)=>writes.push(()=>records[r.key]=d),update:(r,d)=>writes.push(()=>records[r.key]={...records[r.key],...d}),delete:r=>writes.push(()=>delete records[r.key])});writes.forEach(fn=>fn());return result;}};
 const routes={},app=Object.fromEntries(['get','post','put'].map(m=>[m,(url,fn)=>routes[m+' '+url]=fn]));
 const path = require('node:path');
 const context={__dirname,app,db,MAX_PACK_CARDS,console:{error(){}},userIsAdmin:async id=>id==='admin',isValidPackColor:c=>/^#[0-9a-f]{6}$/i.test(c),path,fs:cardFiles?{existsSync:file=>cardFiles.has(path.basename(file))}:fs,crypto:{randomInt},brawlAuth:{authenticate},rubyShop:{},roundFooty:n=>n,amuletEffects:()=>({pack:2,packgem:100}),require:id=>id==='./free-pack-routes'?{catalog:async()=>rewardCatalog}:id==='./town-hall-progress'?{gameplay:()=>({})}:require(id)};
 const source=fs.readFileSync('server.js','utf8');vm.runInNewContext(source.slice(source.indexOf("app.post('/packs',"),source.indexOf("app.post('/grant-pack',")),context);vm.runInNewContext(source.slice(source.indexOf("app.post('/open-pack',"),source.indexOf('/* ------------------ GRANT ITEM')),context);
 return {records,invoke:async(method,url,body,id='admin')=>{let status=200,payload;await routes[method+' '+url]({body,params:{packId:'main'},header:()=>id},{status(n){status=n;return this;},send(v){payload=v;},json(v){payload=v;}});return {status,payload};}};
}

test('random pack rewards grant ordinary cards once and empty pools leave all writes untouched', async () => {
  const { kind, pools } = require('./random-card-rewards');
  const rewardCatalog = { ...catalog, [kind]: pools([
    { filename: 'Bronze_test.png', card: { id: 'test', name: 'Test Bronze Player', tier: 'Bronze' } }
  ], []) };
  const h = harness({ rewardCatalog });
  h.records['packs/main'].rewardCards = [slot('gem', 'bronze', 3), slot(kind, 'ultra:special', 2)];
  const open = () => h.invoke('post', '/open-pack', { itemId: 'owned', cardId: 'forged.png' }, 'u');
  assert.equal((await open()).status, 400);
  h.records['upgradePackProofs/owned'] = { ownerId: 'u', packId: 'main' };
  assert.match((await open()).payload, /No eligible cards/);
  assert.equal(h.records['users/u'].gems.bronze, 2);
  assert.ok(h.records['items/owned']);
  assert.ok(h.records['upgradePackProofs/owned']);
  h.records['packs/main'].rewardCards[1] = slot(kind, 'bronze:regular', 2);
  const result = await open();
  assert.equal(result.status, 200);
  assert.deepEqual(result.payload.extraRewards.filter(item => item.kind === 'card').map(item => item.label),
    ['1 Test Bronze Player', '1 Test Bronze Player']);
  const card = result.payload.extraRewards.find(item => item.kind === 'card');
  const face = require('./public/reward-card-art').describe(card);
  assert.equal(face.name, 'Test Bronze Player');
  assert.equal(face.image, 'images/Bronze_test.png');
  assert.equal(Object.values(h.records).filter(item => item.buyerId === 'u' && item.imageUrl === '/images/Bronze_test.png').length, 2);
  assert.equal((await open()).status, 400);
  assert.equal(h.records['items/owned'], undefined);
});

test('pack creation, editing and opening support pools of 1, 100, 101, 250 and 500 cards', async () => {
  const catalogue = Array.from({ length: 501 }, (_, index) => `Bronze_fixture-${index}.png`);
  const rewardCards = [slot('gem', 'bronze', 5)];
  for (const size of [1, 100, 101, 250, 500]) {
    const draws = [];
    const h = harness({ cardFiles: new Set(catalogue), randomInt: bound => {
      draws.push(bound);
      return bound - 1;
    } });
    const cardIds = catalogue.slice(0, size);
    const body = { name: 'Pool size ' + size, cardIds, rewardCards };
    const created = await h.invoke('post', '/packs', body);
    assert.equal(created.status, 201);
    assert.deepEqual(Array.from(h.records['packs/' + created.payload.id].cardIds), cardIds);
    assert.equal((await h.invoke('put', '/packs/:packId', body)).status, 200);
    assert.deepEqual(Array.from(h.records['packs/main'].cardIds), cardIds);
    assert.equal(h.records['packs/main'].rewardCards[0].options[0].chance, 100);
    const opened = await h.invoke('post', '/open-pack', { itemId: 'owned' }, 'u');
    assert.equal(opened.status, 200);
    assert.deepEqual(draws, [100, size]);
    assert.equal(opened.payload.cardId, cardIds.at(-1));
    assert.equal(opened.payload.extraRewards.length, 1);
    assert.equal(opened.payload.extraRewards[0].amount, 5);
    const awards = Object.entries(h.records).filter(([key]) => key.startsWith('items/'));
    assert.equal(awards.length, 1);
    assert.equal(awards[0][1].buyerId, 'u');
    assert.equal(awards[0][1].imageUrl, '/images/' + cardIds.at(-1));
    assert.equal((await h.invoke('post', '/open-pack', { itemId: 'owned' }, 'u')).status, 400);
  }
  const h = harness({ cardFiles: new Set(catalogue) });
  const body = { name: 'Too many cards', cardIds: catalogue };
  for (const [method, endpoint] of [['post', '/packs'], ['put', '/packs/:packId']]) {
    assert.deepEqual(await h.invoke(method, endpoint, body), { status: 400, payload: 'Choose up to 500 cards' });
  }
  assert.deepEqual(h.records['packs/main'].cardIds, ['Bronze_jan.png']);
  assert.equal(Object.keys(h.records).filter(key => key.startsWith('packs/')).length, 2);
});

test('pack save routes accept 500 long filenames through the HTTP JSON parser', async t => {
  const express = require('express');
  const { once } = require('node:events');
  const app = express();
  require('./http-optimization')(app, require('node:path').join(__dirname, 'public'));
  const size = (req, res) => res.json(req.body.cardIds.length);
  app.post('/packs', size);
  app.put('/packs/:packId', size);
  const listener = app.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  t.after(() => new Promise(resolve => listener.close(resolve)));
  const url = 'http://127.0.0.1:' + listener.address().port;
  const cardIds = Array.from({ length: 500 }, (_, index) => `Bronze_${'a'.repeat(220)}_${index}.png`);
  const body = JSON.stringify({ cardIds });
  assert.ok(Buffer.byteLength(body) > 100 * 1024);
  for (const [method, endpoint] of [['POST', '/packs'], ['PUT', '/packs/example']]) {
    const response = await fetch(url + endpoint, { method, headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(response.status, 200);
    assert.equal(await response.json(), 500);
  }
});
test('any admin can edit regular pack rewards and opening settles them atomically',async()=>{
 const h=harness(),body={name:'Bronze',color:'#996633',cardIds:['Bronze_jan.png'],appearance:{base:'#996633',accent:'#aa7755',trim:'#ffcc88'},rewardCards:[slot('gem','bronze',5),slot('animal','tharos',1),slot('pack','bonus',1),slot('card','Bronze_jan.png',2)]};
 assert.equal((await h.invoke('put','/packs/:packId',body,'u')).status,403);
 assert.equal((await h.invoke('put','/packs/:packId',body)).status,200);
 const result=await h.invoke('post','/open-pack',{itemId:'owned'},'u');assert.equal(result.status,200);assert.equal(result.payload.extraRewards.length,4);assert.equal(result.payload.extraRewards[1].rarity,'unique');assert.equal(h.records['users/u'].gems.bronze,8);assert.equal(h.records['users/u'].balance,3);assert.equal(h.records['users/u'].stableAnimals.tharos,1);assert.equal(h.records['items/owned'],undefined);
 const awards=Object.entries(h.records).filter(([k])=>k.startsWith('items/'));assert.equal(awards.filter(([,v])=>v.itemType==='card').length,3);assert.equal(awards.filter(([,v])=>v.itemType==='pack').length,1);
 assert.equal((await h.invoke('post','/open-pack',{itemId:'owned'},'u')).status,400);assert.equal(h.records['users/u'].gems.bronze,8);
});
test('regular packs retain legacy behavior without extra rewards and validate new options',async()=>{
 assert.equal(builder.validate({name:'Bronze',color:'#996633'},catalog).rewardCards.length,0);
 assert.throws(()=>builder.validate({name:'Bad',appearance:{base:'url(x)'}},catalog));
 assert.throws(()=>builder.validate({name:'Bad',rewardCards:[slot('gem','missing',1)]},catalog));
 const h=harness();const result=await h.invoke('post','/open-pack',{itemId:'owned'},'u');assert.equal(result.status,200);assert.equal(result.payload.extraRewards.length,0);assert.equal(result.payload.cardId,'Bronze_jan.png');
});

test('only admins can save a per-pack purchase cooldown',async()=>{
 const h=harness(),body={name:'Bronze',cardIds:['Bronze_jan.png'],color:'#996633',shop:{enabled:true,price:10,currency:'footy',cooldownMinutes:195}};
 assert.equal((await h.invoke('put','/packs/:packId',body,'u')).status,403);assert.equal(h.records['packs/main'].shop,undefined);
 assert.equal((await h.invoke('put','/packs/:packId',body)).status,200);assert.equal(h.records['packs/main'].shop.cooldownMinutes,195);
});

test('regular pack token rewards include equipped Token Cache in the receipt and wallet',async()=>{
 const h=harness();h.records['users/u'].amuletSlots=[{bonuses:{packtokens:2}}];h.records['users/u'].creatureBrawl={tokens:{rill:6}};
 h.records['packs/main'].rewardCards=[slot('brawlToken','rill-species',3)];
 const result=await h.invoke('post','/open-pack',{itemId:'owned'},'u');assert.equal(result.status,200);assert.equal(result.payload.extraRewards[0].amount,5);assert.equal(h.records['users/u'].creatureBrawl.tokens.rill,11);
});

test('reward-only packs can be saved and opened without a phantom collection card',async()=>{
 const h=harness(),body={name:'Supplies',cardIds:[],color:'#996633',rewardCards:[slot('gem','bronze',5)]};
 assert.equal((await h.invoke('put','/packs/:packId',body)).status,200);
 const result=await h.invoke('post','/open-pack',{itemId:'owned'},'u');assert.equal(result.status,200);assert.equal(result.payload.cardId,null);assert.equal(result.payload.imageUrl,null);assert.equal(result.payload.extraRewards.length,1);assert.equal(Object.entries(h.records).filter(([key,value])=>key.startsWith('items/')&&value.itemType==='card').length,0);
 const rewards=require('./public/reward-card-art').normalize(result.payload);assert.equal(rewards.some(r=>r.kind==='card'),false);assert.equal(rewards[0].id,'bronze');
 assert.throws(()=>builder.validate({...body,rewardCards:[]},catalog),/at least one/);
});

test('Ben-Bal league packs require a session and open by their original pack ID', async () => {
  const { source } = require('./ben-bal-rewards');
  let authenticated = false;
  const h = harness({ authenticate: async () => { if (!authenticated) throw Error('No session'); } });
  Object.assign(h.records['items/owned'], { source, benBalMatchId: 'fixture-match' });
  assert.equal((await h.invoke('post', '/open-pack', { itemId: 'owned' }, 'u')).status, 401);
  assert.equal(h.records['items/owned'].packId, 'main');
  authenticated = true;
  const opened = await h.invoke('post', '/open-pack', { itemId: 'owned' }, 'u');
  assert.equal(opened.status, 200);
  assert.equal(opened.payload.cardId, 'Bronze_jan.png');
});

test('opening a verified material pack grants stacks once and rejects a forged inventory item', async () => {
  const h = harness();
  h.records['packs/main'].rewardCards = [
    slot('upgradeShard', 'shard:bronze', 2),
    slot('upgradeCore', 'core:gold', 1),
    slot('upgradeToken', 'epic:ultra', 1),
    slot('cardXpPotion', 'card-xp:100', 2),
    slot('gem', 'bronze', 5)
  ];
  const open = () => h.invoke('post', '/open-pack', { itemId: 'owned' }, 'u');
  assert.equal((await open()).status, 400);
  assert.equal(h.records['upgradeWallets/u'], undefined);
  h.records['upgradePackProofs/owned'] = { ownerId: 'u', packId: 'main' };
  const response = await open();
  assert.equal(response.status, 200);
  assert.equal(response.payload.extraRewards.length, 5);
  assert.deepEqual(h.records['upgradeWallets/u'].counts, { 'shard:bronze': 2, 'core:gold': 1, 'epic:ultra': 1, 'card-xp:100': 2 });
  assert.equal(h.records['users/u'].gems.bronze, 8);
  h.records['items/owned'] = { itemType: 'pack', packId: 'main', buyerId: 'u', sold: true, sellerId: 'host' };
  assert.equal((await open()).status, 400);
  assert.equal(h.records['upgradeWallets/u'].counts['shard:bronze'], 2);
});
