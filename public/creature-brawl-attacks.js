import {combatRotation} from './creature-brawl-skin.js?v=1';
import {isRill,buildRillAnimations} from './rill-combat-motion.js?v=skin2';
import * as THREE from './vendor/three/three.module.js';
import {locomotion} from './creature-brawl-locomotion.js?v=rill4';

// Choreography is presentation data, never combat data. Every roster entry has
// its own three routines, timed contact marker and locomotion cadence.
const routine=(style,duration,options={})=>({style,duration,contact:.54,...options});
export const choreography={
 velkris:{stride:.52,amplitude:.30,moves:[routine('fang-snap',.92),routine('stinger-strike',1.20),routine('carapace-guard',1.24)]},
 fox:{stride:.58,amplitude:.42,moves:[routine('bite',.82,{side:-1}),routine('feint',1.04,{side:1}),routine('call',1.12)]},
 snail:{stride:1.05,amplitude:.08,moves:[routine('shell-bash',1.18),routine('retract',1.24),routine('shell-rock',1.32)]},
 dragon:{stride:.64,amplitude:.32,moves:[routine('claw',.86,{side:1}),routine('breath',1.18,{delivery:'projectile'}),routine('wing-sweep',1.22,{spread:1.1})]},
 rill:{stride:.54,amplitude:.34,moves:[routine('talon',.82,{side:-1,hop:.32}),routine('dive',1.04,{hop:.55}),routine('updraft',1.16)]},
 'rill-species':{stride:.60,amplitude:.30,moves:[routine('talon',.90,{side:1,hop:.18}),routine('twin-talons',1.08,{hop:.26}),routine('wing-call',1.24,{spread:.75})]},
 brugar:{stride:.88,amplitude:.22,moves:[routine('paw-slam',1.16,{side:-1,weight:1.05}),routine('brace',1.20),routine('roar',1.36,{spread:.45})]},
 'brugar-species':{stride:.94,amplitude:.20,moves:[routine('paw-slam',1.24,{side:1,weight:.85}),routine('tail-guard',1.32),routine('crush',1.42,{side:-1})]},
 krynn:{stride:.56,amplitude:.40,moves:[routine('rake',.84,{side:-1}),routine('pounce',1.02,{hop:.32,side:-1}),routine('tail-whip',1.18,{side:1})]},
 'krynn-species':{stride:.62,amplitude:.36,moves:[routine('rake',.92,{side:1,weight:.85}),routine('cross-rake',1.12,{side:1}),routine('roar',1.28,{weight:.75})]},
 fenra:{stride:.78,amplitude:.26,moves:[routine('hoof',1.02,{side:-1}),routine('crest-call',1.28),routine('wing-call',1.42,{spread:.9})]},
 'fenra-species':{stride:.84,amplitude:.24,moves:[routine('crest-jab',1.12),routine('crest-guard',1.36),routine('crest-pulse',1.40,{delivery:'projectile'})]},
 veyrin:{stride:.64,amplitude:.36,moves:[routine('bite',1.02,{weight:1.2,side:1}),routine('pounce',1.24,{hop:.40,side:1}),routine('wing-roar',1.38)]},
 tharos:{stride:.78,amplitude:.28,moves:[routine('horn-uppercut',1.16),routine('horn-charge',1.30,{weight:1.2}),routine('wing-sweep',1.44,{spread:.85})]},
 talren:{stride:.70,amplitude:.32,moves:[routine('horn-jab',1.00),routine('horn-charge',1.16),routine('bellow',1.32)]},
 'northern-talren':{stride:.82,amplitude:.25,moves:[routine('shoulder',1.10,{side:-1}),routine('crest-guard',1.26,{weight:.7}),routine('stand',1.38)]},
 'defender-talren':{stride:.96,amplitude:.21,moves:[routine('shoulder',1.26,{side:1,weight:1.2}),routine('brace',1.40,{weight:1.3}),routine('shield-check',1.34,{side:1})]},
 'defender-rill':{stride:.66,amplitude:.28,moves:[routine('talon',1.00,{side:1,hop:.12,weight:.8}),routine('wing-cover',1.28,{spread:.8}),routine('dive',1.20,{hop:.40,side:1})]},
 kanji:{stride:.60,amplitude:.35,moves:[routine('saber-bite',.98),routine('feather-pounce',1.16,{hop:.34}),routine('wing-cover',1.34,{spread:1.05})]},
 trusk:{stride:.90,amplitude:.23,moves:[routine('bear-hook',1.20,{side:-1}),routine('scale-brace',1.34),routine('shoulder-rush',1.32,{side:1})]}
};

