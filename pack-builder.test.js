const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const builder=require('./pack-builder');
const catalog={gem:[{id:'bronze',name:'Ruby'}],animal:[{id:'tharos',name:'Tharos',rarity:'unique'}],card:[{id:'Bronze_jan.png',name:'Jan'}],pack:[{id:'bonus',name:'Bonus'}]};
const slot=(kind,id,amount)=>({title:'Reward',options:[{kind,id,min:amount,max:amount,chance:100}]});
function harness(){
 const records={'packs/main':{name:'Bronze',createdBy:'other-admin',color:'#996633',cardIds:['Bronze_jan.png']},'packs/bonus':{name:'Bonus',cardIds:['Bronze_jan.png']},'users/u':{balance:1,gems:{bronze:2}},'items/owned':{itemType:'pack',packId:'main',buyerId:'u',sold:true,sellerId:'host'}};let serial=0;
 const snap=key=>({exists:!!records[key],data:()=>structuredClone(records[key])});
 const ref=key=>({key,get:async()=>snap(key),update:async data=>records[key]={...records[key],...data}});
 const db={collection:name=>({doc:id=>ref(name+'/'+(id||'new'+serial++))}),runTransaction:async fn=>{const writes=[];const result=await fn({get:async r=>{assert.equal(writes.length,0,'reads must precede writes');return snap(r.key);},set:(r,d)=>writes.push(()=>records[r.key]=d),update:(r,d)=>writes.push(()=>records[r.key]={...records[r.key],...d}),delete:r=>writes.push(()=>delete records[r.key])});writes.forEach(fn=>fn());return result;}};
 const routes={},app=Object.fromEntries(['get','post','put'].map(m=>[m,(url,fn)=>routes[m+' '+url]=fn]));
 const context={__dirname,app,db,console:{error(){}},userIsAdmin:async id=>id==='admin',isValidPackColor:c=>/^#[0-9a-f]{6}$/i.test(c),path:require('node:path'),fs,crypto:{randomInt:()=>0},brawlAuth:{authenticate:async()=>{}},rubyShop:{},roundFooty:n=>n,amuletEffects:()=>({pack:2,packgem:100}),require:id=>id==='./free-pack-routes'?{catalog:async()=>catalog}:id==='./town-hall-progress'?{gameplay:()=>({})}:require(id)};
 const source=fs.readFileSync('server.js','utf8');vm.runInNewContext(source.slice(source.indexOf("app.post('/packs',"),source.indexOf("app.post('/grant-pack',")),context);vm.runInNewContext(source.slice(source.indexOf("app.post('/open-pack',"),source.indexOf('/* ------------------ GRANT ITEM')),context);
 return {records,invoke:async(method,url,body,id='admin')=>{let status=200,payload;await routes[method+' '+url]({body,params:{packId:'main'},header:()=>id},{status(n){status=n;return this;},send(v){payload=v;},json(v){payload=v;}});return {status,payload};}};
}
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

test('reward-only packs can be saved and opened without a phantom collection card',async()=>{
 const h=harness(),body={name:'Supplies',cardIds:[],color:'#996633',rewardCards:[slot('gem','bronze',5)]};
 assert.equal((await h.invoke('put','/packs/:packId',body)).status,200);
 const result=await h.invoke('post','/open-pack',{itemId:'owned'},'u');assert.equal(result.status,200);assert.equal(result.payload.cardId,null);assert.equal(result.payload.imageUrl,null);assert.equal(result.payload.extraRewards.length,1);assert.equal(Object.entries(h.records).filter(([key,value])=>key.startsWith('items/')&&value.itemType==='card').length,0);
 const rewards=require('./public/reward-card-art').normalize(result.payload);assert.equal(rewards.some(r=>r.kind==='card'),false);assert.equal(rewards[0].id,'bronze');
 assert.throws(()=>builder.validate({...body,rewardCards:[]},catalog),/at least one/);
});
