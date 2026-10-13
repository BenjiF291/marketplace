import * as THREE from './vendor/three/three.module.js';

// Reusable, fully volumetric fox. No billboards or animal image planes.
const orange=new THREE.Color('#b94c16'),lightOrange=new THREE.Color('#d77a2b'),cream=new THREE.Color('#ece2c2'),dark=new THREE.Color('#252326');
const mix=(a,b,t)=>a.clone().lerp(b,THREE.MathUtils.clamp(t,0,1));
const smoothMin=(a,b,k=.12)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};
function ellipsoid(p,e){const x=(p.x-e[0])/e[3],y=(p.y-e[1])/e[4],z=(p.z-e[2])/e[5],q=Math.hypot(x,y,z);if(q<1e-6)return -Math.min(e[3],e[4],e[5]);return q*(q-1)/Math.max(1e-6,Math.hypot(x/e[3],y/e[4],z/e[5]));}
function field(parts){return p=>parts.reduce((d,e)=>smoothMin(d,ellipsoid(p,e)),100);}
function sculpt(parts,min,max,res,color){
 const sdf=field(parts),verts=[],normals=[],colors=[],uv=[],p=new THREE.Vector3(),eps=.003;
 const sample=(x,y,z)=>sdf(p.set(x,y,z));
 const normal=v=>new THREE.Vector3(sample(v.x+eps,v.y,v.z)-sample(v.x-eps,v.y,v.z),sample(v.x,v.y+eps,v.z)-sample(v.x,v.y-eps,v.z),sample(v.x,v.y,v.z+eps)-sample(v.x,v.y,v.z-eps)).normalize();
 const emit=(a,b,c)=>{const na=normal(a),nb=normal(b),nc=normal(c);if(b.clone().sub(a).cross(c.clone().sub(a)).dot(na.clone().add(nb).add(nc))<0){[b,c]=[c,b];[nb.x,nc.x]=[nc.x,nb.x];[nb.y,nc.y]=[nc.y,nb.y];[nb.z,nc.z]=[nc.z,nb.z];}
  for(const [v,n] of [[a,na],[b,nb],[c,nc]]){verts.push(v.x,v.y,v.z);normals.push(n.x,n.y,n.z);const col=color(v,n);colors.push(col.r,col.g,col.b);uv.push(v.z*.7+v.x*.25,v.y*1.8);}};
 const corner=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
 const step=max.clone().sub(min).divide(new THREE.Vector3(...res));
 for(let x=0;x<res[0];x++)for(let y=0;y<res[1];y++)for(let z=0;z<res[2];z++){
  const vs=corner.map(c=>new THREE.Vector3(min.x+(x+c[0])*step.x,min.y+(y+c[1])*step.y,min.z+(z+c[2])*step.z));const ds=vs.map(v=>sdf(v));if(ds.every(d=>d>0)||ds.every(d=>d<0))continue;
  const edge=(a,b)=>vs[a].clone().lerp(vs[b],ds[a]/(ds[a]-ds[b]));
  for(const tet of tets){const inside=tet.filter(i=>ds[i]<=0),out=tet.filter(i=>ds[i]>0);if(inside.length===1){const [a]=inside;emit(edge(a,out[0]),edge(a,out[1]),edge(a,out[2]));}else if(inside.length===3){const [a]=out;emit(edge(a,inside[0]),edge(a,inside[1]),edge(a,inside[2]));}else if(inside.length===2){const [a,b]=inside,[c,d]=out;const ac=edge(a,c),ad=edge(a,d),bc=edge(b,c),bd=edge(b,d);emit(ac,ad,bc);emit(ad,bd,bc);}}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return geometry;
}
function furTexture(){const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const c=canvas.getContext('2d');c.fillStyle='#faf7ef';c.fillRect(0,0,1024,1024);let seed=7123;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<65000;i++){const x=rand()*1024,y=rand()*1024;c.strokeStyle=`rgba(95,77,55,${.06+rand()*.17})`;c.lineWidth=.35+rand()*.7;c.beginPath();c.moveTo(x,y);c.lineTo(x+rand()*2-1,y+2+rand()*7);c.stroke();}const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1,1);texture.anisotropy=8;texture.colorSpace=THREE.SRGBColorSpace;return texture;}
function mesh(geometry,material,parent,name){const m=new THREE.Mesh(geometry,material);m.name=name;m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
function ell(parent,mat,pos,scale,name){const m=mesh(new THREE.SphereGeometry(1,32,24),mat,parent,name);m.position.set(...pos);m.scale.set(...scale);return m;}
function tube(parent,mat,points,r,name){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),24,r,7,false),mat,parent,name);}
function tuftFur(parent,surface,count){const positions=surface.getAttribute('position'),ns=surface.getAttribute('normal'),cols=surface.getAttribute('color');const v=[],colors=[];let seed=122;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<count;i++){const at=Math.floor(rand()*positions.count),p=new THREE.Vector3().fromBufferAttribute(positions,at),n=new THREE.Vector3().fromBufferAttribute(ns,at);const side=n.clone().cross(new THREE.Vector3(0,0,-1)).normalize();if(side.lengthSq()<.1)continue;const len=.010+rand()*.020,width=.003+rand()*.004,tip=p.clone().addScaledVector(n,len*.65).add(new THREE.Vector3(0,-len*.6,-len*.35));for(const point of [p.clone().addScaledVector(side,-width),p.clone().addScaledVector(side,width),tip]){v.push(point.x,point.y,point.z);colors.push(cols.getX(at),cols.getY(at),cols.getZ(at));}}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();return mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1}),parent,'Fur_silhouette');
}
// Curved, closed ears with a recessed inner bowl and rounded rims.
function ear(parent,mat,inner,x){
 const pivot=new THREE.Group();pivot.name=x<0?'Ear_left':'Ear_right';pivot.position.set(x,.33,-.045);parent.add(pivot);
 const side=Math.sign(x),rows=24,cols=24,positions=[],indices=[];
 const shape=(t,u,back=false)=>{const width=.125*Math.pow(1-t,.72)+.004;return [side*.065*t+u*width,.36*t,-.035*t+(back?-.055:.035*(u*u)-.024*Math.sin(t*Math.PI))];};
 for(let face=0;face<2;face++)for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++)positions.push(...shape(i/rows,j/cols*2-1,!!face));
 const offset=(rows+1)*(cols+1);
 for(let f=0;f<2;f++)for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const n=f*offset+i*(cols+1)+j;indices.push(...(f?[n,n+cols+1,n+1,n+1,n+cols+1,n+cols+2]:[n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1]));}
 for(let i=0;i<rows;i++)for(const j of [0,cols]){const n=i*(cols+1)+j,k=n+cols+1;indices.push(n,k,n+offset,k,k+offset,n+offset);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();mesh(g,mat,pivot,'Ear_outer');
 const v=[],ix=[];for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){const t=.12+i/rows*.76,u=(j/cols*2-1)*.73;const q=shape(t,u);q[2]+=.004;v.push(...q);if(i<rows&&j<cols){const n=i*(cols+1)+j;ix.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);}}
 const ig=new THREE.BufferGeometry();ig.setAttribute('position',new THREE.Float32BufferAttribute(v,3));ig.setIndex(ix);ig.computeVertexNormals();mesh(ig,inner,pivot,'Ear_inner');return pivot;
}
function leg(parent,fur,black,x,z,index){
 const hip=new THREE.Bone();hip.name=`Leg_${index}_hip`;
 const knee=new THREE.Bone();knee.name=`Leg_${index}_knee`;knee.position.y=-.52;hip.add(knee);
 const paw=new THREE.Bone();paw.name=`Leg_${index}_paw`;paw.position.y=-.58;knee.add(paw);
 const positions=[],uv=[],colors=[],skinIndices=[],skinWeights=[],indices=[],rings=40,sides=24;
 for(let i=0;i<=rings;i++){const d=i/rings*1.1;let r=d<.52?THREE.MathUtils.lerp(z<0?.19:.14,.082,d/.52):THREE.MathUtils.lerp(.082,.056,(d-.52)/.58);r*=1+.1*Math.sin(i/rings*Math.PI*2);const c=mix(orange,dark,THREE.MathUtils.smoothstep(d,.43,.65));
  let bone=0,weight=THREE.MathUtils.smoothstep(d,.34,.68);if(d>1){bone=1;weight=THREE.MathUtils.smoothstep(d,1,1.1);}
  for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2;positions.push(Math.cos(a)*r,-d,Math.sin(a)*r);uv.push(j/sides,d);colors.push(c.r,c.g,c.b);skinIndices.push(bone,bone+1,0,0);skinWeights.push(1-weight,weight,0,0);if(i<rings&&j<sides){const n=i*(sides+1)+j;indices.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeights,4));geo.setIndex(indices);geo.computeVertexNormals();
 const skin=new THREE.SkinnedMesh(geo,fur);skin.name=`Leg_${index}_skin`;skin.position.set(x,1.12,z);skin.add(hip);skin.bind(new THREE.Skeleton([hip,knee,paw]));skin.castShadow=true;parent.add(skin);
 ell(paw,black,[0,0,.035],[.105,.077,.15],'Paw');for(let toe=0;toe<3;toe++)ell(paw,black,[(toe-1)*.065,-.004,.115],[.043,.045,.07],'Toe');return {hip,knee,paw,z,phase:index===0||index===3?0:Math.PI};
}
function tail(parent,material){const length=1.65,segments=7,rings=80,sides=32,bones=[];const curve=t=>-.42*Math.sin(t*Math.PI*.85);for(let i=0;i<=segments;i++){const bone=new THREE.Bone();bone.name=`Tail_bone_${i}`;if(i){bone.position.set(0,curve(i/segments)-curve((i-1)/segments),-length/segments);bones[i-1].add(bone);}bones.push(bone);}
 const positions=[],uv=[],colors=[],skinIndices=[],skinWeights=[],indices=[];
 for(let i=0;i<=rings;i++){const t=i/rings,rad=(.085+.29*Math.sin(t*Math.PI)**.9)*Math.pow(1-t,.32)+.002;const c=mix(orange,cream,THREE.MathUtils.smoothstep(t,.65,.75));for(let s=0;s<=sides;s++){const angle=s/sides*Math.PI*2;positions.push(Math.cos(angle)*rad,curve(t)+Math.sin(angle)*rad,-t*length);uv.push(s/sides,t*2);colors.push(c.r,c.g,c.b);const b=Math.min(segments-1,Math.floor(t*segments)),weight=t*segments-b;skinIndices.push(b,b+1,0,0);skinWeights.push(1-weight,weight,0,0);if(i<rings&&s<sides){const a=i*(sides+1)+s;indices.push(a,a+sides+1,a+1,a+1,a+sides+1,a+sides+2);}}}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeights,4));geo.setIndex(indices);geo.computeVertexNormals();const skinned=new THREE.SkinnedMesh(geo,material);skinned.name='Skinned_tail';skinned.position.set(0,1.16,-1.03);skinned.add(bones[0]);skinned.bind(new THREE.Skeleton(bones));skinned.castShadow=true;parent.add(skinned);return {mesh:skinned,bones};}

