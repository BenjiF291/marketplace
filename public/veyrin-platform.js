import * as THREE from './vendor/three/three.module.js';

// Shared approved mountain resting ground for Kael and Tharos.
export function veyrinSurface({stones=27,seedValue=113}={}){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');
 let seed=seedValue;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 ctx.fillStyle='#645f55';ctx.fillRect(0,0,512,512);
 const sites=Array.from({length:stones},()=>[random()*512,random()*512]);
 // Natural polygonal flagstones, with narrow gravel seams between them.
 for(const site of sites){let polygon=[[0,0],[512,0],[512,512],[0,512]];
  for(const other of sites){if(other===site)continue;const nx=other[0]-site[0],ny=other[1]-site[1],limit=(other[0]**2+other[1]**2-site[0]**2-site[1]**2)/2,next=[];
   for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],da=a[0]*nx+a[1]*ny-limit,db=b[0]*nx+b[1]*ny-limit;
    if(da<=0)next.push(a);if((da<=0)!==(db<=0)){const t=da/(da-db);next.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}
   polygon=next;if(!polygon.length)break;
  }
  if(polygon.length<3)continue;
  const shade=116+Math.floor(random()*26);ctx.fillStyle=`rgb(${shade+6},${shade+3},${shade-3})`;ctx.beginPath();polygon.forEach(([x,y],i)=>{x=site[0]+(x-site[0])*.965;y=site[1]+(y-site[1])*.965;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.fill();ctx.strokeStyle='#d3c3a43b';ctx.lineWidth=1;ctx.stroke();
 }
 for(let i=0;i<2200;i++){ctx.fillStyle=i%3?'#151c2420':'#cfb57c44';const x=random()*512,y=random()*512;ctx.fillRect(x,y,1+random()*3,1+random()*2);}
 ctx.strokeStyle='#b29b6c65';ctx.lineWidth=1;
 for(let i=0;i<8;i++){const x=random()*512,y=random()*512;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+14,y+9);ctx.lineTo(x+28,y+7);ctx.stroke();}
 ctx.strokeStyle='#393c38';ctx.lineWidth=3;
 for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(130+i*10,385);ctx.quadraticCurveTo(144+i*10,362,150+i*10,340);ctx.stroke();}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

export function addVeyrinPlatform(root,radius){
 const basalt=new THREE.MeshStandardMaterial({color:'#5d5e59',roughness:1}),light=new THREE.MeshStandardMaterial({color:'#777970',roughness:1}),lichen=new THREE.MeshStandardMaterial({color:'#a68b4e',roughness:1}),grass=new THREE.MeshStandardMaterial({color:'#a58d5e',roughness:1,side:THREE.DoubleSide});
 const block=new THREE.DodecahedronGeometry(1,0),patch=new THREE.DodecahedronGeometry(.07,0);
 function mesh(geometry,material,position,scale){const m=new THREE.Mesh(geometry,material);m.position.set(...position);if(scale)m.scale.set(...scale);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
 for(let i=0;i<23;i++){const a=i/23*Math.PI*2,r=radius*.94,m=mesh(block,i%3?basalt:light,[Math.sin(a)*r,-.15,Math.cos(a)*r],[.20+(i%3)*.016,.22,.21]);m.rotation.y=a+.2;}
 // A low rear crescent shelters the resting ground without obstructing wings.
 for(let i=0;i<8;i++){const a=2.05+i*.31,r=radius*.87,m=mesh(block,basalt,[Math.sin(a)*r,.045,Math.cos(a)*r],[.23,.13+(i%2)*.025,.17]);m.rotation.y=a;}
 const shape=new THREE.Shape();shape.moveTo(-.28,0);shape.lineTo(-.31,.21);shape.lineTo(-.15,.43);shape.lineTo(.14,.35);shape.lineTo(.29,.08);shape.lineTo(.27,0);shape.closePath();
 const shard=new THREE.ExtrudeGeometry(shape,{depth:.10,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.02});
 for(const [x,z,angle] of [[-.97,-1.04,-.35],[.95,-.96,.5]])mesh(shard,light,[x,.02,z]).rotation.y=angle;
 for(let i=0;i<13;i++){const a=2.25+(i%7)*.17,r=radius*.90,p=mesh(patch,lichen,[Math.sin(a)*r,.12+(i%3)*.025,Math.cos(a)*r],[1,.22,.7]);p.rotation.y=i;}
 for(const [x,z] of [[-1.18,-.65],[1.03,-.87]])for(let i=0;i<7;i++){
  const height=.14+(i%3)*.035,leaf=new THREE.Shape();leaf.moveTo(0,0);leaf.quadraticCurveTo(.02,height*.6,.075,height);leaf.quadraticCurveTo(.008,height*.5,0,0);
  const blade=mesh(new THREE.ShapeGeometry(leaf),grass,[x+(i%3)*.025,.01,z]);blade.rotation.y=i*1.1;
 }
 root.userData.veyrinPlatform='mountain-basalt';
}