// Each signature uses the anatomy that delivers it, not a shared root bounce.
choreography.brugar.moves=[routine('twin-tail-sweep',1.36,{side:-1,turn:1.05,lunge:0}),routine('tail-fortress',1.30),routine('tail-fortress',1.42,{spread:.3})];
choreography['brugar-species'].moves=[routine('twin-tail-sweep',1.38,{side:1,turn:-1.05,lunge:0}),routine('tail-fortress',1.32),routine('twin-tail-smash',1.46,{turn:-1.15,lunge:0})];
choreography.krynn.moves[2]=routine('forked-tail-whip',1.30,{delivery:'wave',side:-1});
choreography['krynn-species'].moves[2]=routine('forked-tail-whip',1.34,{delivery:'wave',side:1});
choreography.velkris.moves[1]=routine('stinger-strike',1.20,{lunge:0});
choreography.dragon.moves[1]=routine('claw',1.18);
choreography.dragon.moves[2]=routine('breath',1.22,{delivery:'wave'});
choreography.fenra.moves[1]=routine('hoof',1.28);
choreography['fenra-species'].moves[1]=routine('crest-jab',1.36);
choreography.veyrin.moves[2]=routine('double-maul',1.38,{lunge:.07});
choreography['defender-rill'].moves[1]=routine('twin-talons',1.28);
choreography.trusk.moves[0]=routine('bear-hook',1.32,{side:-1,lunge:.025});
choreography.trusk.moves[2]=routine('shoulder-rush',1.40,{side:1,lunge:.13});
// Talons and wing strokes provide the action; ground models do not get a root hop.
for(const profile of Object.values(choreography))for(const spec of profile.moves)delete spec.hop;

const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
const phases=[0,.28,.54,.73,1];
function envelope(t,values){let i=0;while(i<phases.length-2&&t>phases[i+1])i++;return THREE.MathUtils.lerp(values[i],values[i+1],smooth((t-phases[i])/(phases[i+1]-phases[i])));}

// Anatomical groups are resolved against real bone names. The original pet rigs
// use numbered legs; newer species use front/rear chains. No mesh is stretched.
function anatomy(model){
 const bones=model.joints,byName=new Map(bones.map(b=>[b.name,b]));
 const group=re=>bones.filter(b=>re.test(b.name)).map(b=>b.name);
 return {bones,byName,head:group(/^Head_joint$/),neck:group(/^Neck_(joint|lower)$/),body:group(/^Torso$/),pelvis:group(/^Pelvis$/),jaw:group(/^Jaw_joint$|^Beak_joint$/),
  front:[group(/^Leg_(front_left|left|0)_hip$/),group(/^Leg_(front_right|right|1)_hip$/)],
  knees:[group(/^Leg_(front_left|left|0)_knee$/),group(/^Leg_(front_right|right|1)_knee$/)],
  hind:group(/^Leg_(rear_left|rear_right|2|3)_hip$/),
  wings:[group(/^Wing_left_(root|elbow|wrist)$/),group(/^Wing_right_(root|elbow|wrist)$/)],
  tails:group(/^Tail_.*(root|bone_0|curve_0|upper_0|lower_0|left_0|right_0)$|^Tail_0$/),
  upperTail:group(/^Tail_upper_[0-9]+$/),lowerTail:group(/^Tail_lower_[0-9]+$/),shell:group(/^Shell_joint$/),feelers:group(/^Feeler_.*base$/),crest:group(/^Crest_joint$/),fangs:group(/^Fang_/),sting:group(/^Stinger_joint$/),tailChain:group(/^Tail_[0-9]+$/)};
}

