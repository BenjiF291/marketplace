import * as THREE from './vendor/three/three.module.js';

export function talrenSurface(snowy){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');
 ctx.fillStyle=snowy?'#e1e9e7':'#c09b62';ctx.fillRect(0,0,512,512);
 let seed=109;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<2400;i++){ctx.fillStyle=i%2?(snowy?'#ffffff60':'#ead0a634'):(snowy?'#829ca619':'#75563826');ctx.fillRect(random()*512,random()*512,1+random()*4,1+random()*3);}
 // Shallow clawed paw impressions, kept away from the animal's main standing area.
 for(const [x,y,angle] of [[143,340,-.3],[183,306,-.2],[348,168,.6]]){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=snowy?'#76919a65':'#76512965';
  ctx.beginPath();ctx.ellipse(0,3,8,6,0,0,7);ctx.fill();
  for(let n=0;n<4;n++){const tx=(n-1.5)*5;ctx.beginPath();ctx.ellipse(tx,-7-Math.sin(n)*2,2,3,-.2,0,7);ctx.fill();}
  ctx.restore();
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

export function addTalrenPlatform(root,radius,snowy=false){
 const stone=new THREE.MeshStandardMaterial({color:snowy?'#7a9199':'#ae9168',roughness:1});
 const stoneLight=new THREE.MeshStandardMaterial({color:snowy?'#a1b3b7':'#c4aa80',roughness:1});
 const snow=new THREE.MeshStandardMaterial({color:'#e6eeed',roughness:1});
 const wood=new THREE.MeshStandardMaterial({color:snowy?'#786d5d':'#85633f',roughness:1});
 const rope=new THREE.MeshStandardMaterial({color:snowy?'#acae9d':'#b69b6a',roughness:1});
 const grass=new THREE.MeshStandardMaterial({color:snowy?'#a5a48b':'#ba9854',roughness:1,side:THREE.DoubleSide});
 const leaves=new THREE.MeshStandardMaterial({color:snowy?'#829a90':'#73854c',roughness:1});
 const block=new THREE.DodecahedronGeometry(1,0),mound=new THREE.DodecahedronGeometry(1,1);
 const mesh=(geometry,material,position,scale)=>{const m=new THREE.Mesh(geometry,material);m.position.set(...position);if(scale)m.scale.set(...scale);m.castShadow=m.receiveShadow=true;root.add(m);return m;};
 for(let i=0;i<21;i++){
  const angle=i/21*Math.PI*2,r=radius*.94,x=Math.sin(angle)*r,z=Math.cos(angle)*r;
  const rock=mesh(block,i%3?stone:stoneLight,[x,-.14+(i%3)*.012,z],[.22+(i%3)*.012,.22,.23]);rock.rotation.y=angle+.2;
  if(snowy){const cap=mesh(mound,snow,[x,.015,z],[.22,.055+(i%2)*.012,.22]);cap.rotation.y=angle;}
 }
 // Low rear outcrops, leaving the entire front and central footing unobstructed.
 for(const [x,z,sx,sy,sz] of [[-.85,-1.04,.42,.30,.26],[.82,-1.03,.34,.22,.25]]){
  const rock=mesh(block,stoneLight,[x,.10,z],[sx,sy,sz]);rock.rotation.y=.3;
  if(snowy)mesh(mound,snow,[x,.10+sy*.76,z],[sx*.94,.075,sz*.94]);
 }
 const start=new THREE.Vector3(-.4,.09,-1.20),end=new THREE.Vector3(.5,.09,-1.20),direction=end.clone().sub(start);
 const log=mesh(new THREE.CylinderGeometry(.07,.09,direction.length(),7),wood,start.clone().add(end).multiplyScalar(.5).toArray());log.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
 for(const x of [-.28,.37]){const band=mesh(new THREE.TorusGeometry(.083,.014,5,12),rope,[x,.09,-1.20]);band.rotation.y=Math.PI/2;}
 if(snowy)mesh(mound,snow,[.04,.16,-1.20],[.40,.035,.085]);
 // Sparse golden grass and a small hardy shrub, as in the approved concept.
 for(let i=0;i<10;i++){
  const shape=new THREE.Shape(),height=.19+(i%4)*.045;shape.moveTo(0,0);shape.quadraticCurveTo(.025,height*.6,.08,height);shape.quadraticCurveTo(.008,height*.5,0,0);
  const blade=mesh(new THREE.ShapeGeometry(shape),grass,[-.53+(i%4)*.045,.015,-1.15-(i%3)*.035]);blade.rotation.y=i*.85;
 }
 for(let i=0;i<7;i++){
  const x=1.02+Math.sin(i*2.4)*.10,z=-.80+Math.cos(i*2.4)*.10,y=.14+(i%3)*.06;
  mesh(mound,leaves,[x,y,z],[.075,.065,.075]);
  if(snowy&&i%2===0)mesh(mound,snow,[x,y+.045,z],[.065,.025,.065]);
 }
 for(let i=0;i<6;i++){const a=1.9+i*.21;mesh(block,stoneLight,[Math.sin(a)*radius*.78,.015,Math.cos(a)*radius*.78],[.04,.03,.045]);}
 root.userData.talrenPlatform=snowy?'snow':'sand';
 // Discard materials/geometries not used by the sandy version.
 if(!snowy)snow.dispose();
}
