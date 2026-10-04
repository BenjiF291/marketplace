const {stations,has}=require('./pet-stations');
const {SHIFT:MINE_SHIFT}=require('./ruby-mine-rules');
const layout=require('./public/village-layout'),workforce=require('./village-workforce');
const RESOURCES={water:{minutes:20,tier:1},carrot:{minutes:40,tier:1},corn:{minutes:80,tier:2},milk:{minutes:120,tier:3},meat:{minutes:240,tier:3}};
const PETS=['pet:fox','pet:snail','pet:dragon'];
const MULTIPLIERS=[1,1.08,1.2,1.38,1.65,2,2.45,3,3.6,4.25,5];
const MEALS={food:{name:'Regular meal',gain:1,ingredients:{water:1,carrot:1},tier:1},'food:trail':{name:'Better meal',gain:2,ingredients:{water:1,corn:1},tier:2},'food:feast':{name:'Extraordinary meal',gain:4,ingredients:{milk:1,meat:1},tier:3}};
const happiness=(u,id)=>Math.max(0,Math.min(10,Math.trunc(Number(u.petHappiness?.[id])||0)));
function busyHouses(u,now=Date.now()){
 return new Set([...Object.values(u.rubyMineShifts||{}).filter(s=>now<s.started+MINE_SHIFT).map(s=>s.house||s.worker?.split('/')[0]),...Object.values(u.farmJobs||{}).filter(j=>now<j.ends).map(j=>j.house),...stations(u).map(s=>s.house).filter(Boolean)]);
}
function profile(u,now=Date.now()){
 const busy=busyHouses(u,now),homes=layout.profile(u),level=require('./town-hall-progress').profile(u).level;
 const farmJobs=Object.entries(u.farmJobs||{}).filter(([id])=>Object.hasOwn(RESOURCES,id)).map(([resource,j])=>({...j,resource,active:now<j.ends,claimable:Math.max(0,Math.min(3,Math.floor((now-j.started)/((j.ends-j.started)/3||RESOURCES[resource].minutes*60000)))-(j.claimed||0))}));
 return {workforce:workforce.profile(u,now),resources:RESOURCES,farmJobs,stationUnlocked:level>=3&&(u.villageGridVersion!==2||u.villageLayout?.petstation!==undefined),farmUnlocked:level>=2&&(u.villageGridVersion!==2||u.villageLayout?.farmhouse!==undefined),farmLevel:Math.max(1,Math.min(3,Number(u.farmLevel)||1)),ingredients:u.farmIngredients||{},meals:Object.entries(MEALS).map(([id,m])=>({id,...m,owned:Number(u.rubyItems?.[id])||0})),stations:stations(u).map(s=>({...s,workers:workforce.assigned(s,workforce.residents(u))})),station:u.petStation?{...u.petStation,workers:workforce.assigned(u.petStation,workforce.residents(u))}:null,availableHouses:Object.keys(homes.houseTiers).filter(h=>!busy.has(h)),pets:PETS.filter(id=>u.rubyItems?.[id]>0).map(id=>({id,playReadyAt:Number(u.petCareCooldowns?.[id]?.play)||0,feedReadyAt:Number(u.petCareCooldowns?.[id]?.feed)||0,happiness:happiness(u,id),multiplier:MULTIPLIERS[happiness(u,id)],travelling:u.petJourneys?.[id]?.status==='travelling',inStation:has(u,id)})),serverNow:now};
}
function action(u,b,now=Date.now()){u=require('./gem-wallet').user(u);
 const state=profile(u,now);
 if(b.action==='station-send'){
  if(!state.stationUnlocked)throw Error('The pet station unlocks at Town Hall 3.');
  if(has(u,b.pet))throw Error('This pet is already in the station.');
  if(!state.pets.some(p=>p.id===b.pet&&!p.travelling))throw Error('Choose an owned pet that is not exploring.');
  const pets=Object.fromEntries(stations(u).map(s=>[s.pet,s]));pets[b.pet]={workers:workforce.allocate(u,1,now),pet:b.pet,started:now};return {petStations:pets,petStation:Object.values(pets)[0]||null};
 }
 if(b.action==='station-recall'){const pets=Object.fromEntries(stations(u).map(s=>[s.pet,s])),id=b.pet||(Object.keys(pets).length===1?Object.keys(pets)[0]:null);if(!id||!pets[id])throw Error('Choose a pet in the station.');delete pets[id];return {petStations:pets,petStation:Object.values(pets)[0]||null};}
 if(b.action==='pet-play'||b.action==='pet-feed'){
  if(!has(u,b.pet))throw Error('Send this pet and a caretaker to the pet station first.');
  if(!state.pets.some(p=>p.id===b.pet&&!p.travelling))throw Error('This pet is unavailable.');
  const current=happiness(u,b.pet);if(current===10)throw Error('Your pet is already at maximum happiness.');
  const key=b.action==='pet-play'?'play':'feed',ready=Number(u.petCareCooldowns?.[b.pet]?.[key])||0;if(now<ready)throw Error(`${key==='play'?'Play':'Feeding'} is available in ${Math.ceil((ready-now)/60000)} minutes.`);
  const petCareCooldowns={...(u.petCareCooldowns||{}),[b.pet]:{...(u.petCareCooldowns?.[b.pet]||{}),[key]:now+(key==='play'?3600000:7200000)}};
  if(b.action==='pet-play')return {petCareCooldowns,petHappiness:{...(u.petHappiness||{}),[b.pet]:Math.min(10,current+1)}};
  const meal=Object.hasOwn(MEALS,b.food)?MEALS[b.food]:null;if(!meal||!(u.rubyItems?.[b.food]>0))throw Error('Choose a meal you own.');
  return {petCareCooldowns,petHappiness:{...(u.petHappiness||{}),[b.pet]:Math.min(10,current+meal.gain)},rubyItems:{...u.rubyItems,[b.food]:u.rubyItems[b.food]-1}};
 }
 if(b.action==='farm-start'){
  const resource=Object.hasOwn(RESOURCES,b.resource)?RESOURCES[b.resource]:null;if(!state.farmUnlocked||!resource||resource.tier>state.farmLevel)throw Error('This ingredient is not unlocked.');
  if(state.farmJobs.some(j=>j.resource===b.resource))throw Error('Collect this ingredient assignment first.');
  return {farmJobs:{...(u.farmJobs||{}),[b.resource]:{workers:workforce.allocate(u,2,now),started:now,ends:now+3*resource.minutes*60000,claimed:0}}};
 }
 if(b.action==='farm-collect'||b.action==='farm-recall'){
  const job=state.farmJobs.find(j=>j.resource===b.resource);if(!job)throw Error('Assignment not found.');
  const jobs={...(u.farmJobs||{})};if(b.action==='farm-recall'||!job.active)delete jobs[b.resource];else jobs[b.resource]={...u.farmJobs[b.resource],claimed:(job.claimed||0)+job.claimable};
  return {farmJobs:jobs,farmIngredients:{...(u.farmIngredients||{}),[b.resource]:(Number(u.farmIngredients?.[b.resource])||0)+job.claimable}};
 }
 if(b.action==='farm-upgrade'){
  if(!state.farmUnlocked||state.farmLevel===3)throw Error('Farmhouse upgrade unavailable.');
  if(b.level!==state.farmLevel)throw Error('Farmhouse changed. Refresh and try again.');
  const required=state.farmLevel===1?5:6;if(require('./town-hall-progress').profile(u).level<required)throw Error(`Town Hall level ${required} is required.`);
  const cost=state.farmLevel===1?50:100;if(!(u.gems?.bronze>=cost))throw Error(`You need ${cost} rubies.`);
  return {farmLevel:state.farmLevel+1,gems:{...u.gems,bronze:u.gems.bronze-cost}};
 }
 if(b.action==='farm-cook'){
  const meal=Object.hasOwn(MEALS,b.food)?MEALS[b.food]:null;if(!state.farmUnlocked||!meal||meal.tier>state.farmLevel)throw Error('Upgrade the farmhouse to cook this meal.');
  const ingredients={...(u.farmIngredients||{})};for(const [id,n] of Object.entries(meal.ingredients)){if(!(ingredients[id]>=n))throw Error(`You need ${n} ${id}.`);ingredients[id]-=n;}
  return {farmIngredients:ingredients,rubyItems:{...(u.rubyItems||{}),[b.food]:(Number(u.rubyItems?.[b.food])||0)+1}};
 }
 throw Error('Unknown pet care action.');
}
module.exports={RESOURCES,PETS,MEALS,MULTIPLIERS,happiness,busyHouses,profile,action};
