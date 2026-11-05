import * as THREE from './vendor/three/three.module.js';

const theme=(name,type,base,surface,rim,accent)=>({name,type,base,surface,rim,accent});
export const platformThemes={
 'rill-species':theme('Rill reed-and-driftwood roost','nest','#5d665a','#b18b53','#7b6848','#afc29a'),
 rill:theme('Aeri wind-roost','nest','#455a65','#8d8775','#83b9bc','#e0d4a3'),
 'defender-rill':theme('Sentinel watchpost','fort','#34545a','#527f7d','#b0b899','#7ec7b8'),
 'brugar-species':theme('Boulder clearing','rock','#515246','#77715a','#737d58','#a4ac70'),
 brugar:theme('Brakk granite den','rock','#414b49','#626f69','#83928a','#bcc0a0'),
 'krynn-species':theme('Krynn rootbound woodland hollow','krynn-woodland','#566052','#95938a','#716d59','#8b9b62'),
 krynn:theme('Virex rootbound woodland hollow','krynn-woodland','#566052','#95938a','#716d59','#8b9b62'),
 'fenra-species':theme('Fenra limestone meadow','fenra-meadow','#7c8467','#79885a','#a5a58b','#e4dfcc'),
 fenra:theme('Saelis limestone meadow','fenra-meadow','#7c8467','#79885a','#a5a58b','#e4dfcc'),
 veyrin:theme('Kael mountain basalt refuge','veyrin-basalt','#51534f','#8a887f','#676962','#a68b4e'),
 tharos:theme('Tharos mountain basalt refuge','veyrin-basalt','#51534f','#8a887f','#676962','#a68b4e'),
 talren:theme('Talren sandstone resting ground','talren-sand','#877352','#c09b62','#a58c64','#d6b677'),
 'northern-talren':theme('Northern Talren snowy refuge','talren-snow','#6e858d','#e1e9e7','#a1b3b7','#e6eeed'),
 'defender-talren':theme('Defender Talren sandstone resting ground','talren-sand','#877352','#c09b62','#a58c64','#d6b677'),
 kanji:theme('Kanji slate-and-heather lookout','kanji-heather','#63675d','#8b877f','#77776c','#886681'),
 trusk:theme('Trusk mosswood claw clearing','trusk-mosswood','#636451','#8c7860','#777665','#798f4b'),
 velkris:theme('Velkris silk-lined lair','velkris-web','#50594b','#8e8374','#73725e','#e2dccc'),
 fox:theme('Ember woodland','forest','#5b493b','#95734e','#91613e','#d7a367'),
 snail:theme('Crystal garden','crystal','#536c68','#8bada1','#8daba3','#c2e2db'),
 dragon:theme('Amethyst aerie','crystal','#3e4256','#696382','#768c9f','#b7a3e0')
};
export const platformTheme=kind=>platformThemes[kind]||platformThemes['rill-species'];

