import * as THREE from './vendor/three/three.module.js';

export function fenraSurface(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#79885a';ctx.fillRect(0,0,512,512);let seed=127;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<5000;i++){
  const x=random()*512,y=random()*512;ctx.strokeStyle=['#b9bf7d66','#4c634d55','#9fa87066'][i%3];ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*3-1.5,y-random()*5-1);ctx.stroke();
 }
 for(let i=0;i<90;i++){ctx.fillStyle='#c1bf8155';ctx.beginPath();ctx.ellipse(random()*512,random()*512,2,1,random()*6,0,7);ctx.fill();}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

export function addFenraPlatform(root,radius){
 const limestone=new THREE.MeshStandardMaterial({color:'#bdbba5',roughness:1}),slate=new THREE.MeshStandardMaterial({color:'#a5a197',roughness:1}),moss=new THREE.MeshStandardMaterial({color:'#788452',roughness:1}),green=new THREE.MeshStandardMaterial({color:'#829556',roughness:1,side:THREE.DoubleSide}),ivory=new THREE.MeshStandardMaterial({color:'#e4dfcc',roughness:.98,side:THREE.DoubleSide}),gold=new THREE.MeshStandardMaterial({color:'#bea46c',roughness:1}),lavender=new THREE.MeshStandardMaterial({color:'#a3a0b8',roughness:1,side:THREE.DoubleSide});
 function mesh(geometry,material,position,scale){const m=new THREE.Mesh(geometry,material);if(position)m.position.set(...position);if(scale)m.scale.set(...scale);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
 function stem(points,width=.007){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),12,width,5,false),green);}
 const rock=new THREE.DodecahedronGeometry(1,0),patch=new THREE.DodecahedronGeometry(.10,1);
 for(let i=0;i<23;i++){
  const a=i/23*Math.PI*2,r=radius*.95,stone=mesh(rock,limestone,[Math.sin(a)*r,-.20,Math.cos(a)*r],[.20,.18,.21]);stone.rotation.y=a;
  if(i%2){const cover=mesh(patch,moss,[Math.sin(a)*r,-.035,Math.cos(a)*r],[1.2,.3,.75]);cover.rotation.y=a;}
 }
 // Broad embedded slabs form a flat hoof-friendly landing area.
 const slab=new THREE.CylinderGeometry(.47,.49,.018,9);
 for(const [x,z,angle,sx,sz] of [[-.60,-.18,.3,1,.79],[.59,-.14,-.2,1,.8],[0,.70,.7,1.12,.76]]){
  const stone=mesh(slab,slate,[x,.006,z],[sx,1,sz]);stone.rotation.y=angle;
 }
 const leafShape=new THREE.Shape();leafShape.moveTo(0,0);leafShape.quadraticCurveTo(.055,.015,.10,.08);leafShape.quadraticCurveTo(.025,.07,0,0);const leafGeometry=new THREE.ShapeGeometry(leafShape);
 for(const [x,z,rotation] of [[-1.04,-.82,-.7],[.99,-.84,.6]]){
  stem([[x,0,z],[x+.04,.17,z-.025],[x+.12,.34,z-.06]]);
  for(let i=0;i<6;i++)for(const side of [-1,1]){const leaf=mesh(leafGeometry,green,[x+.025+i*.014,.045+i*.042,z-.035],[side*(1-i*.07),1-i*.07,1]);leaf.rotation.set(-.22,rotation,side*.25);}
 }
 const petal=new THREE.SphereGeometry(.027,6,4),center=new THREE.SphereGeometry(.020,6,4);
 for(let i=0;i<11;i++){
  const a=2.02+i*.205,r=radius*(.83+(i%2)*.055),x=Math.sin(a)*r,z=Math.cos(a)*r,h=.13+(i%3)*.045;
  stem([[x,0,z],[x+.008,h,z]],.006);
  for(let n=0;n<5;n++){const p=mesh(petal,ivory,[x+Math.sin(n*1.256)*.03,h,z+Math.cos(n*1.256)*.03],[1,.35,1]);p.rotation.y=n;}
  mesh(center,gold,[x,h+.012,z],[.65,.3,.65]);
 }
 const bellGeometry=new THREE.ConeGeometry(.035,.065,6,1,true);
 for(const [x,z] of [[-1.16,-.59],[1.09,-.67]])for(let i=0;i<2;i++){
  const height=.28+i*.09,dx=(i?1:-1)*.075;
  stem([[x,0,z],[x,height*.75,z],[x+dx,height,z],[x+dx*1.3,height-.045,z]]);
  mesh(bellGeometry,lavender,[x+dx*1.3,height-.07,z]);
 }
 for(let i=0;i<2;i++){
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-.06,.09,-.09,.24,0,.34);shape.bezierCurveTo(.09,.24,.06,.09,0,0);
  const feather=mesh(new THREE.ShapeGeometry(shape),ivory,[.48+i*.15,.025,1.26-i*.035]);feather.rotation.set(-Math.PI/2,0,-.55+i*.13);
  const vein=mesh(new THREE.CylinderGeometry(.005,.005,.27,4),limestone,[.56+i*.15,.032,1.15-i*.035]);vein.rotation.set(Math.PI/2,0,-.55+i*.13);
 }
 root.userData.fenraPlatform='limestone-meadow';
}