function actionPose(a,spec,t){
 const pose=new Map(),weight=spec.weight||1,side=spec.side||1,index=side<0?0:1;
 const w=envelope(t,[0,1,0,0,0]),hit=envelope(t,[0,0,1,.36,0]),follow=envelope(t,[0,0,0,1,0]);
 const rotate=(names,x=0,y=0,z=0)=>names.forEach(name=>{const p=pose.get(name)||{rotation:[0,0,0],position:[0,0,0]};p.rotation[0]+=x*weight;p.rotation[1]+=y*weight;p.rotation[2]+=z*weight;pose.set(name,p);});
 const translate=(names,x=0,y=0,z=0)=>names.forEach(name=>{const p=pose.get(name)||{rotation:[0,0,0],position:[0,0,0]};p.position[0]+=x;p.position[1]+=y;p.position[2]+=z;pose.set(name,p);});
 const head=(x,y=0)=>{rotate(a.neck,x*.45,y*.3);rotate(a.head,x,y);};
 const paw=(i,amount,across=0)=>{rotate(a.front[i],amount,across,side*(w*.10-hit*.15));rotate(a.knees[i],-amount*.55);};
 const wings=(amount,sweep=0)=>a.wings.forEach((names,i)=>names.forEach((n,j)=>rotate([n],sweep/(j+1),0,(i?1:-1)*amount/(j+1))));
 const tail=amount=>rotate(a.tails,0,amount,amount*.12);
 const tailChain=(names,angle,lift=0)=>names.forEach((name,i)=>rotate([name],lift*.25/(i+1),angle*(i===0?.42:.035),0));
 switch(spec.style){
  case 'twin-tail-sweep':case 'twin-tail-smash':case 'forked-tail-whip':{
   const smash=spec.style==='twin-tail-smash',sweep=side*(-.62*w+.72*hit+.20*follow);
   // Coil both chains, then release the heavy clubs in staggered arcs.
   tailChain(a.upperTail,sweep,smash?-.24*w+.22*hit:-.08*w);
   tailChain(a.lowerTail,side*(-.48*w+.62*hit+.32*follow),smash?.16*w-.22*hit:.08*w);
   rotate(a.pelvis,0,side*(-.12*w+.20*hit));rotate(a.body,smash?.08*hit:0,side*(-.10*w+.14*hit));
   head(.06*w,-side*.18*hit);a.front.forEach((_,i)=>{paw(i,-.10*w+.12*hit);});break;
  }
  case 'tail-fortress':
   tailChain(a.upperTail,-.32*hit);tailChain(a.lowerTail,-.28*hit);
   head(.16*hit);rotate(a.body,.04*hit);a.front.forEach((_,i)=>paw(i,.12*hit));break;
  case 'double-maul':
   paw(0,-.72*w+.48*hit,-.24*hit);paw(1,-.42*hit+.48*follow,.30*follow);
   head(-.18*w+.24*hit+.12*follow);rotate(a.jaw,.32*w-.08*hit+.22*follow);
   rotate(a.body,0,-.12*w+.16*hit-.16*follow);tail(.20*w-.18*hit);break;
  case 'fang-snap':
   head(-.12*w+.18*hit);rotate(a.jaw,.25*w-.12*hit);a.fangs.forEach((name,i)=>rotate([name],0,(i?1:-1)*(.20*w-.25*hit)));paw(0,-.18*w+.14*hit);paw(1,-.18*w+.14*hit);tail(.10*w-.08*hit);break;
  case 'stinger-strike':
   if(spec.tailStrikePose)for(const [name,angle] of spec.tailStrikePose)rotate([name],-.10*w+angle*hit);else{a.tailChain.forEach((name,i)=>rotate([name],(-.12*w+.23*hit)/(1+i*.30),0,0));rotate(a.tails,-.15*w+.42*hit);}rotate(a.sting,-.30*w+.25*hit);head(.08*w);rotate(a.fangs,0,.04*w);break;
  case 'carapace-guard':
   head(.15*w+.10*hit);a.front.forEach((names,i)=>rotate(names,-.12*hit,(i?1:-1)*.18*hit));a.knees.forEach((names,i)=>rotate(names,0,0,(i?1:-1)*.16*hit));rotate(a.tails,-.18*hit);a.fangs.forEach((name,i)=>rotate([name],0,(i?1:-1)*-.15*hit));break;
  case 'bite':case 'saber-bite':
   head(-.22*w+.27*hit,-side*.18*w+side*.08*hit);rotate(a.jaw,.38*w-.06*hit);paw(index,-.25*w+.18*hit);tail(side*(.16*w-.10*hit));if(spec.style==='saber-bite')wings(.18*w-.08*hit);break;
  case 'feint':
   rotate(a.body,.06*w,side*(-.22*w+.16*hit));head(-.1*w+.16*hit,-side*.2*hit);paw(index,-.65*w+.40*hit,-side*.2*hit);tail(-side*.34*hit);break;
  case 'claw':case 'rake':case 'cross-rake':case 'bear-hook':
   paw(index,-.75*w+.46*hit,side*(.20*w-.38*hit));head(-.08*w+.14*hit);rotate(a.body,0,side*(-.08*w+.09*hit));tail(side*(.20*w-.16*hit));
   if(spec.style==='cross-rake')paw(1-index,-.35*w+.34*follow,-side*.25*follow);
   if(spec.style==='bear-hook'){rotate(a.body,-.05*w+.07*hit,side*.10*hit);rotate(a.knees[index],.28*hit);}break;
  case 'paw-slam':case 'crush':
   paw(index,-.85*w+.40*hit);rotate(a.body,-.05*w+.10*hit);head(-.18*w+.16*hit);tail(-side*.20*w+side*.13*hit);if(spec.style==='crush')paw(1-index,-.58*w+.28*hit);break;
  case 'talon':case 'twin-talons':case 'hoof':
   paw(index,-.65*w-.95*hit);rotate(a.knees[index],.72*w+.32*hit);head(-.10*w+.16*hit);wings((spec.spread||.55)*w+.22*hit);tail(.15*w-.1*hit);
   if(spec.style==='twin-talons'){paw(1-index,-.50*w-.80*follow);rotate(a.knees[1-index],.55*w+.25*follow);}break;
  case 'dive':case 'pounce':case 'feather-pounce':
   a.front.forEach((_,i)=>paw(i,-.70*w+.32*hit));rotate(a.hind,.35*w-.20*hit);head(-.18*w+.28*hit);rotate(a.jaw,.3*w-.06*hit);wings(spec.style==='pounce'?.15*w:.65*w-.16*hit);tail(.22*w-.15*hit);break;
  case 'horn-jab':case 'horn-charge':case 'horn-uppercut':case 'crest-jab':
   head(.32*w-(spec.style==='horn-uppercut'?.42:.22)*hit);rotate(a.body,.08*w-.07*hit);paw(index,-.20*w+.15*hit);tail(-.16*w+.14*hit);rotate(a.crest,-.08*hit);break;
  case 'shoulder':case 'shoulder-rush':case 'shield-check':
   rotate(a.body,.08*w-.04*hit,side*(-.20*w+.22*hit),side*.06*hit);head(.16*w,-side*.12*hit);paw(index,-.28*w+.22*hit);tail(-side*.25*w+side*.13*hit);break;
  case 'shell-bash':
   rotate(a.shell,0,-.28*w+.34*hit,-.10*w+.12*hit);translate(a.head,0,-.08*w,-.28*w+.12*hit);rotate(a.feelers,-.35*w+.10*hit);break;
  case 'retract':case 'shell-rock':
   translate(a.head,0,-.12*w-.06*hit,-.38*w-.18*hit);rotate(a.feelers,-.40*w-.20*hit);rotate(a.shell,spec.style==='shell-rock'?.12*hit:0,.16*w-.10*hit,(spec.style==='shell-rock'?.23:.08)*hit);break;
  case 'tail-whip':
   rotate(a.body,0,-side*.18*w+side*.22*hit);tail(side*(.38*w-.50*hit));head(0,side*.2*w-side*.15*hit);paw(index,-.2*w+.14*hit);break;
  case 'wing-sweep':case 'updraft':case 'wing-call':case 'wing-cover':
   wings((spec.spread||.85)*w-(spec.style==='wing-cover'?.12:.25)*hit,-.16*w+.24*hit);head(-.20*w+.12*hit);rotate(a.crest,-.15*w+.1*hit);tail(.14*w-.1*hit);break;
  case 'breath':case 'crest-pulse':
   head(-.32*w+.18*hit);rotate(a.jaw,.42*hit+.18*w);wings(.32*w+.16*hit);rotate(a.crest,-.22*w+.13*hit);tail(.16*w);break;
  case 'brace':case 'scale-brace':case 'tail-guard':case 'crest-guard':case 'stand':
   head(.20*w-.25*hit);rotate(a.body,.06*w-.04*hit);a.front.forEach((_,i)=>{rotate(a.front[i],-.12*w,(i?1:-1)*.12*hit);rotate(a.knees[i],.12*w);});tail(spec.style==='tail-guard'?.38*hit:.14*w);wings(.24*hit);rotate(a.crest,-.18*hit);break;
  case 'call':case 'crest-call':case 'roar':case 'wing-roar':case 'bellow':
   head(-.36*w-.22*hit,side*.07*follow);rotate(a.jaw,.45*hit);rotate(a.crest,-.20*w-.1*hit);rotate(a.body,-.04*hit);wings((spec.style==='wing-roar'?.65:spec.spread||.22)*hit);tail(-.18*w+.20*hit);break;
  default:throw Error('Unauthored Brawl attack: '+spec.style);
 }
 return pose;
}

