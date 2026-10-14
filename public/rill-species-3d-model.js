import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';

// Rill is book/brawl content; this module does not register an adoptable pet.
// Meshy supplied a static mesh. Keep its UVs and add an anatomical skin in +Z-facing space.
let sourcePromise;
const smooth=THREE.MathUtils.smoothstep,vec=p=>new THREE.Vector3(...p);
export async function createRillSpecies(){
 sourcePromise??=new GLTFLoader().loadAsync(new URL('./assets/creatures/rill-species-source.glb',import.meta.url).href);
 const asset=await sourcePromise;asset.scene.updateMatrixWorld(true);
 const root=new THREE.Group();root.name='Rill_species';
 const box=new THREE.Box3().setFromObject(asset.scene),scale=2.6/(box.max.y-box.min.y),center=box.getCenter(new THREE.Vector3());
 const normalize=new THREE.Matrix4().makeTranslation(-center.x*scale,-box.min.y*scale,-center.z*scale).multiply(new THREE.Matrix4().makeScale(scale,scale,scale));
 const joints=[],rest=new Map(),jointMap={};
 function bone(name,point,parent){const b=new THREE.Bone();b.name=name;const world=vec(point);b.position.copy(world);if(parent){b.position.sub(rest.get(parent));parent.add(b);}else root.add(b);rest.set(b,world);joints.push(b);jointMap[name]=b;return b;}
 const pelvis=bone('Pelvis',[0,.58,.55]);
 const torso=bone('Torso',[0,1.12,.60],pelvis);
 const neck=bone('Neck_joint',[0,1.65,.72],torso);
 const head=bone('Head_joint',[0,2.10,.80],neck);
 const crest=bone('Crest_joint',[0,2.27,.64],head);
 const beak=bone('Beak_joint',[0,2.12,1.00],head);
 const wings=[-1,1].map(sign=>{const side=sign<0?'left':'right',points=[[sign*.36,1.52,.64],[sign*.66,1.16,.42],[sign*.84,.69,.15],[sign*.90,.35,-.02]],chain=[];points.forEach((p,i)=>chain.push(bone(`Wing_${side}_${['root','elbow','wrist','tip'][i]}`,p,i?chain[i-1]:torso)));return {sign,bones:chain,points:points.map(vec)};});
 const legs=[-1,1].map(sign=>{const side=sign<0?'left':'right',points=[[sign*.22,.62,.66],[sign*.25,.33,.72],[sign*.28,.09,.77],[sign*.28,.055,.96]],chain=[];points.forEach((p,i)=>chain.push(bone(`${['Leg','Leg','Foot','Toes'][i]}_${side}${i<2?'_'+['hip','knee'][i]:''}`,p,i?chain[i-1]:pelvis)));return {bones:chain,points:points.map(vec)};});
 const tailPoints=[[0,.64,.15],[0,.38,-.18],[0,.25,-.55],[0,.27,-.88],[0,.46,-1.12],[0,.77,-1.15],[0,1.04,-.97]],tail=[];tailPoints.forEach((p,i)=>tail.push(bone(`Tail_${i}`,p,i?tail[i-1]:pelvis)));
 const tailChain={bones:tail,points:tailPoints.map(vec)};
 function chainWeights(chain,p,amount,add){let best=Infinity,t=0;for(let i=0;i<chain.points.length-1;i++){const a=chain.points[i],delta=chain.points[i+1].clone().sub(a),u=THREE.MathUtils.clamp(p.clone().sub(a).dot(delta)/delta.lengthSq(),0,1),distance=p.distanceToSquared(a.clone().addScaledVector(delta,u));if(distance<best){best=distance;t=i+u;}}const i=Math.min(chain.bones.length-2,Math.floor(t));add(chain.bones[i],amount*(1-(t-i)));add(chain.bones[i+1],amount*(t-i));}
 const meshes=[];root.updateMatrixWorld(true);
 asset.scene.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone();geo.applyMatrix4(normalize.clone().multiply(o.matrixWorld));const positions=geo.attributes.position,indices=[],weights=[],p=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
   p.fromBufferAttribute(positions,i);const influences=new Map(),add=(b,w)=>{if(w>0)influences.set(joints.indexOf(b),(influences.get(joints.indexOf(b))||0)+w);};
   // Head/beak/crest are protected from the adjacent wing shoulder region.
   const planted=1-smooth(p.y,.20,.34);chainWeights(legs[p.x<0?0:1],p,planted,add);
   const headWeight=(1-planted)*smooth(p.y,1.85,2.05);const crestWeight=headWeight*smooth(p.y,2.26,2.43)*(1-smooth(p.z,.85,1.0));const beakWeight=headWeight*smooth(p.z,1.02,1.12)*(1-smooth(p.y,2.22,2.33));
   add(crest,crestWeight);add(beak,beakWeight);add(head,Math.max(0,headWeight-crestWeight-beakWeight));
   let available=1-planted-headWeight;
   const neckWeight=available*smooth(p.y,1.42,1.75)*(1-smooth(Math.abs(p.x),.22,.45));add(neck,neckWeight);available-=neckWeight;
   const wingWeight=available*smooth(Math.abs(p.x),.32,.58)*smooth(p.y,.20,.43);chainWeights(wings[p.x<0?0:1],p,wingWeight,add);available-=wingWeight;
   const tailWeight=available*(1-smooth(p.z,-.28,.20))*(1-smooth(Math.abs(p.x),.35,.58));chainWeights(tailChain,p,tailWeight,add);available-=tailWeight;
   const legWeight=available*(1-smooth(p.y,.48,.75))*smooth(p.z,.30,.56);chainWeights(legs[p.x<0?0:1],p,legWeight,add);available-=legWeight;
   const body=smooth(p.y,.62,1.05);add(torso,available*body);add(pelvis,available*(1-body));
   const best=[...influences].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=best.reduce((n,[,w])=>n+w,0)||1;
   for(let j=0;j<4;j++){indices.push(best[j]?.[0]||0);weights.push((best[j]?.[1]||0)/sum);}
  }
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const materials=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const c=m.clone();c.side=THREE.DoubleSide;for(const key of ['map','normalMap','roughnessMap','metalnessMap'])if(c[key])c[key].anisotropy=4;return c;});
  const skin=new THREE.SkinnedMesh(geo,Array.isArray(o.material)?materials:materials[0]);skin.name='Rill_species_skin';skin.castShadow=skin.receiveShadow=true;root.add(skin);skin.bind(new THREE.Skeleton(joints));meshes.push(skin);
 });
 const bindPose=new Map(joints.map(b=>[b,{position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()}]));
 const idleDuration=8;
 function resetPose(){for(const b of joints){const r=bindPose.get(b);b.position.copy(r.position);b.quaternion.copy(r.quaternion);b.scale.copy(r.scale);}}
 // Rotations are additive radians in joint-local XYZ space. A future battle can fade
 // idleWeight down and poseWeight up, or use the exported rig with AnimationMixer.
 function applyPose(pose={},weight=1){weight=THREE.MathUtils.clamp(weight,0,1);for(const [name,value] of Object.entries(pose)){const b=jointMap[name];if(!b)continue;if(value.rotation){const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...value.rotation));b.quaternion.multiply(new THREE.Quaternion().slerp(q,weight));}if(value.position)b.position.addScaledVector(vec(value.position),weight);}root.updateMatrixWorld(true);}
 function update(time,{idleWeight=1,pose,poseWeight=1}={}){
  resetPose();const phase=time/idleDuration*Math.PI*2,w=THREE.MathUtils.clamp(idleWeight,0,1),breath=Math.sin(phase*2)*w;
  // Breathing stays above the pelvis so both talons remain planted.
  torso.scale.set(1+breath*.003,1+breath*.005,1+breath*.004);
  neck.rotation.set(Math.sin(phase)*.012*w,Math.sin(phase)*.018*w,Math.sin(phase*2)*.006*w);
  head.rotation.set(Math.sin(phase*2+.3)*.014*w,Math.sin(phase)*.045*w,Math.sin(phase+.4)*.010*w);
  crest.rotation.x=Math.sin(phase+.2)*.006*w;
  wings.forEach(({sign,bones},i)=>{bones[0].rotation.z=sign*Math.sin(phase*2+i*.15)*.016*w;bones[1].rotation.z=sign*Math.sin(phase*2-.35+i*.15)*.009*w;bones[2].rotation.y=sign*Math.sin(phase*2-.6)*.010*w;bones[3].rotation.y=sign*Math.sin(phase*2-.8)*.006*w;});
  tail.forEach((b,i)=>{b.rotation.y=Math.sin(phase-i*.22)*(.006+i*.001)*w;b.rotation.x=Math.sin(phase*2-i*.18)*.004*w;});
  if(pose)applyPose(pose,poseWeight);root.updateMatrixWorld(true);
 }
 function clips(){const times=[],rotations=new Map(joints.map(b=>[b,[]])),scales=[];for(let i=0;i<=96;i++){const t=i/96*idleDuration;times.push(t);update(t);joints.forEach(b=>rotations.get(b).push(...b.quaternion.toArray()));scales.push(...torso.scale.toArray());}const clip=new THREE.AnimationClip('idle',idleDuration,[...joints.map(b=>new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',times,rotations.get(b))),new THREE.VectorKeyframeTrack('Torso.scale',times,scales)]);resetPose();root.updateMatrixWorld(true);return [clip];}
 update(0);
 return {root,update,joints,jointMap,mesh:meshes[0],wings,legs,tail,clips,idleDuration,resetPose,applyPose,source:'Supplied Meshy teal magical bird FBX',dispose(){const materials=new Set();meshes.forEach(m=>{m.geometry.dispose();m.skeleton.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>materials.add(mat));});materials.forEach(m=>m.dispose());}};
}
