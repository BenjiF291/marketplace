import * as THREE from './vendor/three/three.module.js';
import {createFox} from './fox-3d-model.js?v=meshy2';

// One shared WebGL context serves every fox portrait. Individual rigs and clocks
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
 if(entries.has(host))return;const entry={host,visible:false,time:0,fox:null};entries.set(host,entry);observer.observe(host);
 try{if(!renderer)setup();const fox=await createFox();if(!host.isConnected){fox.dispose();entries.delete(host);return;}entry.fox=fox;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=420;canvas.setAttribute('aria-hidden','true');host.append(canvas);entry.context=canvas.getContext('2d');wake();
 }catch(error){host.dataset.modelError='true';console.error('Fox 3D portrait:',error);}
}
function wake(){if(!frame&&!stopped)frame=requestAnimationFrame(draw);}
function draw(now){frame=null;const dt=Math.min(.05,(now-last)/1000||1/30);last=now;let active=false;
 for(const [host,e] of entries){if(!host.isConnected){observer.unobserve(host);e.fox?.dispose();entries.delete(host);continue;}
  if(!e.fox||!e.visible||document.hidden||!host.getClientRects().length)continue;
  const paused=!!host.closest('.paused,.is-paused'),still=reduced.matches||paused;
  if(still&&e.painted)continue;active||=!still;
  if(!still)e.time+=dt;
  // Cap portraits at 24fps while the full viewer retains its own render loop.
  if(!still&&e.painted&&now-(e.lastDraw||0)<1000/24)continue;e.lastDraw=now;
  const mood=host.closest('[data-mood]')?.dataset.mood;
  const activity=host.closest('[data-activity]')?.dataset.activity;
  const motion=host.closest('.moving,.is-walking')||mood==='fetch'||activity==='walk'?'walk':mood==='dance'||activity==='play'?'run':'idle';
  const island=host.closest('.island-pet');
  e.fox.update(e.time,{motion:still?'idle':motion,dt,pace:Number(island?.dataset.motionPace)||1});
  if(island&&island.dataset.heading!==undefined){const desired=Math.atan2(camera.position.x,camera.position.z)+Number(island.dataset.heading);const delta=Math.atan2(Math.sin(desired-e.fox.root.rotation.y),Math.cos(desired-e.fox.root.rotation.y));e.fox.root.rotation.y+=delta*(1-Math.exp(-8*(now-(e.lastPose||now-40))/1000));}
  else e.fox.root.rotation.y=mood==='pet'?.12:0;
  e.lastPose=now;
  scene.add(e.fox.root);renderer.render(scene,camera);scene.remove(e.fox.root);
  e.context.clearRect(0,0,512,420);e.context.drawImage(renderer.domElement,0,0);e.painted=true;host.dataset.modelReady='true';
 }
 if(active)wake();
}
let queued=false;
function scan(){queued=false;document.querySelectorAll('[data-fox-3d]').forEach(mount);for(const [host,e] of entries)if(!host.isConnected){observer.unobserve(host);e.fox?.dispose();entries.delete(host);}wake();}
const mutations=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(scan);}});mutations.observe(document.body,{childList:true,subtree:true});scan();
document.addEventListener('visibilitychange',wake);reduced.addEventListener('change',()=>{entries.forEach(e=>e.painted=false);wake();});
window.addEventListener('pagehide',event=>{if(event.persisted)return;stopped=true;cancelAnimationFrame(frame);mutations.disconnect();observer.disconnect();entries.forEach(e=>e.fox?.dispose());renderer?.dispose();});
window.companion3D={entries,renderer:()=>renderer};