// Solve the articulated stinger in the model's sagittal plane at authoring time.
// CCD preserves every tail segment length; only joint rotations become keyframes.
function stingerContact(model,a){
 const chain=[...a.tailChain,...a.sting].map(n=>a.byName.get(n));if(chain.length<3||!a.sting.length)return null;
 model.root.updateMatrixWorld(true);const points=chain.map(b=>model.root.worldToLocal(b.getWorldPosition(new THREE.Vector3()))),angles=chain.slice(0,-1).map(()=>0),head=model.root.worldToLocal(a.byName.get('Head_joint').getWorldPosition(new THREE.Vector3())),target=new THREE.Vector3(0,Math.max(.28,head.y+.12),head.z+.35);
 for(let iteration=0;iteration<48;iteration++)for(let i=points.length-2;i>=0;i--){const pivot=points[i],tip=points.at(-1),ay=tip.y-pivot.y,az=tip.z-pivot.z,by=target.y-pivot.y,bz=target.z-pivot.z;let turn=THREE.MathUtils.clamp(Math.atan2(ay*bz-az*by,ay*by+az*bz),-.25,.25),limit=i===0?1.55:1.15;turn=THREE.MathUtils.clamp(angles[i]+turn,-limit,limit)-angles[i];angles[i]+=turn;const c=Math.cos(turn),s=Math.sin(turn);for(let j=i+1;j<points.length;j++){const y=points[j].y-pivot.y,z=points[j].z-pivot.z;points[j].y=pivot.y+c*y-s*z;points[j].z=pivot.z+s*y+c*z;}}
 return chain.slice(0,-1).map((b,i)=>[b.name,angles[i]]);
}

