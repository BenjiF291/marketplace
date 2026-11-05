const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const data=fs.readFileSync('public/assets/creatures/velkris-rigged.glb');
assert.equal(data.toString('ascii',0,4),'glTF');assert.equal(data.readUInt32LE(4),2);
const length=data.readUInt32LE(12),model=JSON.parse(data.toString('utf8',20,20+length)),binaryOffset=20+length+8;
function read(index){const a=model.accessors[index],view=model.bufferViews[a.bufferView],components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],sizes={5126:4,5123:2,5121:1};const size=sizes[a.componentType];assert.ok(size);const values=[];for(let i=0;i<a.count;i++)for(let j=0;j<components;j++){const at=binaryOffset+(view.byteOffset||0)+(a.byteOffset||0)+i*(view.byteStride||components*size)+j*size;values.push(a.componentType===5126?data.readFloatLE(at):a.componentType===5123?data.readUInt16LE(at):data.readUInt8(at));}return {values,components,count:a.count};}
test('Velkris has a weighted eight-legged arachnid rig and one idle clip',()=>{
 assert.equal(model.skins.length,1);assert.equal(model.animations.length,1);assert.deepEqual(model.animations.map(a=>a.name),['idle']);
 assert.ok(model.nodes.some(n=>n.name==='Velkris_species_skin'));assert.equal(model.skins[0].joints.length,48);
 const skins=model.nodes.filter(n=>Number.isInteger(n.skin));assert.equal(skins.length,1);
 for(const node of skins){const skin=model.skins[node.skin];assert.ok(skin.joints.every(i=>model.nodes[i]));for(const primitive of model.meshes[node.mesh].primitives){const weights=read(primitive.attributes.WEIGHTS_0).values,indices=read(primitive.attributes.JOINTS_0).values;for(let i=0;i<weights.length;i+=4){assert.ok(Math.abs(weights.slice(i,i+4).reduce((n,w)=>n+w,0)-1)<1e-5);for(let j=0;j<4;j++)assert.ok(indices[i+j]<skin.joints.length);}}}
 for(const mesh of model.meshes)for(const primitive of mesh.primitives){const p=read(primitive.attributes.POSITION);assert.ok(p.values.every(Number.isFinite));}
});
test('exported movement clips join their first and last poses without a jump',()=>{
 for(const animation of model.animations)for(const sampler of animation.samplers){const times=read(sampler.input).values,out=read(sampler.output);assert.ok(times[0]===0&&times.at(-1)>0);assert.ok(times.every((t,i)=>!i||t>=times[i-1]));for(let j=0;j<out.components;j++)assert.ok(Math.abs(out.values[j]-out.values[out.values.length-out.components+j])<1e-5,animation.name+' loop seam');}
});


test('Velkris exposes articulated fangs, eight legs, a segmented tail and stinger',()=>{
 const skin=model.skins[0],names=skin.joints.map(i=>model.nodes[i].name);
 for(const name of ['Neck_joint','Head_joint','Jaw_joint','Fang_left','Fang_right','Foot_front_left','Foot_front_right','Foot_rear_left','Foot_rear_right','Stinger_joint'])assert.ok(names.includes(name),name);
 const totals=new Map(names.map(n=>[n,0]));
 for(const mesh of model.meshes)for(const p of mesh.primitives){const weights=read(p.attributes.WEIGHTS_0).values,joints=read(p.attributes.JOINTS_0).values;weights.forEach((w,i)=>totals.set(names[joints[i]],totals.get(names[joints[i]])+w));}
 assert.equal(names.filter(n=>/^Leg_.*_hip$/.test(n)).length,8);assert.equal(names.filter(n=>/^Foot_/.test(n)).length,8);
 for(const name of ['Head_joint','Fang_left','Fang_right','Tail_3','Stinger_joint'])assert.ok(totals.get(name)>1,name+' must influence mesh vertices');
 const idle=model.animations[0];for(const channel of idle.channels){const name=model.nodes[channel.target.node].name;if(/^(Foot|Toes|Leg)_/.test(name)){const values=read(idle.samplers[channel.sampler].output);for(let i=0;i<values.values.length;i++)assert.ok(Math.abs(values.values[i]-values.values[i%values.components])<1e-6,'planted feet');}}
});
test('Velkris is a nameless book entry',()=>{const book=fs.readFileSync('public/creature-book.js','utf8');assert.match(book,/kind:'velkris',name:'',species:'Velkris'/);});

