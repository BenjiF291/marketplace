const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const animals=require('./public/stable-animals'),layout=require('./public/village-layout');
test('Stable catalogue excludes the three companions and every poster exists',()=>{
 const inventory=animals.inventory({stableAnimals:Object.fromEntries(animals.animals.map(a=>[a.id,2]))});assert.equal(inventory.length,14);assert.ok(inventory.every(a=>!['fox','snail','dragon'].includes(a.id)));
 animals.animals.forEach(a=>assert.ok(fs.existsSync('public/'+a.poster),a.poster));assert.deepEqual(animals.inventory({}),[]);
});
test('Stable is placeable at Town Hall 1 without changing existing buildings or plot IDs',()=>{
 const user=layout.initial(),positions=layout.profile(user).positions,spot=layout.PLOTS.find(p=>p.id<layout.legacyCount&&layout.validPlacement('stable',p.id,positions));
 const update=layout.validate(user,{...positions,stable:spot.id},0,0);assert.equal(update.villageLayout.stable,spot.id);assert.equal(update.villageLayout.townhall,positions.townhall);assert.equal(update.gems,undefined);
 assert.equal(layout.LEVELS.stable,0);assert.equal(layout.legacyCount,33);assert.equal(layout.profile({}).positions.stable,undefined);
});
test('Stable endpoint authenticates, reads only the requesting account and returns owned animals',async()=>{
 let handler;const records={u:{stableAnimals:{tharos:3,talren:1,fox:2},rubyItems:{'pet:fox':1}},other:{stableAnimals:{tharos:99}}};
 const db={collection:()=>({doc:id=>({get:async()=>({exists:!!records[id],data:()=>records[id]})})})};require('./stable-routes')({get:(url,fn)=>handler=fn},db,async req=>{if(!req.id)throw Error();return req.id;});
 async function call(id){let status=200,payload;await handler({id,query:{player:'other'}},{status(n){status=n;return this;},send(v){payload=v;},json(v){payload=v;}});return {status,payload};}
 assert.equal((await call()).status,401);assert.equal((await call('missing')).status,404);const result=await call('u');assert.equal(result.status,200);assert.equal(result.payload.total,4);assert.equal(result.payload.animals.length,2);assert.equal(result.payload.animals.find(a=>a.id==='tharos').count,3);
});
