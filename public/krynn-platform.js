import * as THREE from './vendor/three/three.module.js';

export function krynnSurface(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#95938a';ctx.fillRect(0,0,512,512);let seed=83;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 ctx.fillStyle='#6f6350';ctx.beginPath();ctx.ellipse(256,60,210,72,0,0,Math.PI*2);ctx.fill();
 for(let i=0;i<2400;i++){ctx.fillStyle=i%2?'#e4ded223':'#3540391a';ctx.fillRect(random()*512,random()*512,random()*5+1,random()*3+1);}
 ctx.strokeStyle='#62675c66';ctx.lineWidth=1.5;
 for(const points of [[[80,0],[126,110],[111,215],[169,267]],[[512,220],[392,259],[326,252],[285,319],[269,512]],[[0,373],[104,351],[182,379],[285,319]]]){
  ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
 }
 // Leaves are kept at the rear edge of the clearing.
 for(let i=0;i<25;i++){const x=random()*512,y=random()*100;ctx.fillStyle=i%2?'#8e7544':'#a58a58';ctx.save();ctx.translate(x,y);ctx.rotate(random()*6);ctx.beginPath();ctx.ellipse(0,0,5,2,0,0,7);ctx.fill();ctx.restore();}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

export function addKrynnPlatform(root,radius){
 const bark=new THREE.MeshStandardMaterial({color:'#6c6250',roughness:1}),grain=new THREE.MeshStandardMaterial({color:'#8a7e66',roughness:1}),stone=new THREE.MeshStandardMaterial({color:'#6f786b',roughness:1}),moss=new THREE.MeshStandardMaterial({color:'#687c46',roughness:1}),fern=new THREE.MeshStandardMaterial({color:'#8b9b62',roughness:1,side:THREE.DoubleSide}),ivory=new THREE.MeshStandardMaterial({color:'#d7ccb3',roughness:1});
 function mesh(geometry,material,position,scale){const m=new THREE.Mesh(geometry,material);if(position)m.position.set(...position);if(scale)m.scale.set(...scale);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
 function branch(points,width,material=bark){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(12,points.length*5),width,6,false),material);}
 const rockGeometry=new THREE.DodecahedronGeometry(1,0),mossGeometry=new THREE.DodecahedronGeometry(.1,1);
 for(let i=0;i<20;i++){const a=i*Math.PI/10,r=radius*.95,rock=mesh(rockGeometry,stone,[Math.sin(a)*r,-.19,Math.cos(a)*r],[.22,.19,.22]);rock.rotation.y=a;}
 // Exposed root arcs form a loose crescent, with a clear opening at the front.
 for(let strand=0;strand<3;strand++){
  const points=[];
  for(let i=0;i<=36;i++){const a=.52+i/36*5.18,r=radius*(.86+strand*.035)+Math.sin(a*3+strand)*.035;points.push([Math.sin(a)*r,.07+strand*.025+Math.sin(a*2+strand)*.028,Math.cos(a)*r]);}
  branch(points,strand===0?.080:.055);
  branch(points.map(([x,y,z])=>[x,y+.047,z+.015]),.009,grain);
 }
 for(const points of [[[-1.22,.07,-.65],[-1.13,.18,-.94],[-1.25,.27,-1.15]],[[1.24,.10,.62],[1.10,.04,.92],[1.27,-.08,1.11]],[[-1.12,.10,.92],[-.99,-.03,1.16],[-1.13,-.16,1.25]]])branch(points,.052);
 // Low stump and cut face, entirely behind the resident's standing area.
 const stump=mesh(new THREE.CylinderGeometry(.12,.17,.30,7),bark,[1.00,.15,-1.03]);stump.rotation.z=-.09;
 const cut=mesh(new THREE.CircleGeometry(.116,12),grain,[.986,.302,-1.03]);cut.rotation.x=-Math.PI/2;
 for(let i=0;i<3;i++){const ring=mesh(new THREE.TorusGeometry(.025+i*.027,.003,3,16),bark,[.986,.304+i*.001,-1.03]);ring.rotation.x=-Math.PI/2;}
 // Slate steps remain within the fixed platform footprint.
 mesh(new THREE.BoxGeometry(.88,.08,.24),stone,[0,-.24,1.53]);mesh(new THREE.BoxGeometry(.66,.07,.18),stone,[0,-.33,1.69]);
 for(let i=0;i<17;i++){const a=.8+i*.27,r=radius*(.88+(i%3)*.035),patch=mesh(mossGeometry,moss,[Math.sin(a)*r,-.005,Math.cos(a)*r],[1.3,.35,.85]);patch.rotation.y=a;}
 const leafShape=new THREE.Shape();leafShape.moveTo(0,0);leafShape.quadraticCurveTo(.07,.025,.10,.09);leafShape.quadraticCurveTo(.02,.07,0,0);const leafGeometry=new THREE.ShapeGeometry(leafShape);
 for(const [x,z,angle] of [[-.46,-1.18,-.3],[.35,-1.22,.4]]){
  branch([[x,.01,z],[x+.04,.18,z-.03],[x+.12,.37,z-.05]],.009,moss);
  for(let i=0;i<6;i++)for(const side of [-1,1]){const leaf=mesh(leafGeometry,fern,[x+.02+i*.014,.06+i*.043,z-.025]);leaf.scale.set(side*(1-i*.08),1-i*.08,1);leaf.rotation.set(-.2,angle,side*.3);}
 }
 const stemGeometry=new THREE.CylinderGeometry(.012,.017,.085,5),capGeometry=new THREE.SphereGeometry(.046,8,5,0,Math.PI*2,0,Math.PI/2);
 for(let i=0;i<4;i++){const x=-.03+(i%2)*.1,z=-1.27+(i%3)*.04,h=.07+(i%2)*.035;mesh(stemGeometry,ivory,[x,h/2,z]);mesh(capGeometry,ivory,[x,h,z],[1,.55,1]);}
 root.userData.krynnPlatform='rootbound-woodland';
}
