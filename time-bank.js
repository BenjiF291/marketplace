const {randomInt}=require('node:crypto');
const HOUR=3600000, CAPACITY=3;
const interval=n=>HOUR*(5-(Math.max(1,Math.min(10,n))-1)*2.5/9);
const chance=n=>.05+(Math.max(1,Math.min(10,n))-1)*.10/9;
const roll=()=>randomInt(1000000)/1000000;
function settle(u,now){
 const old=u.timeBank||{},workers=old.workers||[],stored=[...(old.stored||[])],rolls=[...(old.rolls||[])];
 let progress=Number(old.progress)||0;
 if(workers.length&&stored.length<CAPACITY)progress+=Math.max(0,now-(old.updatedAt??now))/interval(workers.length);
 while(progress>=1&&stored.length<CAPACITY){stored.push((rolls.shift()??1)<chance(workers.length)?'leap':'skip');progress-=1;}
 if(stored.length>=CAPACITY)progress=0;
 return {workers,stored,rolls,progress,updatedAt:now};
}
function targets(u,now){
 const list=[],add=(id,name,end)=>{if(end>now)list.push({id,name,remaining:end-now});};
 for(const [id,j] of Object.entries(u.rubyMineShifts||{}))add('mine/'+id,'Ruby mine '+(Number(id)+1),j.started+require('./ruby-mine-rules').SHIFT);
 for(const [id,j] of Object.entries(u.farmJobs||{}))add('farm/'+id,'Gather '+id,j.ends);
 if(u.vaultJob)add('vault','Footy vault',u.vaultJob.started+24*HOUR);
 const bank=settle(u,now);if(bank.workers.length&&bank.stored.length<CAPACITY)add('bank','Time Bank',now+(1-bank.progress)*interval(bank.workers.length));
 for(const [id,j] of Object.entries(u.petJourneys||{}))if(j.status==='travelling')add('journey/'+id,id.slice(4)+' journey',j.endsAt);
 for(const [id,c] of Object.entries(u.petCareCooldowns||{}))for(const key of ['play','feed'])add(key+'/'+id,id.slice(4)+' '+key+' cooldown',c[key]);
 for(const [i,slot] of (u.amuletSlots||[]).entries())if(slot)add('amulet/'+i,'Amulet slot '+(i+1)+' removal lock',slot.removableAt);
 const spin=u.lastSpin?.toMillis?.()??(u.lastSpin?new Date(u.lastSpin).getTime():0);if(spin)add('spin','Fortune pavilion',spin+7*HOUR);
 return list;
}
function profile(u,now=Date.now()){
 const b=settle(u,now),n=b.workers.length;
 return {unlocked:require('./town-hall-progress').profile(u).level>=4,workers:b.workers,stored:b.stored,capacity:CAPACITY,interval:interval(n),chance:chance(n),nextAt:n&&b.stored.length<CAPACITY?now+(1-b.progress)*interval(n):0,inventory:{skip:Number(u.timeBoosts?.skip)||0,leap:Number(u.timeBoosts?.leap)||0},targets:targets(u,now)};
}
function action(u,b,now=Date.now()){
 const state=settle(u,now);
 if(b.action==='time-use'){
  if(b.actionId&&(u.timeBoostReceipts||[]).includes(b.actionId))return {}; 
  if(!['skip','leap'].includes(b.token)||!(u.timeBoosts?.[b.token]>0))throw Error('You do not own that time boost.');
  const target=targets(u,now).find(t=>t.id===b.target);if(!target)throw Error('Choose an active personal timer.');
  const amount=Math.min(target.remaining,b.token==='leap'?HOUR:HOUR/3),[type,id]=b.target.split('/'),update={timeBoosts:{...u.timeBoosts,[b.token]:u.timeBoosts[b.token]-1}};
  if(b.actionId)update.timeBoostReceipts=[...(u.timeBoostReceipts||[]).slice(-49),b.actionId];
  if(type==='mine')update.rubyMineShifts={...u.rubyMineShifts,[id]:{...u.rubyMineShifts[id],started:u.rubyMineShifts[id].started-amount}};
  if(type==='farm'){const j=u.farmJobs[id];update.farmJobs={...u.farmJobs,[id]:{...j,started:j.started-amount,ends:j.ends-amount}};}
  if(type==='vault')update.vaultJob={...u.vaultJob,started:u.vaultJob.started-amount};
  if(type==='bank')update.timeBank=settle({...u,timeBank:{...state,updatedAt:now-amount}},now);
  if(type==='journey')update.petJourneys={...u.petJourneys,[id]:{...u.petJourneys[id],endsAt:u.petJourneys[id].endsAt-amount}};
  if(type==='play'||type==='feed')update.petCareCooldowns={...u.petCareCooldowns,[id]:{...u.petCareCooldowns[id],[type]:u.petCareCooldowns[id][type]-amount}};
  if(type==='amulet')update.amuletSlots=u.amuletSlots.map((slot,i)=>i===Number(id)?{...slot,removableAt:slot.removableAt-amount}:slot);
  if(type==='spin'){const end=now+target.remaining-7*HOUR;update.lastSpin=new Date(end-amount);}
  return update;
 }
 if(require('./town-hall-progress').profile(u).level<4)throw Error('The Time Bank unlocks at Town Hall 4.');
 if(b.action==='bank-set'){
  if(!Number.isInteger(b.count)||b.count<0||b.count>10)throw Error('Choose between 0 and 10 villagers.');
  const old=state.workers,keep=old.slice(0,b.count),needed=Math.max(0,b.count-old.length);
  state.workers=[...keep,...require('./village-workforce').allocate(u,needed,now)];
 }else if(b.action==='bank-collect'){
  if(!state.stored.length)throw Error('No time boosts are ready.');
  const inventory={skip:Number(u.timeBoosts?.skip)||0,leap:Number(u.timeBoosts?.leap)||0};for(const token of state.stored)inventory[token]++;state.stored=[];
  while(state.rolls.length<CAPACITY)state.rolls.push(roll());
  return {timeBank:state,timeBoosts:inventory};
 }else throw Error('Unknown Time Bank action.');
 while(state.rolls.length<CAPACITY)state.rolls.push(roll());
 return {timeBank:state};
}
module.exports={interval,chance,settle,profile,action,targets};
