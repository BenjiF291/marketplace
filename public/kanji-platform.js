import * as THREE from './vendor/three/three.module.js';
import {veyrinSurface} from './veyrin-platform.js?v=2';

export const kanjiSurface=()=>veyrinSurface({stones:9,seedValue:211});

export function addKanjiPlatform(root,radius){
 const slate=new THREE.MeshStandardMaterial({color:'#827d78',roughness:1}),edge=new THREE.MeshStandardMaterial({color:'#6d7068',roughness:1}),moss=new THREE.MeshStandardMaterial({color:'#737c4b',roughness:1}),grass=new THREE.MeshStandardMaterial({color:'#b3af8f',roughness:1,side:THREE.DoubleSide}),stemMaterial=new THREE.MeshStandardMaterial({color:'#69714b',roughness:1}),heather=new THREE.MeshStandardMaterial({color:'#886681',roughness:1}),featherMaterial=new THREE.MeshStandardMaterial({color:'#344858',roughness:.95,side:THREE.DoubleSide});
 function mesh(geometry,material,position,scale){const m=new THREE.Mesh(geometry,material);if(position)m.position.set(...position);if(scale)m.scale.set(...scale);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
 const block=new THREE.DodecahedronGeometry(1,0),patch=new THREE.DodecahedronGeometry(.10,1);
 for(let i=0;i<22;i++){
  const a=i/22*Math.PI*2,r=radius*.95,stone=mesh(block,i%3?edge:slate,[Math.sin(a)*r,-.19,Math.cos(a)*r],[.21,.19,.22]);stone.rotation.y=a;
 }
 const ledge=mesh(new THREE.CylinderGeometry(.41,.45,.075,7),slate,[0,.04,-1.16],[1.25,1,.59]);ledge.rotation.y=.3;
 for(let i=0;i<13;i++){const a=2.0+i*.19,r=radius*.94,p=mesh(patch,moss,[Math.sin(a)*r,-.018,Math.cos(a)*r],[1.15,.27,.8]);p.rotation.y=a;}
 for(const [x,z] of [[-1.04,-.84],[1.03,-.87]])for(let i=0;i<9;i++){
  const h=.19+(i%4)*.035,shape=new THREE.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(.012,h*.65,.085,h);shape.quadraticCurveTo(.018,h*.5,0,0);
  const blade=mesh(new THREE.ShapeGeometry(shape),grass,[x+(i%3)*.026,.015,z]);blade.rotation.y=i*.8;
 }
 // Small heather blossoms share one draw call, keeping the rim detail light.
 const blooms=new THREE.InstancedMesh(new THREE.SphereGeometry(.019,5,4),heather,144),matrix=new THREE.Object3D();let index=0;
 for(const [x,z] of [[-1.26,-.52],[1.24,-.54]])for(let stalk=0;stalk<8;stalk++){
  const sx=x+Math.sin(stalk*2.4)*.095,sz=z+Math.cos(stalk*2.4)*.08,h=.13+(stalk%3)*.035;
  const line=new THREE.CatmullRomCurve3([new THREE.Vector3(sx,.01,sz),new THREE.Vector3(sx+.015,h*.6,sz),new THREE.Vector3(sx+.035,h,sz)]);
  mesh(new THREE.TubeGeometry(line,6,.006,4,false),stemMaterial);
  for(let flower=0;flower<9;flower++){
   matrix.position.set(sx+.015+Math.sin(flower*2.4)*.016,h*.38+flower*h*.065,sz+Math.cos(flower*2.4)*.016);matrix.scale.set(1,.72,1);matrix.updateMatrix();blooms.setMatrixAt(index++,matrix.matrix);
  }
 }
 blooms.castShadow=blooms.receiveShadow=true;root.add(blooms);
 for(let i=0;i<3;i++){
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-.055,.09,-.07,.22,0,.32);shape.bezierCurveTo(.07,.22,.055,.09,0,0);
  const feather=mesh(new THREE.ShapeGeometry(shape),featherMaterial,[.49+i*.11,.022,1.24-i*.03]);feather.rotation.set(-Math.PI/2,0,-.50+i*.13);
 }
 root.userData.kanjiPlatform='slate-heather-lookout';
}
