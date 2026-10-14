import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';

// Krynn is book/brawl content; this module does not register an adoptable pet.
// Meshy supplied a static mesh. Keep its UVs and add an anatomical skin in +Z-facing space.
let sourcePromise;
const smooth=THREE.MathUtils.smoothstep,vec=p=>new THREE.Vector3(...p);
export async function createKrynnSpecies(){
 sourcePromise??=new GLTFLoader().loadAsync(new URL('./assets/creatures/krynn-species-source.glb',import.meta.url).href);
 const asset=await sourcePromise;asset.scene.updateMatrixWorld(true);
 const root=new THREE.Group();root.name='Krynn_species';
 const box=new THREE.Box3().setFromObject(asset.scene),scale=2.0/(box.max.y-box.min.y),center=box.getCenter(new THREE.Vector3());
 const normalize=new THREE.Matrix4().makeTranslation(-center.x*scale,-box.min.y*scale,-center.z*scale).multiply(new THREE.Matrix4().makeScale(scale,scale,scale));
 const joints=[],rest=new Map(),jointMap={};
 function bone(name,point,parent){const b=new THREE.Bone();b.name=name;const world=vec(point);b.position.copy(world);if(parent){b.position.sub(rest.get(parent));parent.add(b);}else root.add(b);rest.set(b,world);joints.push(b);jointMap[name]=b;return b;}
 const pelvis=bone('Pelvis',[.35,1.10,-.65]);
 const torso=bone('Torso',[.70,1.15,.15],pelvis);
 const chest=bone('Chest_breath',[.80,1.05,.10],torso);
 const neck=bone('Neck_joint',[1.10,1.45,.53],torso);
 const head=bone('Head_joint',[1.33,1.48,1.10],neck);
 const jaw=bone('Jaw_joint',[1.40,1.20,1.30],head);
 const ears=[{bone:bone('Ear_left',[1.13,1.67,1.22],head),a:vec([1.13,1.67,1.22]),b:vec([1.20,1.99,1.40])},{bone:bone('Ear_right',[1.48,1.67,.72],head),a:vec([1.48,1.67,.72]),b:vec([1.58,1.95,.65])}];
 const legs=[];
 for(const [label,points] of [
  ['front_left',[[.95,1.24,.85],[.82,.65,1.00],[.89,.10,1.29],[.97,.035,1.44]]],
  ['front_right',[[1.55,1.15,.39],[1.68,.61,.64],[1.85,.10,.70],[1.97,.035,.86]]],
  ['rear_left',[[-.02,1.05,-.74],[-.15,.53,-.79],[-.29,.10,-.76],[-.22,.035,-.61]]],
  ['rear_right',[[.65,1.05,-.55],[.68,.57,-.97],[.85,.10,-.85],[.94,.035,-.70]]]
 ]){const chain=[];points.forEach((p,i)=>chain.push(bone(`${['Leg','Leg','Foot','Toes'][i]}_${label}${i<2?'_'+['hip','knee'][i]:''}`,p,i?chain[i-1]:pelvis)));legs.push({bones:chain,points:points.map(vec)});}
 const tails=[];
 for(const [label,points] of [
  ['upper',[[.12,1.30,-.78],[-.32,1.12,-1.02],[-.72,1.01,-1.14],[-1.12,1.10,-1.28],[-1.52,1.34,-1.44],[-1.70,1.70,-1.48],[-1.43,1.94,-1.39]]],
  ['lower',[[.12,.92,-.65],[-.40,.80,-.95],[-.85,.64,-1.10],[-1.30,.51,-1.26],[-1.75,.64,-1.40],[-1.97,1.03,-1.44]]]
 ]){const chain=[];points.forEach((p,i)=>chain.push(bone(`Tail_${label}_${i===points.length-1?'tip':i}`,p,i?chain[i-1]:pelvis)));tails.push({bones:chain,points:points.map(vec)});}
 function chainWeights(chain,p,amount,add){let best=Infinity,t=0;for(let i=0;i<chain.points.length-1;i++){const a=chain.points[i],delta=chain.points[i+1].clone().sub(a),u=THREE.MathUtils.clamp(p.clone().sub(a).dot(delta)/delta.lengthSq(),0,1),distance=p.distanceToSquared(a.clone().addScaledVector(delta,u));if(distance<best){best=distance;t=i+u;}}const i=Math.min(chain.bones.length-2,Math.floor(t));add(chain.bones[i],amount*(1-(t-i)));add(chain.bones[i+1],amount*(t-i));}
 const meshes=[];root.updateMatrixWorld(true);
 asset.scene.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone();geo.applyMatrix4(normalize.clone().multiply(o.matrixWorld));const positions=geo.attributes.position,indices=[],weights=[],p=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
   p.fromBufferAttribute(positions,i);const influences=new Map(),add=(b,w)=>{if(w>0)influences.set(joints.indexOf(b),(influences.get(joints.indexOf(b))||0)+w);};
   const segmentDistance=(a,b)=>{const delta=b.clone().sub(a),u=THREE.MathUtils.clamp(p.clone().sub(a).dot(delta)/delta.lengthSq(),0,1);return p.distanceTo(a.clone().addScaledVector(delta,u));};
   let nearest=tails[0],tailDistance=Infinity;for(const chain of tails)for(let k=0;k<chain.points.length-1;k++){const distance=segmentDistance(chain.points[k],chain.points[k+1]);if(distance<tailDistance){tailDistance=distance;nearest=chain;}}
   const tailWeight=(1-smooth(p.x,-.15,.45))*smooth(p.y,.22,.45)*(1-smooth(tailDistance,.18,.38));
   chainWeights(nearest,p,tailWeight,add);let available=1-tailWeight;
   const along=(p.x-.90)*.52+(p.z-.20)*.85;
   const headWeight=available*smooth(along,.30,.62)*smooth(p.y,1.02,1.30);
   let skull=headWeight;
   for(const ear of ears){const weight=skull*smooth(p.y,1.68,1.82)*(1-smooth(segmentDistance(ear.a,ear.b),.065,.16));add(ear.bone,weight);skull-=weight;}
   const jawWeight=skull*(1-smooth(p.y,1.23,1.36))*smooth(along,.82,1.08);add(jaw,jawWeight);add(head,skull-jawWeight);available-=headWeight;
   const leg=legs.reduce((best,l)=>{const a=l.points[2],b=best.points[2];return (p.x-a.x)**2+(p.z-a.z)**2<(p.x-b.x)**2+(p.z-b.z)**2?l:best;},legs[0]);
   const legWeight=available*(1-smooth(p.y,.60,1.04));chainWeights(leg,p,legWeight,add);available-=legWeight;
   const neckWeight=available*smooth(along,.12,.40)*smooth(p.y,1.18,1.40);add(neck,neckWeight);available-=neckWeight;
   const soft=available*(1-smooth(p.y,1.03,1.26))*(1-smooth(Math.abs(p.x-.80),.28,.50));add(chest,soft);add(torso,available-soft);
   const best=[...influences].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=best.reduce((n,[,w])=>n+w,0)||1;
   for(let j=0;j<4;j++){indices.push(best[j]?.[0]||0);weights.push((best[j]?.[1]||0)/sum);}
  }
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const materials=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const c=m.clone();c.side=THREE.DoubleSide;for(const key of ['map','normalMap','roughnessMap','metalnessMap'])if(c[key])c[key].anisotropy=4;return c;});
  const skin=new THREE.SkinnedMesh(geo,Array.isArray(o.material)?materials:materials[0]);skin.name='Krynn_species_skin';skin.castShadow=skin.receiveShadow=true;root.add(skin);skin.bind(new THREE.Skeleton(joints));meshes.push(skin);
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
  tails.forEach((chain,n)=>chain.bones.forEach((b,i)=>{b.rotation.y=Math.sin(phase-i*.22+n*.7)*.006*w;b.rotation.z=Math.sin(phase-i*.20+n*.7)*.004*w;}));
  if(pose)applyPose(pose,poseWeight);root.updateMatrixWorld(true);
 }
 function clips(){const times=[],rotations=new Map(joints.map(b=>[b,[]])),scales=[];for(let i=0;i<=96;i++){const t=i/96*idleDuration;times.push(t);update(t);joints.forEach(b=>rotations.get(b).push(...b.quaternion.toArray()));scales.push(...chest.scale.toArray());}const clip=new THREE.AnimationClip('idle',idleDuration,[...joints.map(b=>new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',times,rotations.get(b))),new THREE.VectorKeyframeTrack('Chest_breath.scale',times,scales)]);resetPose();root.updateMatrixWorld(true);return [clip];}
 update(0);
 return {root,update,joints,jointMap,mesh:meshes[0],legs,tails,ears,clips,idleDuration,resetPose,applyPose,source:'Supplied Meshy black shadow beast FBX',dispose(){const materials=new Set();meshes.forEach(m=>{m.geometry.dispose();m.skeleton.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>materials.add(mat));});materials.forEach(m=>m.dispose());}};
}
