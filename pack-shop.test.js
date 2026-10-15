const test=require('node:test'),assert=require('node:assert/strict');
const routes=require('./pack-shop-routes'),builder=require('./pack-builder');
function harness(){
 const records={'users/u':{balance:100,gems:{bronze:20}},'packs/bronze':{name:'Bronze',cardIds:['Bronze_jan.png','Bronze_jan.png','Gold_lotte.png'],shop:{enabled:true,price:25,currency:'footy'},rewardCards:[{title:'Rubies',options:[{kind:'gem',id:'bronze',min:1,max:3,chance:100}]}]},'packs/hidden':{name:'Hidden',cardIds:['Bronze_jan.png'],shop:{enabled:false,price:5,currency:'footy'}}};let serial=0,queue=Promise.resolve();
 const snap=key=>({id:key.split('/').pop(),exists:!!records[key],data:()=>structuredClone(records[key])}),ref=key=>({key,id:key.split('/').pop(),get:async()=>snap(key)});
 const db={collection:name=>({doc:id=>ref(name+'/'+(id||'new'+serial++)),get:async()=>({docs:Object.keys(records).filter(k=>k.startsWith(name+'/')).map(snap)})}),runTransaction:fn=>{const result=queue.then(async()=>{const writes=[];const value=await fn({get:async r=>{assert.equal(writes.length,0);return snap(r.key);},set:(r,v)=>writes.push(()=>records[r.key]=v),update:(r,v)=>writes.push(()=>records[r.key]={...records[r.key],...v})});writes.forEach(f=>f());return value;});queue=result.catch(()=>{});return result;}};
 const handlers={},app=Object.fromEntries(['get','post'].map(m=>[m,(url,fn)=>handlers[m+' '+url]=fn]));routes(app,db,async req=>{if(req.denied)throw Error('Unauthorized');return 'u';});
 return {records,invoke:async(method,url,body={},denied=false)=>{let status=200,payload;await handlers[method+' '+url]({body,denied},{status(n){status=n;return this;},send(v){payload=v;},json(v){payload=v;}});return {status,payload};}};
}
test('shop shows the daily pack and only published offers with per-card odds',async()=>{
 const h=harness(),response=await h.invoke('get','/pack-shop');assert.equal(response.status,200);assert.equal(response.payload.daily.daily,true);assert.equal(response.payload.daily.cards.length,5);assert.equal(response.payload.packs.length,1);assert.equal(response.payload.packs[0].cards[0].options.length,2);assert.equal(response.payload.packs[0].cards[0].options[0].chance,50);assert.equal(response.payload.packs[0].cards[1].options[0].chance,100);
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
