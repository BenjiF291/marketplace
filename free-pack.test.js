const test=require('node:test'),assert=require('node:assert/strict');
const rules=require('./free-pack');
const catalog={gem:Object.keys(rules.GEM_NAMES).map(id=>({id,name:rules.GEM_NAMES[id]})),boost:[{id:'skip'},{id:'leap'}],pack:[{id:'p'}],card:[{id:'Bronze_jan.png'}],rubyItem:[{id:'pet:fox'}],amulet:[{id:'road:champion'}]};
test('defaults have exactly five cards, requested ranges and equal starter odds',()=>{
 const config=rules.validate(rules.defaults(),catalog);assert.equal(config.cooldownHours,7);assert.equal(config.cards.length,5);
 assert.deepEqual(config.cards[0].options.map(o=>[o.min,o.max]),[[5,15],[3,12],[1,1],[1,1],[3,6]]);
 assert.deepEqual(config.cards[3].options.map(o=>[o.min,o.max]),[[10,25],[7,17],[2,2],[1,1],[6,15]]);
 assert.ok(config.cards.slice(0,4).every(card=>card.options.every(o=>o.chance===20)));
});
test('weighted draws honor boundaries, zero chances, and inclusive ranges',()=>{
 const config=rules.defaults();for(const [roll,index] of [[0,0],[199999,0],[200000,1],[999999,4]]){
  let calls=0;const rewards=rules.draw(config,n=>calls++%2===0?roll:n-1);assert.equal(rewards[0].kind,config.cards[0].options[index].kind);assert.equal(rewards[0].id,config.cards[0].options[index].id);assert.equal(rewards[0].amount,config.cards[0].options[index].max);
 }
 config.cards[0].options[0].chance=0;config.cards[0].options[1].chance=40;assert.equal(rules.draw(config,()=>0)[0].kind,'footy');
});
test('admin config rejects invalid chances, quantities and unknown items',()=>{
 for(const change of [c=>c.cards.pop(),c=>c.cards[0].options[0].chance=21,c=>c.cards[0].options[0].min=2.5,c=>c.cards[0].options[0].id='missing',c=>c.cooldownHours=0]){const c=rules.defaults();change(c);assert.throws(()=>rules.validate(c,catalog));}
});
test('awards aggregate into real wallets and boost inventories without changing the original user',()=>{
 const user={balance:5,gems:{bronze:2,'rare-bronze':1},timeBoosts:{skip:1}};
 const result=rules.apply(user,[{kind:'gem',id:'bronze',amount:10},{kind:'gem',id:'rare-bronze',amount:6},{kind:'boost',id:'skip',amount:2},{kind:'boost',id:'leap',amount:1},{kind:'footy',amount:12}]);
 assert.equal(result.balance,17);assert.deepEqual(result.gems,{bronze:12,'rare-bronze':7});assert.deepEqual(result.timeBoosts,{skip:3,leap:1});assert.equal(user.balance,5);
});
function harness(admin=false){
 const records={'users/u':{isAdmin:admin,balance:0}},handlers={};let serial=0,queue=Promise.resolve();
 const snap=key=>({exists:!!records[key],data:()=>structuredClone(records[key]),id:key.split('/').pop()});
 const ref=key=>({key,id:key.split('/').pop(),get:async()=>snap(key),set:async value=>records[key]=structuredClone(value)});
 const db={collection:name=>({doc:id=>ref(name+'/'+(id||'new'+serial++)),get:async()=>({docs:Object.keys(records).filter(key=>key.startsWith(name+'/')).map(snap)})}),runTransaction:fn=>{
  const run=queue.then(async()=>{const writes=[];const result=await fn({get:async r=>{assert.equal(writes.length,0,'all reads precede writes');return snap(r.key);},set:(r,v)=>writes.push(()=>records[r.key]=structuredClone(v)),update:(r,v)=>writes.push(()=>records[r.key]={...records[r.key],...structuredClone(v)})});writes.forEach(write=>write());return result;});queue=run.catch(()=>{});return run;
 }};
 const app=Object.fromEntries(['get','post','put'].map(method=>[method,(url,fn)=>handlers[method+' '+url]=fn]));require('./free-pack-routes')(app,db,async req=>{if(req.denied)throw Error('Unauthorized');return 'u';});
 return {records,invoke:async(method,url,body={},denied=false)=>{let status=200,payload;await handlers[method+' '+url]({body,denied},{status(code){status=code;return this;},send(value){payload=value;},json(value){payload=value;}});return {status,payload};}};
}
test('claims persist five rewards and seven-hour cooldown; retries and simultaneous claims never double-award',async()=>{
 const h=harness();assert.equal((await h.invoke('get','/free-pack')).payload.canClaim,true);
 const [first,second]=await Promise.all([h.invoke('post','/free-pack/claim',{requestId:'claim-first'}),h.invoke('post','/free-pack/claim',{requestId:'claim-second'})]);
 assert.equal(first.status,200);assert.equal(second.status,400);assert.equal(first.payload.rewards.length,5);assert.equal(first.payload.nextAt-first.payload.claimedAt,7*3600000);
 const saved=structuredClone(h.records);assert.deepEqual((await h.invoke('post','/free-pack/claim',{requestId:'claim-first'})).payload,first.payload);assert.deepEqual(h.records,saved);
 assert.equal((await h.invoke('get','/free-pack')).payload.canClaim,false);
 h.records['users/u'].freePackLastClaimAt-=7*3600000;assert.equal((await h.invoke('post','/free-pack/claim',{requestId:'claim-third'})).status,200);
});
test('only admins can edit; disabled packs cannot be claimed; custom fifth cards reach inventory',async()=>{
 const normal=harness();assert.equal((await normal.invoke('get','/admin/free-pack')).status,403);assert.equal((await normal.invoke('put','/admin/free-pack',rules.defaults())).status,403);assert.equal((await normal.invoke('post','/free-pack/claim',{requestId:'denied-id'},true)).status,401);
 const h=harness(true);h.records['packs/p']={name:'Test pack',cardIds:['Bronze_jan.png']};
 const config=rules.defaults();config.cards[4].options=[{kind:'pack',id:'p',min:2,max:2,chance:100}];
 assert.equal((await h.invoke('put','/admin/free-pack',config)).status,200);
 assert.equal((await h.invoke('post','/free-pack/claim',{requestId:'custom-pack'})).status,200);
 const items=Object.entries(h.records).filter(([key])=>key.startsWith('items/')).map(([,v])=>v);assert.equal(items.length,2);assert.ok(items.every(item=>item.packId==='p'&&item.buyerId==='u'&&item.sold));
 config.enabled=false;await h.invoke('put','/admin/free-pack',config);h.records['users/u'].freePackLastClaimAt=0;assert.equal((await h.invoke('post','/free-pack/claim',{requestId:'disabled-pack'})).status,400);
});
