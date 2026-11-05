import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';

// Kanji is a species in the book, Stable and Brawl; this module does not register an adoptable pet.
// Meshy supplied a static mesh. Keep its UVs and add an anatomical skin in +Z-facing space.
let sourcePromise;
const smooth=THREE.MathUtils.smoothstep,vec=p=>new THREE.Vector3(...p);
export async function createKanji(){
 sourcePromise??=new GLTFLoader().loadAsync(new URL('./assets/creatures/kanji-source.glb',import.meta.url).href);
 const asset=await sourcePromise;asset.scene.updateMatrixWorld(true);
 const root=new THREE.Group();root.name='Kanji_species';
 const box=new THREE.Box3().setFromObject(asset.scene),scale=2.2/(box.max.y-box.min.y),center=box.getCenter(new THREE.Vector3());
 const centered=new THREE.Matrix4().makeTranslation(-center.x*scale,-box.min.y*scale,-center.z*scale).multiply(new THREE.Matrix4().makeScale(scale,scale,scale));
 // The supplied mesh faces diagonally +X/+Z; rotate geometry and skin together to +Z.
 const normalize=new THREE.Matrix4().makeRotationY(-.60).multiply(centered);
 const joints=[],rest=new Map(),jointMap={};
 function bone(name,point,parent){const b=new THREE.Bone();b.name=name;const world=vec(point);b.position.copy(world);if(parent){b.position.sub(rest.get(parent));parent.add(b);}else root.add(b);rest.set(b,world);joints.push(b);jointMap[name]=b;return b;}
 const pelvis=bone('Pelvis',[0,.75,-.50]);
 const torso=bone('Torso',[0,.90,.05],pelvis),chest=bone('Chest_breath',[0,.80,.40],torso);
 const neck=bone('Neck_joint',[0,1.10,.70],torso),head=bone('Head_joint',[0,1.30,1.10],neck),jaw=bone('Jaw_joint',[0,1.12,1.28],head);
 const ears=[-1,1].map(sign=>({bone:bone('Ear_'+(sign<0?'left':'right'),[sign*.22,1.48,.98],head),a:vec([sign*.22,1.48,.98]),b:vec([sign*.28,1.72,.90])}));
 const legs=[];
 for(const [label,x,z] of [['front_left',-.32,.88],['front_right',.32,.88],['rear_left',-.36,-.65],['rear_right',.36,-.65]]){const points=[[x,.78,z],[x,.40,z+.06],[x,.07,z+.13],[x,.035,z+.27]],bones=[];points.forEach((p,i)=>bones.push(bone(`${['Leg','Leg','Foot','Toes'][i]}_${label}${i<2?'_'+['hip','knee'][i]:''}`,p,i?bones[i-1]:pelvis)));legs.push({bones,points:points.map(vec)});}
 const wings=[];
 for(const sign of [-1,1]){const side=sign<0?'left':'right',points=[[sign*.28,1.02,.12],[sign*.63,1.50,-.08],[sign*.98,1.96,-.25],[sign*1.30,1.85,-.58],[sign*1.58,1.48,-.95]],bones=[];points.forEach((p,i)=>bones.push(bone(`Wing_${side}_${['root','elbow','wrist','feathers','tip'][i]}`,p,i?bones[i-1]:torso)));wings.push({sign,bones,points:points.map(vec)});}
 const tailPoints=[[0,.80,-.70],[-.08,.73,-1.00],[-.18,.66,-1.26],[-.28,.64,-1.50],[-.36,.73,-1.73],[-.35,.92,-1.95]],tail=[];tailPoints.forEach((p,i)=>tail.push(bone('Tail_'+i,p,i?tail[i-1]:pelvis)));const tails=[{bones:tail,points:tailPoints.map(vec)}];
 function chainWeights(chain,p,amount,add){let best=Infinity,t=0;for(let i=0;i<chain.points.length-1;i++){const a=chain.points[i],delta=chain.points[i+1].clone().sub(a),u=THREE.MathUtils.clamp(p.clone().sub(a).dot(delta)/delta.lengthSq(),0,1),distance=p.distanceToSquared(a.clone().addScaledVector(delta,u));if(distance<best){best=distance;t=i+u;}}const i=Math.min(chain.bones.length-2,Math.floor(t));add(chain.bones[i],amount*(1-(t-i)));add(chain.bones[i+1],amount*(t-i));}
 const meshes=[];root.updateMatrixWorld(true);
 asset.scene.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone();geo.applyMatrix4(normalize.clone().multiply(o.matrixWorld));const positions=geo.attributes.position,indices=[],weights=[],p=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
   p.fromBufferAttribute(positions,i);const influences=new Map(),add=(b,w)=>{if(w>0)influences.set(joints.indexOf(b),(influences.get(joints.indexOf(b))||0)+w);};
   const segmentDistance=(a,b)=>{const delta=b.clone().sub(a),u=THREE.MathUtils.clamp(p.clone().sub(a).dot(delta)/delta.lengthSq(),0,1);return p.distanceTo(a.clone().addScaledVector(delta,u));};
   // Preserve the exact supplied paw stance; feather and tail motion never reaches planted vertices.
   const planted=1-smooth(p.y,.16,.28);const leg=legs.reduce((best,l)=>p.distanceToSquared(l.points[2])<p.distanceToSquared(best.points[2])?l:best,legs[0]);chainWeights(leg,p,planted,add);let available=1-planted;
   const headWeight=available*smooth(p.z,.58,.94)*smooth(p.y,.85,1.15);let skull=headWeight;
   for(const ear of ears){const weight=skull*smooth(p.y,1.46,1.63)*(1-smooth(segmentDistance(ear.a,ear.b),.10,.25));add(ear.bone,weight);skull-=weight;}
   const jawWeight=skull*(1-smooth(p.y,1.14,1.26))*smooth(p.z,1.12,1.32);add(jaw,jawWeight);add(head,skull-jawWeight);available-=headWeight;
   const wing=wings[p.x<0?0:1],wingWeight=available*smooth(Math.abs(p.x),.30,.62)*smooth(p.y,.90,1.16)*(1-smooth(p.z,.55,.95));chainWeights(wing,p,wingWeight,add);available-=wingWeight;
   const tailWeight=available*(1-smooth(p.z,-.85,-.45))*smooth(p.y,.30,.55);chainWeights(tails[0],p,tailWeight,add);available-=tailWeight;
   const legWeight=available*(1-smooth(p.y,.45,.78));chainWeights(leg,p,legWeight,add);available-=legWeight;
   const neckWeight=available*smooth(p.z,.35,.72)*smooth(p.y,.92,1.14);add(neck,neckWeight);available-=neckWeight;
   const soft=available*(1-smooth(p.y,.82,1.05))*(1-smooth(Math.abs(p.x),.20,.42));add(chest,soft);add(torso,available-soft);
   const best=[...influences].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=best.reduce((n,[,w])=>n+w,0)||1;
   for(let j=0;j<4;j++){indices.push(best[j]?.[0]||0);weights.push((best[j]?.[1]||0)/sum);}
  }
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const materials=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const c=m.clone();c.side=THREE.DoubleSide;for(const key of ['map','normalMap','roughnessMap','metalnessMap'])if(c[key])c[key].anisotropy=4;return c;});
  const skin=new THREE.SkinnedMesh(geo,Array.isArray(o.material)?materials:materials[0]);skin.name='Kanji_species_skin';skin.castShadow=skin.receiveShadow=true;root.add(skin);skin.bind(new THREE.Skeleton(joints));meshes.push(skin);
 });
 const bindPose=new Map(joints.map(b=>[b,{position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()}]));
 const idleDuration=8;
 function resetPose(){for(const b of joints){const r=bindPose.get(b);b.position.copy(r.position);b.quaternion.copy(r.quaternion);b.scale.copy(r.scale);}}
 // Rotations are additive radians in joint-local XYZ space. A future battle can fade
 // idleWeight down and poseWeight up, or use the exported rig with AnimationMixer.
 function applyPose(pose={},weight=1){weight=THREE.MathUtils.clamp(weight,0,1);for(const [name,value] of Object.entries(pose)){const b=jointMap[name];if(!b)continue;if(value.rotation){const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...value.rotation));b.quaternion.multiply(new THREE.Quaternion().slerp(q,weight));}if(value.position)b.position.addScaledVector(vec(value.position),weight);}root.updateMatrixWorld(true);}
 function update(time,{idleWeight=1,pose,poseWeight=1}={}){
  resetPose();const phase=time/idleDuration*Math.PI*2,w=THREE.MathUtils.clamp(idleWeight,0,1),breath=Math.sin(phase*2)*w;
  // Gentle breathing above the planted legs; mane scales and fur never accumulate drift.
  chest.scale.set(1+breath*.004,1+breath*.006,1+breath*.003);
  neck.rotation.set(Math.sin(phase)*.005*w,Math.sin(phase)*.009*w,0);
  head.rotation.set(Math.sin(phase*2)*.009*w,Math.sin(phase)*.028*w,0);
  ears.forEach(({bone},i)=>bone.rotation.z=Math.sin(phase*2+i*.7)*.012*w);
  wings.forEach(({sign,bones},side)=>bones.forEach((b,i)=>{b.rotation.z=sign*Math.sin(phase*2-i*.20+side*.15)*(.006-i*.0006)*w;b.rotation.y=sign*Math.sin(phase-i*.2)*.003*w;}));
  tails.forEach((chain,n)=>chain.bones.forEach((b,i)=>{b.rotation.y=Math.sin(phase-i*.22+n*.7)*.006*w;b.rotation.z=Math.sin(phase-i*.20+n*.7)*.004*w;}));
  if(pose)applyPose(pose,poseWeight);root.updateMatrixWorld(true);
 }
 function clips(){const times=[],rotations=new Map(joints.map(b=>[b,[]])),scales=[];for(let i=0;i<=96;i++){const t=i/96*idleDuration;times.push(t);update(t);joints.forEach(b=>rotations.get(b).push(...b.quaternion.toArray()));scales.push(...chest.scale.toArray());}const clip=new THREE.AnimationClip('idle',idleDuration,[...joints.map(b=>new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',times,rotations.get(b))),new THREE.VectorKeyframeTrack('Chest_breath.scale',times,scales)]);resetPose();root.updateMatrixWorld(true);return [clip];}
 update(0);
 return {root,update,joints,jointMap,mesh:meshes[0],legs,tails,wings,ears,clips,idleDuration,resetPose,applyPose,source:'Supplied Meshy feathered winged saber FBX',dispose(){const materials=new Set();meshes.forEach(m=>{m.geometry.dispose();m.skeleton.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>materials.add(mat));});materials.forEach(m=>m.dispose());}};
}
