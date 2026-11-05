import {combatRotation} from './creature-brawl-skin.js?v=1';
import * as THREE from './vendor/three/three.module.js';

export const isRill=kind=>['rill','rill-species','defender-rill'].includes(kind);
const clamp=x=>THREE.MathUtils.clamp(x,0,1),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
function curve(t,keys){for(let i=1;i<keys.length;i++)if(t<=keys[i][0])return THREE.MathUtils.lerp(keys[i-1][1],keys[i][1],smooth((t-keys[i-1][0])/(keys[i][0]-keys[i-1][0])));return keys.at(-1)[1];}
const wrap=t=>((t%1)+1)%1;
function pose(){const map=new Map();return {map,set(name,x=0,y=0,z=0,dy=0){map.set(name,{rotation:[x,y,z],position:[0,dy,0]});}};}
function wings(p,spread,fold=.1,sweep=0,tip=.05,bank=0){
 for(const [side,sign] of [['left',-1],['right',1]]){
  p.set('Wing_'+side+'_root',sweep,sign*.05,sign*(spread+bank*sign));
  p.set('Wing_'+side+'_elbow',fold*.18,sign*fold*.30,sign*fold);
  p.set('Wing_'+side+'_wrist',-fold*.15,sign*(tip*.45),sign*fold*.32);
  p.set('Wing_'+side+'_tip',tip*.18,sign*tip,sign*tip*.25);
 }
}
function leg(p,side,hip,knee,ankle,toes,splay=0){const sign=side==='left'?-1:1;p.set('Leg_'+side+'_hip',hip,sign*splay,sign*.025);p.set('Leg_'+side+'_knee',knee);p.set('Foot_'+side,ankle,sign*splay*.3);p.set('Toes_'+side,toes,sign*splay*.5);}
function tail(p,time,strength=.035,pitch=0){for(let i=0;i<7;i++)p.set('Tail_'+i,pitch/(i+2)+Math.sin(time*2-i*.43)*strength*.35,Math.sin(time-i*.38)*strength*(.5+i*.08),Math.sin(time-i*.3)*strength*.12);}
function ground(t){const p=pose(),phase=t*Math.PI*2;
 p.set('Pelvis',Math.sin(phase)*.006,Math.sin(phase)*.008);
 p.set('Torso',Math.sin(phase*2)*.014,0,Math.sin(phase)*.008);
 p.set('Neck_joint',Math.sin(phase)*.025,Math.sin(phase)*.07);
 p.set('Head_joint',-Math.sin(phase)*.018,Math.sin(phase+.35)*.06,Math.sin(phase)*.025);
 p.set('Crest_joint',Math.sin(phase-.3)*.025);p.set('Beak_joint',Math.max(0,Math.sin(phase))*.015);
 wings(p,.02+Math.sin(phase)*.012,.015,0,Math.sin(phase-.5)*.018);
 for(const side of ['left','right'])leg(p,side,0,0,0,Math.sin(phase)*.012);
 tail(p,phase,.018);return p;
}
function flight(t){const p=pose(),phase=wrap(t),angle=phase*Math.PI*2;
 // A short, extended power stroke and a longer, folded recovery stroke.
 const spread=curve(phase,[[0,1.68],[.38,.18],[.64,.78],[1,1.68]]),fold=curve(wrap(phase-.07),[[0,.12],[.35,.015],[.69,.18],[1,.12]]);
 wings(p,spread,fold,-.14+Math.sin(angle)*.08,Math.sin(angle-.7)*.035);
 p.set('Pelvis',.25+Math.sin(angle-.3)*.018,0,Math.sin(angle)*.015);
 p.set('Torso',.28+Math.sin(angle-.4)*.025,0,Math.sin(angle)*.012);
 p.set('Neck_joint',-.35-Math.sin(angle-.4)*.025);
 p.set('Head_joint',-.09+Math.sin(angle-.4)*.015,Math.sin(angle*.5)*.015);
 p.set('Crest_joint',-.08+Math.sin(angle-.65)*.045);p.set('Beak_joint',.025+Math.sin(angle)*.012);
 leg(p,'left',1.12,-.52,-.35,.72,.05);leg(p,'right',1.15,-.55,-.33,.76,.05);
 tail(p,angle-.7,.04,-.12);return p;
}
function blend(a,b,mix){const out=pose();for(const key of new Set([...a.map.keys(),...b.map.keys()])){const x=a.map.get(key)||{rotation:[0,0,0],position:[0,0,0]},y=b.map.get(key)||{rotation:[0,0,0],position:[0,0,0]};out.map.set(key,{rotation:x.rotation.map((v,i)=>THREE.MathUtils.lerp(v,y.rotation[i],mix)),position:x.position.map((v,i)=>THREE.MathUtils.lerp(v,y.position[i],mix))});}return out;}
function launch(t){const crouch=Math.sin(Math.PI*clamp(t/.48))*.10,p=blend(ground(0),flight(0),smooth((t-.18)/.82));p.set('Pelvis',p.map.get('Pelvis').rotation[0]-.10*crouch,0,p.map.get('Pelvis').rotation[2],-crouch);if(t<.55){leg(p,'left',-.22*crouch,.55*crouch,-.28*crouch,-.12*crouch);leg(p,'right',-.22*crouch,.55*crouch,-.28*crouch,-.12*crouch);}return p;}
function land(t){const p=blend(flight(0),ground(0),smooth(t)),absorb=Math.sin(Math.PI*t)**2;
 p.set('Pelvis',p.map.get('Pelvis').rotation[0]-.05*absorb,0,p.map.get('Pelvis').rotation[2],-.06*absorb);p.set('Torso',p.map.get('Torso').rotation[0]+.08*absorb);
 const extend=smooth(t/.52),settle=smooth((t-.52)/.48);
 for(const side of ['left','right']){const r=side==='right';leg(p,side,THREE.MathUtils.lerp(r?1.15:1.12,-.15,extend)*(1-settle),THREE.MathUtils.lerp(r?-.55:-.52,.30,extend)*(1-settle),THREE.MathUtils.lerp(r?-.33:-.35,-.15,extend)*(1-settle),THREE.MathUtils.lerp(r?.76:.72,-.20,extend)*(1-settle),.05*(1-extend)+.06*absorb);}
 return p;
}
function strike(t,slot,support){const pulse=curve(t,[[0,0],[.26,1],[.54,0],[.76,.15],[1,0]]),hit=curve(t,[[0,0],[.30,0],[.54,1],[.72,.35],[1,0]]),follow=curve(t,[[0,0],[.54,0],[.73,1],[1,0]]),p=support?ground(0):flight(0);
 if(support){
  wings(p,.03+1.22*hit+.65*pulse,.10+.18*pulse,-.14*hit,.15*hit);
  p.set('Torso',-.11*hit);p.set('Neck_joint',-.18*pulse-.10*hit);p.set('Head_joint',-.18*hit);p.set('Beak_joint',.26*hit);p.set('Crest_joint',-.20*hit);
  for(const side of ['left','right'])leg(p,side,.05*hit,-.08*hit,.03*hit,-.10*hit,.04*hit);
 }else{
  const first=slot===1?'right':'left',other=first==='left'?'right':'left';
  wings(p,1.68-.60*pulse+.10*hit,curve(.93,[[0,.12],[.35,.015],[.69,.18],[1,.12]])+.15*pulse-.20*hit,-.14-.16*pulse+.14*hit,Math.sin(-.7)*.035+.10*pulse-.08*hit,slot===1?.08*hit:-.06*hit);
  leg(p,first,1.12+.10*pulse-2.17*hit,-.52+.48*hit,-.35-.14*hit,.72-1.18*hit,.05+.11*hit);
  leg(p,other,1.15-.12*hit-1.45*follow,-.55+.20*follow,-.33-.15*follow,.76-.85*follow,.05+.10*follow);
  p.set('Pelvis',p.map.get('Pelvis').rotation[0]-.30*hit,0,(slot===1?1:-1)*.06*hit);
  p.set('Torso',p.map.get('Torso').rotation[0]-.22*hit,0,(slot===1?1:-1)*.08*hit);
  p.set('Neck_joint',p.map.get('Neck_joint').rotation[0]+.20*hit,0);p.set('Head_joint',p.map.get('Head_joint').rotation[0]+.12*hit);p.set('Beak_joint',.025+.21*hit);p.set('Crest_joint',p.map.get('Crest_joint').rotation[0]-.18*pulse+.09*hit);
 }
 // Tail segments counterbalance a kick, with smaller delayed rotations toward the tip.
 for(let i=0;i<7;i++){const rest=p.map.get('Tail_'+i).rotation;p.set('Tail_'+i,rest[0]+(.13*pulse-.18*hit+.05*follow)/(i+2),rest[1]+Math.sin(i*.5)*.025*hit,rest[2]);}
 return p;
}
export function buildRillAnimations(model,kind,moves){
 const rest=new Map(model.joints.map(b=>[b.name,{q:b.quaternion.clone(),p:b.position.clone()}]));
 function clip(name,duration,poseAt,steps=96){const times=Array.from({length:steps+1},(_,i)=>duration*i/steps),frames=times.map((_,i)=>poseAt(i/steps).map),tracks=[];
  for(const bone of model.joints){const r=rest.get(bone.name),qs=[],ps=[];for(const f of frames){const p=f.get(bone.name)||{rotation:[0,0,0],position:[0,0,0]},q=r.q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...combatRotation(bone.name,p.rotation))));qs.push(...q.toArray());ps.push(...r.p.clone().add(new THREE.Vector3(...p.position)).toArray());}tracks.push(new THREE.QuaternionKeyframeTrack(bone.name+'.quaternion',times,qs),new THREE.VectorKeyframeTrack(bone.name+'.position',times,ps));}return new THREE.AnimationClip(kind+':'+name,duration,tracks);
 }
 const actions=new Map(moves.map((move,slot)=>{const hostile=move.effects.some(e=>e.type==='damage'),support=slot===2,duration=slot===0?1.32:slot===1?1.42:1.48;
  return [move.id,{style:support?'rill-wing-fan':slot===0?'rill-talon-strike':'rill-hooking-rake',duration,contact:.54,airborne:!support,delivery:!hostile?'support':move.target==='enemies'?'wave':'melee',lunge:.025,attackSocket:!support?(slot===0?'Toes_left':'Toes_right'):undefined,clip:clip(move.id,duration,t=>strike(t,slot,support))}];
 }));
 const travel=clip('flight',kind==='defender-rill'?.84:.72,flight),idle=clip('idle-alert',6.4,ground);
 const hit=clip('hit',.32,t=>{const p=ground(0),s=Math.sin(t*Math.PI)**2;p.set('Torso',-.12*s,0,.06*s);p.set('Neck_joint',-.12*s);p.set('Head_joint',-.18*s);p.set('Crest_joint',.10*s);wings(p,.10*s,.04*s);tail(p,t*Math.PI*2,.018,.10*s);return p;});
 return {actions,travel,idle,hit,takeoff:clip('takeoff',.72,launch),landing:clip('landing',.64,land)};
}
