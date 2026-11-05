import * as THREE from './vendor/three/three.module.js';

export function velkrisSurface(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#8e8374';ctx.fillRect(0,0,512,512);let seed=151;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<1800;i++){ctx.fillStyle=i%2?'#ddcfba28':'#3b403025';ctx.fillRect(random()*512,random()*512,random()*5+1,random()*3+1);}
 // Fine irregular silk carpet, with directional strands leading into the retreat.
 for(let i=0;i<310;i++){
  const x=random()*512,y=random()*512;ctx.strokeStyle=i%3?'#e9e3d34c':'#f2eadb70';ctx.lineWidth=i%7===0?1.3:.55;
  ctx.beginPath();ctx.moveTo(360,80);ctx.quadraticCurveTo((x+360)/2+random()*25,(y+80)/2,x,y);ctx.stroke();
 }
 for(let i=0;i<120;i++){const x=random()*512,y=random()*512;ctx.strokeStyle='#f4ecdd38';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+12,y-14,x+27,y+17,x+43,y+random()*20);ctx.stroke();}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

export function addVelkrisPlatform(root,radius){
 const stone=new THREE.MeshStandardMaterial({color:'#62695b',roughness:1}),wood=new THREE.MeshStandardMaterial({color:'#655642',roughness:1}),moss=new THREE.MeshStandardMaterial({color:'#7a7e4a',roughness:1}),dark=new THREE.MeshBasicMaterial({color:'#181d19',side:THREE.DoubleSide});
 function mesh(geometry,material,position,scale){const m=new THREE.Mesh(geometry,material);if(position)m.position.set(...position);if(scale)m.scale.set(...scale);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
 function branch(points,width=.045){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),20,width,6,false),wood);}
 const rock=new THREE.DodecahedronGeometry(1,0),patch=new THREE.DodecahedronGeometry(.09,0);
 for(let i=0;i<23;i++){const a=i/23*Math.PI*2,r=radius*.95,m=mesh(rock,stone,[Math.sin(a)*r,-.18,Math.cos(a)*r],[.20,.20,.21]);m.rotation.y=a;}
 for(const [x,z,height] of [[1.20,-.86,.36],[-1.15,-.86,.22],[.98,-1.15,.28]])mesh(rock,stone,[x,height/2,z],[.13,height/2,.13]);
 branch([[-1.23,0,-.59],[-1.28,.22,-.67],[-1.20,.36,-.78]]);
 branch([[.36,.02,-1.04],[.40,.26,-1.08],[.67,.38,-1.12],[.96,.25,-1.04],[1.07,.01,-.97]],.07);
 branch([[.39,.20,-1.07],[.12,.27,-1.20],[-.16,.23,-1.26],[-.32,.32,-1.22]],.038);
 const retreat=mesh(new THREE.CircleGeometry(.225,24),dark,[.70,.13,-1.075],[1,.88,1]);retreat.name='Silk-lined shaded retreat';
 for(let i=0;i<13;i++){const a=1.8+i*.29,r=radius*.91,p=mesh(patch,moss,[Math.sin(a)*r,-.03,Math.cos(a)*r],[1.2,.3,.75]);p.rotation.y=a;}
 // One shared line batch keeps detailed webbing inexpensive on mobile.
 const lines=[],v=p=>new THREE.Vector3(...p),segment=(a,b)=>lines.push(...a.toArray(),...b.toArray());
 function web(points){
  const vertices=points.map(v),center=vertices.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/vertices.length),spokes=[];
  for(let i=0;i<12;i++){const edge=i/12*vertices.length,index=Math.floor(edge),p=vertices[index].clone().lerp(vertices[(index+1)%vertices.length],edge-index);spokes.push(p);segment(center,p);}
  for(let ring=1;ring<=7;ring++){const r=ring/7;for(let i=0;i<spokes.length;i++){
   const a=center.clone().lerp(spokes[i],r),b=center.clone().lerp(spokes[(i+1)%spokes.length],r),mid=a.clone().lerp(b,.5);mid.y-=.006;segment(a,mid);segment(mid,b);
  }}
 }
 web([[-1.20,.36,-.78],[-.32,.32,-1.22],[-1.31,.015,-.22]]);
 web([[.96,.39,-1.12],[1.20,.36,-.86],[1.31,.015,-.31]]);
 web([[-.32,.32,-1.22],[.67,.38,-1.12],[.14,.015,-1.02]]);
 // Funnel threads flow down from the mouth onto the ground, away from the legs.
 for(let i=0;i<25;i++){
  const angle=.3+i/24*2.7,end=new THREE.Vector3(Math.cos(angle)*radius*.85,.018,Math.sin(angle)*radius*.85),start=new THREE.Vector3(.70+(i%3-1)*.07,.12+(i%4)*.025,-1.03),mid=start.clone().lerp(end,.30);mid.y=.027;segment(start,mid);segment(mid,end);
 }
 // Soft silk swags hang across the outer rim, anchored at small knots.
 for(let i=0;i<11;i++){
  const angle=-1.25+i*.25,a=v([Math.sin(angle)*radius*.98,.015,Math.cos(angle)*radius*.98]),b=v([Math.sin(angle+.24)*radius*.98,.015,Math.cos(angle+.24)*radius*.98]);
  for(let strand=0;strand<3;strand++){let previous=a;for(let n=1;n<=8;n++){const p=a.clone().lerp(b,n/8);p.y-=Math.sin(n/8*Math.PI)*(.09+strand*.025);segment(previous,p);previous=p;}}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
 const silk=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#e2dccc',transparent:true,opacity:.72,depthWrite:false}));silk.name='Radial webs, funnel silk and rim drapes';root.add(silk);
 root.userData.velkrisPlatform='webbed-lair';
}
