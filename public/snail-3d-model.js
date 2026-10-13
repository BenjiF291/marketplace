import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';

// The supplied Meshy FBX is an unrigged mesh. This anatomical rig preserves its
// original geometry and UVs, assigning smooth weights in normalized model space.
let sourcePromise;
const smooth=THREE.MathUtils.smoothstep;
const vec=p=>new THREE.Vector3(...p);
export async function createSnail(){
 sourcePromise??=new GLTFLoader().loadAsync(new URL('./assets/companions/snail-meshy-source.glb',import.meta.url).href);
 const asset=await sourcePromise;asset.scene.updateMatrixWorld(true);
 const root=new THREE.Group();root.name='Snail_entity';
 const box=new THREE.Box3().setFromObject(asset.scene),height=box.max.y-box.min.y,scale=2.6/height,center=box.getCenter(new THREE.Vector3());
 const normalize=new THREE.Matrix4().makeTranslation(-center.x*scale,-box.min.y*scale,-center.z*scale).multiply(new THREE.Matrix4().makeScale(scale,scale,scale));
 const bones=[],rest=new Map();
 const bone=(name,point,parent)=>{const b=new THREE.Bone();b.name=name;const world=vec(point);b.position.copy(world);if(parent){const parentWorld=rest.get(parent);b.position.sub(parentWorld);parent.add(b);}else root.add(b);rest.set(b,world);bones.push(b);return b;};
 const torso=bone('Torso',[0,.10,0]);
 const shell=bone('Shell_joint',[0,1.10,-.15],torso);
 const head=bone('Head_joint',[0,.52,1.07],torso);
 const foot=[];for(let i=0;i<9;i++)foot.push(bone(`Foot_wave_${i}`,[0,.12,-1.75+i*.37],torso));
 const feelers=[];
 for(const [label,points] of [
  ['upper_left',[[-.18,.78,1.32],[-.27,1.30,1.58],[-.42,1.74,1.84]]],
  ['upper_right',[[.14,.78,1.32],[.35,1.23,1.54],[.61,1.60,1.83]]],
  ['lower_left',[[-.22,.54,1.32],[-.26,.59,1.90]]],
  ['lower_right',[[.22,.54,1.32],[.34,.53,1.88]]]
 ]){const chain=[];points.forEach((p,i)=>chain.push(bone(`Feeler_${label}_${i===points.length-1?'tip':i===0?'base':'mid'}`,p,i?chain[i-1]:head)));feelers.push({label,points:points.map(vec),bones:chain});}
 const index=b=>bones.indexOf(b),meshes=[];
 root.updateMatrixWorld(true);
 asset.scene.traverse(o=>{if(!o.isMesh)return;
  const geo=o.geometry.clone();geo.applyMatrix4(normalize.clone().multiply(o.matrixWorld));
  const positions=geo.attributes.position,indices=[],weights=[],p=new THREE.Vector3();
  const image=o.material.map?.image,canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(image)ctx.drawImage(image,0,0,256,256);const pixels=ctx.getImageData(0,0,256,256).data;

  for(let i=0;i<positions.count;i++){
   p.fromBufferAttribute(positions,i);const influences=new Map();const add=(b,w)=>{if(w>0)influences.set(index(b),(influences.get(index(b))||0)+w);};
   const uv=geo.attributes.uv,u=THREE.MathUtils.clamp(Math.floor(uv.getX(i)*256),0,255),v=THREE.MathUtils.clamp(Math.floor(uv.getY(i)*256),0,255),at=(v*256+u)*4;
   const purple=pixels[at+2]>pixels[at+1]*1.20&&pixels[at]>pixels[at+1]*1.10;
   // Purple shell plates, their rim, and elevated crystals all move as one rigid
   // object. The low green foot remains free to contract below that shell.
   const crystal=pixels[at+2]>pixels[at]*1.40&&pixels[at+1]>pixels[at]*1.25;
   const shellWeight=(p.z<.83&&p.y>.46)||(p.z<1.15&&p.y>1.10)||(purple&&p.z<.90&&p.y>.24)||(crystal&&p.z<1.05&&p.y>.52)?1:0;
   add(shell,shellWeight);let available=1-shellWeight;
   let nearest=null,bestDistance=Infinity,bestSegment=0,bestU=0;
   if(p.z>1.15)for(const f of feelers){
    if(f.label.startsWith('upper')?(p.y<.78):(p.y>.77||p.z<1.43))continue;
    for(let j=0;j<f.points.length-1;j++){const a=f.points[j],segment=f.points[j+1].clone().sub(a),u=THREE.MathUtils.clamp(p.clone().sub(a).dot(segment)/segment.lengthSq(),0,1),distance=p.distanceToSquared(a.clone().addScaledVector(segment,u));if(distance<bestDistance){bestDistance=distance;nearest=f;bestSegment=j;bestU=u;}}
   }
   if(nearest){const isTip=p.distanceTo(nearest.points.at(-1))<.14;const upper=nearest.label.startsWith('upper'),weight=isTip?available:available*(upper?smooth(p.y,.78,.96):1)*(1-smooth(Math.sqrt(bestDistance),.08,.17));
    const tip=nearest.points.at(-1);if(p.distanceTo(tip)<.14)add(nearest.bones.at(-1),weight);else{add(nearest.bones[bestSegment],weight*(1-bestU));add(nearest.bones[bestSegment+1],weight*bestU);}available-=weight;
   }
   const headWeight=available*smooth(p.z,.82,1.12)*smooth(p.y,.25,.56);add(head,headWeight);available-=headWeight;
   const waveWeight=available*smooth(p.y,.045,.18),t=THREE.MathUtils.clamp((p.z+1.75)/.37,0,8),n=Math.min(7,Math.floor(t));
   add(foot[n],waveWeight*(1-(t-n)));add(foot[n+1],waveWeight*(t-n));add(torso,available-waveWeight);
   const best=[...influences].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=best.reduce((s,p)=>s+p[1],0)||1;
   for(let j=0;j<4;j++){indices.push(best[j]?.[0]||0);weights.push((best[j]?.[1]||0)/sum);}
  }
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const materials=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const c=m.clone();c.side=THREE.FrontSide;for(const k of ['map','normalMap','roughnessMap','metalnessMap'])if(c[k])c[k].anisotropy=4;return c;});
  const skin=new THREE.SkinnedMesh(geo,Array.isArray(o.material)?materials:materials[0]);skin.name='Meshy_snail_skin';skin.castShadow=skin.receiveShadow=true;root.add(skin);skin.bind(new THREE.Skeleton(bones));meshes.push(skin);
 });
 let blend=0,fast=0,phase=0,previousTime=null,look=0;
 function update(time,{motion='idle',dt=1/60,immediate=false,lookBack=false,travelDistance}={}){
  const elapsed=immediate?dt:THREE.MathUtils.clamp(previousTime===null?dt:time-previousTime,0,.15);previousTime=time;
  const target=motion==='idle'?0:1;blend=immediate?target:THREE.MathUtils.damp(blend,target,5,elapsed);fast=immediate?(motion==='run'?1:0):THREE.MathUtils.damp(fast,motion==='run'?1:0,3,elapsed);
  const cycle=THREE.MathUtils.lerp(2,1.2,fast),advance=travelDistance===undefined?elapsed/cycle:Math.max(0,travelDistance)/.38;
  phase=immediate?time/cycle*Math.PI*2:phase+advance*Math.PI*2;
  foot.forEach((b,i)=>{const wave=Math.sin(phase-i*.72),amplitude=THREE.MathUtils.lerp(.002,.014+.004*fast,blend);b.position.y=.02+amplitude*(1+wave);b.position.z=-1.75+i*.37+Math.cos(phase-i*.72)*.018*blend;});
  shell.position.y=1.00+Math.sin(phase)*.002*blend;shell.rotation.set(0,0,0);
  look=immediate?(lookBack?.18:0):THREE.MathUtils.damp(look,lookBack?.18:0,4,elapsed);
  head.rotation.set(Math.sin(time*.85)*.012,look+Math.sin(time*.6)*.025,0);
  feelers.forEach((f,n)=>f.bones.forEach((b,i)=>b.rotation.set(Math.sin(time*1.1+n*.9-i*.3)*.018,Math.sin(time*.8+n)*.025,Math.sin(time*.9+n-i*.4)*.020)));
  root.updateMatrixWorld(true);
 }
 update(0,{immediate:true});
 function clips(){const result=[];for(const motion of ['idle','walk','run']){const duration=motion==='idle'?4.8:motion==='walk'?2:1.2,times=[],samples=new Map(bones.map(b=>[b,[]])),positions=new Map(bones.map(b=>[b,[]]));
  for(let i=0;i<=64;i++){const t=i/64*duration,ph=i/64*Math.PI*2;times.push(t);update(t,{motion,immediate:true});
   head.rotation.set(Math.sin(ph)*.012,Math.sin(ph)*.025,0);feelers.forEach((f,n)=>f.bones.forEach((b,j)=>b.rotation.set(Math.sin(ph+n*.9-j*.3)*.018,Math.sin(ph+n)*.025,Math.sin(ph+n-j*.4)*.020)));
   // Idle foot breathing must close its loop too; crawling already uses the clip period.
   if(motion==='idle')foot.forEach((b,n)=>b.position.y=.02+.002*(1+Math.sin(ph-n*.72)));
   bones.forEach(b=>{samples.get(b).push(...b.quaternion.toArray());positions.get(b).push(...b.position.toArray());});
  }
  result.push(new THREE.AnimationClip(motion==='walk'?'crawl':motion==='run'?'fast_crawl':'idle',duration,bones.flatMap(b=>[new THREE.VectorKeyframeTrack(b.name+'.position',times,positions.get(b)),new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',times,samples.get(b))])));
 }update(0,{immediate:true});return result;}
 return {root,update,joints:bones,mesh:meshes[0],tail:meshes[0],feelers,foot,shell,clips,source:'Meshy supplied snail FBX',dispose(){const materials=new Set();meshes.forEach(m=>{m.geometry.dispose();m.skeleton.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>materials.add(mat));});materials.forEach(m=>m.dispose());}};
}
