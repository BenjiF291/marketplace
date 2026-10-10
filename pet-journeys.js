const {randomInt}=require('node:crypto');
const {gemIdentity}=require('./gem-utils');
const {catalog}=require('./amulet-utils');
const HOURS=4*3600000;
const PET_PERKS={
 'pet:fox':'Affordable explorer: standard food odds and a full extra journey alongside your other pets.',
 'pet:snail':'Crystal Collector: 25% chance to add one gem to its haul, capped at 5.',
 'pet:dragon':'Treasure Hunter: the same extra-gem chance as the snail, better high-tier gem odds, and double the rare bonus chance.'
};
function petOdds(table,petId,happiness=0){
 const collector=petId==='pet:snail'||petId==='pet:dragon',dragon=petId==='pet:dragon';
 const quantities=table.quantities.map((q,i,all)=>{const weight=collector?Math.round(q.weight*(i===4?1:.75)+(i?all[i-1].weight*.25:0)):q.weight;return {...q,weight,percent:weight/10000};});
 const gw=dragon?weights(table.gems.map((_,i)=>Math.pow(Math.min(.98,table.decay+.02),i))):table.gems.map(g=>g.weight);
 const rewards=table.rewards.map(r=>{const weight=dragon?(r.kind==='none'?1000000-(1000000-r.weight)*2:r.weight*2):r.weight;return {...r,weight,percent:weight/10000};});
 const multiplier=require('./pet-care').MULTIPLIERS[Math.max(0,Math.min(10,Math.trunc(happiness)||0))];
 // Multiply the odds of better outcomes relative to the baseline outcome, then normalize.
 const boost=rows=>{if(multiplier===1)return rows.map(r=>({...r,percent:r.weight/10000}));const adjusted=weights(rows.map((r,i)=>r.weight*(i?multiplier:1)));return rows.map((r,i)=>({...r,weight:adjusted[i],percent:adjusted[i]/10000}));};
 return {perk:PET_PERKS[petId],happiness,multiplier,gems:boost(table.gems.map((g,i)=>({...g,weight:gw[i]}))),quantities:boost(quantities),rewards:boost(rewards)};
}
const FOODS=[
 {id:'food',name:'Crystal Crunch',price:2,decay:.22,amounts:[45,30,15,8,2],bonus:100},
 {id:'food:trail',name:'Explorer Trail Mix',price:8,decay:.28,amounts:[20,30,25,18,7],bonus:400},
 {id:'food:feast',name:'Starlight Feast',price:20,decay:.34,amounts:[8,17,30,28,17],bonus:1000}
];
function weights(values,total=1000000){const sum=values.reduce((a,b)=>a+b,0);if(!sum)return [];const out=values.map(v=>Math.max(1,Math.floor(v/sum*total)));let left=total-out.reduce((a,b)=>a+b,0);for(let i=0;left>0;i++,left--)out[i%out.length]++;return out;}
function tables(tiers,packs){
 const ordered=[...tiers].sort((a,b)=>Number(a.order)-Number(b.order));
 const gems=ordered.map(gemIdentity);
 const amulets=catalog(ordered).filter(a=>!a.exclusive&&a.tierRank>=4).map(a=>({kind:'amulet',id:a.id,name:`${a.gemName} — ${a.name}`}));
 const specialPacks=packs.filter(p=>p.cardIds?.length&&ordered.some((t,i)=>i>=4&&(t.packs||[]).includes(p.id))).map(p=>({kind:'pack',id:p.id,name:p.name+' Pack',pack:{name:p.name,cardIds:p.cardIds,color:p.color||'#667eea'}}));
 const bonuses=[...amulets,...specialPacks];
 return FOODS.map(food=>{
  const gw=weights(gems.map((_,i)=>Math.pow(food.decay,i)));
  const bw=weights(bonuses.map(()=>1),food.bonus);
  return {...food,gems:gems.map((g,i)=>({...g,weight:gw[i],percent:gw[i]/10000})),quantities:food.amounts.map((p,i)=>({amount:i+1,weight:p*10000,percent:p})),
   rewards:[{kind:'none',name:'No bonus item',weight:1000000-(bonuses.length?food.bonus:0),percent:(1000000-(bonuses.length?food.bonus:0))/10000},...bonuses.map((b,i)=>({...b,weight:bw[i],percent:bw[i]/10000}))]};
 }).map(table=>({...table,petOdds:Object.fromEntries(Object.keys(PET_PERKS).map(id=>[id,petOdds(table,id)]))}));
}
function draw(rows,roll=randomInt(1000000)){let sum=0;for(const row of rows){sum+=row.weight;if(roll<sum)return row;}throw Error('Invalid loot table');}
function pets(user){const ids=user.rubyEquipped?.pets??(user.rubyEquipped?.pet?[user.rubyEquipped.pet]:[]);return [...new Set(ids)].filter(id=>['pet:fox','pet:snail','pet:dragon'].includes(id)&&user.rubyItems?.[id]>0);}
function start(user,petId,foodId,loot,journeyId,now=Date.now(),rolls){
 if(!['pet:fox','pet:snail','pet:dragon'].includes(petId)||!user.rubyItems?.[petId])throw Error('You do not own that pet');
 if(user.petJourneys?.[petId]?.status==='travelling')throw Error('This pet already has a journey. Claim its rewards first.');
 const food=loot.find(t=>t.id===foodId);if(!food||!food.gems.length)throw Error('Journey food or gem tiers unavailable');
 if(require('./pet-stations').has(user,petId))throw Error('Call your pet home from the pet station before exploring.');
 const table=petOdds(food,petId,require('./pet-care').happiness(user,petId));
 if(!(user.rubyItems?.[foodId]>0))throw Error('You need one serving of this food');
 const gem=draw(table.gems,rolls?.[0]),amount=draw(table.quantities,rolls?.[1]).amount,bonus=draw(table.rewards,rolls?.[2]);
 const journey={id:journeyId,petId,foodId,happiness:table.happiness,happinessMultiplier:table.multiplier,startedAt:now,endsAt:now+HOURS,status:'travelling',reward:{gemKey:gem.gemKey,gemName:gem.gemName,amount,bonus}};
 return {rubyItems:{...user.rubyItems,[foodId]:user.rubyItems[foodId]-1},petJourneys:{...(user.petJourneys||{}),[petId]:journey}};
}
function claim(user,petId,journeyId,now=Date.now()){user=require('./gem-wallet').user(user);
 const journey=user.petJourneys?.[petId];if(!journey||journey.id!==journeyId)throw Error('Journey not found');
 if(journey.status!=='travelling')throw Error('Rewards already claimed');if(now<journey.endsAt)throw Error('Your pet is still travelling');
 const reward=journey.reward,update={petHappiness:{...(user.petHappiness||{}),[petId]:1},gems:{...(user.gems||{}),[reward.gemKey]:(user.gems?.[reward.gemKey]||0)+reward.amount},petJourneys:{...user.petJourneys,[petId]:{...journey,status:'claimed',claimedAt:now}}};
 if(reward.bonus.kind==='amulet')update.amulets={...(user.amulets||{}),[reward.bonus.id]:(user.amulets?.[reward.bonus.id]||0)+1};
 return {update,reward};
}
module.exports={FOODS,HOURS,PET_PERKS,tables,petOdds,draw,pets,start,claim};
