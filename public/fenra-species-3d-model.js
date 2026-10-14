import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';

// Fenra is book/brawl content; this module does not register an adoptable pet.
// Meshy supplied a static mesh. Keep its UVs and add an anatomical skin in +Z-facing space.
let sourcePromise;
const smooth=THREE.MathUtils.smoothstep,vec=p=>new THREE.Vector3(...p);
export async function createFenraSpecies(){
 sourcePromise??=new GLTFLoader().loadAsync(new URL('./assets/creatures/fenra-species-source.glb',import.meta.url).href);
 const asset=await sourcePromise;asset.scene.updateMatrixWorld(true);
 const root=new THREE.Group();root.name='Fenra_species';
 const box=new THREE.Box3().setFromObject(asset.scene),scale=2.6/(box.max.y-box.min.y),center=box.getCenter(new THREE.Vector3());
 const normalize=new THREE.Matrix4().makeTranslation(-center.x*scale,-box.min.y*scale,-center.z*scale).multiply(new THREE.Matrix4().makeScale(scale,scale,scale));
 const joints=[],rest=new Map(),jointMap={};
 function bone(name,point,parent){const b=new THREE.Bone();b.name=name;const world=vec(point);b.position.copy(world);if(parent){b.position.sub(rest.get(parent));parent.add(b);}else root.add(b);rest.set(b,world);joints.push(b);jointMap[name]=b;return b;}
 const pelvis=bone('Pelvis',[.02,1.13,-.46]);
 const torso=bone('Torso',[.01,1.34,.15],pelvis);
 const chest=bone('Chest_breath',[.01,1.25,.30],torso);
 const neckLower=bone('Neck_lower',[0,1.42,.45],torso);
 const neck=bone('Neck_joint',[.04,1.87,.65],neckLower);
 const head=bone('Head_joint',[.06,2.21,.75],neck);
 const crest=bone('Crest_joint',[.06,2.36,.57],head);
 const jaw=bone('Jaw_joint',[.06,2.20,.72],head);
 const legs=[];
 for(const [label,points] of [
  ['front_left',[[-.10,1.26,.51],[-.15,.68,.67],[-.10,.14,.86],[-.10,.07,.96]]],
  ['front_right',[[.21,1.25,.35],[.19,.70,.45],[.18,.15,.50],[.19,.07,.58]]],
  ['rear_left',[[-.15,1.17,-.44],[-.26,.64,-.56],[-.23,.14,-.57],[-.22,.07,-.48]]],
  ['rear_right',[[.22,1.18,-.46],[.24,.68,-.36],[.33,.14,-.33],[.32,.07,-.23]]]
 ]){const chain=[];points.forEach((p,i)=>chain.push(bone(`${['Leg','Leg','Foot','Toes'][i]}_${label}${i<2?'_'+['hip','knee'][i]:''}`,p,i?chain[i-1]:pelvis)));legs.push({bones:chain,points:points.map(vec)});}
 const wings=[-1,1].map(sign=>{const label=sign<0?'left':'right',points=[[sign*.20,1.38,.20],[sign*.50,1.55,.35],[sign*.80,1.78,.51],[sign*1.20,.93,.64],[sign*1.31,.60,.80]],chain=[];points.forEach((p,i)=>chain.push(bone(`Wing_${label}_${['root','elbow','wrist','feathers','tip'][i]}`,p,i?chain[i-1]:torso)));return {sign,bones:chain,points:points.map(vec)};});
 const tailRoot=bone('Tail_root',[.04,1.15,-.48],pelvis),tails=[];
 for(const [label,points] of [
  ['outer',[[-.15,1.14,-.67],[-.60,.73,-.90],[-1.04,.09,-.91]]],
  ['middle',[[-.13,1.16,-.63],[-.51,.67,-.85],[-.89,.05,-.79]]],
  ['inner',[[-.09,1.12,-.57],[-.36,.65,-.74],[-.67,.20,-.68]]]
 ]){const chain=[];points.forEach((p,i)=>chain.push(bone(`Tail_${label}_${i===points.length-1?'tip':i}`,p,i?chain[i-1]:tailRoot)));tails.push({bones:chain,points:points.map(vec)});}
 function chainWeights(chain,p,amount,add){let best=Infinity,t=0;for(let i=0;i<chain.points.length-1;i++){const a=chain.points[i],delta=chain.points[i+1].clone().sub(a),u=THREE.MathUtils.clamp(p.clone().sub(a).dot(delta)/delta.lengthSq(),0,1),distance=p.distanceToSquared(a.clone().addScaledVector(delta,u));if(distance<best){best=distance;t=i+u;}}const i=Math.min(chain.bones.length-2,Math.floor(t));add(chain.bones[i],amount*(1-(t-i)));add(chain.bones[i+1],amount*(t-i));}
 const meshes=[];root.updateMatrixWorld(true);
 asset.scene.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone();geo.applyMatrix4(normalize.clone().multiply(o.matrixWorld));const positions=geo.attributes.position,indices=[],weights=[],p=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
   p.fromBufferAttribute(positions,i);const influences=new Map(),add=(b,w)=>{if(w>0)influences.set(joints.indexOf(b),(influences.get(joints.indexOf(b))||0)+w);};
   const wingWeight=smooth(Math.abs(p.x),.25,.47)*smooth(p.y,.28,.48)*smooth(p.z,-.35,-.08);
   chainWeights(wings[p.x<0?0:1],p,wingWeight,add);let available=1-wingWeight;
   let nearest=tails[0],tailDistance=Infinity;for(const chain of tails)for(let k=0;k<chain.points.length-1;k++){const a=chain.points[k],delta=chain.points[k+1].clone().sub(a),u=THREE.MathUtils.clamp(p.clone().sub(a).dot(delta)/delta.lengthSq(),0,1),distance=p.distanceTo(a.clone().addScaledVector(delta,u));if(distance<tailDistance){tailDistance=distance;nearest=chain;}}
   const outer=smooth(Math.abs(p.x),.40,.55),clearOfHooves=outer+(1-outer)*smooth(p.y,.22,.45);
   const tailWeight=available*(1-smooth(p.z,-.58,-.28))*(1-smooth(p.x,-.12,.09))*(1-smooth(tailDistance,.18,.34))*clearOfHooves*smooth(p.y,.20,.34);
   chainWeights(nearest,p,tailWeight,add);available-=tailWeight;
   const headWeight=available*smooth(p.y,2.02,2.20);
   const crestWeight=headWeight*smooth(p.y,2.29,2.44)*(1-smooth(p.z,.69,.86));add(crest,crestWeight);
   const jawWeight=(headWeight-crestWeight)*(1-smooth(p.y,2.20,2.30))*smooth(p.z,.78,.88);add(jaw,jawWeight);add(head,headWeight-crestWeight-jawWeight);available-=headWeight;
   const upperNeck=available*smooth(p.y,1.68,1.99)*(1-smooth(Math.abs(p.x),.18,.36));add(neck,upperNeck);available-=upperNeck;
   const lowerNeck=available*smooth(p.y,1.34,1.61)*smooth(p.z,.37,.58);add(neckLower,lowerNeck);available-=lowerNeck;
   const leg=legs.reduce((best,l)=>{const a=l.points[2],b=best.points[2];return (p.x-a.x)**2+(p.z-a.z)**2<(p.x-b.x)**2+(p.z-b.z)**2?l:best;},legs[0]);
   const legWeight=available*(1-smooth(p.y,.85,1.18));chainWeights(leg,p,legWeight,add);available-=legWeight;
   const soft=available*(1-smooth(p.y,1.25,1.45))*smooth(p.z,-.03,.22);add(chest,soft);add(torso,available-soft);
   const best=[...influences].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=best.reduce((n,[,w])=>n+w,0)||1;
   for(let j=0;j<4;j++){indices.push(best[j]?.[0]||0);weights.push((best[j]?.[1]||0)/sum);}
  }
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const materials=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const c=m.clone();c.side=THREE.DoubleSide;for(const key of ['map','normalMap','roughnessMap','metalnessMap'])if(c[key])c[key].anisotropy=4;return c;});
  const skin=new THREE.SkinnedMesh(geo,Array.isArray(o.material)?materials:materials[0]);skin.name='Fenra_species_skin';skin.castShadow=skin.receiveShadow=true;root.add(skin);skin.bind(new THREE.Skeleton(joints));meshes.push(skin);
 });
 const bindPose=new Map(joints.map(b=>[b,{position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()}]));
 const idleDuration=8;
 function resetPose(){for(const b of joints){const r=bindPose.get(b);b.position.copy(r.position);b.quaternion.copy(r.quaternion);b.scale.copy(r.scale);}}
 // Rotations are additive radians in joint-local XYZ space. A future battle can fade
 // idleWeight down and poseWeight up, or use the exported rig with AnimationMixer.
 function applyPose(pose={},weight=1){weight=THREE.MathUtils.clamp(weight,0,1);for(const [name,value] of Object.entries(pose)){const b=jointMap[name];if(!b)continue;if(value.rotation){const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...value.rotation));b.quaternion.multiply(new THREE.Quaternion().slerp(q,weight));}if(value.position)b.position.addScaledVector(vec(value.position),weight);}root.updateMatrixWorld(true);}
 function update(time,{idleWeight=1,pose,poseWeight=1}={}){
  resetPose();const phase=time/idleDuration*Math.PI*2,w=THREE.MathUtils.clamp(idleWeight,0,1),breath=Math.sin(phase*2)*w;
  // Gentle breathing stays above the legs; hooves retain the supplied standing pose.
  chest.scale.set(1+breath*.004,1+breath*.006,1+breath*.003);
  neckLower.rotation.set(Math.sin(phase)*.004*w,Math.sin(phase)*.006*w,0);
  neck.rotation.set(Math.sin(phase)*.006*w,Math.sin(phase)*.012*w,0);
  head.rotation.set(Math.sin(phase*2)*.009*w,Math.sin(phase)*.028*w,0);
  crest.rotation.x=Math.sin(phase+.3)*.004*w;
  wings.forEach(({sign,bones},i)=>bones.forEach((b,n)=>{b.rotation.z=sign*Math.sin(phase*2-n*.20+i*.1)*(.009-n*.001)*w;b.rotation.y=sign*Math.sin(phase*2-n*.25)*.004*w;}));
  tails.forEach((chain,n)=>chain.bones.forEach((b,i)=>{b.rotation.y=Math.sin(phase-i*.22+n*.7)*.003*w;b.rotation.z=Math.sin(phase-i*.20+n*.7)*.002*w;}));
  if(pose)applyPose(pose,poseWeight);root.updateMatrixWorld(true);
 }
 function clips(){const times=[],rotations=new Map(joints.map(b=>[b,[]])),scales=[];for(let i=0;i<=96;i++){const t=i/96*idleDuration;times.push(t);update(t);joints.forEach(b=>rotations.get(b).push(...b.quaternion.toArray()));scales.push(...chest.scale.toArray());}const clip=new THREE.AnimationClip('idle',idleDuration,[...joints.map(b=>new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',times,rotations.get(b))),new THREE.VectorKeyframeTrack('Chest_breath.scale',times,scales)]);resetPose();root.updateMatrixWorld(true);return [clip];}
 update(0);
 return {root,update,joints,jointMap,mesh:meshes[0],legs,tails,wings,crest,clips,idleDuration,resetPose,applyPose,source:'Supplied Meshy silver winged creature FBX',dispose(){const materials=new Set();meshes.forEach(m=>{m.geometry.dispose();m.skeleton.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>materials.add(mat));});materials.forEach(m=>m.dispose());}};
}
