const test=require('node:test'),assert=require('node:assert/strict');
function fixture(){const t=Date.now(),records={'users/u':{balance:100,townHallXP:8500,townHallProgressVersion:3,freePackLastClaimAt:t,packShopLastPurchases:{silver:t},timeBoosts:{skip:2,leap:1},amuletSlots:[{bonuses:{dailycooldown:20,shopcooldown:10,boostpower:50}}]},'gameSettings/freePack':{...require('./free-pack').defaults(),cooldownHours:5},'packs/silver':{name:'Silver',cardIds:['Bronze_jan.png'],shop:{enabled:true,price:10,currency:'footy',cooldownMinutes:90}}},handlers={};
const snap=key=>({id:key.split('/').pop(),exists:!!records[key],data:()=>structuredClone(records[key])}),ref=key=>({key,id:key.split('/').pop(),get:async()=>snap(key)}),db={collection:name=>({doc:id=>ref(name+'/'+id),get:async()=>({docs:Object.keys(records).filter(k=>k.startsWith(name+'/')).map(snap)})})},app=Object.fromEntries(['get','post','put'].map(m=>[m,(url,fn)=>handlers[m+' '+url]=fn]));
db.runTransaction=async fn=>{const writes=[];const result=await fn({get:async r=>{assert.equal(writes.length,0);return snap(r.key);},update:(r,v)=>writes.push(()=>records[r.key]={...records[r.key],...structuredClone(v)}),set:(r,v)=>writes.push(()=>records[r.key]=structuredClone(v))});writes.forEach(f=>f());return result;};
require('./village-routes')(app,db,async()=> 'u',async()=>[]);require('./pack-shop-routes')(app,db,async()=> 'u');require('./free-pack-routes')(app,db,async()=> 'u');
return {t,records,async call(method,url,body={}){let status=200,payload;await handlers[method+' '+url]({body},{status(n){status=n;return this;},send(v){payload=v;},json(v){payload=v;}});return {status,payload};}};}
test('new personal timers use current server configuration and stay consistent across boost/shop/claim routes',async()=>{
const h=fixture();let daily=await h.call('get','/free-pack');assert.equal(daily.payload.nextAt,h.t+4*3600000);
const boosted=await h.call('post','/village/action',{action:'time-use',target:'daily-pack',token:'skip',actionId:'daily-integration-123'});assert.equal(boosted.status,200);assert.equal(h.records['users/u'].freePackLastClaimAt,h.t-30*60000);assert.ok(boosted.payload.economy.timeBank.targets.some(t=>t.id==='pack/silver'));
daily=await h.call('get','/free-pack');let shop=await h.call('get','/pack-shop');assert.equal(daily.payload.nextAt,shop.payload.daily.nextAt);assert.equal(daily.payload.nextAt,h.t+3.5*3600000);
assert.equal((await h.call('post','/village/action',{action:'time-use',target:'pack/silver',token:'leap',actionId:'shop-integration-1234'})).status,200);shop=await h.call('get','/pack-shop');assert.ok(shop.payload.packs[0].nextAt<=shop.payload.serverNow);assert.equal(h.records['users/u'].timeBoosts.leap,0);
const before=structuredClone(h.records['users/u']);await h.call('post','/village/action',{action:'time-use',target:'pack/silver',token:'leap',actionId:'shop-integration-1234'});assert.deepEqual(h.records['users/u'],before);
});
test('new amulet designs expose working effects',()=>{
const amulets=require('./amulet-utils'),catalog=amulets.catalog([{id:'bronze',name:'Bronze'}]);for(const key of ['discovery-clock','merchant-clock','token-cache','temporal-lens'])assert.ok(catalog.some(e=>e.id.endsWith(':'+key)));
const slots=catalog.filter(e=>['discovery-clock','merchant-clock','token-cache','temporal-lens'].some(k=>e.id.endsWith(':'+k)));const powers=amulets.effects({amuletSlots:slots,amuletSlotCount:4});assert.equal(powers.dailycooldown,8);assert.equal(powers.packshop,3);assert.equal(powers.packtokens,1);assert.equal(powers.pigment,1);assert.equal(powers.boostpower,6);
});
test('battle Footy amulets do not alter fixed ruby-only creature rewards',()=>{
const service=require('./creature-brawl-service'),user={balance:10,amuletSlots:[{power:'battle',value:15}]},b={rating:0,tokens:{rill:6}},match={id:'m',practice:false,stage:0,state:{phase:'FINISHED',winner:0,reason:'elimination',units:[]}};const update=service.settle(user,b,match,Date.now());assert.equal(match.reward.footy,0);assert.equal(match.reward.rubies,5);assert.equal(update.balance,undefined);assert.equal(update.gems.bronze,5);assert.deepEqual(match.reward.tokens,{});assert.deepEqual(update.creatureBrawl.tokens,{rill:6});
});

test('building boost endpoint exposes owned timers and bulk retries survive short receipt history',async()=>{
 const h=fixture(),read=await h.call('get','/village/time-skips');assert.equal(read.status,200);assert.deepEqual(read.payload.inventory,{skip:2,leap:1});assert.equal(read.payload.boostMinutes.skip,30);assert.equal(read.payload.targets.find(t=>t.id==='daily-pack').building,'market');
 const body={action:'time-use',target:'daily-pack',token:'skip',count:2,actionId:'bulk-building-integration-123'};
 const used=await h.call('post','/village/action',body);assert.equal(used.status,200);assert.equal(used.payload.boostUse.count,2);assert.equal(h.records['users/u'].timeBoosts.skip,0);assert.equal(h.records['users/u'].freePackLastClaimAt,h.t-3600000);
 h.records['users/u'].timeBoostReceipts=[];const before=structuredClone(h.records['users/u']);const retry=await h.call('post','/village/action',body);assert.equal(retry.status,200);assert.equal(retry.payload.replayed,true);assert.equal(retry.payload.boostUse.count,2);assert.deepEqual(h.records['users/u'],before);
 const rejected=await h.call('post','/village/action',{...body,actionId:'insufficient-building-123'});assert.equal(rejected.status,400);assert.deepEqual(h.records['users/u'],before);
});
