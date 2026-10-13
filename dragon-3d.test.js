const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const data=fs.readFileSync('public/assets/companions/dragon-meshy-rigged.glb');
assert.equal(data.toString('ascii',0,4),'glTF');assert.equal(data.readUInt32LE(4),2);
const length=data.readUInt32LE(12),model=JSON.parse(data.toString('utf8',20,20+length)),binaryOffset=20+length+8;
function read(index){const a=model.accessors[index],view=model.bufferViews[a.bufferView],components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],sizes={5126:4,5123:2,5121:1};const size=sizes[a.componentType];assert.ok(size);const values=[];for(let i=0;i<a.count;i++)for(let j=0;j<components;j++){const at=binaryOffset+(view.byteOffset||0)+(a.byteOffset||0)+i*(view.byteStride||components*size)+j*size;values.push(a.componentType===5126?data.readFloatLE(at):a.componentType===5123?data.readUInt16LE(at):data.readUInt8(at));}return {values,components,count:a.count};}
test('supplied dragon has a weighted anatomical rig and four movement clips',()=>{
 assert.equal(model.skins.length,1);assert.equal(model.animations.length,4);assert.deepEqual(model.animations.map(a=>a.name),['idle','walk','run','fly']);
 assert.ok(model.nodes.some(n=>n.name==='Meshy_dragon_skin'));assert.equal(model.skins[0].joints.length,29);
 const skins=model.nodes.filter(n=>Number.isInteger(n.skin));assert.equal(skins.length,1);
 for(const node of skins){const skin=model.skins[node.skin];assert.ok(skin.joints.every(i=>model.nodes[i]));for(const primitive of model.meshes[node.mesh].primitives){const weights=read(primitive.attributes.WEIGHTS_0).values,indices=read(primitive.attributes.JOINTS_0).values;for(let i=0;i<weights.length;i+=4){assert.ok(Math.abs(weights.slice(i,i+4).reduce((n,w)=>n+w,0)-1)<1e-5);for(let j=0;j<4;j++)assert.ok(indices[i+j]<skin.joints.length);}}}
 for(const mesh of model.meshes)for(const primitive of mesh.primitives){const p=read(primitive.attributes.POSITION);assert.ok(p.values.every(Number.isFinite));}
});
test('exported movement clips join their first and last poses without a jump',()=>{
 for(const animation of model.animations)for(const sampler of animation.samplers){const times=read(sampler.input).values,out=read(sampler.output);assert.ok(times[0]===0&&times.at(-1)>0);assert.ok(times.every((t,i)=>!i||t>=times[i-1]));for(let j=0;j<out.components;j++)assert.ok(Math.abs(out.values[j]-out.values[out.values.length-out.components+j])<1e-5,animation.name+' loop seam');}
});

test('toe vertices follow their own paw joints instead of remaining pinned to the torso',()=>{
 const counts=[0,0,0,0],skin=model.skins[0],names=skin.joints.map(i=>model.nodes[i].name);
 for(const mesh of model.meshes)for(const primitive of mesh.primitives){const positions=read(primitive.attributes.POSITION).values,weights=read(primitive.attributes.WEIGHTS_0).values,joints=read(primitive.attributes.JOINTS_0).values;
  for(let i=0;i<positions.length/3;i++){if(positions[i*3+1]>.10)continue;const leg=(positions[i*3+2]>.72?0:2)+(positions[i*3]>0?1:0);let attached=0;for(let j=0;j<4;j++)if(names[joints[i*4+j]]===`Leg_${leg}_paw`)attached+=weights[i*4+j];assert.ok(attached>.99,`Leg ${leg} toe attached by ${attached}`);counts[leg]++;}
 }assert.ok(counts.every(n=>n>30));
});

test('outer wing membranes follow wing joints and the face remains attached to the head',()=>{
 const names=model.skins[0].joints.map(i=>model.nodes[i].name);let wingCount=0,headCount=0;
 for(const mesh of model.meshes)for(const primitive of mesh.primitives){const p=read(primitive.attributes.POSITION).values,w=read(primitive.attributes.WEIGHTS_0).values,j=read(primitive.attributes.JOINTS_0).values;
  for(let i=0;i<p.length/3;i++){const wing=Math.abs(p[i*3])>.95&&p[i*3+1]>1.7&&p[i*3+2]<.4,head=p[i*3+1]>1.85&&p[i*3+2]>1.3;if(!wing&&!head)continue;let influence=0;for(let k=0;k<4;k++)if(wing?names[j[i*4+k]].startsWith('Wing_'):names[j[i*4+k]]==='Head_joint')influence+=w[i*4+k];assert.ok(influence>.99);if(wing)wingCount++;else headCount++;}
 }assert.ok(wingCount>30);assert.ok(headCount>30);
});