test('Velkris is available to rewards, the Stable and Brawl without granting ownership',()=>{const animals=require('./public/stable-animals'),c=require('./public/creature-brawl-catalog').creatures.find(c=>c.id==='velkris');assert.ok(c&&c.species==='velkris');assert.equal(c.moves.length,3);assert.equal(c.moves[0].cost,0);assert.equal(animals.animals.find(a=>a.id==='velkris').companion,false);assert.deepEqual(animals.inventory({}),[]);assert.equal(animals.inventory({stableAnimals:{velkris:2}})[0].count,2);});

test('Velkris reward illustration uses a padded alpha crop without losing the silhouette',()=>{const vm=require('node:vm'),root={StableAnimals:require('./public/stable-animals')};vm.runInNewContext(fs.readFileSync('public/reward-card-art.js','utf8'),{window:root});const info=root.RewardCardArt.describe({kind:'animal',id:'velkris',amount:1});assert.equal(info.name,'Velkris');assert.equal(info.image,'assets/creatures/velkris-poster.png');assert.equal(info.imageFrame.imageWidth,768);assert.ok(info.imageFrame.width>300&&info.imageFrame.height>250);assert.deepEqual(JSON.parse(JSON.stringify(info.imageFrame)),{x:99,y:198,width:495,height:359,imageWidth:768,imageHeight:630});});


test('Velkris stinger reaches the forward contact without stretching tail segments',async()=>{
 const THREE=await import('./public/vendor/three/three.module.js'),{buildCombatAnimations}=await import('./public/creature-brawl-attacks.js');
 const jointIds=new Set(model.skins[0].joints),nodes=model.nodes.map((n,i)=>{const b=jointIds.has(i)?new THREE.Bone():new THREE.Group();b.name=n.name||'';if(n.translation)b.position.fromArray(n.translation);if(n.rotation)b.quaternion.fromArray(n.rotation);if(n.scale)b.scale.fromArray(n.scale);return b;});model.nodes.forEach((n,i)=>(n.children||[]).forEach(j=>nodes[i].add(nodes[j])));const root=new THREE.Group();model.scenes[model.scene||0].nodes.forEach(i=>root.add(nodes[i]));root.updateMatrixWorld(true);
 const joints=model.skins[0].joints.map(i=>nodes[i]),rig={root,joints},tail=joints.filter(b=>/^Tail_[0-9]+$|^Stinger_joint$/.test(b.name)),position=b=>b.getWorldPosition(new THREE.Vector3()),lengths=tail.slice(1).map((b,i)=>position(b).distanceTo(position(tail[i]))),moves=require('./public/creature-brawl-catalog').creatures.find(c=>c.id==='velkris').moves,set=buildCombatAnimations(rig,'velkris',moves),spec=set.actions.get('tail-strike');assert.ok(spec.tailStrikePose);
 const head=position(joints.find(b=>b.name==='Head_joint')),target=new THREE.Vector3(0,Math.max(.28,head.y+.12),head.z+.35),mixer=new THREE.AnimationMixer(root),action=mixer.clipAction(spec.clip);action.play();action.paused=true;action.time=spec.duration*spec.contact;mixer.update(0);root.updateMatrixWorld(true);const tip=position(joints.find(b=>b.name==='Stinger_joint'));assert.ok(tip.distanceTo(target)<.20,JSON.stringify({tip:tip.toArray(),target:target.toArray()}));tail.slice(1).forEach((b,i)=>assert.ok(Math.abs(position(b).distanceTo(position(tail[i]))-lengths[i])<1e-6));mixer.stopAllAction();mixer.uncacheRoot(root);
});
