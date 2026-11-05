import * as THREE from './vendor/three/three.module.js';

// Valemere's stone terrace, matching the lobby's ruins and waterfall sanctuary.
export function buildValemereArena(scene,resources,isDisposed=()=>false){
 const root=new THREE.Group();root.name='Valemere ruined sanctuary';scene.add(root);
 const material=color=>new THREE.MeshStandardMaterial({color,roughness:.95});
 const stone=material('#7e8378'),cap=material('#b0ac95'),dark=material('#4b5e57'),gold=material('#a58c52'),moss=material('#536d43');
 const mesh=(geo,mat,pos,scale)=>{const m=new THREE.Mesh(geo,mat);if(pos)m.position.set(...pos);if(scale)m.scale.set(...scale);m.receiveShadow=true;m.castShadow=true;root.add(m);return m;};
 const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');let seed=917;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 ctx.fillStyle='#626e66';ctx.fillRect(0,0,1024,1024);
 // Large irregular slabs, rather than a small endlessly repeated brick texture.
 for(let row=0;row<13;row++)for(let col=-1;col<12;col++){const x=col*98+(row%2)*49,y=row*85;ctx.beginPath();ctx.moveTo(x+3+random()*7,y+3);ctx.lineTo(x+90,y+3+random()*6);ctx.lineTo(x+94-random()*5,y+78);ctx.lineTo(x+3,y+80-random()*7);ctx.closePath();ctx.fillStyle=['#a4a28e','#979d8d','#b0ac98','#899485'][Math.floor(random()*4)];ctx.fill();ctx.strokeStyle='#4c5a5044';ctx.lineWidth=2;ctx.stroke();}
 for(let i=0;i<10000;i++){ctx.fillStyle=i%2?'#fff5dc12':'#163c2a12';ctx.fillRect(random()*1024,random()*1024,1+random()*3,1+random()*2);}
 for(let i=0;i<120;i++){const a=random()*Math.PI*2,r=430+random()*85;ctx.fillStyle='#526e4650';ctx.beginPath();ctx.ellipse(512+Math.cos(a)*r,512+Math.sin(a)*r,12+random()*24,5+random()*12,random()*6,0,7);ctx.fill();}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;resources.push(texture);
 const floor=mesh(new THREE.CircleGeometry(19,128),new THREE.MeshStandardMaterial({map:texture,roughness:1}),[0,-.025,0]);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
 const paving=new THREE.TextureLoader().load(new URL('./assets/village/valemere-arena-flagstone.png',import.meta.url).href,t=>{if(isDisposed()){t.dispose();return;}t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;floor.material.map=t;floor.material.needsUpdate=true;for(const mat of [stone,cap,dark]){mat.map=t;mat.needsUpdate=true;}root.userData.surfaceReady=true;});resources.push(paving);

 mesh(new THREE.CylinderGeometry(19.25,19.6,1.0,96),dark,[0,-.57,0]);mesh(new THREE.CylinderGeometry(19.65,20.1,.6,96),stone,[0,-1.35,0]);
 for(const [radius,width,mat] of [[18.15,.14,gold],[18.45,.30,cap],[18.86,.12,gold],[10.7,.055,gold],[3.7,.05,gold]]){const ring=mesh(new THREE.RingGeometry(radius,radius+width,128),mat,[0,-.012,0]);ring.rotation.x=-Math.PI/2;ring.castShadow=false;}
 // Compass engraving at the heart of the fighting floor.
 for(let i=0;i<8;i++){const a=i*Math.PI/4,s=new THREE.Shape();s.moveTo(0,0);s.lineTo(.22,1.5);s.lineTo(0,2.5);s.lineTo(-.22,1.5);s.closePath();const m=mesh(new THREE.ShapeGeometry(s),gold,[0,-.008,0]);m.rotation.set(-Math.PI/2,0,a);m.castShadow=false;}
 const block=new THREE.BoxGeometry(1,1,1),rock=new THREE.DodecahedronGeometry(1,0);
 // Low broken parapet around the far half keeps combat silhouettes unobstructed.
 for(let i=0;i<26;i++){const a=-Math.PI*.52+i/25*Math.PI*1.04,x=Math.sin(a)*19,z=-Math.cos(a)*19;const m=mesh(block,i%4?stone:cap,[x,.30,z],[1.65,.65,1.05]);m.rotation.y=-a;}
 for(const [x,z,h] of [[-13.5,-13.2,5.6],[13.5,-13.2,6.4],[-18,-5,3.7],[18,-5,4.1]]){
  mesh(block,dark,[x,.23,z],[2.2,.5,2]);for(let j=0;j<Math.floor(h/.9);j++){const m=mesh(block,j%3?stone:cap,[x+Math.sin(j*4)*.08,.9+j*.9,z],[1.4,.84,1.3]);m.rotation.y=.07*Math.sin(j*2);}
  mesh(block,cap,[x,h+.1,z],[1.9,.38,1.8]);
  const banner=mesh(new THREE.PlaneGeometry(.82,2.5),new THREE.MeshStandardMaterial({color:'#244e51',side:THREE.DoubleSide,roughness:1}),[x,h-1.45,z+.69]);banner.rotation.z=x<0?.04:-.04;
  const sigil=mesh(new THREE.TorusGeometry(.28,.025,4,24),gold,[x,h-1.1,z+.71]);sigil.scale.y=1.5;
 }
 // Two surviving shoulders of a monumental, broken rune arch.
 for(const side of [-1,1])for(let i=0;i<7;i++){const a=(side<0?Math.PI:0)+(side<0?-1:1)*i*.12;const x=Math.cos(a)*8.5,y=4.5+Math.sin(a)*8.5,m=mesh(block,stone,[x,y,-18.1],[1.2,1.1,1.35]);m.rotation.z=a+Math.PI/2;}
 const flames=[];
 for(const [x,z] of [[-16,-9],[16,-9],[-17,7],[17,7]]){
  mesh(new THREE.CylinderGeometry(.9,1.1,.4,8),dark,[x,.2,z]);mesh(new THREE.CylinderGeometry(.5,.7,1.1,8),stone,[x,.9,z]);mesh(new THREE.CylinderGeometry(.98,.55,.48,12),dark,[x,1.65,z]);
  const lip=mesh(new THREE.TorusGeometry(.94,.09,5,24),gold,[x,1.9,z]);lip.rotation.x=Math.PI/2;
  const fire=mesh(new THREE.ConeGeometry(.47,1.1,7),new THREE.MeshBasicMaterial({color:'#ffaf3f'}),[x,2.32,z]);const core=mesh(new THREE.ConeGeometry(.25,.9,6),new THREE.MeshBasicMaterial({color:'#fff0a7'}),[x,2.2,z+.1]);flames.push(fire,core);
 }
 for(let i=0;i<46;i++){const a=i/46*Math.PI*2,r=19.6+(i%4)*.18;const m=mesh(rock,i%3?stone:moss,[Math.sin(a)*r,-1.4-(i%5)*.45,Math.cos(a)*r],[1.25,1.7+(i%3),1]);m.rotation.y=a;}
 for(let i=0;i<23;i++){const a=-Math.PI/2+i/22*Math.PI,r=18.6;mesh(rock,moss,[Math.sin(a)*r,.16,-Math.cos(a)*r],[.7,.22,.65]);}
 root.userData.theme='valemere-stone-sanctuary';
 return {floor,update(time){for(let i=0;i<flames.length;i++)flames[i].scale.set(1+.06*Math.sin(time*5+i),1+.12*Math.sin(time*7+i),1);}};
}