export function platformSurface(theme){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const ctx=canvas.getContext('2d');let seed=71;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 ctx.fillStyle=theme.surface;ctx.fillRect(0,0,512,512);
 for(let i=0;i<1600;i++){ctx.fillStyle=i%2?'#ffffff0b':'#00000012';const x=random()*512,y=random()*512;ctx.fillRect(x,y,1+random()*7,1+random()*3);}
 ctx.strokeStyle=theme.base;ctx.lineWidth=2;
 if(['nest','forest'].includes(theme.type)){
  for(let x=30;x<512;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+5,512);ctx.stroke();for(let y=0;y<512;y+=35){ctx.strokeStyle='#30251a23';ctx.beginPath();ctx.moveTo(x+10,y);ctx.bezierCurveTo(x+35,y+7,x+40,y-5,x+53,y+3);ctx.stroke();}}
 }else if(theme.type==='fort'){
  ctx.strokeStyle=theme.base;for(let y=0;y<512;y+=85){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();for(let x=(y/85%2)*64;x<512;x+=128){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+85);ctx.stroke();}}
 }else if(['rock','crystal','ember'].includes(theme.type)){
  ctx.lineWidth=3;for(let i=0;i<17;i++){let x=random()*512,y=random()*512;ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<4;j++){x+=(random()-.5)*100;y+=(random()-.5)*100;ctx.lineTo(x,y);}ctx.strokeStyle=theme.type==='ember'?theme.accent+'99':theme.base+'99';ctx.stroke();}
 }else if(theme.type==='snow'){
  ctx.strokeStyle=theme.accent;ctx.lineWidth=7;ctx.beginPath();ctx.arc(256,256,170,0,Math.PI*2);ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(256+Math.cos(a)*150,256+Math.sin(a)*150);ctx.lineTo(256+Math.cos(a)*185,256+Math.sin(a)*185);ctx.stroke();}
 }else{
  for(let i=0;i<220;i++){ctx.fillStyle=theme.accent+'55';ctx.beginPath();ctx.ellipse(random()*512,random()*512,random()*5+1,random()*2+1,random()*3,0,7);ctx.fill();}
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

export function decoratePlatform(root,theme,radius){
 const accent=new THREE.MeshStandardMaterial({color:theme.accent,roughness:.8}),rim=new THREE.MeshStandardMaterial({color:theme.rim,roughness:.9}),dark=new THREE.MeshStandardMaterial({color:theme.base,roughness:1});
 const pebble=new THREE.DodecahedronGeometry(.13,0),stud=new THREE.SphereGeometry(.035,8,6);
 // All dressing hugs the outer edge, leaving the creature's standing area clear.
 for(let i=0;i<16;i++){
  const angle=i*Math.PI/8,x=Math.sin(angle),z=Math.cos(angle),r=radius*.99;
  let geometry=pebble,material=i%3?rim:accent,y=-.035,scale=[1.3,.7,1];
  if(theme.type==='fort'){geometry=stud;material=accent;y=.016;scale=[1,.5,1];}
  if(theme.type==='nest'){geometry=new THREE.CylinderGeometry(.025,.035,.34,5);y=.025;scale=[1,1,1];material=i%3?rim:accent;}
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x*r,y,z*r);mesh.scale.set(...scale);mesh.rotation.y=angle;mesh.castShadow=mesh.receiveShadow=true;
  if(theme.type==='nest'){mesh.rotation.z=Math.PI/2;mesh.rotation.y=angle+.45;}
  root.add(mesh);
 }
 const feature=theme.type;
 if(['crystal','ember','rock'].includes(feature)){
  for(let i=0;i<5;i++){const angle=2.3+i*.34,height=feature==='crystal'?.17+(i%3)*.10:.09+(i%2)*.08;
   const mesh=new THREE.Mesh(feature==='crystal'?new THREE.ConeGeometry(.07,height,5):pebble,i%2?rim:accent);mesh.position.set(Math.sin(angle)*radius*.9,height/2,Math.cos(angle)*radius*.9);mesh.rotation.set(.12,angle,-.15);mesh.castShadow=true;root.add(mesh);}
 }
 if(['forest','meadow'].includes(feature)){
  const grass=new THREE.MeshStandardMaterial({color:theme.accent,roughness:1,side:THREE.DoubleSide});
  for(let i=0;i<7;i++){const a=2+i*.24,r=radius*.92;for(let n=0;n<3;n++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(.035,.16+(i%3)*.035,3),n===2?grass:rim);leaf.position.set(Math.sin(a)*r+(n-1)*.035,.06,Math.cos(a)*r);leaf.rotation.z=(n-1)*.4;root.add(leaf);}}
  if(feature==='meadow'){
   const petalGeometry=new THREE.SphereGeometry(.035,6,4);
   for(let i=0;i<4;i++){const a=2.25+i*.34,x=Math.sin(a)*radius*.89,z=Math.cos(a)*radius*.89;
    for(let n=0;n<5;n++){const flower=new THREE.Mesh(petalGeometry,accent);flower.position.set(x+Math.sin(n*1.256)*.04,.11,z+Math.cos(n*1.256)*.04);flower.scale.y=.35;root.add(flower);}
   }
  }
 }
 // Discard shared geometries that this particular theme did not use.
 if(theme.type!=='fort')stud.dispose();
 if(theme.type==='fort'||theme.type==='nest')pebble.dispose();
 // No unreferenced materials are retained; the owner disposes all attached ones.
 const used=new Set();root.traverse(o=>{if(o.material)used.add(o.material);});for(const material of [accent,rim,dark])if(!used.has(material))material.dispose();
}
