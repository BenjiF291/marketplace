const test=require('node:test'),assert=require('node:assert/strict'),catalog=require('./public/creature-brawl-catalog');
let THREE,build;
test.before(async()=>{THREE=await import('./public/vendor/three/three.module.js');({buildRillAnimations:build}=await import('./public/rill-combat-motion.js'));});
function rig(){const root=new THREE.Group(),names=['Pelvis','Torso','Neck_joint','Head_joint','Crest_joint','Beak_joint'];for(const side of ['left','right']){for(const part of ['root','elbow','wrist','tip'])names.push('Wing_'+side+'_'+part);names.push('Leg_'+side+'_hip','Leg_'+side+'_knee','Foot_'+side,'Toes_'+side);}for(let i=0;i<7;i++)names.push('Tail_'+i);const joints=names.map(name=>{const b=new THREE.Bone();b.name=name;root.add(b);return b;});return {root,joints};}
test('Rill articulates every available joint through the full movement set',()=>{
 const model=rig(),set=build(model,'rill-species',catalog.creatures.find(c=>c.id==='rill-species').moves),clips=[set.idle,set.travel,set.takeoff,set.landing,set.hit,...[...set.actions.values()].map(a=>a.clip)];
 for(const clip of clips){assert.equal(clip.validate(),true);for(const track of clip.tracks)assert.ok([...track.values].every(Number.isFinite));}
 for(const bone of model.joints){const tracks=clips.flatMap(c=>c.tracks.filter(t=>t.name===bone.name+'.quaternion'));assert.ok(tracks.some(t=>[...t.values].some((v,i)=>Math.abs(v-t.values[i%4])>.005)),bone.name+' needs authored movement');}
 const root=set.travel.tracks.find(t=>t.name==='Wing_left_root.quaternion'),tip=set.travel.tracks.find(t=>t.name==='Wing_left_tip.quaternion');assert.notDeepEqual([...root.values],[...tip.values]);
 for(const side of ['left','right'])assert.ok(clips.some(c=>{const t=c.tracks.find(t=>t.name==='Toes_'+side+'.quaternion');return Math.max(...t.values)-Math.min(...t.values)>.2;}));
});
test('takeoff joins flight and landing returns to the exact grounded idle pose',()=>{
 const set=build(rig(),'rill',catalog.creatures.find(c=>c.id==='rill').moves);
 function seam(a,end,b,start){for(const track of a.tracks){const other=b.tracks.find(t=>t.name===track.name),size=track.getValueSize();for(let i=0;i<size;i++){const x=track.values[(end?track.values.length-size:0)+i],y=other.values[(start?0:other.values.length-size)+i];assert.ok(Math.abs(x-y)<1e-5,track.name+' transition');}}}
 seam(set.takeoff,true,set.travel,true);seam(set.travel,true,set.travel,true);seam(set.travel,false,set.landing,true);seam(set.landing,true,set.idle,true);
});
