import * as THREE from './vendor/three/three.module.js';

// Approved roost concept: slate, wooden landing deck, woven driftwood rim,
// low rear perch, reed cluster, moss, and two shed turquoise feathers.
export function addRillRoost(root,radius){
 const wood=new THREE.MeshStandardMaterial({color:'#96703f',roughness:.96});
 const reed=new THREE.MeshStandardMaterial({color:'#c09b5b',roughness:1});
 const bark=new THREE.MeshStandardMaterial({color:'#795632',roughness:.98});
 const slate=new THREE.MeshStandardMaterial({color:'#647064',roughness:1});
 const binding=new THREE.MeshStandardMaterial({color:'#547d71',roughness:.98});
 const moss=new THREE.MeshStandardMaterial({color:'#6e7c3c',roughness:1});
 const green=new THREE.MeshStandardMaterial({color:'#8d9a42',roughness:1,side:THREE.DoubleSide});
 const teal=new THREE.MeshStandardMaterial({color:'#45ada5',roughness:.9,side:THREE.DoubleSide});
 function mesh(geometry,material,position){const m=new THREE.Mesh(geometry,material);if(position)m.position.set(...position);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
 function branch(points,width,material){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(new THREE.TubeGeometry(curve,Math.max(8,points.length*7),width,6,false),material);}
 // Irregular slate blocks conceal the regular support cylinder without changing
 // the established deck footprint or lifting the creature off its landing area.
 const stoneGeometry=new THREE.CylinderGeometry(.23,.26,.18,5);
 for(let i=0;i<14;i++){const a=i/14*Math.PI*2,r=radius*.94,stone=mesh(stoneGeometry,slate,[Math.sin(a)*r,-.28,Math.cos(a)*r]);stone.rotation.y=a;stone.scale.set(1.1,.80+(i%3)*.09,1.1);}
 // Four woven strands cross over and under each other around the perimeter.
 for(let strand=0;strand<4;strand++){
  const points=[];
  for(let i=0;i<=128;i++){const a=i/128*Math.PI*2,phase=a*9+strand*Math.PI/2,r=radius*.88+Math.cos(phase)*.048;points.push([Math.sin(a)*r,.10+Math.sin(phase)*.055,Math.cos(a)*r]);}
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  mesh(new THREE.TubeGeometry(curve,192,strand%2?.044:.054,6,false),strand%2?reed:wood);
 }
 // Teal cloth wraps, restrained to four points like the concept sheet.
 const bandGeometry=new THREE.TorusGeometry(.115,.027,5,12);
 for(const a of [.6,2.1,3.7,5.2]){const band=mesh(bandGeometry,binding,[Math.sin(a)*radius*.88,.10,Math.cos(a)*radius*.88]);band.rotation.set(Math.PI/2,0,-a);band.scale.set(.9,1.25,1);}
 // Low curved perch at the BACK, leaving the front and center unobstructed.
 for(const x of [-.82,.82]){
  branch([[x,.02,-1.02],[x*.98,.26,-1.04],[x,.48,-1.07]],.075,bark);
  for(const y of [.16,.22,.38]){const band=mesh(new THREE.TorusGeometry(.078,.018,5,12),binding,[x,y,-1.05]);band.rotation.x=Math.PI/2;}
 }
 branch([[-1.04,.48,-1.05],[-.62,.50,-1.10],[0,.46,-1.14],[.63,.51,-1.08],[1.04,.49,-1.04]],.075,wood);
 // Reed clump is off the standing area, at one back corner.
 for(let i=0;i<6;i++){
  const x=.97+(i%3)*.08,z=-1.01-(i%2)*.09,height=.42+(i%3)*.13;
  branch([[x,0,z],[x+.025,height*.55,z-.03],[x+.05,height,z-.04]],.012,green);
  if(i%2===0){const cattail=mesh(new THREE.CylinderGeometry(.025,.025,.15,6),bark,[x+.05,height+.035,z-.04]);cattail.rotation.z=-.05;}
  const leafShape=new THREE.Shape();leafShape.moveTo(0,0);leafShape.quadraticCurveTo(.08,.24,.18,.43);leafShape.quadraticCurveTo(.04,.23,0,0);
  const leaf=mesh(new THREE.ShapeGeometry(leafShape),green,[x,0,z]);leaf.rotation.y=i*1.1;
 }
 const mossGeometry=new THREE.DodecahedronGeometry(.13,1);
 for(let i=0;i<8;i++){const a=2.05+i*.12,m=mesh(mossGeometry,moss,[Math.sin(a)*radius*.96,-.15,Math.cos(a)*radius*.96]);m.scale.set(1.15,.35,.8);}
 for(let i=0;i<2;i++){
  const feather=new THREE.Shape();feather.moveTo(0,0);feather.bezierCurveTo(-.09,.10,-.12,.29,0,.40);feather.bezierCurveTo(.10,.28,.07,.10,0,0);
  const f=mesh(new THREE.ShapeGeometry(feather),teal,[.66+i*.13,.17,1.12-i*.04]);f.rotation.set(-Math.PI/2+.25,0,-.45+i*.12);
  branch([[.66+i*.13,.178,1.12-i*.04],[.72+i*.13,.21,.91-i*.04]],.008,binding);
 }
 root.userData.approvedRillRoost=true;
}
