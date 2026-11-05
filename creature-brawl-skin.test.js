const test=require('node:test'),assert=require('node:assert/strict');
let T,conditionCombatSkin,combatRotation;
test.before(async()=>{T=await import('./public/vendor/three/three.module.js');({conditionCombatSkin,combatRotation}=await import('./public/creature-brawl-skin.js'));});
test('combat skin smooths abrupt weights and UV seams without changing geometry or bind pose',()=>{
 const root=new T.Group(),a=new T.Bone(),b=new T.Bone();a.name='Torso';b.name='Wing_left_root';a.add(b);b.position.x=1;root.add(a);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,1,0,0,1,1,0,0,1,0],3));g.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,1,0,1],2));
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute([0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(Array.from({length:6},()=>[1,0,0,0]).flat(),4));
 const mesh=new T.SkinnedMesh(g,new T.MeshBasicMaterial());root.add(mesh);root.updateMatrixWorld(true);mesh.bind(new T.Skeleton([a,b]));
 const positions=Array.from(g.attributes.position.array),uv=Array.from(g.attributes.uv.array),rest=b.position.clone(),model={root,joints:[a,b]};conditionCombatSkin(model);
 assert.deepEqual(Array.from(mesh.geometry.attributes.position.array),positions);assert.deepEqual(Array.from(mesh.geometry.attributes.uv.array),uv);assert.deepEqual(b.position,rest);
 const idx=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;
 for(let i=0;i<6;i++){assert.ok(Math.abs([0,1,2,3].reduce((sum,j)=>sum+w.array[i*4+j],0)-1)<1e-6);assert.ok([...w.array.slice(i*4,i*4+4)].every(v=>Number.isFinite(v)&&v>=0));}
 const influences=i=>Object.fromEntries([0,1,2,3].filter(j=>w.array[i*4+j]>0).map(j=>[idx.array[i*4+j],w.array[i*4+j]]));assert.deepEqual(influences(1),influences(3));assert.deepEqual(influences(2),influences(5));assert.equal(g.attributes.skinIndex.getX(3),1);
 const before=mesh.geometry;conditionCombatSkin(model);assert.equal(mesh.geometry,before);mesh.geometry.dispose();mesh.material.dispose();
});
test('combat limits preserve rotation direction and reject extreme wing and leg bends',()=>{
 for(const name of ['Wing_left_root','Leg_left_hip','Torso','Head_joint']){const rotation=[1,-2,3],safe=combatRotation(name,rotation);assert.ok(Math.hypot(...safe)<=.121);assert.ok(safe.every(Number.isFinite));assert.ok(Math.abs(safe[1]/safe[0]+2)<1e-8);assert.deepEqual(combatRotation(name,[0,0,0]),[0,0,0]);}
});
