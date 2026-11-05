import * as THREE from './vendor/three/three.module.js';
import {BrawlArena} from './creature-brawl-arena.js?v=dragon-import1';
import {attackStudy,installStudy,repairStudyChest} from './dragon-melee-study.js';

const $=id=>document.getElementById(id),status=$('status'),timeline=$('timeline');
const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
if(!local){status.textContent='This development preview is available on localhost only.';throw Error('Development preview only');}
const url=new URL(location.href);url.searchParams.set('brawlDragonRig','embedded');history.replaceState(null,'',url);
let arena,actor,study=structuredClone(attackStudy),player,playing=false,progress=0,last=0,frame;
$('poses').value=JSON.stringify(study,null,2);

function sample(p){
 progress=THREE.MathUtils.clamp(p,0,1);player.seek(progress);
 if($('parent').checked)arena.poseAttack(actor,progress);
 else{actor.motion.position.set(0,0,0);actor.motion.rotation.set(0,0,0);actor.facing.rotation.y=actor.homeYaw;}
 arena.paint();timeline.value=String(Math.round(progress*1000));
 const phase=[...study.frames].reverse().find(f=>progress>=f.t);
 $('phase').textContent=`${(progress*study.duration).toFixed(2)} s · ${phase?.label||'Pose'}`;
}
function pause(){playing=false;$('play').textContent='Play';}
function loop(now){const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
 if(playing){sample(progress+dt*Number($('speed').value)/study.duration);if(progress>=1)pause();}
 frame=requestAnimationFrame(loop);
}
function view(){
 sample(0);const box=new THREE.Box3().setFromObject(actor.model.root,true),sphere=box.getBoundingSphere(new THREE.Sphere());
 const vectors={arena:[.8,.42,-1],side:[1,.30,.08],front:[.03,.27,-1]},direction=new THREE.Vector3(...vectors[$('view').value]).normalize();
 const fov=THREE.MathUtils.degToRad(arena.camera.fov/2),distance=sphere.radius/Math.sin(fov)*1.12/Math.min(1,arena.camera.aspect);
 arena.camera.position.copy(sphere.center).addScaledVector(direction,distance);arena.camera.lookAt(sphere.center);arena.camera.updateMatrixWorld();arena.paint();
}
function apply(value){actor.combat?.dispose();study=structuredClone(value);player=installStudy(actor,study);actor.moveId=actor.unit.moves[0].id;actor.spec=actor.combat.set.actions.get(actor.moveId);actor.contactPosition=new THREE.Vector3();actor.attackYaw=actor.homeYaw;actor.attackTurn=0;actor.direction=new THREE.Vector3(Math.sin(actor.homeYaw),0,Math.cos(actor.homeYaw));sample(0);}

// Read-only diagnostics on this rig and this attack, not a claim of visual quality.
function inspect(){
 const bones=actor.model.joints,meshes=[];actor.model.root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 let vertices=0,badSums=0,worstEdge=null;const baseline=[],ratios=[],support=new Map(),supportError={},maxDisplacement={value:0};
 $('parent').checked=false;sample(0);
 for(const bone of bones.filter(b=>/^Leg_[123]_paw$/.test(b.name))){support.set(bone.name,bone.getWorldPosition(new THREE.Vector3()));supportError[bone.name]=0;}
 function capture(){actor.model.root.updateMatrixWorld(true);return meshes.map(mesh=>{const out=[],p=new THREE.Vector3();
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){p.fromBufferAttribute(mesh.geometry.attributes.position,i);mesh.applyBoneTransform(i,p);out.push(p.clone());}return out;});}
 for(const mesh of meshes){const weights=mesh.geometry.attributes.skinWeight;vertices+=weights.count;for(let i=0;i<weights.count;i++)if(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)>1e-4)badSums++;}
 baseline.push(...capture());
 for(let step=0;step<=30;step++){
  sample(step/30);const current=capture();
  for(const bone of bones.filter(b=>support.has(b.name)))supportError[bone.name]=Math.max(supportError[bone.name],bone.getWorldPosition(new THREE.Vector3()).distanceTo(support.get(bone.name)));
  meshes.forEach((mesh,m)=>{const index=mesh.geometry.index,count=index?.count||current[m].length;
   for(let i=0;i<current[m].length;i+=5)maxDisplacement.value=Math.max(maxDisplacement.value,current[m][i].distanceTo(baseline[m][i]));
   for(let i=0;i<count-2;i+=15){for(const [a,b] of [[i,i+1],[i+1,i+2],[i+2,i]]){const x=index?index.getX(a):a,y=index?index.getX(b):b,rest=baseline[m][x].distanceTo(baseline[m][y]);if(rest>.005){const ratio=current[m][x].distanceTo(current[m][y])/rest;ratios.push(ratio);if(!worstEdge||ratio>worstEdge.ratio){const influences=v=>{const j=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;return [0,1,2,3].map(k=>({bone:mesh.skeleton.bones[j.getComponent(v,k)]?.name,weight:w.getComponent(v,k)})).filter(i=>i.weight>0);};worstEdge={ratio,time:step/30,restLength:rest,restPoints:[baseline[m][x].toArray(),baseline[m][y].toArray()],influences:[influences(x),influences(y)]};}}}}
  });
 }
 sample(1);const end=capture();let recoveryError=0;end.forEach((points,m)=>points.forEach((p,i)=>recoveryError=Math.max(recoveryError,p.distanceTo(baseline[m][i]))));
 ratios.sort((a,b)=>a-b);$('parent').checked=true;sample(0);
 return {source:'Existing dragon-meshy-rigged.glb; no regenerated skeleton or weight conditioning',bones:bones.map(b=>({name:b.name,parent:b.parent?.name})),vertices,unnormalizedWeights:badSums,embeddedClips:actor.clips.map(c=>c.name),missingJoints:['spine','jaw','individual toes'],attackDuration:study.duration,contact:study.contact,poseOnlySupportingPawDrift:supportError,exactRecoveryMaxVertexError:recoveryError,sampledEdgeRatios:{p99:ratios[Math.floor(ratios.length*.99)],maximum:ratios.at(-1)},worstEdge,maxSampledVertexMovement:maxDisplacement.value,notes:['Normalized weights do not establish good anatomical weighting.','Current production claw asks for ~43 degree anticipation plus torso twist; conservative clamps can then flatten the motion.','The prior imported walk/run/fly study also deforms, independently of production attack code.','This test uses a fixed torso and three support chains. Linear blend skinning can still shear around the moving shoulder.','Pose-only paw stability excludes the existing whole-body parent lunge/lean.','No root translation or scale tracks; parent movement occurs once through BrawlArena.poseAttack.']};
}

