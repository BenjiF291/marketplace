const test=require('node:test'),assert=require('node:assert/strict');
const catalog=require('./public/creature-brawl-catalog');
let THREE,buildCombatAnimations,choreography,CombatAnimationPlayer;
test.before(async()=>{THREE=await import('./public/vendor/three/three.module.js');({buildCombatAnimations,choreography}=await import('./public/creature-brawl-attacks.js'));({CombatAnimationPlayer}=await import('./public/creature-brawl-animation-player.js'));});
function rig(){const root=new THREE.Group(),names=['Torso','Neck_joint','Neck_lower','Head_joint','Jaw_joint','Beak_joint','Crest_joint','Shell_joint','Feeler_upper_left_base','Feeler_upper_right_base','Tail_root','Pelvis'];for(const level of ['upper','lower'])for(let n=0;n<5;n++)names.push('Tail_'+level+'_'+n);for(const side of ['left','right']){for(const part of ['root','elbow','wrist'])names.push(`Wing_${side}_${part}`);for(const part of ['hip','knee'])names.push(`Leg_front_${side}_${part}`,`Leg_rear_${side}_${part}`,`Leg_${side}_${part}`);}const joints=names.map((name,i)=>{const b=new THREE.Bone();b.name=name;b.position.set(i*.01,1,0);root.add(b);return b;});return {root,joints};}
test('every catalogue creature has choreography for all three actual move IDs',()=>{
 assert.deepEqual(Object.keys(choreography).sort(),catalog.creatures.map(c=>c.id).sort());
 for(const c of catalog.creatures){const set=buildCombatAnimations(rig(),c.id,c.moves);assert.deepEqual([...set.actions.keys()],c.moves.map(m=>m.id));for(const spec of set.actions.values()){assert.ok(spec.contact>0&&spec.contact<1);assert.ok(spec.duration>=.8&&spec.duration<1.5);assert.equal(spec.clip.name.startsWith(c.id+':'),true);}}
});
test('all combat clips have finite normalized quaternions and return to their exact starting pose',()=>{
 for(const c of catalog.creatures){const set=buildCombatAnimations(rig(),c.id,c.moves);for(const clip of [...set.actions.values()].map(s=>s.clip).concat(set.travel,set.hit)){assert.equal(clip.validate(),true);for(const track of clip.tracks){assert.ok([...track.values].every(Number.isFinite));const size=track.getValueSize();for(let j=0;j<size;j++)assert.ok(Math.abs(track.values[j]-track.values[track.values.length-size+j])<1e-6,clip.name+' rest seam');if(size===4)for(let i=0;i<track.values.length;i+=4)assert.ok(Math.abs(Math.hypot(...track.values.slice(i,i+4))-1)<1e-5);}}}
});
test('contact seeking holds the strike until authoritative effects and reset resumes idle',()=>{
 const model=rig(),mixer=new THREE.AnimationMixer(model.root),idle=mixer.clipAction(new THREE.AnimationClip('idle',2,[new THREE.QuaternionKeyframeTrack('Head_joint.quaternion',[0,2],[0,0,0,1,0,0,0,1])])).play(),moves=catalog.creatures.find(c=>c.id==='trusk').moves,player=new CombatAnimationPlayer(model,'trusk',moves,mixer,idle),head=model.joints.find(b=>b.name==='Head_joint'),original=head.quaternion.clone();
 const spec=player.attack('basic',.54),strike=head.quaternion.clone();assert.ok(strike.angleTo(original)>.05);mixer.update(.6);assert.ok(head.quaternion.clone().normalize().angleTo(strike.clone().normalize())<1e-6);assert.equal(player.active.time,spec.duration*.54);assert.equal(idle.enabled,false);
 player.travel(.2);player.hit(.5);player.reset();assert.equal(idle.enabled,true);assert.equal(player.active,null);assert.ok(head.quaternion.angleTo(original)<1e-6);player.dispose();
});
test('simultaneous same-species actors have independent animation state',()=>{
 const moves=catalog.creatures.find(c=>c.id==='kanji').moves,make=()=>{const model=rig(),mixer=new THREE.AnimationMixer(model.root),idle=mixer.clipAction(new THREE.AnimationClip('idle',2,[])).play();return {model,player:new CombatAnimationPlayer(model,'kanji',moves,mixer,idle)};},a=make(),b=make();a.player.attack('basic',.28);assert.notDeepEqual(a.model.joints.map(j=>j.quaternion.toArray()),b.model.joints.map(j=>j.quaternion.toArray()));assert.equal(b.player.active,null);a.player.dispose();b.player.dispose();
});

test('Brugar sweeps articulate both tail chains with a planted torso and no root jump',()=>{
 for(const kind of ['brugar','brugar-species']){
  const model=rig(),moves=catalog.creatures.find(c=>c.id===kind).moves,set=buildCombatAnimations(model,kind,moves),spec=set.actions.get('basic');
  assert.equal(spec.style,'twin-tail-sweep');assert.equal(spec.hop,undefined);assert.ok(Math.abs(spec.turn)>1);
  for(const chain of ['upper','lower'])for(const index of [0,1,2]){
   const track=spec.clip.tracks.find(t=>t.name==='Tail_'+chain+'_'+index+'.quaternion');
   assert.ok(track);assert.ok([...track.values].some((v,i)=>i%4!==3&&Math.abs(v)>.005));
  }
 }
});
