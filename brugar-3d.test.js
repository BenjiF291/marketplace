const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const data=fs.readFileSync('public/assets/creatures/brakk-rigged.glb');
assert.equal(data.toString('ascii',0,4),'glTF');assert.equal(data.readUInt32LE(4),2);
const length=data.readUInt32LE(12),model=JSON.parse(data.toString('utf8',20,20+length)),binaryOffset=20+length+8;
function read(index){const a=model.accessors[index],view=model.bufferViews[a.bufferView],components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],sizes={5126:4,5123:2,5121:1};const size=sizes[a.componentType];assert.ok(size);const values=[];for(let i=0;i<a.count;i++)for(let j=0;j<components;j++){const at=binaryOffset+(view.byteOffset||0)+(a.byteOffset||0)+i*(view.byteStride||components*size)+j*size;values.push(a.componentType===5126?data.readFloatLE(at):a.componentType===5123?data.readUInt16LE(at):data.readUInt8(at));}return {values,components,count:a.count};}
test('Brakk has a weighted stone beast rig and one idle clip',()=>{
 assert.equal(model.skins.length,1);assert.equal(model.animations.length,1);assert.deepEqual(model.animations.map(a=>a.name),['idle']);
 assert.ok(model.nodes.some(n=>n.name==='Brakk_Brugar_skin'));assert.equal(model.skins[0].joints.length,34);
 const skins=model.nodes.filter(n=>Number.isInteger(n.skin));assert.equal(skins.length,1);
 for(const node of skins){const skin=model.skins[node.skin];assert.ok(skin.joints.every(i=>model.nodes[i]));for(const primitive of model.meshes[node.mesh].primitives){const weights=read(primitive.attributes.WEIGHTS_0).values,indices=read(primitive.attributes.JOINTS_0).values;for(let i=0;i<weights.length;i+=4){assert.ok(Math.abs(weights.slice(i,i+4).reduce((n,w)=>n+w,0)-1)<1e-5);for(let j=0;j<4;j++)assert.ok(indices[i+j]<skin.joints.length);}}}
 for(const mesh of model.meshes)for(const primitive of mesh.primitives){const p=read(primitive.attributes.POSITION);assert.ok(p.values.every(Number.isFinite));}
});
test('exported movement clips join their first and last poses without a jump',()=>{
 for(const animation of model.animations)for(const sampler of animation.samplers){const times=read(sampler.input).values,out=read(sampler.output);assert.ok(times[0]===0&&times.at(-1)>0);assert.ok(times.every((t,i)=>!i||t>=times[i-1]));for(let j=0;j<out.components;j++)assert.ok(Math.abs(out.values[j]-out.values[out.values.length-out.components+j])<1e-5,animation.name+' loop seam');}
});


test('Brakk has two independently weighted club tails and four planted paws',()=>{
 const names=model.skins[0].joints.map(i=>model.nodes[i].name),totals=new Map(names.map(n=>[n,0]));
 for(const mesh of model.meshes)for(const p of mesh.primitives){const w=read(p.attributes.WEIGHTS_0).values,j=read(p.attributes.JOINTS_0).values;w.forEach((v,i)=>totals.set(names[j[i]],totals.get(names[j[i]])+v));}
 for(const name of ['Head_joint','Neck_joint','Jaw_joint','Chest_breath','Foot_front_left','Foot_front_right','Foot_rear_left','Foot_rear_right','Tail_upper_club','Tail_lower_club'])assert.ok(totals.get(name)>5,name);
 for(const c of model.animations[0].channels){const name=model.nodes[c.target.node].name;if(name==='Torso'||name.startsWith('Foot_')||name.startsWith('Leg_')){const out=read(model.animations[0].samplers[c.sampler].output);for(let i=0;i<out.values.length;i++)assert.ok(Math.abs(out.values[i]-out.values[i%out.components])<1e-6,'stone armor and paws remain stable');}}
 const animatedScale=model.animations[0].channels.filter(c=>c.target.path==='scale').map(c=>model.nodes[c.target.node].name);assert.deepEqual(animatedScale,['Chest_breath']);
});
test('Brakk is a named Brugar in the book and never registered as an adoptable pet',()=>{const book=fs.readFileSync('public/creature-book.js','utf8'),petArt=fs.readFileSync('public/companions.js','utf8');assert.match(book,/kind:'brugar',name:'Brakk',species:'Brugar'/);assert.match(petArt,/new Set\(\['fox','snail','dragon'\]\)/);});
