import * as THREE from './vendor/three/three.module.js';

// The generated rigs have hard weight cutovers, including across UV seams.
// Smooth only connected surface neighbors; keep mesh geometry, UVs and bind matrices intact.
export function conditionCombatSkin(model){
 if(model.combatSkinReady)return;model.combatSkinReady=true;
 model.root.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const geometry=mesh.geometry,position=geometry.attributes.position,index=geometry.attributes.skinIndex,weight=geometry.attributes.skinWeight;
  if(!position||!index||!weight)return;
  const groups=[],vertices=[],weld=new Map();
  for(let i=0;i<position.count;i++){
   const key=[position.getX(i),position.getY(i),position.getZ(i)].map(x=>Math.round(x*100000)).join(',');let group=weld.get(key);
   if(group===undefined){group=groups.length;weld.set(key,group);groups.push({neighbors:new Set(),weights:new Map(),count:0});}
   vertices[i]=group;const g=groups[group];g.count++;
   for(let j=0;j<4;j++){const bone=index.array[i*4+j],w=weight.array[i*4+j];if(w>0)g.weights.set(bone,(g.weights.get(bone)||0)+w);}
  }
  for(const g of groups)for(const [bone,w] of g.weights)g.weights.set(bone,w/g.count);
  const triangles=geometry.index,count=triangles?triangles.count:position.count;
  for(let i=0;i<count;i+=3){const ids=[0,1,2].map(j=>vertices[triangles?triangles.getX(i+j):i+j]);for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3];if(a!==b){groups[a].neighbors.add(b);groups[b].neighbors.add(a);}}}
  const strongest=weights=>{const entries=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),total=entries.reduce((n,e)=>n+e[1],0);return new Map(entries.map(([bone,w])=>[bone,w/total]));};
  for(let pass=0;pass<18;pass++){
   const next=groups.map(g=>{if(!g.neighbors.size)return g.weights;const weights=new Map([...g.weights].map(([b,w])=>[b,w*.35]));for(const neighbor of g.neighbors)for(const [b,w] of groups[neighbor].weights)weights.set(b,(weights.get(b)||0)+w*.65/g.neighbors.size);return strongest(weights);});
   groups.forEach((g,i)=>g.weights=next[i]);
  }
  // Clone before changing weights so other actors and non-Brawl portraits are independent.
  mesh.geometry=geometry.clone();geometry.dispose();const indices=new Uint16Array(position.count*4),weights=new Float32Array(position.count*4);
  for(let i=0;i<position.count;i++){let j=0;for(const [bone,w] of strongest(groups[vertices[i]].weights)){indices[i*4+j]=bone;weights[i*4+j]=w;j++;}}
  mesh.geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));mesh.geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 });
}

// Static-source skins cannot sustain the extreme bends of an authored game rig.
// Clamp the rotation vector, preserving its direction and the original bone lengths.
export function combatRotation(name,rotation){
 const limit=/Wing_.*root/.test(name)?.48:/Wing_/.test(name)?.22:/hip/.test(name)?.42:/knee/.test(name)?.48:/Foot|Toes/.test(name)?.32:/Pelvis|Torso/.test(name)?.12:/Neck/.test(name)?.20:/Head/.test(name)?.28:/Jaw|Beak/.test(name)?.25:/Tail/.test(name)?.24:.28;
 const length=Math.hypot(...rotation),safeLimit=limit*.25,factor=length>safeLimit?safeLimit/length:1;
 return rotation.map(v=>v*factor);
}
