import * as THREE from './vendor/three/three.module.js';

export function truskSurface(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');let seed=319;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 c.fillStyle='#8c7860';c.fillRect(0,0,512,512);
 for(let i=0;i<3400;i++){c.fillStyle=i%3?'#e2cfaa38':'#443b3025';c.beginPath();c.ellipse(random()*512,random()*512,random()*2.7+.5,random()*1.5+.5,random()*6,0,7);c.fill();}
 for(const [x,y,r] of [[112,170,39],[390,185,29],[125,360,33]]){c.fillStyle='#9e9580';c.strokeStyle='#6a6355';c.lineWidth=3;c.beginPath();for(let i=0;i<8;i++){const a=i/8*Math.PI*2,rr=r*(.8+random()*.25);c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr*.64);}c.closePath();c.fill();c.stroke();}
 // Shallow paw impressions at the front of the clearing.
 for(const [x,y,angle] of [[280,421,-.18],[356,397,.2]]){c.save();c.translate(x,y);c.rotate(angle);c.fillStyle='#5d4b36';c.strokeStyle='#c1a582';c.lineWidth=2;c.beginPath();c.ellipse(0,4,13,10,0,0,7);c.fill();c.stroke();for(let i=0;i<4;i++){c.beginPath();c.ellipse(-17+i*11,-12-Math.sin(i/3*Math.PI)*5,4.5,6,-.3+i*.2,0,7);c.fill();c.stroke();}c.restore();}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export function addTruskPlatform(root,radius){
 const mat=color=>new THREE.MeshStandardMaterial({color,roughness:1});const stone=mat('#777665'),moss=mat('#687446'),bark=mat('#59422f'),grain=mat('#aa8352'),scar=mat('#d0a26b'),dark=mat('#38291e'),fern=mat('#798f4b');fern.side=THREE.DoubleSide;
 const mesh=(geo,material,pos,scale)=>{const m=new THREE.Mesh(geo,material);if(pos)m.position.set(...pos);if(scale)m.scale.set(...scale);m.castShadow=m.receiveShadow=true;root.add(m);return m;};
 const rock=new THREE.DodecahedronGeometry(1,1),patch=new THREE.DodecahedronGeometry(.12,1);
 for(let i=0;i<25;i++){const a=i/25*Math.PI*2,r=radius*.96;const m=mesh(rock,stone,[Math.sin(a)*r,-.14,Math.cos(a)*r],[.20,.16,.16]);m.rotation.y=a;const p=mesh(patch,moss,[Math.sin(a)*r,.004,Math.cos(a)*r],[1,.3,.8]);p.rotation.y=a;}
 // Fallen, claw-scarred trunk stays behind the flat standing area.
 const log=mesh(new THREE.CylinderGeometry(.18,.22,1.64,10),bark,[-.18,.19,-1.17]);log.rotation.z=Math.PI/2;
 const end=mesh(new THREE.CircleGeometry(.175,10),grain,[.646,.19,-1.17]);end.rotation.y=Math.PI/2;
 for(let i=0;i<3;i++){const ring=mesh(new THREE.TorusGeometry(.04+i*.047,.004,3,18),bark,[.648+i*.001,.19,-1.17]);ring.rotation.y=Math.PI/2;}
 const line=(points,width,material)=>mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),10,width,4,false),material);
 for(let i=0;i<6;i++){const a=i/6*Math.PI*2;line([[-.97,.19+Math.sin(a)*.19,-1.17+Math.cos(a)*.19],[-.2,.19+Math.sin(a)*.19,-1.17+Math.cos(a)*.19],[.57,.19+Math.sin(a)*.17,-1.17+Math.cos(a)*.17]],.009,grain);}
 for(let i=0;i<3;i++)line([[-.30+i*.12,.35,-1.10],[-.18+i*.12,.26,-.99],[-.05+i*.12,.15,-.97]],.012,scar);
 const stump=mesh(new THREE.CylinderGeometry(.13,.21,.38,9),bark,[1.02,.18,-.91]);const cut=mesh(new THREE.CircleGeometry(.128,9),grain,[1.02,.375,-.91]);cut.rotation.x=-Math.PI/2;
 for(let i=0;i<7;i++){const a=i/7*Math.PI*2;const shard=mesh(new THREE.ConeGeometry(.035,.11+(i%3)*.025,4),i%2?bark:grain,[1.02+Math.sin(a)*.12,.40,-.91+Math.cos(a)*.12]);shard.rotation.z=Math.sin(a)*.2;}
 for(let i=0;i<3;i++)line([[.94+i*.043,.39,-.80],[.91+i*.043,.24,-.73],[.91+i*.043,.08,-.73]],.008,scar);
 const leaf=new THREE.Shape();leaf.moveTo(0,0);leaf.quadraticCurveTo(.065,.02,.11,.07);leaf.quadraticCurveTo(.03,.075,0,0);const leafGeo=new THREE.ShapeGeometry(leaf);
 for(const [x,z] of [[-1.07,-.78],[.65,-1.25],[1.25,-.60]])for(let frond=0;frond<3;frond++){
  const a=frond*2.1,h=.23+frond*.035,dx=Math.cos(a)*.13,dz=Math.sin(a)*.13;line([[x,.01,z],[x+dx*.4,h*.6,z+dz*.4],[x+dx,h,z+dz]],.006,moss);
  for(let i=0;i<5;i++)for(const side of [-1,1]){const t=i/5,l=mesh(leafGeo,fern,[x+dx*t,.04+h*t,z+dz*t],[side*(1-t*.55),1-t*.55,1]);l.rotation.set(-.4,a,side*.4);}
 }
 // A few fallen leaves soften the border without filling the standing area.
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2,m=mesh(leafGeo,i%3?grain:dark,[Math.sin(a)*radius*.82,.027,Math.cos(a)*radius*.82],[.6,.6,.6]);m.rotation.set(-Math.PI/2,0,a);}
 root.userData.truskPlatform='mosswood-claw-clearing';
}
