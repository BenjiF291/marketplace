import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';

// The supplied Meshy FBX is an unrigged mesh. This anatomical rig preserves its
// original geometry and UVs, assigning smooth weights in normalized model space.
let sourcePromise;
const smooth=THREE.MathUtils.smoothstep;
const vec=p=>new THREE.Vector3(...p);
export async function createDragon(){
 sourcePromise??=new GLTFLoader().loadAsync(new URL('./assets/companions/dragon-meshy-source.glb',import.meta.url).href);
 const asset=await sourcePromise;asset.scene.updateMatrixWorld(true);
 const root=new THREE.Group();root.name='Dragon_entity';
 const box=new THREE.Box3().setFromObject(asset.scene),height=box.max.y-box.min.y,scale=2.6/height,center=box.getCenter(new THREE.Vector3());
 const normalize=new THREE.Matrix4().makeTranslation(-center.x*scale,-box.min.y*scale,-center.z*scale).multiply(new THREE.Matrix4().makeScale(scale,scale,scale));
 const bones=[],rest=new Map();
 const bone=(name,point,parent)=>{const b=new THREE.Bone();b.name=name;const world=vec(point);b.position.copy(world);if(parent){const parentWorld=rest.get(parent);b.position.sub(parentWorld);parent.add(b);}else root.add(b);rest.set(b,world);bones.push(b);return b;};
 const torso=bone('Torso',[0,.90,.35]);
 const head=bone('Head_joint',[0,1.60,1.03],torso);
 const wings=[];
 for(const sign of [-1,1]){
  const label=sign<0?'left':'right';
  const shoulder=bone(`Wing_${label}_root`,[sign*.27,1.18,.66],torso);
  const elbow=bone(`Wing_${label}_elbow`,[sign*.46,1.49,.40],shoulder);
  const wrist=bone(`Wing_${label}_wrist`,[sign*.76,2.19,.53],elbow);
  const tip=bone(`Wing_${label}_tip`,[sign*1.15,2.23,-.48],wrist);
  wings.push({sign,bones:[shoulder,elbow,wrist,tip]});
 }
 const legs=[];
 for(let i=0;i<4;i++){
  const front=i<2,side=i%2?1:-1;
  const hip=bone(`Leg_${i}_hip`,[side*(front?.29:.34),front?.95:.96,front?1.10:0],torso);
  const knee=bone(`Leg_${i}_knee`,[side*(front?.44:.43),front?.48:.50,front?1.16:.15],hip);
  const paw=bone(`Leg_${i}_paw`,[side*(front?.49:.54),.13,front?1.50:0],knee);
  const a=rest.get(knee).clone().sub(rest.get(hip)),b=rest.get(paw).clone().sub(rest.get(knee));
  const upper=Math.atan2(-a.z,-a.y),lower=Math.atan2(-b.z,-b.y);
  legs.push({hip,knee,paw,front,upper,lower,l1:Math.hypot(a.y,a.z),l2:Math.hypot(b.y,b.z),kneeSign:Math.sign(lower-upper),foot:rest.get(paw).clone().sub(rest.get(hip)),walkPhase:[0,.5,.75,.25][i]*Math.PI*2,phase:i===0||i===3?0:Math.PI});
 }
 const tailPoints=[[0,.90,-.28],[0,.78,-.55],[0,.67,-.85],[0,.74,-1.14],[0,.97,-1.40],[0,1.25,-1.58],[0,1.58,-1.55]];
 const tailBones=tailPoints.map((p,i)=>bone(`Tail_bone_${i}`,p,i?bones.at(-1):torso));
 const index=b=>bones.indexOf(b),meshes=[];
 root.updateMatrixWorld(true);
 asset.scene.traverse(o=>{if(!o.isMesh)return;
  const geo=o.geometry.clone();geo.applyMatrix4(normalize.clone().multiply(o.matrixWorld));
  const positions=geo.attributes.position,indices=[],weights=[],p=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
   p.fromBufferAttribute(positions,i);const influences=new Map();const add=(b,w)=>{if(w>0)influences.set(index(b),(influences.get(index(b))||0)+w);};
   const wingWeight=smooth(p.y,1.12,1.46)*smooth(Math.abs(p.x),.46,.64)*(1-smooth(p.z,.72,.96));
   const wing=wings[p.x<0?0:1];
   const outer=smooth(Math.abs(p.x),.73,1.08),upper=smooth(p.y,1.46,2.08);
   add(wing.bones[0],wingWeight*(1-upper));add(wing.bones[1],wingWeight*upper*(1-outer));add(wing.bones[2],wingWeight*upper*outer*.75);add(wing.bones[3],wingWeight*upper*outer*.25);
   const available=1-wingWeight;
   const tailWeight=available*smooth(-p.z,.32,.68)*smooth(p.y,.28,.52)*(1-smooth(Math.abs(p.x),.20,.40));
   const headWeight=(available-tailWeight)*smooth(p.y,1.32,1.72)*smooth(p.z,.66,1.02);
   add(head,headWeight);
   if(tailWeight){let bestDistance=Infinity,t=0;for(let n=0;n<tailPoints.length-1;n++){
    const a=vec(tailPoints[n]),b=vec(tailPoints[n+1]),segment=b.clone().sub(a),u=THREE.MathUtils.clamp(p.clone().sub(a).dot(segment)/segment.lengthSq(),0,1),distance=p.distanceToSquared(a.addScaledVector(segment,u));if(distance<bestDistance){bestDistance=distance;t=n+u;}}
    const n=Math.min(tailBones.length-2,Math.floor(t));add(tailBones[n],tailWeight*(1-(t-n)));add(tailBones[n+1],tailWeight*(t-n));
   }
   const remaining=available-headWeight-tailWeight;
   const leg=legs[(p.z>.72?0:2)+(p.x<0?0:1)],hipPoint=rest.get(leg.hip),kneePoint=rest.get(leg.knee);
   const along=THREE.MathUtils.clamp((hipPoint.y-p.y)/(hipPoint.y-kneePoint.y),0,1);
   const radial=Math.hypot(p.x-THREE.MathUtils.lerp(hipPoint.x,kneePoint.x,along),p.z-THREE.MathUtils.lerp(hipPoint.z,kneePoint.z,along));
   const attachment=1-smooth(radial,.23,.43)*smooth(p.y,.51,.86);
   const legWeight=remaining*smooth(1.11-p.y,.10,.37)*attachment;
   const lowerWeight=1-smooth(p.y,.40,.59),pawWeight=1-smooth(p.y,.17,.29);
   add(leg.hip,legWeight*(1-lowerWeight));add(leg.knee,legWeight*lowerWeight*(1-pawWeight));add(leg.paw,legWeight*lowerWeight*pawWeight);add(torso,remaining-legWeight);
   const best=[...influences].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=best.reduce((s,p)=>s+p[1],0)||1;
   for(let j=0;j<4;j++){indices.push(best[j]?.[0]||0);weights.push((best[j]?.[1]||0)/sum);}
  }
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const materials=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const c=m.clone();c.side=THREE.FrontSide;for(const k of ['map','normalMap','roughnessMap','metalnessMap'])if(c[k])c[k].anisotropy=4;return c;});
  const skin=new THREE.SkinnedMesh(geo,Array.isArray(o.material)?materials:materials[0]);skin.name='Meshy_dragon_skin';skin.castShadow=skin.receiveShadow=true;root.add(skin);skin.bind(new THREE.Skeleton(bones));meshes.push(skin);
 });
 let blend=0,runBlend=0,flight=0,phase=0,previousTime=null,look=0;
 function update(time,{motion='idle',dt=1/60,immediate=false,lookBack=false,pace=1,travelDistance}={}){
  const elapsed=immediate?dt:THREE.MathUtils.clamp(previousTime===null?dt:time-previousTime,0,.15);previousTime=time;
  const walkTarget=motion==='walk'||motion==='run'?1:0;
  blend=immediate?walkTarget:THREE.MathUtils.damp(blend,walkTarget,6,elapsed);
  runBlend=immediate?(motion==='run'?1:0):THREE.MathUtils.damp(runBlend,motion==='run'?1:0,2.5,elapsed);
  flight=immediate?(motion==='fly'?1:0):THREE.MathUtils.damp(flight,motion==='fly'?1:0,4,elapsed);
  const stride=THREE.MathUtils.lerp(.32,.40,runBlend),stance=THREE.MathUtils.lerp(.65,.57,runBlend),frequency=THREE.MathUtils.lerp(1,1/.68,runBlend)*THREE.MathUtils.clamp(pace,.5,1.7);
  const advance=travelDistance===undefined?elapsed*frequency:Math.max(0,travelDistance)*stance/stride;
  phase=immediate?time*frequency*Math.PI*2:phase+advance*Math.PI*2;
  const groundBob=Math.sin(phase*2)*.004*blend,crouch=THREE.MathUtils.lerp(.11,.14,runBlend);
  torso.position.y=.90-crouch*blend+groundBob+flight*(.42+Math.sin(time*Math.PI*2/.8)*.018);
  torso.rotation.set(flight*.09,0,0);
  look=immediate?(lookBack?.4:0):THREE.MathUtils.damp(look,lookBack?.4:0,5,elapsed);
  head.rotation.set(Math.sin(time*1.2)*.009,look+Math.sin(time*.6)*.025,0);
  for(const l of legs){const ph=phase+THREE.MathUtils.lerp(l.walkPhase,l.phase,runBlend),cycle=((ph/(Math.PI*2))%1+1)%1;
   let offset,lift;if(cycle<stance){offset=stride*(.5-cycle/stance);lift=0;}else{const u=(cycle-stance)/(1-stance);offset=stride*(THREE.MathUtils.smootherstep(u,0,1)-.5);lift=THREE.MathUtils.lerp(.15,.20,runBlend)*Math.sin(Math.PI*u)**2;}
   const z=l.foot.z+offset*blend,y=l.foot.y+lift*blend+crouch*blend-groundBob;
   const reach=Math.sqrt(l.l1*l.l1+l.l2*l.l2+2*l.l1*l.l2*Math.cos(.32)),distance=THREE.MathUtils.clamp(Math.hypot(y,z),Math.abs(l.l1-l.l2)+.01,reach);
   const knee=l.kneeSign*Math.acos(THREE.MathUtils.clamp((distance*distance-l.l1*l.l1-l.l2*l.l2)/(2*l.l1*l.l2),-1,1));
   const hip=Math.atan2(-z,-y)-Math.atan2(l.l2*Math.sin(knee),l.l1+l.l2*Math.cos(knee));
   l.hip.rotation.x=(hip-l.upper)*blend*(1-flight)+(l.front?.65:-.18)*flight;
   l.knee.rotation.x=(knee-(l.lower-l.upper))*blend*(1-flight)+l.kneeSign*(l.front?.85:.70)*flight;
   l.paw.rotation.x=-l.hip.rotation.x-l.knee.rotation.x+flight*.12;
  }
  wings.forEach(({sign,bones},i)=>{
   const beat=Math.sin(time*Math.PI*2/.8),idle=Math.sin(time*1.1+i*.1)*.012;
   bones[0].rotation.set(flight*.03,0,sign*(idle+flight*(-.35+.25*beat)));
   bones[1].rotation.set(0,0,sign*flight*.045*Math.sin(time*Math.PI*2/.8-.3));
   bones[2].rotation.set(0,flight*.04*Math.sin(time*Math.PI*2/.8-.4),sign*flight*.035*Math.sin(time*Math.PI*2/.8-.5));
   bones[3].rotation.set(0,flight*.025*Math.sin(time*Math.PI*2/.8-.6),0);
  });
  tailBones.forEach((b,i)=>b.rotation.set(Math.sin(time*1.1-i*.25)*.005,Math.sin(time*1.3-i*.35)*(.008+i*.0015),0));
  root.updateMatrixWorld(true);
 }
 update(0,{immediate:true});
 function clips(){const result=[];for(const motion of ['idle','walk','run','fly']){const duration=motion==='idle'?4.8:motion==='walk'?1:motion==='run'?.68:.8,times=[],samples=new Map(bones.map(b=>[b,[]])),positions=[];
  for(let i=0;i<=64;i++){const t=i/64*duration,ph=i/64*Math.PI*2;times.push(t);update(t,{motion,immediate:true});
   head.rotation.set(Math.sin(ph)*.009,Math.sin(ph)*.025,0);tailBones.forEach((b,n)=>b.rotation.set(Math.sin(ph-n*.25)*.005,Math.sin(ph-n*.35)*(.008+n*.0015),0));
   wings.forEach(({sign,bones},n)=>bones[0].rotation.z=sign*(Math.sin(ph+n*.1)*.012+(motion==='fly'?-.35+.25*Math.sin(ph):0)));
   bones.forEach(b=>samples.get(b).push(...b.quaternion.toArray()));positions.push(...torso.position.toArray());
  }
  result.push(new THREE.AnimationClip(motion,duration,[new THREE.VectorKeyframeTrack('Torso.position',times,positions),...bones.map(b=>new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',times,samples.get(b)))]));
 }update(0,{immediate:true});return result;}
 return {root,update,joints:bones,tail:meshes[0],clips,wings,source:'Meshy supplied dragon FBX',dispose(){const materials=new Set();meshes.forEach(m=>{m.geometry.dispose();m.skeleton.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>materials.add(mat));});materials.forEach(m=>m.dispose());}};
}
