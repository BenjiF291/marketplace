import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';

// Velkris is a species in the book, Stable and Brawl; this module does not register an adoptable pet.
// Meshy supplied a static mesh. Keep its UVs and add an anatomical skin in +Z-facing space.
let sourcePromise;
const smooth=THREE.MathUtils.smoothstep,vec=p=>new THREE.Vector3(...p);
export async function createVelkris(){
 sourcePromise??=new GLTFLoader().loadAsync(new URL('./assets/creatures/velkris-source.glb',import.meta.url).href);
 const asset=await sourcePromise;asset.scene.updateMatrixWorld(true);
 const root=new THREE.Group();root.name='Velkris_species';
 const box=new THREE.Box3().setFromObject(asset.scene),scale=1.8/(box.max.y-box.min.y),center=box.getCenter(new THREE.Vector3());
 const centered=new THREE.Matrix4().makeTranslation(-center.x*scale,-box.min.y*scale,-center.z*scale).multiply(new THREE.Matrix4().makeScale(scale,scale,scale));
 // Facing and anatomical anchors are calibrated against the supplied mesh.
 const normalize=new THREE.Matrix4().makeRotationY(0).multiply(centered);
 const joints=[],rest=new Map(),jointMap={};
 function bone(name,point,parent){const b=new THREE.Bone();b.name=name;const world=vec(point);b.position.copy(world);if(parent){b.position.sub(rest.get(parent));parent.add(b);}else root.add(b);rest.set(b,world);joints.push(b);jointMap[name]=b;return b;}
 const pelvis=bone('Pelvis',[0,.46,-.30]);
 const torso=bone('Torso',[0,.49,.22],pelvis),chest=bone('Chest_breath',[0,.44,.40],torso);
 const neck=bone('Neck_joint',[0,.42,.74],torso),head=bone('Head_joint',[0,.38,1.04],neck),jaw=bone('Jaw_joint',[0,.28,1.24],head);
 const fangs=[-1,1].map(sign=>({bone:bone('Fang_'+(sign<0?'left':'right'),[sign*.27,.43,1.13],head),sign}));
 const legs=[];
 for(const sign of [-1,1])for(const [row,z,kx,kz,fx,fz] of [['front',.98,.78,1.36,1.15,2.03],['mid_front',.78,1.03,.98,1.58,1.36],['mid_rear',.55,1.10,.48,1.66,.65],['rear',.32,1.04,-.10,1.55,-.02]]){
  const label=row+'_'+(sign<0?'left':'right'),points=[[sign*.40,.43,z],[sign*kx,.76,kz],[sign*(fx-.10),.16,fz-.07],[sign*fx,.015,fz]],bones=[];
  points.forEach((p,i)=>bones.push(bone(`${['Leg','Leg','Ankle','Foot'][i]}_${label}${i<2?'_'+['hip','knee'][i]:''}`,p,i?bones[i-1]:pelvis)));legs.push({sign,row,bones,points:points.map(vec)});
 }
 const tailPoints=[[0,.52,-.65],[0,.68,-1.05],[0,.95,-1.35],[0,1.30,-1.45],[0,1.65,-1.30],[0,1.78,-1.00],[0,1.60,-.78],[0,1.42,-.80]],tail=[];tailPoints.forEach((p,i)=>tail.push(bone(i===7?'Stinger_joint':'Tail_'+i,p,i?tail[i-1]:pelvis)));const tails=[{bones:tail,points:tailPoints.map(vec)}];
 function chainWeights(chain,p,amount,add){let best=Infinity,t=0;for(let i=0;i<chain.points.length-1;i++){const a=chain.points[i],delta=chain.points[i+1].clone().sub(a),u=THREE.MathUtils.clamp(p.clone().sub(a).dot(delta)/delta.lengthSq(),0,1),distance=p.distanceToSquared(a.clone().addScaledVector(delta,u));if(distance<best){best=distance;t=i+u;}}const i=Math.min(chain.bones.length-2,Math.floor(t));add(chain.bones[i],amount*(1-(t-i)));add(chain.bones[i+1],amount*(t-i));}
 const meshes=[];root.updateMatrixWorld(true);
 asset.scene.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone();geo.applyMatrix4(normalize.clone().multiply(o.matrixWorld));const positions=geo.attributes.position,indices=[],weights=[],p=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
   p.fromBufferAttribute(positions,i);const influences=new Map(),add=(b,w)=>{if(w>0)influences.set(joints.indexOf(b),(influences.get(joints.indexOf(b))||0)+w);};
   const segmentDistance=(a,b)=>{const delta=b.clone().sub(a),u=THREE.MathUtils.clamp(p.clone().sub(a).dot(delta)/delta.lengthSq(),0,1);return p.distanceTo(a.clone().addScaledVector(delta,u));};
   let nearest=legs[0],distance=Infinity;for(const leg of legs){const d=Math.min(...leg.points.slice(0,-1).map((a,i)=>segmentDistance(a,leg.points[i+1])));if(d<distance){distance=d;nearest=leg;}}
   const planted=1-smooth(p.y,.22,.32);chainWeights(nearest,p,planted,add);let available=1-planted;
   const tailWeight=available*Math.max((1-smooth(p.z,-.92,-.62))*smooth(p.y,.42,.65),(1-smooth(p.z,-.40,-.15))*smooth(p.y,1.0,1.18));chainWeights(tails[0],p,tailWeight,add);available-=tailWeight;
   const headWeight=available*smooth(p.z,.70,1.02);const fangWeight=headWeight*smooth(Math.abs(p.x),.20,.32)*smooth(p.z,1.05,1.22)*smooth(p.y,.30,.40);add(fangs[p.x<0?0:1].bone,fangWeight);const jawWeight=(headWeight-fangWeight)*(1-smooth(p.y,.30,.42))*smooth(p.z,1.12,1.30);add(jaw,jawWeight);add(head,headWeight-fangWeight-jawWeight);available-=headWeight;
   const legWeight=available*smooth(Math.abs(p.x),.30,.53)*(1-smooth(distance,.18,.38));chainWeights(nearest,p,legWeight,add);available-=legWeight;
   const neckWeight=available*smooth(p.z,.50,.80);add(neck,neckWeight);available-=neckWeight;
   const soft=available*(1-smooth(p.y,.45,.65))*(1-smooth(Math.abs(p.x),.20,.40));add(chest,soft);add(torso,available-soft);
   const best=[...influences].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=best.reduce((n,[,w])=>n+w,0)||1;
   for(let j=0;j<4;j++){indices.push(best[j]?.[0]||0);weights.push((best[j]?.[1]||0)/sum);}
  }
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const materials=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const c=m.clone();c.side=THREE.DoubleSide;for(const key of ['map','normalMap','roughnessMap','metalnessMap'])if(c[key])c[key].anisotropy=4;return c;});
  const skin=new THREE.SkinnedMesh(geo,Array.isArray(o.material)?materials:materials[0]);skin.name='Velkris_species_skin';skin.castShadow=skin.receiveShadow=true;root.add(skin);skin.bind(new THREE.Skeleton(joints));meshes.push(skin);
 });
 const bindPose=new Map(joints.map(b=>[b,{position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()}]));
 const idleDuration=8;
 function resetPose(){for(const b of joints){const r=bindPose.get(b);b.position.copy(r.position);b.quaternion.copy(r.quaternion);b.scale.copy(r.scale);}}
 // Rotations are additive radians in joint-local XYZ space. A future battle can fade
 // idleWeight down and poseWeight up, or use the exported rig with AnimationMixer.
 function applyPose(pose={},weight=1){weight=THREE.MathUtils.clamp(weight,0,1);for(const [name,value] of Object.entries(pose)){const b=jointMap[name];if(!b)continue;if(value.rotation){const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...value.rotation));b.quaternion.multiply(new THREE.Quaternion().slerp(q,weight));}if(value.position)b.position.addScaledVector(vec(value.position),weight);}root.updateMatrixWorld(true);}
 function update(time,{idleWeight=1,pose,poseWeight=1}={}){
  resetPose();const phase=time/idleDuration*Math.PI*2,w=THREE.MathUtils.clamp(idleWeight,0,1),breath=Math.sin(phase*2)*w;
  // Gentle breathing above the planted legs; armour scales and fur never accumulate drift.
  chest.scale.set(1+breath*.004,1+breath*.006,1+breath*.003);
  neck.rotation.set(Math.sin(phase)*.005*w,Math.sin(phase)*.009*w,0);
  head.rotation.set(Math.sin(phase*2)*.009*w,Math.sin(phase)*.028*w,0);
  fangs.forEach(({bone,sign})=>bone.rotation.y=sign*Math.sin(phase)*.012*w);
  tails.forEach(chain=>chain.bones.forEach((b,i)=>{b.rotation.y=Math.sin(phase-i*.23)*.003*w;b.rotation.z=Math.sin(phase-i*.19)*.002*w;}));
  if(pose)applyPose(pose,poseWeight);root.updateMatrixWorld(true);
 }
 function clips(){const times=[],rotations=new Map(joints.map(b=>[b,[]])),scales=[];for(let i=0;i<=96;i++){const t=i/96*idleDuration;times.push(t);update(t);joints.forEach(b=>rotations.get(b).push(...b.quaternion.toArray()));scales.push(...chest.scale.toArray());}const clip=new THREE.AnimationClip('idle',idleDuration,[...joints.map(b=>new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',times,rotations.get(b))),new THREE.VectorKeyframeTrack('Chest_breath.scale',times,scales)]);resetPose();root.updateMatrixWorld(true);return [clip];}
 update(0);
 return {root,update,joints,jointMap,mesh:meshes[0],legs,tails,fangs,clips,idleDuration,resetPose,applyPose,source:'Supplied Meshy green spider scorpion FBX',dispose(){const materials=new Set();meshes.forEach(m=>{m.geometry.dispose();m.skeleton.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>materials.add(mat));});materials.forEach(m=>m.dispose());}};
}