try{
 arena=new BrawlArena($('stage'),{onError:text=>status.textContent=text});
 const c=window.CreatureBrawlCatalog.creatures.find(c=>c.id==='dragon');
 await arena.sync([{...c,id:'study-dragon',kind:'dragon',team:0,slot:1,hp:c.base.hp,maxHP:c.base.hp}],'study-dragon');
 actor=arena.actors.get('study-dragon');if(!actor?.model?.importedAnimations)throw Error('The rigged GLB did not load. Preview stopped rather than using the procedural fallback.');
 cancelAnimationFrame(arena.frame);actor.mixer.stopAllAction();actor.model.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.pose();});
 actor.homeYaw=actor.facing.rotation.y;apply(study);const beforeRepair=inspect(),repair=repairStudyChest(actor.model),report=inspect();
 report.source='Existing rigged GLB with a preview-only central chest weight correction';report.beforeRepair={sampledEdgeRatios:beforeRepair.sampledEdgeRatios,worstEdge:beforeRepair.worstEdge};report.repair=repair;
 $('diagnostics').textContent=JSON.stringify(report,null,2);view();
 for(const id of ['play','replay','apply','restore','download'])$(id).disabled=false;
 $('play').onclick=()=>{if(playing)pause();else{if(progress===1)sample(0);playing=true;$('play').textContent='Pause';}};
 $('replay').onclick=()=>{sample(0);playing=true;$('play').textContent='Pause';};
 timeline.oninput=()=>{pause();sample(Number(timeline.value)/1000);};
 $('parent').onchange=()=>{pause();sample(progress);};$('view').onchange=()=>{pause();view();};
 $('apply').onclick=()=>{pause();try{const value=JSON.parse($('poses').value);const {validateStudy}=window.dragonMeleeStudy;validateStudy(value,actor.model.joints);apply(value);status.textContent='Edited poses applied. Replay or scrub to review.';}catch(error){status.textContent=error.message;}};
 $('restore').onclick=()=>{pause();$('poses').value=JSON.stringify(attackStudy,null,2);apply(attackStudy);status.textContent='Original study restored.';};
 $('download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(study,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='pocket-dragon-claw-poses.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const {validateStudy}=await import('./dragon-melee-study.js');
 window.dragonMeleeStudy={arena,actor,report,sample,validateStudy,get progress(){return progress;},get playing(){return playing;}};
 status.textContent='Ready for visual review. Play at 0.25×, scrub contact, and compare pose-only motion.';frame=requestAnimationFrame(loop);
 // Arena resize remains authoritative for actor scale; then reframe this single-creature view.
 window.addEventListener('resize',()=>{pause();requestAnimationFrame(view);});
}catch(error){status.textContent='Preview unavailable: '+error.message;console.error(error);}
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);arena?.dispose();},{once:true});