export function buildCombatAnimations(model,kind,moves){
 if(isRill(kind))return buildRillAnimations(model,kind,moves);
 const profile=choreography[kind];if(!profile||profile.moves.length!==moves.length)throw Error('Missing choreography for '+kind);
 const a=anatomy(model),rest=new Map(a.bones.map(b=>[b.name,{q:b.quaternion.clone(),p:b.position.clone()}]));
 function clip(name,duration,poseAt,steps=40,solvedJoints=new Set()){
  const times=Array.from({length:steps+1},(_,i)=>i/steps*duration),tracks=[],frames=times.map((_,i)=>poseAt(i/steps));
  for(const bone of a.bones){const rotations=[],positions=[],r=rest.get(bone.name);for(let i=0;i<=steps;i++){const p=frames[i].get(bone.name),q=r.q.clone();if(p)q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...(solvedJoints.has(bone.name)?p.rotation:combatRotation(bone.name,p.rotation)))));rotations.push(...q.toArray());positions.push(r.p.x+(p?.position[0]||0),r.p.y+(p?.position[1]||0),r.p.z+(p?.position[2]||0));}
   tracks.push(new THREE.QuaternionKeyframeTrack(bone.name+'.quaternion',times,rotations),new THREE.VectorKeyframeTrack(bone.name+'.position',times,positions));}
  return new THREE.AnimationClip(name,duration,tracks);
 }
 const actions=new Map(moves.map((move,i)=>{const spec={...profile.moves[i],...(profile.moves[i].style==='stinger-strike'?{tailStrikePose:stingerContact(model,a)}:{})},hostile=move.effects.some(e=>e.type==='damage');spec.delivery=spec.delivery||(!hostile?'support':move.target==='enemies'?'wave':'melee');const solvedJoints=new Set(spec.tailStrikePose?.map(([name])=>name));const animation=clip(kind+':'+move.id,spec.duration,t=>actionPose(a,spec,t),40,solvedJoints);return [move.id,{...spec,clip:animation}];}));
 const movement=locomotion[kind];
 const travel=clip(kind+':travel',profile.stride,t=>{
  const pose=new Map(),put=(names,x=0,y=0,z=0)=>names.forEach(n=>pose.set(n,{rotation:[x,y,z],position:[0,0,0]}));
  const phase=t*Math.PI*2,legs=a.bones.filter(b=>/^Leg_.*_hip$/.test(b.name)),air=movement.mode==='flight';
  if(movement.mode==='scuttle'){
   legs.forEach(b=>{const sign=b.name.includes('left')?-1:1,row=b.name.includes('mid_front')?1:b.name.includes('mid_rear')?2:b.name.includes('rear')?3:0,swing=Math.sin(phase+((row+(sign>0?1:0))%2)*Math.PI),lift=Math.max(0,swing);put([b.name],0,sign*swing*.30,sign*lift*.22);put([b.name.replace(/hip$/,'knee')],0,0,-sign*lift*.18);});put(a.head,Math.sin(phase*2)*.025);put(a.tails,0,Math.sin(phase)*.06);
  }else if(air){
   const tuck=.75+.08*Math.cos(phase);
   a.front.forEach((names,i)=>{put(names,-.80*tuck);put(a.knees[i],.70*tuck);});put(a.hind,.50*tuck);
   if(movement.mode==='flight'){
    a.wings.forEach((names,i)=>names.forEach((name,j)=>put([name],-.10*Math.sin(phase),0,(i?1:-1)*Math.sin(phase)*[.90,.24,.12][j])));
   }
   put(a.body,-.08*Math.sin(phase));put(a.head,.14*tuck);put(a.neck,-.10*tuck);
  }else{
   legs.forEach(b=>{const left=/left|_0_|_2_/.test(b.name),rear=/rear|_2_|_3_/.test(b.name),s=Math.sin(phase+(left!==rear?0:Math.PI)),heavy=['brugar','brugar-species','trusk'].includes(kind),amplitude=heavy?.28:.42;put([b.name],s*amplitude);put([b.name.replace(/hip$/,'knee')],Math.max(0,-s)*(heavy?.38:.62));});
   put(a.body,-.018*Math.sin(phase*2),Math.sin(phase)*.018);put(a.neck,Math.sin(phase*2)*.025);put(a.head,-Math.sin(phase*2)*.02);if(kind==='kanji')a.wings.forEach((names,i)=>names.forEach((name,j)=>put([name],0,0,(i?1:-1)*(.12+.10*Math.sin(phase))/(j+1))));
  }
  put(a.tails,0,Math.sin(phase)*.14);
  if(kind==='snail')a.bones.filter(b=>b.name.startsWith('Foot_wave_')).forEach((b,i)=>{const p=Math.sin(phase-i*.45)*.045;pose.set(b.name,{rotation:[0,0,0],position:[0,p,Math.cos(phase-i*.45)*.045]});});return pose;
 },48);
 const hit=clip(kind+':hit',.28,t=>{const p=new Map(),s=Math.sin(t*Math.PI);for(const name of [...a.head,...a.neck])p.set(name,{rotation:[-.14*s,.05*s,0],position:[0,0,0]});for(const name of a.front[0])p.set(name,{rotation:[-.12*s,0,0],position:[0,0,0]});return p;});
 return {actions,travel,hit};
}
