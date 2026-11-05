const test=require('node:test'),assert=require('node:assert/strict');
const routes=require('./pack-shop-routes'),builder=require('./pack-builder');
function harness(){
 const records={'users/u':{balance:100,gems:{bronze:20}},'packs/bronze':{name:'Bronze',cardIds:['Bronze_jan.png','Bronze_jan.png','Gold_lotte.png'],shop:{enabled:true,price:25,currency:'footy'},rewardCards:[{title:'Rubies',options:[{kind:'gem',id:'bronze',min:1,max:3,chance:100}]}]},'packs/hidden':{name:'Hidden',cardIds:['Bronze_jan.png'],shop:{enabled:false,price:5,currency:'footy'}}};let serial=0,queue=Promise.resolve();
 const snap=key=>({id:key.split('/').pop(),exists:!!records[key],data:()=>structuredClone(records[key])}),ref=key=>({key,id:key.split('/').pop(),get:async()=>snap(key)});
 const db={collection:name=>({doc:id=>ref(name+'/'+(id||'new'+serial++)),get:async()=>({docs:Object.keys(records).filter(k=>k.startsWith(name+'/')).map(snap)})}),runTransaction:fn=>{const result=queue.then(async()=>{const writes=[];const value=await fn({get:async r=>{assert.equal(writes.length,0);return snap(r.key);},set:(r,v)=>writes.push(()=>records[r.key]=v),update:(r,v)=>writes.push(()=>records[r.key]={...records[r.key],...v})});writes.forEach(f=>f());return value;});queue=result.catch(()=>{});return result;}};
 const handlers={},app=Object.fromEntries(['get','post'].map(m=>[m,(url,fn)=>handlers[m+' '+url]=fn]));routes(app,db,async req=>{if(req.denied)throw Error('Unauthorized');return req.user||'u';});
 return {records,invoke:async(method,url,body={},denied=false,user='u')=>{let status=200,payload;await handlers[method+' '+url]({body,denied,user},{status(n){status=n;return this;},send(v){payload=v;},json(v){payload=v;}});return {status,payload};}};
}
test('shop shows the daily pack and only published offers with per-card odds',async()=>{
 const h=harness(),response=await h.invoke('get','/pack-shop');assert.equal(response.status,200);assert.equal(response.payload.daily.daily,true);assert.equal(response.payload.daily.cards.length,5);assert.equal(response.payload.packs.length,1);assert.equal(response.payload.packs[0].cards[1].options.length,2);assert.equal(response.payload.packs[0].cards[1].options[0].chance,50);assert.equal(response.payload.packs[0].cards[0].options[0].chance,100);
 assert.equal((await h.invoke('get','/pack-shop',{},true)).status,401);
});
test('paid pack purchases charge once under retries and concurrent requests',async()=>{
 const h=harness(),body={packId:'bronze',price:25,currency:'footy',requestId:'purchase-123'};
 const [a,b]=await Promise.all([h.invoke('post','/pack-shop/buy',body),h.invoke('post','/pack-shop/buy',body)]);assert.equal(a.status,200);assert.equal(b.payload.itemId,a.payload.itemId);assert.equal(h.records['users/u'].balance,75);assert.equal(Object.keys(h.records).filter(k=>k.startsWith('items/')).length,1);assert.equal(h.records['items/'+a.payload.itemId].buyerId,'u');
 assert.equal((await h.invoke('post','/pack-shop/buy',{...body,packId:'hidden'})).status,400);
});
test('purchases reject stale prices, hidden offers and insufficient currency without charging',async()=>{
 const h=harness(),body={packId:'bronze',price:25,currency:'footy',requestId:'purchase-123'};
 assert.equal((await h.invoke('post','/pack-shop/buy',{...body,price:1})).status,400);assert.equal(h.records['users/u'].balance,100);
 h.records['packs/bronze'].shop={enabled:true,price:10,currency:'bronze'};
 assert.equal((await h.invoke('post','/pack-shop/buy',{...body,price:10,currency:'bronze'})).status,200);assert.equal(h.records['users/u'].gems.bronze,10);assert.equal(h.records['users/u'].balance,100);
 h.records['users/u'].gems.bronze=0;
 assert.equal((await h.invoke('post','/pack-shop/buy',{...body,requestId:'purchase-456',price:10,currency:'bronze'})).status,400);
 assert.equal((await h.invoke('post','/pack-shop/buy',{...body,packId:'hidden',price:5})).status,400);
});
test('pack builder validates offer visibility, price and currency',()=>{
 const base={name:'Bronze',color:'#996633'},catalog={};
 assert.equal(builder.validate({...base,shop:{enabled:true,price:2,currency:'bronze'}},catalog).shop.price,2);
 for(const shop of [{enabled:true,price:0,currency:'footy'},{enabled:true,price:.001,currency:'footy'},{enabled:true,price:1.5,currency:'bronze'},{enabled:true,price:1,currency:'fake'}])assert.throws(()=>builder.validate({...base,shop},catalog));
});

