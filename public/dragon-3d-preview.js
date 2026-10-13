import * as THREE from './vendor/three/three.module.js';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {createDragon} from './dragon-3d-model.js?v=dragon1';
if(new URLSearchParams(location.search).has('embedded'))document.documentElement.dataset.embedded='true';
const host=document.getElementById('dragonCanvas'),loading=document.getElementById('loading'),status=document.getElementById('status');
try{
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio*1.5,2.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;host.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#283e36');scene.fog=new THREE.Fog('#283e36',10,24);
 const camera=new THREE.PerspectiveCamera(36,1,.1,50);camera.position.set(4.7,3.1,5.4);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.1,-.35);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=3;controls.maxDistance=12;controls.maxPolarAngle=Math.PI*.48;controls.minPolarAngle=.2;controls.autoRotateSpeed=1.4;
 scene.add(new THREE.HemisphereLight('#fff0cf','#314f36',1.8));const key=new THREE.DirectionalLight('#ffdea2',2.4);key.position.set(-3,6,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.1,far:20});key.shadow.normalBias=.025;scene.add(key);const rim=new THREE.DirectionalLight('#b6dce2',1.4);rim.position.set(3,4,-4);scene.add(rim);
 const ground=new THREE.Mesh(new THREE.CircleGeometry(14,80),new THREE.MeshStandardMaterial({color:'#697655',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const ring=new THREE.Mesh(new THREE.RingGeometry(2.8,2.83,80),new THREE.MeshStandardMaterial({color:'#a0a276',roughness:1,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.006;scene.add(ring);
 let seed=27;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<32;i++){const angle=i/32*Math.PI*2,radius=10+random()*3;const tree=new THREE.Group();tree.position.set(Math.cos(angle)*radius,0,Math.sin(angle)*radius);const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.04,.07,1,7),new THREE.MeshStandardMaterial({color:'#514331',roughness:1}));trunk.position.y=.5;tree.add(trunk);for(let n=0;n<3;n++){const crown=new THREE.Mesh(new THREE.ConeGeometry(.7-n*.13,1.2,9),new THREE.MeshStandardMaterial({color:['#314d35','#3c583d','#49634b'][n],roughness:1}));crown.position.y=1+n*.38;crown.castShadow=true;tree.add(crown);}tree.scale.setScalar(.7+random()*.7);scene.add(tree);}
 const dragon=await createDragon();scene.add(dragon.root);let motion='idle',paused=false,exporting=false,time=0,distance=0,heading=0,last=performance.now();const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const setMotion=value=>{motion=value;document.querySelectorAll('[data-motion]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.motion===value)));status.textContent=value==='idle'?'A watchful head, breathing wings, and a gentle tail sway.':value==='walk'?'Walking on four articulated feet.':value==='fly'?'Wingbeats, tucked legs, and a lifted body.':'A faster gait with the same continuous rig.';};
 document.getElementById('motion').onclick=e=>{const b=e.target.closest('[data-motion]');if(b)setMotion(b.dataset.motion);};
 const views={threequarter:[4.7,3.1,5.4],front:[0,2.4,7],side:[7,2.3,-.3],back:[0,2.5,-7]};
 document.getElementById('views').onclick=e=>{const b=e.target.closest('[data-view]');if(!b)return;camera.position.set(...views[b.dataset.view]);controls.target.set(0,1.1,-.35);controls.update();};
 document.getElementById('turntable').onchange=e=>controls.autoRotate=e.target.checked;
 document.getElementById('pause').onclick=e=>{paused=!paused;e.target.textContent=paused?'Resume':'Pause';e.target.setAttribute('aria-pressed',String(paused));};
 const resize=()=>{const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(host);resize();
 function animate(now){requestAnimationFrame(animate);const dt=Math.min(.05,(now-last)/1000);last=now;if(document.hidden)return;
  if(!paused&&!reduced.matches&&!exporting){time+=dt;if(motion!=='idle'&&document.getElementById('travel').checked){distance+=dt*(motion==='fly'?1.1:motion==='run'?1.03:.4923);const angle=distance/1.6;dragon.root.position.set(1.6*Math.sin(angle),0,1.6*Math.cos(angle)-1.6);const target=Math.PI/2+angle;heading+=Math.atan2(Math.sin(target-heading),Math.cos(target-heading))*Math.min(1,dt*6);dragon.root.rotation.y=heading;}}
  if(!exporting){dragon.update(time,{motion:reduced.matches?'idle':motion,dt,lookBack:document.getElementById('look').checked});}
  controls.update();renderer.render(scene,camera);
 }
 requestAnimationFrame(animate);loading.hidden=true;
 async function exportGLB(){
  const {GLTFExporter}=await import('./vendor/three/GLTFExporter.js');const exporter=new GLTFExporter();
  const position=dragon.root.position.clone(),rotation=dragon.root.quaternion.clone();exporting=true;
  try{const clips=dragon.clips();dragon.root.position.set(0,0,0);dragon.root.rotation.set(0,0,0);dragon.update(0,{immediate:true});return await exporter.parseAsync(dragon.root,{binary:true,animations:clips});}
  finally{dragon.root.position.copy(position);dragon.root.quaternion.copy(rotation);dragon.update(time,{motion,immediate:true});exporting=false;}
 }
 document.getElementById('export').onclick=async e=>{e.target.disabled=true;try{const result=await exportGLB();const url=URL.createObjectURL(new Blob([result],{type:'model/gltf-binary'}));const a=document.createElement('a');a.href=url;a.download='crystal-dragon.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='3D dragon exported with idle, walk, run, and fly animations.';}catch(error){status.textContent='Export failed: '+error.message;}finally{e.target.disabled=false;}};
 window.dragon3D={dragon,renderer,scene,camera,controls,setMotion,exportGLB,stats:()=>({triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,joints:dragon.joints.length,skinnedTail:dragon.tail.isSkinnedMesh}),pause:()=>{paused=true;},renderAt:t=>{time=t;dragon.update(t,{motion,immediate:true});renderer.render(scene,camera);}};
 window.addEventListener('pagehide',event=>{if(event.persisted)return;dragon.dispose();controls.dispose();renderer.dispose();});
}catch(error){loading.textContent='This 3D preview needs WebGL. '+error.message;console.error(error);}
