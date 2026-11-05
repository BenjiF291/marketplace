const test=require('node:test'),assert=require('node:assert/strict');
test('single claw study holds support chains, uses unit-scale quaternion tracks and recovers exactly',async()=>{
 const THREE=await import('./public/vendor/three/three.module.js'),{attackStudy,buildStudyClip,validateStudy}=await import('./public/dragon-melee-study.js');
 const names=['Torso','Head_joint','Leg_0_hip','Leg_0_knee','Leg_0_paw','Leg_1_hip','Leg_2_hip','Leg_3_hip','Tail_bone_0'];
 const root=new THREE.Group(),bones=names.map(name=>{const b=new THREE.Bone();b.name=name;root.add(b);return b;}),rest=new Map(bones.map(b=>[b.name,{p:b.position.clone(),q:b.quaternion.clone()}]));
 const clip=buildStudyClip(attackStudy,bones,rest);assert.ok(clip.validate());assert.equal(clip.duration,1.25);assert.ok(!clip.tracks.some(t=>t.name.endsWith('.scale')));
 const mixer=new THREE.AnimationMixer(root),action=mixer.clipAction(clip).play();action.paused=true;
 for(const t of [0,.18,.4,.54,.65,.83,1]){action.time=t*clip.duration;mixer.update(0);for(const b of bones){assert.ok(Math.abs(b.quaternion.length()-1)<1e-6);assert.deepEqual(b.position.toArray(),rest.get(b.name).p.toArray());if(/^Leg_[123]_/.test(b.name)||t===0||t===1)assert.ok(b.quaternion.angleTo(rest.get(b.name).q)<1e-6);}}
 const invalid=structuredClone(attackStudy);invalid.frames[2].pose.Torso=[10,0,0];assert.throws(()=>validateStudy(invalid,bones),/support/);
});
test('study chest correction removes opposite-leg influence from central chest, leaving the paw unchanged',async()=>{
 const THREE=await import('./public/vendor/three/three.module.js'),{repairStudyChest}=await import('./public/dragon-melee-study.js');
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,.6,1.05,-.5,.13,1.5],3));
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([1,0,0,0,2,0,0,0],4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([.85,.15,0,0,1,0,0,0],4));
 const mesh={isSkinnedMesh:true,geometry,skeleton:{bones:[{name:'Torso'},{name:'Leg_0_hip'},{name:'Leg_0_paw'}]}};
 const report=repairStudyChest({root:{traverse:fn=>fn(mesh)}});assert.equal(report.changedVertices,1);
 const j=geometry.attributes.skinIndex,w=geometry.attributes.skinWeight;assert.equal(j.getX(0),0);assert.equal(w.getX(0),1);assert.equal(j.getX(1),2);assert.equal(w.getX(1),1);
});