export function createFox(){
 const root=new THREE.Group();root.name='Fox_entity';const torso=new THREE.Group();torso.name='Torso';root.add(torso);const texture=furTexture();const fur=new THREE.MeshStandardMaterial({vertexColors:true,map:texture,bumpMap:texture,bumpScale:.014,roughness:.91});const orangeMat=new THREE.MeshStandardMaterial({color:orange,map:texture,bumpMap:texture,bumpScale:.014,roughness:.94});const black=new THREE.MeshStandardMaterial({color:dark,roughness:.77});const ivory=new THREE.MeshStandardMaterial({color:cream,roughness:.95,side:THREE.DoubleSide});
 const bodyParts=[[0,1.26,0,.32,.32,.88],[0,1.30,.54,.34,.40,.40],[0,1.22,-.65,.36,.36,.39],[0,1.57,.70,.30,.40,.29],[-.25,1.58,.72,.12,.23,.23],[.25,1.58,.72,.12,.23,.23],[0,1.24,.84,.22,.27,.22]];
 const bodyColor=p=>{let c=mix(orange,lightOrange,(p.y-.85)*.7);const chest=THREE.MathUtils.smoothstep(p.z,.82,1.02)*THREE.MathUtils.smoothstep(1.82-p.y,0,.24);const belly=THREE.MathUtils.smoothstep(1.02-p.y,0,.17)*.65;return c.lerp(cream,Math.max(chest,belly));};
 const bodyGeo=sculpt(bodyParts,new THREE.Vector3(-.53,.72,-1.17),new THREE.Vector3(.53,2.02,1.13),[36,42,54],bodyColor);mesh(bodyGeo,fur,torso,'Body_sculpt');tuftFur(torso,bodyGeo,4200);
 const head=new THREE.Group();head.name='Head_joint';head.position.set(0,1.75,.82);torso.add(head);
 const headParts=[[0,.16,.015,.265,.25,.29],[0,.065,.28,.17,.13,.25],[0,.025,.52,.105,.09,.24],[0,-.04,.38,.135,.065,.28],[-.21,.015,-.015,.125,.12,.20],[.21,.015,-.015,.125,.12,.20],[-.285,-.035,-.04,.075,.055,.17],[.285,-.035,-.04,.075,.055,.17]];
 const headColor=p=>mix(orange,cream,Math.max(THREE.MathUtils.smoothstep(.10-p.y,0,.09),THREE.MathUtils.smoothstep(Math.abs(p.x),.25,.31)*THREE.MathUtils.smoothstep(.17-p.y,0,.1)));
 const headGeo=sculpt(headParts,new THREE.Vector3(-.39,-.19,-.30),new THREE.Vector3(.39,.47,.83),[36,34,44],headColor);mesh(headGeo,fur,head,'Head_sculpt');tuftFur(head,headGeo,1600);
 const noseMat=new THREE.MeshStandardMaterial({color:'#15161a',roughness:.34});ell(head,noseMat,[0,.025,.75],[.067,.048,.044],'Nose');
 tube(head,black,[[-.13,-.035,.30],[-.104,-.05,.46],[-.047,-.041,.65],[0,-.025,.731]],.006,'Mouth_left');tube(head,black,[[.13,-.035,.30],[.104,-.05,.46],[.047,-.041,.65],[0,-.025,.731]],.006,'Mouth_right');
 const earBack=new THREE.MeshStandardMaterial({color:'#513022',map:texture,roughness:.97});ivory.map=texture;const ears=[ear(head,earBack,ivory,-.18),ear(head,earBack,ivory,.18)];const eyes=[];const amber=new THREE.MeshStandardMaterial({color:'#d78c20',roughness:.22});
 for(const sign of [-1,1]){const eye=new THREE.Group();eye.name=sign<0?'Eye_left':'Eye_right';eye.position.set(sign*.214,.175,.205);eye.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(sign*.65,.07,.76).normalize());head.add(eye);ell(eye,black,[0,0,0],[.057,.024,.011],'Eye_socket');ell(eye,amber,[0,0,.009],[.026,.019,.007],'Iris');ell(eye,noseMat,[0,0,.017],[.006,.016,.003],'Pupil');ell(eye,new THREE.MeshBasicMaterial({color:'#fff8dd'}),[-.009,.008,.021],[.004,.004,.002],'Eye_glint');eyes.push(eye);}
 const legs=[leg(torso,fur,black,-.29,.62,0),leg(torso,fur,black,.29,.62,1),leg(torso,fur,black,-.31,-.66,2),leg(torso,fur,black,.31,-.66,3)];const tailRig=tail(torso,fur);
 const cord=new THREE.MeshStandardMaterial({color:'#563626',roughness:.9});tube(torso,cord,[[-.24,1.67,.83],[-.25,1.5,.95],[0,1.41,1.05],[.25,1.5,.95],[.24,1.67,.83]],.012,'Pendant_cord');const gem=mesh(new THREE.OctahedronGeometry(.070),new THREE.MeshStandardMaterial({color:'#bd1834',metalness:.22,roughness:.18}),torso,'Ruby_pendant');gem.position.set(0,1.34,1.063);gem.scale.set(.75,1.15,.5);
 let walkBlend=0;const joints=[head,...ears,...eyes,...legs.flatMap(l=>[l.hip,l.knee,l.paw]),...tailRig.bones];
 function update(time,{motion='idle',dt=1/60,immediate=false}={}){
  const target=motion==='idle'?0:motion==='run'?1.65:1;walkBlend=immediate?target:THREE.MathUtils.damp(walkBlend,target,6,dt);const phase=time*(motion==='run'?11.5:7.2),bob=Math.sin(phase*2)*.022*walkBlend;
  torso.position.y=bob;torso.rotation.z=Math.sin(phase)*.014*walkBlend;torso.scale.set(1,1+Math.sin(time*2)*.007,1);
  head.rotation.x=Math.sin(time*1.8)*.04+Math.sin(phase)*.025*walkBlend;head.rotation.y=Math.sin(time*.7)*.10;head.rotation.z=Math.sin(time*.5)*.018;
  ears.forEach((ear,i)=>{ear.rotation.z=(i?-1:1)*(.06+Math.sin(time*1.6+i)*.035);ear.rotation.x=Math.sin(time*.9+i)*.04;});
  const blink=(time%5.1)>4.94?Math.max(.07,Math.abs(Math.cos((time%5.1-4.94)/.16*Math.PI))):1;eyes.forEach(eye=>eye.scale.y=blink);
  for(const l of legs){const p=phase+l.phase,swing=Math.cos(p)*.22*walkBlend,lift=Math.max(0,Math.sin(p))*.16*walkBlend;const y=-(1.12+bob-.075-lift),z=swing,d=Math.min(1.099,Math.hypot(y,z));const knee=(l.z<0?-1:1)*Math.acos(THREE.MathUtils.clamp((d*d-.52*.52-.58*.58)/(2*.52*.58),-1,1));const hip=Math.atan2(-z,-y)-Math.atan2(.58*Math.sin(knee),.52+.58*Math.cos(knee));l.hip.rotation.x=hip;l.knee.rotation.x=knee;l.paw.rotation.x=-hip-knee;}
  tailRig.bones.forEach((bone,i)=>{bone.rotation.y=Math.sin(time*1.8-i*.43)*(.10+i*.008);bone.rotation.x=Math.sin(time*1.3-i*.25)*.035;});root.updateMatrixWorld(true);
 }
 update(0,{immediate:true});
 function clips(){const out=[];for(const motion of ['idle','walk','run']){const duration=motion==='idle'?5.1:2*Math.PI/(motion==='run'?11.5:7.2),times=[],samples=new Map(joints.map(j=>[j,[]])),positions=[];for(let i=0;i<=48;i++){const t=i/48*duration;times.push(t);update(t,{motion,immediate:true});const ph=i/48*Math.PI*2;
 head.rotation.set(Math.sin(ph)*.05,Math.sin(ph)*.08,Math.sin(ph)*.015);
 ears.forEach((ear,n)=>ear.rotation.set(Math.sin(ph+n)*.04,0,(n?-1:1)*(.06+Math.sin(ph+n)*.035)));
 tailRig.bones.forEach((bone,n)=>bone.rotation.set(Math.sin(ph-n*.25)*.035,Math.sin(ph-n*.43)*(.10+n*.008),0));
 for(const j of joints)samples.get(j).push(...j.quaternion.toArray());positions.push(...torso.position.toArray());}const tracks=[new THREE.VectorKeyframeTrack('Torso.position',times,positions),...joints.map(j=>new THREE.QuaternionKeyframeTrack(j.name+'.quaternion',times,samples.get(j)))];out.push(new THREE.AnimationClip(motion,duration,tracks));}update(0,{immediate:true});return out;}
 return {root,update,joints,tail:tailRig.mesh,clips,dispose(){const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();root.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});skeletons.forEach(s=>s.dispose());geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());}};
}
