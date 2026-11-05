const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const data=fs.readFileSync('public/assets/creatures/trusk-rigged.glb');
assert.equal(data.toString('ascii',0,4),'glTF');assert.equal(data.readUInt32LE(4),2);
const length=data.readUInt32LE(12),model=JSON.parse(data.toString('utf8',20,20+length)),binaryOffset=20+length+8;
function read(index){const a=model.accessors[index],view=model.bufferViews[a.bufferView],components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],sizes={5126:4,5123:2,5121:1};const size=sizes[a.componentType];assert.ok(size);const values=[];for(let i=0;i<a.count;i++)for(let j=0;j<components;j++){const at=binaryOffset+(view.byteOffset||0)+(a.byteOffset||0)+i*(view.byteStride||components*size)+j*size;values.push(a.componentType===5126?data.readFloatLE(at):a.componentType===5123?data.readUInt16LE(at):data.readUInt8(at));}return {values,components,count:a.count};}
test('Trusk has a weighted armoured quadruped rig and one idle clip',()=>{
 assert.equal(model.skins.length,1);assert.equal(model.animations.length,1);assert.deepEqual(model.animations.map(a=>a.name),['idle']);
 assert.ok(model.nodes.some(n=>n.name==='Trusk_species_skin'));assert.equal(model.skins[0].joints.length,31);
 const skins=model.nodes.filter(n=>Number.isInteger(n.skin));assert.equal(skins.length,1);
 for(const node of skins){const skin=model.skins[node.skin];assert.ok(skin.joints.every(i=>model.nodes[i]));for(const primitive of model.meshes[node.mesh].primitives){const weights=read(primitive.attributes.WEIGHTS_0).values,indices=read(primitive.attributes.JOINTS_0).values;for(let i=0;i<weights.length;i+=4){assert.ok(Math.abs(weights.slice(i,i+4).reduce((n,w)=>n+w,0)-1)<1e-5);for(let j=0;j<4;j++)assert.ok(indices[i+j]<skin.joints.length);}}}
 for(const mesh of model.meshes)for(const primitive of mesh.primitives){const p=read(primitive.attributes.POSITION);assert.ok(p.values.every(Number.isFinite));}
});
test('exported movement clips join their first and last poses without a jump',()=>{
 for(const animation of model.animations)for(const sampler of animation.samplers){const times=read(sampler.input).values,out=read(sampler.output);assert.ok(times[0]===0&&times.at(-1)>0);assert.ok(times.every((t,i)=>!i||t>=times[i-1]));for(let j=0;j<out.components;j++)assert.ok(Math.abs(out.values[j]-out.values[out.values.length-out.components+j])<1e-5,animation.name+' loop seam');}
});


test('Trusk exposes articulated head, ears, curled tail and fixed paw stance',()=>{
 const skin=model.skins[0],names=skin.joints.map(i=>model.nodes[i].name);
 for(const name of ['Neck_joint','Head_joint','Jaw_joint','Ear_left','Foot_front_left','Foot_front_right','Foot_rear_left','Foot_rear_right','Tail_6'])assert.ok(names.includes(name),name);
 const totals=new Map(names.map(n=>[n,0]));
 for(const mesh of model.meshes)for(const p of mesh.primitives){const weights=read(p.attributes.WEIGHTS_0).values,joints=read(p.attributes.JOINTS_0).values;weights.forEach((w,i)=>totals.set(names[joints[i]],totals.get(names[joints[i]])+w));}
 for(const name of ['Head_joint','Tail_3'])assert.ok(totals.get(name)>1,name+' must influence mesh vertices');
 const idle=model.animations[0];for(const channel of idle.channels){const name=model.nodes[channel.target.node].name;if(/^(Foot|Toes|Leg)_/.test(name)){const values=read(idle.samplers[channel.sampler].output);for(let i=0;i<values.values.length;i++)assert.ok(Math.abs(values.values[i]-values.values[i%values.components])<1e-6,'planted feet');}}
});
test('Trusk is a nameless book entry',()=>{const book=fs.readFileSync('public/creature-book.js','utf8');assert.match(book,/kind:'trusk',name:'',species:'Trusk'/);});

test('Trusk is available to rewards, the Stable and Brawl without granting ownership',()=>{const animals=require('./public/stable-animals'),c=require('./public/creature-brawl-catalog').creatures.find(c=>c.id==='trusk');assert.ok(c&&c.species==='trusk');assert.equal(c.moves.length,3);assert.equal(c.moves[0].cost,0);assert.equal(animals.animals.find(a=>a.id==='trusk').companion,false);assert.deepEqual(animals.inventory({}),[]);assert.equal(animals.inventory({stableAnimals:{trusk:2}})[0].count,2);});

test('Trusk reward illustration uses a padded alpha crop without losing the silhouette',()=>{const vm=require('node:vm'),root={StableAnimals:require('./public/stable-animals')};vm.runInNewContext(fs.readFileSync('public/reward-card-art.js','utf8'),{window:root});const info=root.RewardCardArt.describe({kind:'animal',id:'trusk',amount:1});assert.equal(info.name,'Trusk');assert.equal(info.image,'assets/creatures/trusk-poster.png');assert.equal(info.imageFrame.imageWidth,768);assert.ok(info.imageFrame.width>300&&info.imageFrame.height>250);assert.deepEqual(JSON.parse(JSON.stringify(info.imageFrame)),{x:166,y:168,width:451,height:332,imageWidth:768,imageHeight:630});});
