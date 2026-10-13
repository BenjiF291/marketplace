import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';

// Brakk is book/brawl content; this module does not register an adoptable pet.
// Meshy supplied a static mesh. Keep its UVs and add an anatomical skin in +Z-facing space.
let sourcePromise;
const smooth=THREE.MathUtils.smoothstep,vec=p=>new THREE.Vector3(...p);
export async function createBrugar(){
 sourcePromise??=new GLTFLoader().loadAsync(new URL('./assets/creatures/brakk-source.glb',import.meta.url).href);
 const asset=await sourcePromise;asset.scene.updateMatrixWorld(true);
 const root=new THREE.Group();root.name='Brakk_Brugar';
 const box=new THREE.Box3().setFromObject(asset.scene),scale=2.0/(box.max.y-box.min.y),center=box.getCenter(new THREE.Vector3());
 const normalize=new THREE.Matrix4().makeTranslation(-center.x*scale,-box.min.y*scale,-center.z*scale).multiply(new THREE.Matrix4().makeScale(scale,scale,scale));
 const joints=[],rest=new Map(),jointMap={};
 function bone(name,point,parent){const b=new THREE.Bone();b.name=name;const world=vec(point);b.position.copy(world);if(parent){b.position.sub(rest.get(parent));parent.add(b);}else root.add(b);rest.set(b,world);joints.push(b);jointMap[name]=b;return b;}
 const pelvis=bone('Pelvis',[.78,.83,-.72]);
 const torso=bone('Torso',[.88,1.00,-.12],pelvis);
 const chest=bone('Chest_breath',[.88,.75,.10],torso);
 const neck=bone('Neck_joint',[.88,1.10,.43],torso);
 const head=bone('Head_joint',[.90,.92,.86],neck);
 const jaw=bone('Jaw_joint',[.90,.57,1.10],head);
 const legs=[];
 for(const [label,points] of [
  ['front_left',[[.60,.90,.70],[.55,.48,.97],[.50,.12,1.22],[.55,.05,1.44]]],
  ['front_right',[[1.38,.90,.27],[1.59,.48,.37],[1.70,.12,.50],[1.80,.05,.68]]],
  ['rear_left',[[-.03,.88,-.70],[-.20,.48,-.53],[-.28,.12,-.46],[-.24,.05,-.25]]],
  ['rear_right',[[.65,.80,-.94],[.61,.44,-1.17],[.58,.12,-1.25],[.65,.05,-1.06]]]
 ]){const chain=[];points.forEach((p,i)=>chain.push(bone(`${['Leg','Leg','Foot','Toes'][i]}_${label}${i<2?'_'+['hip','knee'][i]:''}`,p,i?chain[i-1]:pelvis)));legs.push({bones:chain,points:points.map(vec)});}
 const tails=[];
 for(const [label,points] of [
  ['upper',[[.35,1.10,-1.10],[-.15,1.19,-1.27],[-.55,1.35,-1.40],[-.98,1.62,-1.41],[-1.40,1.76,-1.07],[-1.65,1.60,-.72]]],
  ['lower',[[.35,.78,-.80],[-.15,.76,-.88],[-.55,.72,-.93],[-1.00,.75,-.79],[-1.42,.89,-.45],[-1.68,.96,-.08]]]
 ]){const chain=[];points.forEach((p,i)=>chain.push(bone(`Tail_${label}_${i===points.length-1?'club':i}`,p,i?chain[i-1]:pelvis)));tails.push({bones:chain,points:points.map(vec)});}
 function chainWeights(chain,p,amount,add){let best=Infinity,t=0;for(let i=0;i<chain.points.length-1;i++){const a=chain.points[i],delta=chain.points[i+1].clone().sub(a),u=THREE.MathUtils.clamp(p.clone().sub(a).dot(delta)/delta.lengthSq(),0,1),distance=p.distanceToSquared(a.clone().addScaledVector(delta,u));if(distance<best){best=distance;t=i+u;}}const i=Math.min(chain.bones.length-2,Math.floor(t));add(chain.bones[i],amount*(1-(t-i)));add(chain.bones[i+1],amount*(t-i));}
 const meshes=[];root.updateMatrixWorld(true);
 asset.scene.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone();geo.applyMatrix4(normalize.clone().multiply(o.matrixWorld));const positions=geo.attributes.position,indices=[],weights=[],p=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
   p.fromBufferAttribute(positions,i);const influences=new Map(),add=(b,w)=>{if(w>0)influences.set(joints.indexOf(b),(influences.get(joints.indexOf(b))||0)+w);};
   // Tail clubs keep a single rigid influence; shafts use smooth segment weights.
   const tailWeight=(1-smooth(p.x,-.30,.35))*(1-smooth(p.z,-.30,.15)*smooth(p.x,-.45,-.15))*smooth(p.y,.42,.68);
   let available=1-tailWeight;
   if(tailWeight>0){let nearest=tails[0],best=Infinity;for(const chain of tails)for(const point of chain.points){const dist=p.distanceToSquared(point);if(dist<best){best=dist;nearest=chain;}}
    if(p.x<-1.47) add(nearest.bones.at(-1),tailWeight);else chainWeights(nearest,p,tailWeight,add);
   }
   const headWeight=available*smooth(p.z,.32,.76)*smooth(p.y,.45,.68)*(1-smooth(Math.abs(p.x-.90),.60,.85));
   const jawWeight=headWeight*(1-smooth(p.y,.57,.70))*smooth(p.z,.91,1.12);add(jaw,jawWeight);add(head,headWeight-jawWeight);available-=headWeight;
   const leg=legs.reduce((best,l)=>{const a=l.points[2],b=best.points[2];return (p.x-a.x)**2+(p.z-a.z)**2<(p.x-b.x)**2+(p.z-b.z)**2?l:best;},legs[0]);
   const legWeight=available*(1-smooth(p.y,.47,.83));chainWeights(leg,p,legWeight,add);available-=legWeight;
   const neckWeight=available*smooth(p.z,.12,.48)*smooth(p.y,.91,1.14);add(neck,neckWeight);available-=neckWeight;
   const soft=available*(1-smooth(p.y,.75,1.00))*(1-smooth(Math.abs(p.x-.88),.25,.47));add(chest,soft);add(torso,available-soft);
   const best=[...influences].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=best.reduce((n,[,w])=>n+w,0)||1;
   for(let j=0;j<4;j++){indices.push(best[j]?.[0]||0);weights.push((best[j]?.[1]||0)/sum);}
  }
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const materials=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const c=m.clone();c.side=THREE.DoubleSide;for(const key of ['map','normalMap','roughnessMap','metalnessMap'])if(c[key])c[key].anisotropy=4;return c;});
  const skin=new THREE.SkinnedMesh(geo,Array.isArray(o.material)?materials:materials[0]);skin.name='Brakk_Brugar_skin';skin.castShadow=skin.receiveShadow=true;root.add(skin);skin.bind(new THREE.Skeleton(joints));meshes.push(skin);
 });
 const bindPose=new Map(joints.map(b=>[b,{position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()}]));
 const idleDuration=8;
 function resetPose(){for(const b of joints){const r=bindPose.get(b);b.position.copy(r.position);b.quaternion.copy(r.quaternion);b.scale.copy(r.scale);}}
 // Rotations are additive radians in joint-local XYZ space. A future battle can fade
 // idleWeight down and poseWeight up, or use the exported rig with AnimationMixer.
 function applyPose(pose={},weight=1){weight=THREE.MathUtils.clamp(weight,0,1);for(const [name,value] of Object.entries(pose)){const b=jointMap[name];if(!b)continue;if(value.rotation){const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...value.rotation));b.quaternion.multiply(new THREE.Quaternion().slerp(q,weight));}if(value.position)b.position.addScaledVector(vec(value.position),weight);}root.updateMatrixWorld(true);}
 function update(time,{idleWeight=1,pose,poseWeight=1}={}){
  resetPose();const phase=time/idleDuration*Math.PI*2,w=THREE.MathUtils.clamp(idleWeight,0,1),breath=Math.sin(phase*2)*w;
  // Only the underside breathes. Stone plates and all four feet remain stable.
  chest.scale.set(1+breath*.004,1+breath*.006,1+breath*.003);
  neck.rotation.set(Math.sin(phase)*.005*w,Math.sin(phase)*.009*w,0);
  head.rotation.set(Math.sin(phase*2)*.006*w,Math.sin(phase)*.018*w,0);
  tails.forEach((chain,n)=>chain.bones.forEach((b,i)=>{if(i===chain.bones.length-1)return;b.rotation.y=Math.sin(phase-i*.22+n*.7)*.003*w;b.rotation.z=Math.sin(phase-i*.2+n*.7)*.002*w;}));
  if(pose)applyPose(pose,poseWeight);root.updateMatrixWorld(true);
 }
 function clips(){const times=[],rotations=new Map(joints.map(b=>[b,[]])),scales=[];for(let i=0;i<=96;i++){const t=i/96*idleDuration;times.push(t);update(t);joints.forEach(b=>rotations.get(b).push(...b.quaternion.toArray()));scales.push(...chest.scale.toArray());}const clip=new THREE.AnimationClip('idle',idleDuration,[...joints.map(b=>new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',times,rotations.get(b))),new THREE.VectorKeyframeTrack('Chest_breath.scale',times,scales)]);resetPose();root.updateMatrixWorld(true);return [clip];}
 update(0);
 return {root,update,joints,jointMap,mesh:meshes[0],legs,tails,clips,idleDuration,resetPose,applyPose,source:'Supplied Meshy armored stone beast FBX',dispose(){const materials=new Set();meshes.forEach(m=>{m.geometry.dispose();m.skeleton.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>materials.add(mat));});materials.forEach(m=>m.dispose());}};
}
