import {heightMetres,stableHeight} from './creature-sizes.js?v=1';
import {truskSurface,addTruskPlatform} from './trusk-platform.js?v=1';
import {kanjiSurface,addKanjiPlatform} from './kanji-platform.js?v=1';
import {velkrisSurface,addVelkrisPlatform} from './velkris-platform.js?v=1';
import {fenraSurface,addFenraPlatform} from './fenra-platform.js?v=1';
import {krynnSurface,addKrynnPlatform} from './krynn-platform.js?v=1';
import {veyrinSurface,addVeyrinPlatform} from './veyrin-platform.js?v=1';
import {talrenSurface,addTalrenPlatform} from './talren-platform.js?v=1';
import {addRillRoost} from './rill-roost.js?v=1';
import {platformTheme,platformSurface,decoratePlatform} from './stable-platform-themes.js?v=trusk-platform1';
import * as THREE from './vendor/three/three.module.js';

// The resident and its pedestal share one camera, lighting and shadow map.
export function createStableDais(model,kind) {
 model.root.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(model.root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const radius=1.65,ground=0;
 // Shared real-height conversion: do not enlarge small species to fill their stall.
 // Wings and tails may overhang the fixed pedestal, like the reference chart.
 const scale=stableHeight(kind)/Math.max(size.y,.001);
 model.root.scale.multiplyScalar(scale);
 model.root.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
 model.root.updateMatrixWorld(true);
 const root=new THREE.Group();root.userData.heightMetres=heightMetres(kind);root.userData.displayHeight=stableHeight(kind);root.name='Stable display platform';root.position.set(0,ground-.025,0);
 const theme=platformTheme(kind),surfaceTexture=theme.type==='trusk-mosswood'?truskSurface():theme.type==='kanji-heather'?kanjiSurface():theme.type==='velkris-web'?velkrisSurface():theme.type==='fenra-meadow'?fenraSurface():theme.type==='krynn-woodland'?krynnSurface():theme.type==='veyrin-basalt'?veyrinSurface():theme.type.startsWith('talren-')?talrenSurface(theme.type==='talren-snow'):platformSurface(theme);root.userData.platformTheme=theme.name;
 const stone=new THREE.MeshStandardMaterial({color:theme.base,roughness:.93}),edge=new THREE.MeshStandardMaterial({color:theme.rim,metalness:theme.type==='fort'?.48:.08,roughness:.65}),wood=new THREE.MeshStandardMaterial({map:surfaceTexture,roughness:.95});
 function cylinder(r1,r2,height,y,material){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,height,64),material);mesh.position.y=y;mesh.receiveShadow=true;mesh.castShadow=true;root.add(mesh);return mesh;}
 cylinder(radius,radius*1.04,.28,-.19,stone);
 cylinder(radius*1.04,radius*1.10,.12,-.39,stone);
 cylinder(radius*1.015,radius*1.015,.065,-.04,edge);
 cylinder(radius*.97,radius*.97,.05,-.015,wood);
 if(kind==='rill-species')addRillRoost(root,radius);else if(theme.type.startsWith('talren-'))addTalrenPlatform(root,radius,theme.type==='talren-snow');else if(theme.type==='veyrin-basalt')addVeyrinPlatform(root,radius);else if(theme.type==='krynn-woodland')addKrynnPlatform(root,radius);else if(theme.type==='fenra-meadow')addFenraPlatform(root,radius);else if(theme.type==='velkris-web')addVelkrisPlatform(root,radius);else if(theme.type==='kanji-heather')addKanjiPlatform(root,radius);else if(theme.type==='trusk-mosswood')addTruskPlatform(root,radius);else decoratePlatform(root,theme,radius);
 // Soft grounding beneath the stone base makes its contact with the stable floor visible.
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const context=canvas.getContext('2d'),gradient=context.createRadialGradient(64,64,15,64,64,64);
 gradient.addColorStop(0,'#000b');gradient.addColorStop(.55,'#0008');gradient.addColorStop(1,'#0000');context.fillStyle=gradient;context.fillRect(0,0,128,128);
 const shadowTexture=new THREE.CanvasTexture(canvas),shadow=new THREE.Mesh(new THREE.PlaneGeometry(radius*3,radius*3),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));
 shadow.rotation.x=-Math.PI/2;shadow.position.y=-.455;root.add(shadow);
 // Fixed framing prevents the platform changing apparent size between residents.
 const viewBounds=new THREE.Box3(new THREE.Vector3(-radius*1.1,-.5,-radius*1.1),new THREE.Vector3(radius*1.1,2.85,radius*1.1));
 return {root,bounds:viewBounds,creatureHeight:size.y*scale,dispose(){const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);if(o.isInstancedMesh)o.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());shadowTexture.dispose();surfaceTexture.dispose();}};
}

export function frameStableDais(camera,dais){
 const sphere=dais.bounds.getBoundingSphere(new THREE.Sphere());
 let distance=sphere.radius/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))*.80;
 const focus=sphere.center.clone();focus.y-=.35;
 if(camera.aspect>2||matchMedia('(max-width:650px)').matches){focus.set(0,dais.creatureHeight*.45,0);distance=(Math.max(1.3,dais.creatureHeight)+.6)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.05;}
 camera.position.copy(focus).add(new THREE.Vector3(.65,.34,1).normalize().multiplyScalar(distance));
 camera.lookAt(focus);camera.updateMatrixWorld();
}
