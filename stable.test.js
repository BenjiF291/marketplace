const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const animals=require('./public/stable-animals'),layout=require('./public/village-layout');
test('Stable reads companions from their pet inventory and every poster exists',()=>{
 const inventory=animals.inventory({stableAnimals:Object.fromEntries(animals.animals.map(a=>[a.id,2]))});assert.equal(inventory.length,17);assert.ok(inventory.every(a=>!['fox','snail','dragon'].includes(a.id)));
 animals.animals.forEach(a=>assert.ok(fs.existsSync('public/'+a.poster),a.poster));assert.deepEqual(animals.inventory({}),[]);
});
test('Stable is placeable at Town Hall 1 without changing existing buildings or plot IDs',()=>{
 const user=layout.initial(),positions=layout.profile(user).positions,spot=layout.PLOTS.find(p=>p.id<layout.legacyCount&&layout.validPlacement('stable',p.id,positions));
 const update=layout.validate(user,{...positions,stable:spot.id},0,0);assert.equal(update.villageLayout.stable,spot.id);assert.equal(update.villageLayout.townhall,positions.townhall);assert.equal(update.gems,undefined);
 assert.equal(layout.LEVELS.stable,0);assert.equal(layout.legacyCount,33);assert.equal(layout.profile({}).positions.stable,undefined);
});
test('Stable endpoint authenticates, reads only the requesting account and returns owned animals',async()=>{
 let handler;const records={u:{stableAnimals:{tharos:3,talren:1,fox:2},rubyItems:{'pet:fox':1}},other:{stableAnimals:{tharos:99}}};
 const db={collection:()=>({doc:id=>({get:async()=>({exists:!!records[id],data:()=>records[id]})})})};require('./stable-routes')({get:(url,fn)=>handler=fn,post:()=>{}},db,async req=>{if(!req.id)throw Error();return req.id;});
 async function call(id){let status=200,payload;await handler({id,query:{player:'other'}},{status(n){status=n;return this;},send(v){payload=v;},json(v){payload=v;}});return {status,payload};}
 assert.equal((await call()).status,401);assert.equal((await call('missing')).status,404);const result=await call('u');assert.equal(result.status,200);assert.equal(result.payload.total,5);assert.equal(result.payload.animals.length,5);assert.equal(result.payload.animals.filter(a=>a.id==='tharos').length,3);assert.ok(result.payload.animals.every(a=>a.count===1));assert.equal(new Set(result.payload.animals.map(a=>a.instanceId)).size,5);
});

test('Three Rills occupy separate stable stalls with consistent identities across reloads',()=>{
 const user={stableAnimals:{'rill-species':3,fox:2}};
 const residents=animals.residents(user);assert.equal(residents.length,3);
 assert.deepEqual(residents.map(a=>a.instanceId),['rill-species:0','rill-species:1','rill-species:2']);
 assert.deepEqual(animals.residents({...user,stableAnimals:{...user.stableAnimals,kanji:1}}).filter(a=>a.id==='rill-species'),residents);
 assert.deepEqual(animals.residents({}),[]);
});

test('resident nicknames persist per owned copy, validate input and stay account-owned',async()=>{
 const records={a:{stableAnimals:{'rill-species':3}},b:{stableAnimals:{trusk:1},stableNames:{'trusk:0':'Other'}}},handlers={};
 const db={collection:()=>({doc:id=>({id})}),runTransaction:async fn=>{const writes=[];const value=await fn({get:async ref=>({exists:!!records[ref.id],data:()=>structuredClone(records[ref.id])}),update:(ref,value)=>writes.push(()=>Object.assign(records[ref.id],value))});writes.forEach(f=>f());return value;}};
 require('./stable-routes')({get:()=>{},post:(path,fn)=>handlers[path]=fn},db,async req=>{if(!req.id)throw Error();return req.id;});
 async function call(id,instanceId,name){let status=200,body;const res={status(n){status=n;return this;},send(v){body=v;},json(v){body=v;}};await handlers['/stable/name']({id,body:{instanceId,name,userId:'b'}},res);return {status,body};}
 assert.equal((await call(null,'rill-species:0','Fern')).status,401);assert.equal((await call('a','trusk:0','Taken')).status,400);
 for(const name of ['a'.repeat(33),'<script>','Bad\u202eName',null])assert.equal((await call('a','rill-species:0',name)).status,400);
 assert.equal((await call('a','rill-species:1','  River   Song  ')).body.animal.name,'River Song');let list=animals.residents(records.a);assert.deepEqual(list.map(a=>a.name),['Rill','River Song','Rill']);assert.equal(records.b.stableNames['trusk:0'],'Other');
 await call('a','rill-species:2','River Song');assert.equal(animals.residents(records.a)[2].name,'River Song');await call('a','rill-species:1','');assert.equal(animals.residents(records.a)[1].name,'Rill');assert.equal(records.a.stableNames['rill-species:1'],undefined);
});


test('owned companions appear as separate stable residents with existing names and growth',()=>{
 const user={rubyItems:{'pet:fox':2,'pet:dragon':1,'pet:snail':1},stableAnimals:{fox:99,dragon:99,snail:99,'rill-species':1},stableNames:{'fox:1':'Sparks'},creatureGrowth:{'fox:1':{level:7,hunger:12}}};
 const residents=animals.residents(user);assert.equal(residents.length,5);
 assert.deepEqual(residents.filter(a=>a.companion).map(a=>a.instanceId),['fox:0','fox:1','snail:0','dragon:0']);
 const fox=require('./creature-growth').decorate(user,residents.find(a=>a.instanceId==='fox:1'));
 assert.equal(fox.name,'Sparks');assert.equal(fox.growth.level,7);assert.equal(fox.growth.hunger,12);
 assert.equal(animals.residents({...user,rubyItems:{'pet:snail':1}}).some(a=>a.id==='fox'||a.id==='dragon'),false);
});
