const test=require('node:test'),assert=require('node:assert/strict'),world=require('./public/island-walk-world'),walking=require('./public/village-walking'),layout=require('./public/village-layout');
const buildings=()=>Object.entries(layout.profile({}).positions).map(([id,n])=>({id,x:layout.PLOTS[n].x,z:layout.PLOTS[n].y,w:50,d:18}));
test('first-person movement remains on local paths and cannot tunnel through a building',()=>{
 const map=world.create([[[0,0],[200,0]],[[0,50],[200,50]]],[{x:100,z:0,w:40,d:30}]);
 const at=map.move({x:0,z:0},200,0);assert.ok(at.x<75);assert.ok(map.valid(at.x,at.z));
 assert.equal(map.valid(100,0),false);assert.equal(map.valid(100,500),false);assert.equal(map.valid(NaN,0),false);
 assert.equal(map.doorVisible({x:100,z:-30},{x:100,z:0,w:40,d:30}),false);
 assert.equal(map.doorVisible({x:100,z:40},{x:100,z:0,w:40,d:30}),true);
});
test('saved island buildings have clear front door approaches and a safe spawn',()=>{
 const bs=buildings(),map=world.create(walking.segments,bs),spawn=map.spawn();assert.ok(spawn);assert.ok(map.valid(spawn.x,spawn.z));
 for(const b of bs){assert.ok(map.valid(b.x,b.z+b.d/2+7),b.id+' door approach');assert.ok(map.doorVisible({x:b.x,z:b.z+b.d/2+7},b),b.id+' door interaction');}
 const moved=bs.map((b,i)=>i?b:{...b,x:spawn.x,z:spawn.z});const changed=world.create(walking.segments,moved);const reset=changed.spawn(spawn);assert.ok(changed.valid(reset.x,reset.z));assert.notDeepEqual(reset,spawn);
});
test('door interactions are range-limited and blocked by other buildings',()=>{const a={x:100,z:0,w:40,d:30},b={x:100,z:60,w:30,d:20},map=world.create([[[0,40],[200,40]]],[a,b]);assert.equal(map.doorVisible({x:100,z:90},a),false);assert.equal(map.doorVisible({x:100,z:200},a),false);assert.equal(map.doorVisible({x:100,z:35},a),true);});
