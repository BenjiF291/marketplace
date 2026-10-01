const test=require('node:test'),assert=require('node:assert/strict');
function fixture(user,authenticate=async()=> 'admin',hall={level:1}){
 let handler,reads=0;
 const db={collection:n=>({doc:()=>({get:async()=>{reads++;return {exists:n==='users'?!!user:true,data:()=>n==='users'?user:hall};}})})};
 const tiers=Array.from({length:10},(_,i)=>({id:String(i),name:'Tier '+i}));
 require('./village-routes')({post:()=>{},get:(path,fn)=>{assert.equal(path,'/admin/village');handler=fn;}},db,authenticate,async()=>tiers);
 return {get reads(){return reads;},async call(){let status=200,body;const res={status(n){status=n;return res;},send(v){body=v;},json(v){body=v;}};await handler({},res);return {status,body};}};
}
test('village rejects missing sessions before reading an account and admits ordinary accounts',async()=>{
 const noSession=fixture({isAdmin:true},async()=>{throw Error('no session');});assert.equal((await noSession.call()).status,401);assert.equal(noSession.reads,0);
 assert.equal((await fixture(undefined).call()).status,403);for(const user of [{isAdmin:false},{isAdmin:'true'}]){const r=await fixture(user).call();assert.equal(r.status,200);assert.equal(r.body.isAdmin,false);}
});
test('admin village uses private hall progression independently of the personal gem forge',async()=>{
 const f=fixture({isAdmin:true,gemConverterLevel:3,balance:42,gemCompressor:true});const response=await f.call();assert.equal(response.status,200);assert.equal(response.body.level,0);assert.equal(response.body.forgeLevel,3);assert.equal(response.body.compressor,true);assert.equal(response.body.balance,42);assert.equal(f.reads,1);
 assert.equal((await fixture({isAdmin:true,townHallXP:1850},undefined,{level:1}).call()).body.level,5);
 assert.equal((await fixture({isAdmin:true}).call()).body.level,0);
 assert.equal((await fixture({isAdmin:true,gemConverterLevel:-10}).call()).body.level,0);
 assert.equal((await fixture({isAdmin:true,gemConverterLevel:5000}).call()).body.forgeLevel,9);
 assert.equal((await fixture({isAdmin:true,gemConverterAllUnlocked:true}).call()).body.forgeLevel,9);
});

test('island naming is authenticated, validated, account-owned and safe to retry',async()=>{
 const records={a:{},b:{islandName:'Other Island'}},handlers={};let writes=0;
 const db={collection:()=>({doc:id=>({id})}),runTransaction:async fn=>fn({get:async ref=>({exists:!!records[ref.id],data:()=>records[ref.id]}),update:(ref,update)=>{writes++;Object.assign(records[ref.id],update);}})};
 require('./village-routes')({get:()=>{},post:(path,fn)=>handlers[path]=fn},db,async req=>{if(!req.identity)throw Error();return req.identity;},async()=>[]);
 async function call(identity,name){let status=200,body;const res={status(n){status=n;return this;},send(v){body=v;},json(v){body=v;}};await handlers['/village/name']({identity,body:{name,userId:'b'}},res);return {status,body};}
 assert.equal((await call(null,'Willow Bay')).status,401);
 for(const name of ['', 'a', 'x'.repeat(33),'<script>',{},'Bay\u202e'])assert.equal((await call('a',name)).status,400);
 assert.equal(writes,0);
 const saved=await call('a','  Willow   Bay  ');assert.equal(saved.status,200);assert.equal(saved.body.islandName,'Willow Bay');assert.equal(records.a.islandName,'Willow Bay');assert.equal(records.b.islandName,'Other Island');
 assert.equal((await call('a','Changed')).body.islandName,'Willow Bay');assert.equal(writes,1);
 assert.equal((await call('missing','Willow Bay')).status,400);
});
test('island profile returns the account name for other devices',async()=>{assert.equal((await fixture({islandName:'Willow Bay'}).call()).body.islandName,'Willow Bay');assert.equal((await fixture({}).call()).body.islandName,null);});
