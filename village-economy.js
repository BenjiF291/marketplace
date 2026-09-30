const layout=require('./public/village-layout');
const unlocks=[2,4,5,7,10],INTERVAL=180000,SHIFT=3600000;
function profile(user,now=Date.now()){
 const homes=layout.profile(user),level=require('./town-hall-progress').profile(user).level;
 const mines=unlocks.map((unlock,i)=>{const shift=user.rubyMineShifts?.[i];const earned=shift?Math.max(0,Math.min(20,Math.floor((now-shift.started)/INTERVAL))):0;return {id:i,unlock,unlocked:level>=unlock,worker:shift?.worker||null,ends:shift?shift.started+SHIFT:0,active:!!shift&&now<shift.started+SHIFT,claimable:Math.max(0,earned-(shift?.claimed||0))};});
 const busy=new Set(mines.filter(m=>m.active).map(m=>m.worker));
 const workers=Object.keys(homes.houseTiers).flatMap(id=>Array.from({length:[0,3,5,10][homes.houseTiers[id]]},(_,i)=>({id:`${id}/${i}`,name:`House ${Number(id.split(':')[1])+1}, villager ${i+1}`}))).filter(w=>!busy.has(w.id));
 return {mines,workers,serverNow:now};
}
function action(user,body,now=Date.now()){
 const homes=layout.profile(user),gems={...(user.gems||{})};
 if(body.action==='upgrade-house'){
  if(body.revision!==homes.revision)throw Error('Your village changed. Reopen the island.');
  const tier=homes.houseTiers[body.house];if(!tier||tier>=3)throw Error('Choose a house below tier 3.');
  const cost=tier===1?25:40;if(!(Number(gems.bronze)>=cost))throw Error(`You need ${cost} rubies.`);
  gems.bronze-=cost;return {gems,villageHouseTiers:{...homes.houseTiers,[body.house]:tier+1},villageLayoutRevision:homes.revision+1};
 }
 const state=profile(user,now),mine=state.mines.find(m=>m.id===body.mine);if(!mine?.unlocked)throw Error('This ruby mine is not unlocked.');
 const shifts={...(user.rubyMineShifts||{})},old=shifts[body.mine];
 if(body.action==='start-mine'){
  if(mine.active)throw Error('This mine already has a working villager.');
  if(!state.workers.some(w=>w.id===body.worker))throw Error('Choose an available villager.');
  shifts[body.mine]={worker:body.worker,started:now,claimed:0};
 }else if(body.action==='collect-mine'){
  if(!mine.claimable)throw Error('No rubies ready yet.');
  shifts[body.mine]={...old,claimed:(old.claimed||0)+mine.claimable};
 }else throw Error('Unknown village action.');
 gems.bronze=(Number(gems.bronze)||0)+mine.claimable;
 return {gems,rubyMineShifts:shifts};
}
module.exports={profile,action};
