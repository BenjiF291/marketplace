/* Deterministic event-time combat. No timers, DOM, random numbers or persistence. */
(function(root){
 const VERSION='creature-brawl-v1',copy=value=>structuredClone(value),living=u=>u.hp>0;
 const ring=['Protector','Cunning','Swift','Furious'];
 const debuffs=['stun','bind','burn','defDown','atkDown','spdDown'];
 function advantage(a,b){const i=ring.indexOf(a),j=ring.indexOf(b);return (i+1)%4===j?1.25:(j+1)%4===i?.8:1;}
 function effective(u,key){const up=u.statuses[key+'Up']?.magnitude||0,down=u.statuses[key+'Down']?.magnitude||0;return Math.max(key==='spd'?30:0,u.stats[key]*(1+up)*(1-down));}
 function emit(s,type,data={}){s.events.push({seq:s.events.length+1,activation:s.activationId,type,...data});}
 function capAP(s,team,n){s.ap[team]=Math.min(s.config.apCap,Math.max(0,s.ap[team]+n));emit(s,'ap',{team,value:s.ap[team]});}
 function order(s,a,b){return a.next-b.next||(a.team===b.team?0:a.team===s.priority?-1:1)||a.slot-b.slot||a.id.localeCompare(b.id);}
 function checkVictory(s){const teams=[0,1].map(t=>s.units.some(u=>u.team===t&&living(u)));if(!teams[0]||!teams[1]){s.phase='FINISHED';s.winner=teams[0]&&!teams[1]?0:teams[1]&&!teams[0]?1:null;s.reason='elimination';emit(s,'finished',{winner:s.winner,reason:s.reason});return true;}return false;}
 function knockOut(s,u){u.hp=0;u.shield=0;u.shieldStatus=null;u.statuses={};u.next=null;capAP(s,u.team,1);emit(s,'defeat',{id:u.id,team:u.team});}
 function damage(s,source,target,amount,tag='damage'){if(!living(target))return;const absorbed=Math.min(target.shield,amount);target.shield-=absorbed;const dealt=Math.min(target.hp,amount-absorbed);target.hp-=dealt;emit(s,tag,{source:source?.id||target.id,id:target.id,amount:dealt,absorbed,hp:target.hp,shield:target.shield});if(!living(target))knockOut(s,target);}
 function rescale(s,u,oldSpeed){if(living(u)&&u.id!==s.actorId&&Number.isFinite(u.next))u.next=s.clock+Math.max(0,u.next-s.clock)*oldSpeed/effective(u,'spd');}
 function addStatus(s,u,type,duration,magnitude=0){
  if(!living(u))return false;
  if(type==='stun'&&(u.statuses.stun||u.statuses.stunImmune))return false;
  const oldSpeed=effective(u,'spd'),prior=u.statuses[type];
  u.statuses[type]={remaining:Math.max(prior?.remaining||0,duration),magnitude:Math.max(prior?.magnitude||0,magnitude),appliedActivationId:s.activationId};
  if(type==='spdUp'||type==='spdDown')rescale(s,u,oldSpeed);
  emit(s,'status',{id:u.id,status:type,...u.statuses[type]});return true;
 }
 function cleanse(s,u){const type=debuffs.find(type=>u.statuses[type]);if(!type)return;const oldSpeed=effective(u,'spd');delete u.statuses[type];if(type==='stun')addStatus(s,u,'stunImmune',1);if(type==='spdDown')rescale(s,u,oldSpeed);emit(s,'cleanse',{id:u.id,status:type});}
 function tick(s,u){
  for(const [type,status] of Object.entries(u.statuses)){if(status.appliedActivationId===s.activationId)continue;if(--status.remaining<=0){const oldSpeed=effective(u,'spd');delete u.statuses[type];if(type==='spdUp'||type==='spdDown')rescale(s,u,oldSpeed);emit(s,'expire',{id:u.id,status:type});}}
  if(u.shieldStatus&&u.shieldStatus.appliedActivationId!==s.activationId&&--u.shieldStatus.remaining<=0){u.shield=0;u.shieldStatus=null;emit(s,'shieldExpired',{id:u.id});}
 }
 function complete(s,u){tick(s,u);s.completed++;if(living(u))u.next=s.clock+1000/effective(u,'spd');s.actorId=null;if(checkVictory(s))return;if(s.completed>=s.config.drawAt){s.phase='FINISHED';s.winner=null;s.reason='activation-limit';emit(s,'finished',{winner:null,reason:s.reason});}else s.phase='START_ACTIVATION';}
 function advanceInPlace(s){
  while(s.phase==='START_ACTIVATION'){
   if(checkVictory(s))break;
   const u=s.units.filter(living).sort((a,b)=>order(s,a,b))[0];s.clock=u.next;s.actorId=u.id;s.activationId++;emit(s,'activation',{id:u.id,team:u.team,time:s.clock});
   if(u.statuses.burn)damage(s,null,u,Math.max(1,Math.round(u.maxHP*.05)),'burn');
   if(!living(u)){s.completed++;s.actorId=null;if(checkVictory(s))break;if(s.completed>=s.config.drawAt){s.phase='FINISHED';s.winner=null;s.reason='activation-limit';emit(s,'finished',{winner:null,reason:s.reason});break;}continue;}
   if(u.statuses.stun){delete u.statuses.stun;addStatus(s,u,'stunImmune',1);emit(s,'stunned',{id:u.id});complete(s,u);continue;}
   const surge=s.completed>=s.config.surgeAt;if(surge&&!s.surge){s.surge=true;emit(s,'surge');}capAP(s,u.team,surge?2:1);s.phase='AWAITING_ACTION';
  }
  return s;
 }
 function create(id,teams,options={}){
  const s={id,revision:0,rulesVersion:VERSION,priority:options.priority??0,config:{apCap:5,surgeAt:24,drawAt:80,...options.config},phase:'START_ACTIVATION',clock:0,activationId:0,completed:0,ap:[0,0],actorId:null,winner:null,surge:false,events:[],units:[]};
  if(teams.length!==2||teams.some(t=>t.length!==3))throw Error('Select exactly three creatures per team.');
  teams.forEach((team,t)=>team.forEach((entry,slot)=>{if(s.units.some(u=>u.id===entry.id))throw Error('Combatant IDs must be unique.');const stats=copy(entry.stats),u={...copy(entry),team:t,slot,maxHP:stats.hp,hp:stats.hp,stats,shield:0,shieldStatus:null,statuses:{},next:1000/Math.max(30,stats.spd)};s.units.push(u);}));return advanceInPlace(s);
 }
 function legal(s,moveId){
  const actor=s.units.find(u=>u.id===s.actorId),move=actor?.moves.find(m=>m.id===moveId);
  if(s.phase!=='AWAITING_ACTION'||!actor||!living(actor)||!move)return {targets:[],reason:'No creature is awaiting this action.'};
  if(move.cost&&actor.statuses.bind)return {targets:[],reason:'Bound: only the free basic attack is available.'};
  if(move.cost>s.ap[actor.team])return {targets:[],reason:`Needs ${move.cost} AP; team has ${s.ap[actor.team]}.`};
  let targets=s.units.filter(u=>living(u)&&(move.target==='self'?u.id===actor.id:['ally','allies'].includes(move.target)?u.team===actor.team:u.team!==actor.team));
  if(move.target==='enemy'){const taunters=targets.filter(u=>u.statuses.taunt).sort((a,b)=>b.statuses.taunt.appliedActivationId-a.statuses.taunt.appliedActivationId||a.id.localeCompare(b.id));if(taunters.length)targets=[taunters[0]];}
  targets.sort((a,b)=>a.slot-b.slot||a.id.localeCompare(b.id));return {targets:targets.map(u=>u.id),reason:targets.length?'':'No living valid target.'};
 }
 function resolveInPlace(s,moveId,targetId){
  const actor=s.units.find(u=>u.id===s.actorId),move=actor?.moves.find(m=>m.id===moveId),available=legal(s,moveId);
  if(available.reason)throw Error(available.reason);if(!available.targets.includes(targetId))throw Error('Choose a valid living target.');
  const startTargets=available.targets.map(id=>s.units.find(u=>u.id===id)),targets=move.target==='allies'||move.target==='enemies'?startTargets:[s.units.find(u=>u.id===targetId)];
  s.phase='RESOLVING';capAP(s,actor.team,-move.cost);emit(s,'action',{source:actor.id,moveId,name:move.name,targets:targets.map(u=>u.id),cost:move.cost});
  for(const effect of move.effects){const list=effect.target==='self'?[actor]:effect.target==='allies'?s.units.filter(u=>u.team===actor.team&&living(u)).sort((a,b)=>a.slot-b.slot):effect.target==='enemies'?s.units.filter(u=>u.team!==actor.team&&living(u)).sort((a,b)=>a.slot-b.slot):targets;
   for(const target of list){if(!living(target))continue;
    if(effect.type==='damage')for(let hit=0;hit<(effect.hits||1)&&living(target);hit++){const def=effective(target,'def')*(1-(effect.ignoreDef||0)),raw=effective(actor,'atk')*effect.power*advantage(actor.role,target.role)*(move.cost?actor.stats.specialPower:1);damage(s,actor,target,Math.max(1,Math.round(raw*100/(100+def))));}
    else if(effect.type==='heal'){const amount=Math.min(target.maxHP-target.hp,Math.round(target.maxHP*effect.ratio));target.hp+=amount;emit(s,'heal',{source:actor.id,id:target.id,amount,hp:target.hp});}
    else if(effect.type==='shield'){const amount=Math.min(Math.round(target.maxHP*.4),Math.max(target.shield,Math.round(target.maxHP*effect.ratio)));target.shield=amount;target.shieldStatus={remaining:Math.max(target.shieldStatus?.remaining||0,effect.duration||2),appliedActivationId:s.activationId};emit(s,'shield',{source:actor.id,id:target.id,shield:amount});}
    else if(effect.type==='status')addStatus(s,target,effect.status,effect.duration,effect.magnitude);
    else if(effect.type==='cleanse')cleanse(s,target);
   }
  }
  return actor;
 }
 function preview(source,moveId,targetId){const s=copy({...source,events:[]}),from=0;resolveInPlace(s,moveId,targetId);return {events:s.events.slice(from),targets:s.units.map(u=>{const old=source.units.find(v=>v.id===u.id);return {id:u.id,hp:u.hp,damage:Math.max(0,old.hp-u.hp),heal:Math.max(0,u.hp-old.hp),shield:u.shield,shieldGain:Math.max(0,u.shield-old.shield),shieldDamage:Math.max(0,old.shield-u.shield),knockout:old.hp>0&&u.hp===0,advantage:advantage(source.units.find(v=>v.id===source.actorId).role,u.role)};}).filter(u=>u.damage||u.heal||u.shieldGain||u.shieldDamage||s.events.slice(from).some(e=>e.id===u.id&&['status','cleanse'].includes(e.type)))};}
 function act(source,{moveId,targetId}){const s=copy(source),actor=resolveInPlace(s,moveId,targetId);complete(s,actor);s.revision++;if(s.phase!=='FINISHED')advanceInPlace(s);return s;}
 function choose(s){
  const actor=s.units.find(u=>u.id===s.actorId);if(!actor||s.phase!=='AWAITING_ACTION')return null;const actions=[];
  for(const move of actor.moves){const valid=legal(s,move.id);for(const targetId of valid.targets){const p=preview(s,move.id,targetId);let score=-move.cost*5;
   for(const t of p.targets){const target=s.units.find(u=>u.id===t.id),enemy=target.team!==actor.team,threat=Math.max(0,...s.units.filter(u=>u.team!==target.team&&living(u)).map(u=>effective(u,'atk')*advantage(u.role,target.role)*100/(100+effective(target,'def'))));score+=(enemy?1:-1)*(t.damage+t.shieldDamage*.8)+(enemy?-1:1)*(t.heal*.95+Math.min(t.shieldGain,threat*1.5)*.45);if(t.knockout)score+=enemy?300:-500;}
   for(const e of p.events){const target=s.units.find(u=>u.id===e.id);if(e.type==='status'){const existing=target.statuses[e.status],useful=!existing||existing.remaining<e.remaining||existing.magnitude<e.magnitude;const turns=Math.max(0,e.remaining-(existing?.remaining||0)),strike=effective(target,'atk')*.6;
    // Price team buffs by their magnitude and useful lifetime, not a flat bonus.
    // Otherwise the AI ignores speed/attack support regardless of its actual strength.
    const value=e.status==='stun'?40+effective(target,'atk')*.25+effective(target,'spd')*.1:e.status==='bind'?20+s.ap[target.team]*8:e.status==='burn'?target.maxHP*.05*turns:['atkUp','atkDown','spdUp','spdDown'].includes(e.status)?strike*e.magnitude*turns*(e.status.startsWith('spd')?1.25:1):['defUp','defDown'].includes(e.status)?target.maxHP*.18*e.magnitude*turns:35;
    score+=useful?value:-12;}if(e.type==='cleanse')score+=e.status==='stun'?90:40;}
   if(move.target==='enemies'&&valid.targets.length===1)score-=20;
   actions.push({moveId:move.id,targetId,score});if(['enemies','allies','self'].includes(move.target))break;
  }}return actions.sort((a,b)=>b.score-a.score||a.moveId.localeCompare(b.moveId)||a.targetId.localeCompare(b.targetId))[0]||null;
 }
 function timeline(source,count=8){const s=copy({...source,events:[]}),result=[];if(s.phase==='FINISHED')return result;
  // Simulate known starts (including skipped Stun/Burn activations), never invented actions.
  if(s.phase==='AWAITING_ACTION'){const u=s.units.find(u=>u.id===s.actorId);result.push({id:u.id,team:u.team,time:s.clock});complete(s,u);}
  let safety=0;while(result.length<count&&s.phase!=='FINISHED'&&safety++<100){const from=s.events.length;advanceInPlace(s);const events=s.events.slice(from);for(const e of events.filter(e=>e.type==='activation'))result.push({id:e.id,team:e.team,time:e.time,skipped:events.some(v=>v.activation===e.activation&&['stunned','defeat'].includes(v.type)&&v.id===e.id)});if(s.phase==='AWAITING_ACTION')complete(s,s.units.find(u=>u.id===s.actorId));}return result.slice(0,count);
 }
 const api={VERSION,create,act,advance:source=>advanceInPlace(copy(source)),legal,preview,choose,timeline,effective,advantage,addStatus,cleanse,damage};if(typeof module!=='undefined')module.exports=api;else root.CreatureBrawlEngine=api;
})(typeof window==='undefined'?globalThis:window);
