import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';

// Tharos is book/brawl content; this module does not register an adoptable pet.
// Meshy supplied a static mesh. Keep its UVs and add an anatomical skin in +Z-facing space.
let sourcePromise;
const smooth=THREE.MathUtils.smoothstep,vec=p=>new THREE.Vector3(...p);
export async function createTharos(){
 sourcePromise??=new GLTFLoader().loadAsync(new URL('./assets/creatures/tharos-source.glb',import.meta.url).href);
 const asset=await sourcePromise;asset.scene.updateMatrixWorld(true);
 const root=new THREE.Group();root.name='Tharos_Veyrin';
 const box=new THREE.Box3().setFromObject(asset.scene),scale=2.2/(box.max.y-box.min.y),center=box.getCenter(new THREE.Vector3());
 const normalize=new THREE.Matrix4().makeTranslation(-center.x*scale,-box.min.y*scale,-center.z*scale).multiply(new THREE.Matrix4().makeScale(scale,scale,scale));
 const joints=[],rest=new Map(),jointMap={};
 function bone(name,point,parent){const b=new THREE.Bone();b.name=name;const world=vec(point);b.position.copy(world);if(parent){b.position.sub(rest.get(parent));parent.add(b);}else root.add(b);rest.set(b,world);joints.push(b);jointMap[name]=b;return b;}
 const pelvis=bone('Pelvis',[.45,.80,.18]);
 const torso=bone('Torso',[-.15,1.00,.27],pelvis);
 const chest=bone('Chest_breath',[-.25,.93,.42],torso);
 const neck=bone('Neck_joint',[-.45,1.28,.65],torso);
 const head=bone('Head_joint',[-.68,1.55,.80],neck);
 const jaw=bone('Jaw_joint',[-.68,1.40,.95],head);
 const horns=[{bone:bone('Horn_left',[-.98,1.84,.78],head),a:vec([-.98,1.84,.78]),b:vec([-1.08,2.14,.57])},{bone:bone('Horn_right',[-.60,1.82,.80],head),a:vec([-.60,1.82,.80]),b:vec([-.56,2.20,.55])}];
 const ears=[{bone:bone('Ear_left',[-1.00,1.61,.61],head),a:vec([-1.00,1.61,.61]),b:vec([-1.08,1.77,.62])},{bone:bone('Ear_right',[-.48,1.64,.90],head),a:vec([-.48,1.64,.90]),b:vec([-.37,1.82,.96])}];
 const legs=[];
 for(const [label,points] of [
  ['front_left',[[-.52,.92,.44],[-.70,.49,.38],[-.88,.12,.44],[-.94,.07,.55]]],
  ['front_right',[[-.16,.90,.67],[-.34,.51,.80],[-.58,.10,.985],[-.60,.07,1.06]]],
  ['rear_left',[[.20,.84,.00],[.11,.43,-.03],[-.087,.10,-.009],[-.15,.065,.08]]],
  ['rear_right',[[.57,.82,.28],[.74,.40,.32],[.63,.10,.63],[.56,.06,.75]]]
 ]){const chain=[];points.forEach((p,i)=>chain.push(bone(`${['Leg','Leg','Foot','Toes'][i]}_${label}${i<2?'_'+['hip','knee'][i]:''}`,p,i?chain[i-1]:pelvis)));legs.push({bones:chain,points:points.map(vec)});}
 const wings=[];
 for(const [label,points] of [
  ['left',[[-.45,1.12,.25],[-.88,1.44,.08],[-1.35,1.95,-.02],[-1.45,1.24,-.72],[-1.55,.50,-1.20]]],
  ['right',[[-.20,1.20,.52],[.20,1.46,.85],[.47,2.04,1.23],[1.09,1.05,1.54],[1.52,.10,1.70]]]
 ]){const chain=[];points.forEach((p,i)=>chain.push(bone(`Wing_${label}_${['root','elbow','wrist','fingers','tip'][i]}`,p,i?chain[i-1]:torso)));wings.push({sign:label==='left'?-1:1,bones:chain,points:points.map(vec)});}
 const tails=[];
 const points=[[.45,.85,.25],[.70,.76,.25],[.92,.58,.19],[1.00,.35,.10],[.95,.17,-.14],[.87,.07,-.30],[.83,.09,-.39]],chain=[];
 points.forEach((p,i)=>chain.push(bone(`Tail_curve_${i===points.length-1?'tip':i}`,p,i?chain[i-1]:pelvis)));tails.push({bones:chain,points:points.map(vec)});
 function chainWeights(chain,p,amount,add){let best=Infinity,t=0;for(let i=0;i<chain.points.length-1;i++){const a=chain.points[i],delta=chain.points[i+1].clone().sub(a),u=THREE.MathUtils.clamp(p.clone().sub(a).dot(delta)/delta.lengthSq(),0,1),distance=p.distanceToSquared(a.clone().addScaledVector(delta,u));if(distance<best){best=distance;t=i+u;}}const i=Math.min(chain.bones.length-2,Math.floor(t));add(chain.bones[i],amount*(1-(t-i)));add(chain.bones[i+1],amount*(t-i));}
 const meshes=[];root.updateMatrixWorld(true);
 asset.scene.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone();geo.applyMatrix4(normalize.clone().multiply(o.matrixWorld));const positions=geo.attributes.position,indices=[],weights=[],p=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
   p.fromBufferAttribute(positions,i);const influences=new Map(),add=(b,w)=>{if(w>0)influences.set(joints.indexOf(b),(influences.get(joints.indexOf(b))||0)+w);};
   const segmentDistance=(a,b)=>{const delta=b.clone().sub(a),u=THREE.MathUtils.clamp(p.clone().sub(a).dot(delta)/delta.lengthSq(),0,1);return p.distanceTo(a.clone().addScaledVector(delta,u));};
   const along=-(p.x+.15)*.80+(p.z-.27)*.60,side=(p.x+.15)*.60+(p.z-.27)*.80;
   let nearPaw=Infinity;for(const l of legs){const f=l.points[2];nearPaw=Math.min(nearPaw,Math.hypot(p.x-f.x,p.z-f.z));}
   const protectPaws=1-(1-smooth(nearPaw,.32,.46))*(1-smooth(p.y,.30,.65));
   const protectHead=1-(1-smooth(Math.hypot(p.x+.68,p.z-.80),.42,.62))*smooth(p.y,1.28,1.55);
   const wingWeight=smooth(Math.abs(side),.36,.62)*protectPaws*protectHead;
   chainWeights(wings[side<0?0:1],p,wingWeight,add);let available=1-wingWeight;
   let tailDistance=Infinity;for(let i=0;i<tails[0].points.length-1;i++)tailDistance=Math.min(tailDistance,segmentDistance(tails[0].points[i],tails[0].points[i+1]));
   const tailWeight=available*smooth(p.x,.40,.70)*(1-smooth(p.z,.32,.50))*(1-smooth(tailDistance,.13,.28));chainWeights(tails[0],p,tailWeight,add);available-=tailWeight;
   const headWeight=available*(1-smooth(Math.hypot(p.x+.68,p.z-.80),.52,.75))*smooth(p.y,1.38,1.64);let skull=headWeight;
   for(const horn of horns){const weight=skull*smooth(p.y,1.77,1.92)*(1-smooth(segmentDistance(horn.a,horn.b),.06,.16));add(horn.bone,weight);skull-=weight;}
   for(const ear of ears){const weight=skull*smooth(p.y,1.57,1.72)*(1-smooth(segmentDistance(ear.a,ear.b),.055,.13));add(ear.bone,weight);skull-=weight;}
   const jawWeight=skull*(1-smooth(p.y,1.54,1.64))*smooth(along,.80,1.00);add(jaw,jawWeight);add(head,skull-jawWeight);available-=headWeight;
   const leg=legs.reduce((best,l)=>{const a=l.points[2],b=best.points[2];return (p.x-a.x)**2+(p.z-a.z)**2<(p.x-b.x)**2+(p.z-b.z)**2?l:best;},legs[0]);
   const legWeight=available*(1-smooth(p.y,.62,.98));chainWeights(leg,p,legWeight,add);available-=legWeight;
   const neckWeight=available*smooth(along,.34,.67)*smooth(p.y,1.08,1.35);add(neck,neckWeight);available-=neckWeight;
   const soft=available*(1-smooth(p.y,.93,1.12))*smooth(along,-.12,.16);add(chest,soft);add(torso,available-soft);
   const best=[...influences].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=best.reduce((n,[,w])=>n+w,0)||1;
   for(let j=0;j<4;j++){indices.push(best[j]?.[0]||0);weights.push((best[j]?.[1]||0)/sum);}
  }
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const materials=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const c=m.clone();c.side=THREE.DoubleSide;for(const key of ['map','normalMap','roughnessMap','metalnessMap'])if(c[key])c[key].anisotropy=4;return c;});
  const skin=new THREE.SkinnedMesh(geo,Array.isArray(o.material)?materials:materials[0]);skin.name='Tharos_Veyrin_skin';skin.castShadow=skin.receiveShadow=true;root.add(skin);skin.bind(new THREE.Skeleton(joints));meshes.push(skin);
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
  ears.forEach(({bone},i)=>bone.rotation.z=Math.sin(phase*2+i*.7)*.008*w);
  wings.forEach(({sign,bones},i)=>bones.forEach((b,n)=>{b.rotation.z=sign*Math.sin(phase*2-n*.23+i*.15)*(.007-n*.001)*w;b.rotation.y=sign*Math.sin(phase*2-n*.25)*.003*w;}));
  tails.forEach((chain,n)=>chain.bones.forEach((b,i)=>{b.rotation.y=Math.sin(phase-i*.22+n*.7)*.006*w;b.rotation.z=Math.sin(phase-i*.20+n*.7)*.004*w;}));
  if(pose)applyPose(pose,poseWeight);root.updateMatrixWorld(true);
 }
 function clips(){const times=[],rotations=new Map(joints.map(b=>[b,[]])),scales=[];for(let i=0;i<=96;i++){const t=i/96*idleDuration;times.push(t);update(t);joints.forEach(b=>rotations.get(b).push(...b.quaternion.toArray()));scales.push(...chest.scale.toArray());}const clip=new THREE.AnimationClip('idle',idleDuration,[...joints.map(b=>new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',times,rotations.get(b))),new THREE.VectorKeyframeTrack('Chest_breath.scale',times,scales)]);resetPose();root.updateMatrixWorld(true);return [clip];}
 update(0);
 return {root,update,joints,jointMap,mesh:meshes[0],legs,tails,ears,horns,wings,clips,idleDuration,resetPose,applyPose,source:'Supplied Meshy scaly black winged cat FBX',dispose(){const materials=new Set();meshes.forEach(m=>{m.geometry.dispose();m.skeleton.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>materials.add(mat));});materials.forEach(m=>m.dispose());}};
}
