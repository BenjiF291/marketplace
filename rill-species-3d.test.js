const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const data=fs.readFileSync('public/assets/creatures/rill-species-rigged.glb');
assert.equal(data.toString('ascii',0,4),'glTF');assert.equal(data.readUInt32LE(4),2);
const length=data.readUInt32LE(12),model=JSON.parse(data.toString('utf8',20,20+length)),binaryOffset=20+length+8;
function read(index){const a=model.accessors[index],view=model.bufferViews[a.bufferView],components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],sizes={5126:4,5123:2,5121:1};const size=sizes[a.componentType];assert.ok(size);const values=[];for(let i=0;i<a.count;i++)for(let j=0;j<components;j++){const at=binaryOffset+(view.byteOffset||0)+(a.byteOffset||0)+i*(view.byteStride||components*size)+j*size;values.push(a.componentType===5126?data.readFloatLE(at):a.componentType===5123?data.readUInt16LE(at):data.readUInt8(at));}return {values,components,count:a.count};}
test('Aeri has a weighted bird rig and one idle clip',()=>{
 assert.equal(model.skins.length,1);assert.equal(model.animations.length,1);assert.deepEqual(model.animations.map(a=>a.name),['idle']);
 assert.ok(model.nodes.some(n=>n.name==='Rill_species_skin'));assert.equal(model.skins[0].joints.length,29);
 const skins=model.nodes.filter(n=>Number.isInteger(n.skin));assert.equal(skins.length,1);
 for(const node of skins){const skin=model.skins[node.skin];assert.ok(skin.joints.every(i=>model.nodes[i]));for(const primitive of model.meshes[node.mesh].primitives){const weights=read(primitive.attributes.WEIGHTS_0).values,indices=read(primitive.attributes.JOINTS_0).values;for(let i=0;i<weights.length;i+=4){assert.ok(Math.abs(weights.slice(i,i+4).reduce((n,w)=>n+w,0)-1)<1e-5);for(let j=0;j<4;j++)assert.ok(indices[i+j]<skin.joints.length);}}}
 for(const mesh of model.meshes)for(const primitive of mesh.primitives){const p=read(primitive.attributes.POSITION);assert.ok(p.values.every(Number.isFinite));}
});
test('exported movement clips join their first and last poses without a jump',()=>{
 for(const animation of model.animations)for(const sampler of animation.samplers){const times=read(sampler.input).values,out=read(sampler.output);assert.ok(times[0]===0&&times.at(-1)>0);assert.ok(times.every((t,i)=>!i||t>=times[i-1]));for(let j=0;j<out.components;j++)assert.ok(Math.abs(out.values[j]-out.values[out.values.length-out.components+j])<1e-5,animation.name+' loop seam');}
});


test('Rill rig exposes wings, head, tail and planted feet for future brawl animation',()=>{
 const skin=model.skins[0],names=skin.joints.map(i=>model.nodes[i].name);
 for(const name of ['Neck_joint','Head_joint','Crest_joint','Beak_joint','Wing_left_root','Wing_left_elbow','Wing_left_wrist','Wing_left_tip','Wing_right_root','Foot_left','Foot_right','Toes_left','Toes_right','Tail_6'])assert.ok(names.includes(name),name);
 const totals=new Map(names.map(n=>[n,0]));
 for(const mesh of model.meshes)for(const p of mesh.primitives){const weights=read(p.attributes.WEIGHTS_0).values,joints=read(p.attributes.JOINTS_0).values;weights.forEach((w,i)=>totals.set(names[joints[i]],totals.get(names[joints[i]])+w));}
 for(const name of ['Head_joint','Wing_left_root','Wing_left_wrist','Wing_right_root','Wing_right_wrist','Foot_left','Foot_right','Tail_3'])assert.ok(totals.get(name)>5,name+' must influence mesh vertices');
 const idle=model.animations[0];for(const channel of idle.channels){const name=model.nodes[channel.target.node].name;if(/^(Foot|Toes|Leg)_/.test(name)){const values=read(idle.samplers[channel.sampler].output);for(let i=0;i<values.values.length;i++)assert.ok(Math.abs(values.values[i]-values.values[i%values.components])<1e-6,'planted feet');}}
});
test('Rill species is nameless and keeps Aeri alongside it',()=>{const book=fs.readFileSync('public/creature-book.js','utf8');assert.match(book,/kind:'rill-species',name:'',species:'Rill'/);assert.match(book,/kind:'rill',name:'Aeri',species:'Rill'/);});
