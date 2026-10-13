import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';

// The supplied Meshy FBX is an unrigged mesh. This anatomical rig preserves its
// original geometry and UVs, assigning smooth weights in normalized model space.
let sourcePromise;
const smooth=THREE.MathUtils.smoothstep;
const vec=p=>new THREE.Vector3(...p);
export async function createFox(){
 sourcePromise??=new GLTFLoader().loadAsync(new URL('./assets/companions/fox-meshy-source.glb',import.meta.url).href);
 const asset=await sourcePromise;asset.scene.updateMatrixWorld(true);
 const root=new THREE.Group();root.name='Fox_entity';
 const box=new THREE.Box3().setFromObject(asset.scene),height=box.max.y-box.min.y,scale=2.6/height,center=box.getCenter(new THREE.Vector3());
 const normalize=new THREE.Matrix4().makeTranslation(-center.x*scale,-box.min.y*scale,-center.z*scale).multiply(new THREE.Matrix4().makeScale(scale,scale,scale));
 const bones=[],rest=new Map();
 const bone=(name,point,parent)=>{const b=new THREE.Bone();b.name=name;const world=vec(point);b.position.copy(world);if(parent){const parentWorld=rest.get(parent);b.position.sub(parentWorld);parent.add(b);}else root.add(b);rest.set(b,world);bones.push(b);return b;};
 const torso=bone('Torso',[0,1.2,0]);
 const head=bone('Head_joint',[0,1.7,.87],torso);
 const ears=[bone('Ear_left',[-.30,2.08,.98],head),bone('Ear_right',[.30,2.08,.98],head)];
 const legs=[];
 for(let i=0;i<4;i++){
  const front=i<2,x=(i%2?1:-1)*(front?.30:.33),z=front?.61:-.55;
  const hip=bone(`Leg_${i}_hip`,[x,front?1.27:1.28,z],torso);
  const knee=bone(`Leg_${i}_knee`,[x,.61,front?.67:-.86],hip);
  const paw=bone(`Leg_${i}_paw`,[x,.105,front?.80:-.72],knee);
  const a=rest.get(knee).clone().sub(rest.get(hip)),b=rest.get(paw).clone().sub(rest.get(knee));
  const upper=Math.atan2(-a.z,-a.y),lower=Math.atan2(-b.z,-b.y);
  legs.push({hip,knee,paw,front,x,z,upper,lower,l1:a.length(),l2:b.length(),foot:rest.get(paw).clone().sub(rest.get(hip)),phase:i===0||i===3?0:Math.PI});
 }
 const tailPoints=[[0,1.3,-.83],[0,1.23,-1.04],[0,1.2,-1.26],[0,1.3,-1.47],[0,1.53,-1.65],[0,1.73,-1.78],[0,1.84,-1.88]];
 const tailBones=tailPoints.map((p,i)=>bone(`Tail_bone_${i}`,p,i?bones.at(-1):torso));
 const index=b=>bones.indexOf(b),meshes=[];
 root.updateMatrixWorld(true);
 asset.scene.traverse(o=>{if(!o.isMesh)return;
  const geo=o.geometry.clone();geo.applyMatrix4(normalize.clone().multiply(o.matrixWorld));
  const positions=geo.attributes.position,indices=[],weights=[],p=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
   p.fromBufferAttribute(positions,i);const influences=new Map();const add=(b,w)=>{if(w>0)influences.set(index(b),(influences.get(index(b))||0)+w);};
   // Tail begins behind the hips; head and ears are above the shoulder ruff.
   const tailWeight=smooth(-p.z,.89,1.20)*smooth(p.y,.84,1.1);
   const headWeight=smooth(p.y,1.45,1.82)*smooth(p.z,.46,.83)*(1-tailWeight);
   const earWeight=smooth(p.y,2.08,2.28)*headWeight;
   add(head,headWeight-earWeight);add(ears[p.x<0?0:1],earWeight);
   if(tailWeight){let t=0;for(let n=0;n<tailPoints.length-1;n++){if(-p.z>=-tailPoints[n][2]){t=n+THREE.MathUtils.clamp((p.z-tailPoints[n][2])/(tailPoints[n+1][2]-tailPoints[n][2]),0,1);}}const n=Math.min(tailBones.length-2,Math.floor(t));add(tailBones[n],tailWeight*(1-(t-n)));add(tailBones[n+1],tailWeight*(t-n));}
   const remaining=1-headWeight-tailWeight;
   const front=p.z>.12,leg=legs[(front?0:2)+(p.x<0?0:1)];
   const legWeight=remaining*smooth(1.37-p.y,.10,.42)*smooth(Math.abs(p.x),.10,.23);
   const lowerWeight=smooth(.79-p.y,0,.32),pawWeight=smooth(.22-p.y,0,.13);
   add(leg.hip,legWeight*(1-lowerWeight));add(leg.knee,legWeight*lowerWeight*(1-pawWeight));add(leg.paw,legWeight*lowerWeight*pawWeight);add(torso,remaining-legWeight);
   const best=[...influences].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=best.reduce((s,p)=>s+p[1],0)||1;
   for(let j=0;j<4;j++){indices.push(best[j]?.[0]||0);weights.push((best[j]?.[1]||0)/sum);}
  }
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const materials=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const c=m.clone();c.side=THREE.FrontSide;for(const k of ['map','normalMap','roughnessMap','metalnessMap'])if(c[k])c[k].anisotropy=4;return c;});
  const skin=new THREE.SkinnedMesh(geo,Array.isArray(o.material)?materials:materials[0]);skin.name='Meshy_fox_skin';skin.castShadow=skin.receiveShadow=true;root.add(skin);skin.bind(new THREE.Skeleton(bones));meshes.push(skin);
 });
 let blend=0;
 function update(time,{motion='idle',dt=1/60,immediate=false,lookBack=false}={}){
  const target=motion==='idle'?0:1;blend=immediate?target:THREE.MathUtils.damp(blend,target,7,dt);
  const cycle=motion==='run'?.58:.9,phase=time/cycle*Math.PI*2,run=motion==='run',stride=run?.32:.19;
  torso.position.y=1.2+Math.sin(phase*2)*(run?.055:.018)*blend;torso.rotation.set(0,0,Math.sin(phase)*.009*blend);
  head.rotation.set(Math.sin(time*1.5)*.025+Math.sin(phase*2)*.014*blend,lookBack?.55:Math.sin(time*.7)*.075,Math.sin(time*.6)*.015);
  ears.forEach((b,i)=>b.rotation.set(Math.sin(time*1.3+i)*.025,0,Math.sin(time*1.7+i)*.025));
  for(const l of legs){const ph=phase+l.phase+(run&&!l.front?.3:0),lift=Math.max(0,Math.sin(ph))*(run?.17:.10)*blend,z=l.foot.z+Math.cos(ph)*stride*blend,y=l.foot.y+lift-(torso.position.y-1.2);
   const d=THREE.MathUtils.clamp(Math.hypot(y,z),Math.abs(l.l1-l.l2)+.001,l.l1+l.l2-.001);
   const knee=-Math.acos(THREE.MathUtils.clamp((d*d-l.l1*l.l1-l.l2*l.l2)/(2*l.l1*l.l2),-1,1));
   const hip=Math.atan2(-z,-y)-Math.atan2(l.l2*Math.sin(knee),l.l1+l.l2*Math.cos(knee));
   // Identity is the imported rest pose. Blend into IK without snapping idle legs.
   l.hip.rotation.x=(hip-l.upper)*blend;l.knee.rotation.x=(knee-(l.lower-l.upper))*blend;l.paw.rotation.x=-l.hip.rotation.x-l.knee.rotation.x;
  }
  tailBones.forEach((b,i)=>b.rotation.set(Math.sin(time*1.3-i*.32)*.018,Math.sin(time*1.7-i*.40)*(.035+i*.004),0));
  root.updateMatrixWorld(true);
 }
 update(0,{immediate:true});
 function clips(){const result=[];for(const motion of ['idle','walk','run']){const duration=motion==='idle'?4.8:motion==='walk'?.9:.58,times=[],samples=new Map(bones.map(b=>[b,[]])),positions=[];
  for(let i=0;i<=48;i++){const t=i/48*duration,phase=i/48*Math.PI*2;times.push(t);update(t,{motion,immediate:true});
   head.rotation.set(Math.sin(phase)*.025,Math.sin(phase)*.075,Math.sin(phase)*.015);ears.forEach((b,n)=>b.rotation.set(Math.sin(phase+n)*.025,0,Math.sin(phase+n)*.025));tailBones.forEach((b,n)=>b.rotation.set(Math.sin(phase-n*.32)*.018,Math.sin(phase-n*.40)*(.035+n*.004),0));
   bones.forEach(b=>samples.get(b).push(...b.quaternion.toArray()));positions.push(...torso.position.toArray());
  }
  result.push(new THREE.AnimationClip(motion,duration,[new THREE.VectorKeyframeTrack('Torso.position',times,positions),...bones.map(b=>new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',times,samples.get(b)))]));
 }update(0,{immediate:true});return result;}
 return {root,update,joints:bones,tail:meshes[0],clips,source:'Meshy supplied FBX',dispose(){const materials=new Set();meshes.forEach(m=>{m.geometry.dispose();m.skeleton.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>materials.add(mat));});materials.forEach(m=>m.dispose());}};
}