test('purchase cooldown is atomic, per-player/per-pack, expires, and preserves idempotent receipts',async()=>{
 const h=harness();h.records['packs/bronze'].shop.cooldownMinutes=150;
 h.records['packs/other']={...structuredClone(h.records['packs/bronze']),name:'Other'};h.records['users/v']={balance:100};
 const body={packId:'bronze',price:25,currency:'footy',requestId:'cooldown-first'};
 const results=await Promise.all([h.invoke('post','/pack-shop/buy',body),h.invoke('post','/pack-shop/buy',{...body,requestId:'cooldown-second'})]);
 assert.deepEqual(results.map(r=>r.status),[200,400]);assert.match(results[1].payload,/unlocks in/);assert.equal(h.records['users/u'].balance,75);
 const first=results[0].payload;assert.equal(first.nextAt-first.purchasedAt,150*60000);assert.equal(h.records['users/u'].packShopLastPurchases.bronze,first.purchasedAt);
 const replay=await h.invoke('post','/pack-shop/buy',body);assert.deepEqual(replay.payload,first);assert.equal(h.records['users/u'].balance,75);
 let shop=await h.invoke('get','/pack-shop');assert.equal(shop.payload.packs.find(p=>p.id==='bronze').nextAt,first.nextAt);
 assert.equal((await h.invoke('post','/pack-shop/buy',{...body,packId:'other',requestId:'cooldown-other'})).status,200);
 assert.equal((await h.invoke('post','/pack-shop/buy',{...body,requestId:'cooldown-user-v'},false,'v')).status,200);
 const otherTime=h.records['users/u'].packShopLastPurchases.other;h.records['users/u'].packShopLastPurchases.bronze-=150*60000;
 assert.equal((await h.invoke('post','/pack-shop/buy',{...body,requestId:'cooldown-expired'})).status,200);assert.equal(h.records['users/u'].balance,25);assert.equal(h.records['users/u'].packShopLastPurchases.other,otherTime);
 h.records['packs/bronze'].shop.cooldownMinutes=0;shop=await h.invoke('get','/pack-shop');assert.equal(shop.payload.packs.find(p=>p.id==='bronze').nextAt,0);
 assert.equal((await h.invoke('post','/pack-shop/buy',{...body,requestId:'cooldown-disabled'})).status,200);
});

test('cooldown setting validates, defaults to disabled, and follows the current pack policy',async()=>{
 const base={name:'Pack',shop:{enabled:true,price:5,currency:'footy'}};
 assert.equal(builder.validate(base,{}).shop.cooldownMinutes,0);assert.equal(builder.validate({...base,shop:{...base.shop,cooldownMinutes:125}},{}).shop.cooldownMinutes,125);
 for(const value of [-1,1.5,Infinity,'60',525601])assert.throws(()=>builder.validate({...base,shop:{...base.shop,cooldownMinutes:value}},{}),/cooldown/);
 const h=harness(),body={packId:'bronze',price:25,currency:'footy',requestId:'policy-first'};const first=await h.invoke('post','/pack-shop/buy',body);h.records['packs/bronze'].shop.cooldownMinutes=60;
 const shop=await h.invoke('get','/pack-shop');assert.equal(shop.payload.packs[0].nextAt,first.payload.purchasedAt+3600000);
 assert.equal((await h.invoke('post','/pack-shop/buy',{...body,requestId:'policy-second'})).status,400);
});

test('pack-shop amulets affect displayed/enforced prices and purchase cooldowns',async()=>{
 const h=harness();h.records['users/u'].amuletSlots=[{bonuses:{market:10,packshop:5,shopcooldown:20}}];h.records['packs/bronze'].shop.cooldownMinutes=150;
 const shop=await h.invoke('get','/pack-shop');assert.equal(shop.payload.packs[0].price,22.5);assert.equal(shop.payload.packs[0].basePrice,25);
 const body={packId:'bronze',price:25,currency:'footy',requestId:'amulet-shop-price'};assert.equal((await h.invoke('post','/pack-shop/buy',body)).status,400);
 const bought=await h.invoke('post','/pack-shop/buy',{...body,price:22.5});assert.equal(bought.status,200);assert.equal(h.records['users/u'].balance,77.5);assert.equal(bought.payload.nextAt-bought.payload.purchasedAt,120*60000);
 h.records['packs/bronze'].shop={enabled:true,price:11,currency:'bronze'};h.records['users/u'].amuletSlots=[{bonuses:{market:40,packshop:10}}];
 assert.equal((await h.invoke('get','/pack-shop')).payload.packs[0].price,10);assert.equal((await h.invoke('post','/pack-shop/buy',{...body,requestId:'amulet-gem-price',currency:'bronze',price:10})).status,200);assert.equal(h.records['users/u'].gems.bronze,10);
});
