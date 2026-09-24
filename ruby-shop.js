const {randomInt}=require('node:crypto');
const {dayKey}=require('./daily-packs');
const GOODS=[
 ['pet:fox','Ember Fox',100,'pet','A curious geode fox. Click to play; treats are optional.'],
 ['pet:snail','Crystal Snail',150,'pet','A tiny roaming crystal collector.'],
 ['pet:dragon','Pocket Dragon',250,'pet','A playful dragon that peeks around your home.'],
 ['food','Crystal Crunch',2,'supply','One optional treat for your active companion.'],
 ['relic:rose','Petrified Ruby Rose',150,'relic','A permanent collectible for your display shelf.'],
 ['relic:moon','Crimson Moon',250,'relic','A rare carved moon for your display shelf.'],
 ['relic:crown','Ancient Geode Crown',400,'relic','The centrepiece of a ruby collection.'],
 ['opening:embers','Ember Burst',100,'opening','A permanent fiery pack reveal.'],
 ['opening:aurora','Crystal Aurora',100,'opening','A permanent aurora pack reveal.'],
 ['profile:ember','Ember Collector',60,'profile','Ruby profile frame and collector title.'],
 ['profile:royal','Crimson Royalty',120,'profile','Golden profile frame and royal title.'],
 ['recall','Amulet Recall',40,'supply','Remove one locked amulet now. Returns it to your inventory.'],
 ['fuel','Converter Fuel',15,'supply','Half off the next conversion after amulet discounts, saving up to 100 Footy.'],
 ['retry','Wheel Retry',20,'supply','Replace your latest wheel reward. May be worse. Once per Amsterdam day.']
].map(([id,name,price,kind,description])=>({id,name,price,kind,description}));
const COMPASSES=[['common',12,2,'Silver'],['uncommon',25,5,'Rare Gold'],['rare',45,7,'Lightning'],['ultra',80,8,'Ultra'],['mythical',140,Infinity,'all configured special tiers'],['legendary',220,Infinity,'every pack, including unclassified packs']].map(([key,price,maxRank,limit])=>({id:`compass:${key}`,name:`${key==='ultra'?'Ultra Rare':key[0].toUpperCase()+key.slice(1)} Compass`,price,maxRank,kind:'supply',description:`Choose one of up to three different cards from your next selected pack, up to ${limit}.`}));
const CATALOG=[...GOODS,...COMPASSES];
function spend(user,id){const owned={...(user.rubyItems||{})};if(!(owned[id]>0))throw Error('You do not own this item');owned[id]--;return owned;}
function purchase(user,id){const item=CATALOG.find(item=>item.id===id);if(!item)throw Error('Unknown Ruby item');if(item.kind!=='supply'&&(user.rubyItems?.[id]||0)>0)throw Error('Already owned');const gems={...(user.gems||{})};if(!(gems.bronze>=item.price))throw Error('Not enough Rubies');gems.bronze-=item.price;return {gems,rubyItems:{...(user.rubyItems||{}),[id]:(user.rubyItems?.[id]||0)+1}};}
function compassAllowed(id,packId,tiers){const compass=COMPASSES.find(c=>c.id===id);if(!compass)return false;if(id==='compass:legendary')return true;const ordered=[...tiers].sort((a,b)=>a.order-b.order);const rank=ordered.findIndex(t=>(t.packs||[]).includes(packId)||packId===`trophy-${String(t.name).toLowerCase().replace(/\s+/g,'-')}`);return rank>=0&&rank<=compass.maxRank;}
function choices(cards){const pool=[...new Set(cards)],result=[];while(pool.length&&result.length<3)result.push(pool.splice(randomInt(pool.length),1)[0]);return result;}
function use(user,body,now=Date.now()){
 const id=body.itemId,item=CATALOG.find(item=>item.id===id);if(!item)throw Error('Unknown Ruby item');
 if(!(user.rubyItems?.[id]>0))throw Error('You do not own this item');
 if(['pet','opening','profile'].includes(item.kind))return {rubyEquipped:{...(user.rubyEquipped||{}),[item.kind]:id}};
 if(id==='food'){if(!user.rubyEquipped?.pet||!user.rubyItems?.[user.rubyEquipped.pet])throw Error('Choose a companion first');return {rubyItems:spend(user,id),rubyTreats:(user.rubyTreats||0)+1};}
 if(id==='fuel')return {rubyFuelArmed:true};
 if(id==='recall'){const slots=[...(user.amuletSlots||[])],slot=slots[body.slot];if(!Number.isInteger(body.slot)||body.slot<0||!slot)throw Error('Choose an occupied amulet slot');slots[body.slot]=null;return {rubyItems:spend(user,id),amuletSlots:slots,amulets:{...(user.amulets||{}),[slot.id]:(user.amulets?.[slot.id]||0)+1}};}
 throw Error('Use this item with its matching activity');
}
function retryWheel(user,base,now=Date.now()){
 const day=dayKey(new Date(now));const spin=user.lastSpin?.toDate?user.lastSpin.toDate().getTime():new Date(user.lastSpin||0).getTime();
 if(!spin||now-spin>7*3600000||user.rubyRetryDay===day||!user.wheelRetryReward)throw Error('No eligible spin, or retry already used today');
 const amount=base*user.wheelRetryReward.multiplier+user.wheelRetryReward.bonus;
 const balance=Math.round(((user.balance||0)-(user.lastSpinAmount||0)+amount)*100)/100;
 if(balance<0)throw Error('Keep enough Footy to replace your previous reward');
 return {rubyItems:spend(user,'retry'),rubyRetryDay:day,balance,lastSpinAmount:amount};
}
function fuelCost(user,cost){return user.rubyFuelArmed?Math.round((cost-Math.min(100,Math.round(cost*50)/100))*100)/100:cost;}
module.exports={fuelCost,CATALOG,spend,purchase,compassAllowed,choices,use,retryWheel};
