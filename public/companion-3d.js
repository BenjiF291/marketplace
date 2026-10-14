import * as THREE from './vendor/three/three.module.js';
import {createTalren} from './talren-3d-model.js?v=talren1';
import {createTharos} from './tharos-3d-model.js?v=tharos1';
import {createVeyrin} from './veyrin-3d-model.js?v=kael1';
import {createFenra} from './fenra-3d-model.js?v=saelis1';
import {createKrynn} from './krynn-3d-model.js?v=virex1';
import {createBrugar} from './brugar-3d-model.js?v=brakk1';
import {createRill} from './rill-3d-model.js?v=rill1';
import {createSnail} from './snail-3d-model.js?v=snail1';
import {createDragon} from './dragon-3d-model.js?v=dragon1';
import {createFox} from './fox-3d-model.js?v=meshy3';

// One shared WebGL context serves every 3D companion portrait. Individual rigs and clocks
// keep companion interactions independent; hidden portraits do no rendering.
const entries=new Map();let renderer,scene,camera,frame,last=0,stopped=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function setup(){
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(512,420);renderer.setClearColor(0,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#fff4df','#586852',2));
 const light=new THREE.DirectionalLight('#ffe1b4',2.4);light.position.set(-3,6,5);light.castShadow=true;light.shadow.mapSize.set(512,512);Object.assign(light.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:15});light.shadow.normalBias=.035;scene.add(light);
 const rim=new THREE.DirectionalLight('#d1e7ff',1.1);rim.position.set(3,4,-4);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.ShadowMaterial({opacity:.16}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
 camera=new THREE.PerspectiveCamera(34,512/420,.1,30);camera.position.set(3.7,2.7,4.7);camera.lookAt(0,1.2,0);
}
const observer=new IntersectionObserver(items=>{for(const item of items){const e=entries.get(item.target);if(e)e.visible=item.isIntersecting;}wake();});
async function mount(host){
 if(entries.has(host))return;const entry={host,visible:false,time:0,model:null,fox:null,dragon:null,snail:null,kind:host.dataset.species};entries.set(host,entry);observer.observe(host);
 try{if(!renderer)setup();const model=await (entry.kind==='talren'?createTalren():entry.kind==='tharos'?createTharos():entry.kind==='veyrin'?createVeyrin():entry.kind==='fenra'?createFenra():entry.kind==='krynn'?createKrynn():entry.kind==='brugar'?createBrugar():entry.kind==='rill'?createRill():entry.kind==='dragon'?createDragon():entry.kind==='snail'?createSnail():createFox());if(!host.isConnected){model.dispose();entries.delete(host);return;}entry.model=model;entry[entry.kind]=model;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=420;canvas.setAttribute('aria-hidden','true');host.append(canvas);entry.context=canvas.getContext('2d');wake();
 }catch(error){host.dataset.modelError='true';console.error('Companion 3D portrait:',error);}
}
function wake(){if(!frame&&!stopped)frame=requestAnimationFrame(draw);}
function draw(now){frame=null;const dt=Math.min(.05,(now-last)/1000||1/30);last=now;let active=false;
 for(const [host,e] of entries){if(!host.isConnected){observer.unobserve(host);e.model?.dispose();entries.delete(host);continue;}
  if(!e.model||!e.visible||document.hidden||!host.getClientRects().length)continue;
  const paused=!!host.closest('.paused,.is-paused'),still=reduced.matches||paused;
  if(still&&e.painted)continue;active||=!still;
  if(!still)e.time+=dt;
  // Cap portraits at 24fps while the full viewer retains its own render loop.
  if(!still&&e.painted&&now-(e.lastDraw||0)<1000/24)continue;e.lastDraw=now;
  const mood=host.closest('[data-mood]')?.dataset.mood;
  const activity=host.closest('[data-activity]')?.dataset.activity;
  let motion=host.closest('.moving,.is-walking')||mood==='fetch'||activity==='walk'?'walk':mood==='dance'||activity==='play'?'run':'idle';
  const island=host.closest('.island-pet');
  const dragon=e.kind==='dragon';if(dragon&&island&&motion==='walk')motion='fly';
  const veyrin=e.kind==='veyrin'||e.kind==='tharos',krynn=e.kind==='krynn',brugar=e.kind==='brugar';camera.position.set(veyrin?0:krynn?.5:brugar?4.8:dragon?4.5:3.7,island?(dragon?6.2:5.2):(brugar?3.0:dragon?3.0:2.7),veyrin||krynn?7.0:brugar?6.0:dragon?5.8:4.7);camera.lookAt(0,veyrin||krynn||brugar?1.0:dragon?1.3:1.2,0);camera.updateMatrixWorld();
  if(island&&island.dataset.heading!==undefined){const direction=Number(island.dataset.heading),pitch=Math.atan2(camera.position.y-(dragon?1.3:1.2),Math.hypot(camera.position.x,camera.position.z));const desired=Math.atan2(camera.position.x,camera.position.z)+Math.atan2(Math.sin(direction)*Math.sin(pitch)*camera.aspect*island.offsetHeight,Math.cos(direction)*island.offsetWidth);const delta=Math.atan2(Math.sin(desired-e.model.root.rotation.y),Math.cos(desired-e.model.root.rotation.y));e.model.root.rotation.y+=delta*(1-Math.exp(-8*(now-(e.lastPose||now-40))/1000));}
  else e.model.root.rotation.y=mood==='pet'?.12:0;
  e.lastPose=now;
  let travelDistance;
  if(island){const distance=Number(island.dataset.walkDistance)||0,delta=e.walkDistance===undefined?0:Math.max(0,distance-e.walkDistance);e.walkDistance=distance;
   // Convert actual map displacement to model units using this view's projected
   // ground scale. Gait advances by distance, so planted paws do not slide.
   const yaw=e.model.root.rotation.y,a=new THREE.Vector3(0,0,0).project(camera),b=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)).project(camera);
   const pixelsPerUnit=Math.hypot((b.x-a.x)*island.offsetWidth/2,(b.y-a.y)*island.offsetHeight/2);
   travelDistance=delta/Math.max(.5,pixelsPerUnit);
  }
  e.model.update(e.time,{motion:still?'idle':motion,dt,travelDistance});
  scene.add(e.model.root);renderer.render(scene,camera);scene.remove(e.model.root);
  e.context.clearRect(0,0,512,420);e.context.drawImage(renderer.domElement,0,0);e.painted=true;host.dataset.modelReady='true';
 }
 if(active)wake();
}
let queued=false;
function scan(){queued=false;document.querySelectorAll('[data-fox-3d],[data-dragon-3d],[data-snail-3d],[data-rill-3d],[data-brugar-3d],[data-krynn-3d],[data-fenra-3d],[data-veyrin-3d],[data-tharos-3d],[data-talren-3d]').forEach(mount);for(const [host,e] of entries)if(!host.isConnected){observer.unobserve(host);e.model?.dispose();entries.delete(host);}wake();}
const mutations=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(scan);}});mutations.observe(document.body,{childList:true,subtree:true});scan();
document.addEventListener('visibilitychange',wake);reduced.addEventListener('change',()=>{entries.forEach(e=>e.painted=false);wake();});
window.addEventListener('pagehide',event=>{if(event.persisted)return;stopped=true;cancelAnimationFrame(frame);mutations.disconnect();observer.disconnect();entries.forEach(e=>e.model?.dispose());renderer?.dispose();});
window.companion3D={entries,renderer:()=>renderer};
