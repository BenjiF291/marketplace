import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';
import {clone as cloneSkeleton} from './vendor/three/SkeletonUtils.js';
import {choreography} from './creature-brawl-attacks.js?v=skin2';

let assetPromise;
export function embeddedDragonEnabled(){return ['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&new URLSearchParams(location.search).get('brawlDragonRig')==='embedded';}
export function prepareEmbeddedClips(clips,rootBone){
 const report=[];
 const prepared=clips.map(original=>{
  const clip=original.clone();
  for(const track of clip.tracks){if(track.name!==rootBone.name+'.position')continue;
   const raw=Array.from(track.values),first=raw.slice(0,3),last=raw.slice(-3),range=[0,1,2].map(axis=>{const values=raw.filter((_,i)=>i%3===axis);return [Math.min(...values),Math.max(...values)];});
   const verticalOffset=clip.name==='fly'?first[1]-rootBone.position.y:0;report.push({clip:clip.name,bone:rootBone.name,first,last,range,horizontalDrift:[last[0]-first[0],last[2]-first[2]],removedVerticalOffset:verticalOffset});
   for(let i=0;i<track.values.length;i+=3){track.values[i]=rootBone.position.x;track.values[i+1]=raw[i+1]-verticalOffset;track.values[i+2]=rootBone.position.z;}
  }
  return clip;
 });
 return {clips:prepared,report};
}
export async function createEmbeddedDragon(){
 assetPromise??=new GLTFLoader().loadAsync(new URL('./assets/companions/dragon-meshy-rigged.glb',import.meta.url).href).catch(error=>{assetPromise=null;throw error;});
 const asset=await assetPromise;
 for(const name of ['idle','walk','run','fly'])if(!asset.animations.some(clip=>clip.name===name))throw Error('Embedded dragon is missing clip: '+name);
 const root=cloneSkeleton(asset.scene),joints=[],meshes=[];
 root.traverse(node=>{if(node.isBone)joints.push(node);if(node.isSkinnedMesh){node.geometry=node.geometry.clone();node.material=Array.isArray(node.material)?node.material.map(m=>m.clone()):node.material.clone();node.castShadow=node.receiveShadow=true;meshes.push(node);}});
 const torso=joints.find(b=>b.name==='Torso');if(!torso)throw Error('Embedded dragon is missing Torso.');
 const prepared=prepareEmbeddedClips(asset.animations,torso);
 return {root,joints,importedAnimations:true,animationSource:'embedded-glb',rootMotionReport:prepared.report,missingCombatClips:['melee attack','ranged cast','hit reaction','defeat','victory'],
  // Deliberate no-op: the imported skeleton is controlled exclusively by AnimationMixer.
  update(){},clips:()=>prepared.clips,
  createCombatPlayer:(moves,mixer,idle)=>new EmbeddedDragonAnimationPlayer(prepared.clips,moves,mixer,idle),
  dispose(){const materials=new Set(),skeletons=new Set();for(const mesh of meshes){mesh.geometry.dispose();skeletons.add(mesh.skeleton);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(material);}skeletons.forEach(s=>s.dispose());materials.forEach(m=>m.dispose());}
 };
}
export class EmbeddedDragonAnimationPlayer{
 constructor(clips,moves,mixer,idle){this.mixer=mixer;this.idle=idle;this.clips=new Map(clips.map(c=>[c.name,c]));this.active=null;this.previewAction=null;
  // No attack/cast/hit is embedded. Keep the neutral imported idle during those phases;
  // the existing arena still owns contact timing, facing, lunges and projectile effects.
  this.set={travel:this.clips.get('fly'),hit:this.clips.get('idle'),actions:new Map(moves.map((move,i)=>{const spec={...choreography.dragon.moves[i],clip:this.clips.get('idle')};spec.delivery=spec.delivery||(!move.effects.some(e=>e.type==='damage')?'support':move.target==='enemies'?'wave':'melee');return [move.id,spec];}))};
 }
 use(clip){if(this.active?.getClip()!==clip){this.mixer.stopAllAction();this.previewAction=null;this.active=this.mixer.clipAction(clip).reset().play();this.active.paused=true;}return this.active;}
 seek(clip,seconds){const action=this.use(clip);action.time=THREE.MathUtils.clamp(seconds,0,clip.duration);this.mixer.update(0);}
 attack(id,progress){const spec=this.set.actions.get(id);if(!spec)throw Error('Unknown dragon move: '+id);this.seek(spec.clip,progress*spec.clip.duration);return spec;}
 travel(seconds){this.seek(this.set.travel,((seconds%this.set.travel.duration)+this.set.travel.duration)%this.set.travel.duration);}
 hit(progress){this.seek(this.set.hit,progress*this.set.hit.duration);}
 preview(name){const clip=this.clips.get(name);if(!clip)throw Error('Unknown embedded clip: '+name);this.mixer.stopAllAction();this.active=null;this.previewAction=this.mixer.clipAction(clip).reset().play();this.previewAction.paused=false;return this.previewAction;}
 seekClip(name,progress){const clip=this.clips.get(name);if(!clip)throw Error('Unknown embedded clip: '+name);this.seek(clip,progress*clip.duration);}
 reset(){this.mixer.stopAllAction();this.active=null;this.previewAction=null;this.idle.reset().play();this.mixer.update(0);}
 dispose(){this.mixer.stopAllAction();for(const clip of this.clips.values())this.mixer.uncacheClip(clip);this.active=null;this.previewAction=null;}
}
