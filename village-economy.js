const layout=require('./public/village-layout'),workforce=require('./village-workforce');
const unlocks=[2,4,5,7,10],INTERVAL=180000,SHIFT=3600000;
function profile(user,now=Date.now()){
 const homes=layout.profile(user),level=require('./town-hall-progress').profile(user).level;
 const mines=unlocks.map((unlock,i)=>{const shift=user.rubyMineShifts?.[i];const earned=shift?Math.max(0,Math.min(20,Math.floor((now-shift.started)/INTERVAL))):0;return {workers:workforce.assigned(shift,workforce.residents(user)),id:i,unlock,unlocked:level>=unlock,worker:shift?.worker||null,house:shift?.house||shift?.worker?.split('/')[0]||null,household:!!shift?.house,ends:shift?shift.started+SHIFT:0,active:!!shift&&now<shift.started+SHIFT,claimable:Math.max(0,earned-(shift?.claimed||0))};});
 const staff=workforce.profile(user,now);
 return {care:require('./pet-care').profile(user,now),mines,workforce:staff,workers:staff.available.map(id=>({id})),serverNow:now};
}
function action(user,body,now=Date.now()){
 if(/^(station-|pet-|farm-)/.test(body.action||''))return require('./pet-care').action(user,body,now);
 const homes=layout.profile(user),gems={...(user.gems||{})};
 if(body.action==='upgrade-house'){
  if(body.revision!==homes.revision)throw Error('Your village changed. Reopen the island.');
  const tier=homes.houseTiers[body.house];if(!tier||tier>=3)throw Error('Choose a house below tier 3.');
  const cost=tier===1?25:40;if(!(Number(gems.bronze)>=cost))throw Error(`You need ${cost} rubies.`);
  gems.bronze-=cost;return {gems,villageHouseTiers:{...homes.houseTiers,[body.house]:tier+1},villageLayoutRevision:homes.revision+1};
 }
 const state=profile(user,now),shifts={...(user.rubyMineShifts||{})};
 if(body.action==='start-mine'||body.action==='start-household'){
  const available=body.mine===undefined?state.mines.find(m=>m.unlocked&&!m.active):state.mines.find(m=>m.id===body.mine&&m.unlocked&&!m.active);
  if(!available)throw Error('No unlocked mine is available.');
  gems.bronze=(Number(gems.bronze)||0)+available.claimable;
  shifts[available.id]={workers:workforce.allocate(user,3,now),started:now,claimed:0};
  return {gems,rubyMineShifts:shifts};
 }
 const mine=state.mines.find(m=>m.id===body.mine);if(!mine?.unlocked)throw Error('This ruby mine is not unlocked.');
 const old=shifts[body.mine];
 if(body.action==='recall-mine'){
  if(!old)throw Error('There is no villager to call back.');
  delete shifts[body.mine];
 }else if(body.action==='collect-mine'){
  if(!mine.claimable)throw Error('No rubies ready yet.');
  shifts[body.mine]={...old,claimed:(old.claimed||0)+mine.claimable};
 }else throw Error('Unknown village action.');
 gems.bronze=(Number(gems.bronze)||0)+mine.claimable;
 return {gems,rubyMineShifts:shifts};
}
module.exports={profile,action};
