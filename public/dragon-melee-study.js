import * as THREE from './vendor/three/three.module.js';

// Degrees, not additive oscillators. Edit these poses in the workshop JSON panel.
export const attackStudy={duration:1.25,contact:.54,frames:[
 {t:0,label:'Start',pose:{}},
 {t:.18,label:'Lift',pose:{Leg_0_hip:[3,0,-3],Leg_0_knee:[-18,0,0],Leg_0_paw:[15,0,3],Head_joint:[-2,0,0]}},
 {t:.40,label:'Anticipation',pose:{Leg_0_hip:[8,-3,-5],Leg_0_knee:[-30,0,0],Leg_0_paw:[22,3,5],Head_joint:[-3,-2,0],Tail_bone_0:[0,2,0]}},
 {t:.54,label:'Contact',pose:{Leg_0_hip:[-28,4,3],Leg_0_knee:[8,0,0],Leg_0_paw:[20,-4,-3],Head_joint:[2,1,0],Tail_bone_0:[0,-2,0]}},
 {t:.65,label:'Follow-through',pose:{Leg_0_hip:[-18,6,5],Leg_0_knee:[12,0,0],Leg_0_paw:[6,-6,-5],Head_joint:[3,0,0],Tail_bone_0:[0,-3,0]}},
 {t:.83,label:'Settle',pose:{Leg_0_hip:[-8,0,0],Leg_0_knee:[-6,0,0],Leg_0_paw:[14,0,0],Head_joint:[1,0,0]}},
 {t:1,label:'Recovered',pose:{}}
]};

export function validateStudy(study,bones){
 if(!Number.isFinite(study.duration)||study.duration<.4||study.duration>4)throw Error('Duration must be 0.4 to 4 seconds.');
 if(study.contact!==.54)throw Error('Keep contact at 0.54 to match the arena contact marker.');
 if(!Array.isArray(study.frames)||study.frames.length<3||study.frames.length>40||study.frames[0].t!==0||study.frames.at(-1).t!==1)throw Error('Use 3 to 40 frames, starting at 0 and ending at 1.');
 const names=new Set(bones.map(b=>b.name));let previous=-1;
 for(const frame of study.frames){if(!Number.isFinite(frame.t)||frame.t<=previous||frame.t<0||frame.t>1)throw Error('Frame times must increase from 0 to 1.');previous=frame.t;
  for(const [name,angles] of Object.entries(frame.pose||{})){if(!names.has(name))throw Error('Unknown bone: '+name);if(name==='Torso'||/^Leg_[123]_/.test(name))throw Error('Keep torso and three support chains fixed for this study.');if(!Array.isArray(angles)||angles.length!==3||angles.some(a=>!Number.isFinite(a)||Math.abs(a)>35))throw Error('Use three finite angles within 35 degrees: '+name);}
 }
 if(Object.values(study.frames[0].pose||{}).flat().some(Boolean)||Object.values(study.frames.at(-1).pose||{}).flat().some(Boolean))throw Error('Start and end must be the neutral pose.');
}

export function buildStudyClip(study,bones,rest){
 validateStudy(study,bones);
 // Bake eased quaternion interpolation into a standard editable AnimationClip.
 // No scale or root-position channels: parent movement remains the arena's job.
 const times=Array.from({length:151},(_,i)=>i/150*study.duration),tracks=[];
 for(const bone of bones){const values=[],base=rest.get(bone.name).q;
  for(const time of times){const t=time/study.duration;let i=0;while(i<study.frames.length-2&&t>study.frames[i+1].t)i++;
   const left=study.frames[i],right=study.frames[i+1],u=THREE.MathUtils.smoothstep(t,left.t,right.t);
   const quaternion=frame=>{const angles=frame.pose?.[bone.name]||[0,0,0];return base.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles.map(THREE.MathUtils.degToRad))));};
   values.push(...quaternion(left).slerp(quaternion(right),u).toArray());
  }
  tracks.push(new THREE.QuaternionKeyframeTrack(bone.name+'.quaternion',times,values));
  tracks.push(new THREE.VectorKeyframeTrack(bone.name+'.position',[0,study.duration],[...rest.get(bone.name).p.toArray(),...rest.get(bone.name).p.toArray()]));
 }
 return new THREE.AnimationClip('Pocket Dragon / single claw study',study.duration,tracks);
}

export function installStudy(actor,study){
 actor.studyRest??=new Map(actor.model.joints.map(b=>[b.name,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}]));
 actor.mixer.stopAllAction();
 for(const b of actor.model.joints){const r=actor.studyRest.get(b.name);b.position.copy(r.p);b.quaternion.copy(r.q);b.scale.copy(r.s);}
 const clip=buildStudyClip(study,actor.model.joints,actor.studyRest),action=actor.mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;
 const seek=p=>{action.enabled=true;action.time=THREE.MathUtils.clamp(p,0,1)*clip.duration;actor.mixer.update(0);actor.model.root.updateMatrixWorld(true);};
 actor.combat={idle:action,set:{actions:new Map([[actor.unit.moves[0].id,{clip,duration:study.duration,contact:.54,delivery:'melee',style:'claw',lunge:.035}]])},attack(id,p){seek(p);},reset(){seek(0);},dispose(){actor.mixer.stopAllAction();actor.mixer.uncacheClip(clip);}};
 actor.idle=action;seek(0);return {clip,seek};
}

// The source generator chooses a leg by the sign of X, including vertices on
// the central chest. Keep that chest patch on the torso, fading into the actual
// shoulders. This affects only this study's already-cloned geometry.
export function repairStudyChest(model){
 let changed=0;const smooth=THREE.MathUtils.smoothstep;
 model.root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const geo=mesh.geometry,p=geo.attributes.position,j=geo.attributes.skinIndex,w=geo.attributes.skinWeight,torso=mesh.skeleton.bones.findIndex(b=>b.name==='Torso');
  for(let i=0;i<p.count;i++){
   const mask=(1-smooth(Math.abs(p.getX(i)),.08,.28))*smooth(p.getY(i),.30,.54)*smooth(p.getZ(i),.55,.85);if(mask<=0)continue;
   const influences=new Map();let transferred=0;
   for(let k=0;k<4;k++){const bone=j.getComponent(i,k),weight=w.getComponent(i,k),transfer=/^Leg_[01]_/.test(mesh.skeleton.bones[bone].name)?weight*mask:0;transferred+=transfer;influences.set(bone,(influences.get(bone)||0)+weight-transfer);}
   if(transferred<1e-7)continue;changed++;influences.set(torso,(influences.get(torso)||0)+transferred);
   const best=[...influences].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=best.reduce((n,[,v])=>n+v,0);
   for(let k=0;k<4;k++){j.setComponent(i,k,best[k]?.[0]||0);w.setComponent(i,k,(best[k]?.[1]||0)/sum);}
  }j.needsUpdate=w.needsUpdate=true;
 });return {changedVertices:changed,region:'Central chest between the front legs; smooth torso attachment',sourceFileModified:false};
}
