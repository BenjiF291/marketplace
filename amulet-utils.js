const { gemIdentity } = require('./gem-utils');
const SLOT_PRICES = [0, 50, 150, 500, 1000];
const LOCK_MS = 5 * 24 * 60 * 60 * 1000;
const POWERS = [
  ['wheel', 'Fortune Dial', 3, 1, 12, 'extra Footy per wheel spin'],
  ['converter', 'Crystal Furnace', 5, 1.5, 20, '% off converter Footy costs'],
  ['salvage', 'Reclaimer', 5, 2, 25, '% extra Footy when selling cards to their tier'],
  ['pack', 'Unsealer', 10, 5, 60, 'Footy each time you open a pack'],
  ['vip', 'Royal Seal', 5, 1.5, 20, '% off VIP purchases'],
  ['market', 'Bargainer', 2, 1, 10, '% off Footy purchases from the host (seller still receives full payment)'],
  ['ascend', 'Rising Star', 10, 5, 60, 'Footy per successful ascension'],
  ['battle', 'Victor Crest', 5, 2, 25, '% extra Footy on a battle win (maximum 50 Footy)'],
  ['gemshop', 'Artisan Seal', 4, 1, 15, '% off amulet gem prices (rounded up)'],
  ['vipdays', 'Timekeeper', 1, 0.5, 5, 'extra days with each VIP purchase']
];
const EXTRA_POWERS = [
  ['pigment','Prism Brush',1,.15,3,'extra dye per gem crafted into dye'],
  ['packgem','Hidden Geode',10,1,25,'% chance of one Ruby when opening a pack'],
  ['wheelstreak','Third Chime',6,1,18,'extra Footy on every third wheel spin'],
  ['fullbatch','Perfect Furnace',1,0,1,'extra gem when converting exactly three cards'],
  ['trophybonus','Laurel Heart',1,0,3,'extra trophies per ranked win']
];
const EXCLUSIVES = [
 {id:'road:trailblazer',name:'Trailblazer Chime',power:'wheelstreak',value:9,description:'+9 Footy on every third wheel spin',milestone:100},
 {id:'road:chromatic',name:'Chromatic Compass',power:'pigment',value:2,description:'+2 dye per gem crafted into dye',milestone:500},
 {id:'road:champion',name:"Champion's Laurel",power:'trophybonus',value:3,description:'+3 trophies per ranked win',milestone:1750},
 {id:'road:forge',name:'Eternal Furnace',power:'fullbatch',value:2,description:'+2 gems when converting exactly three cards',milestone:3000}
].map(entry=>({...entry,gemKey:'trophy-road',gemName:'Trophy road',tierName:'Trophy exclusive',exclusive:true,price:0}));
const ALL_POWERS=[...POWERS,...EXTRA_POWERS];
const { SETS, CONDITIONS, active } = require('./amulet-designs');
function designs(rank) {
  if(SETS[rank])return SETS[rank];
  // Special tiers use mixed roles rather than rescaled standard-tier items.
  return Array.from({length:5},(_,i)=>{
    const a=ALL_POWERS[(rank+i*3)%ALL_POWERS.length],b=ALL_POWERS[(rank*2+i*3+1)%ALL_POWERS.length];
    return [`special-${i}`,`${a[1]} & ${b[1]}`,{[a[0]]:a[2],[b[0]]:b[2]},['diverse',null,'rubystash','vip','full'][i]];
  });
}
function designFields(design) {
 const [key,name,bonuses,condition]=design;
 const description=Object.entries(bonuses).map(([power,value])=>`${value} ${ALL_POWERS.find(rule=>rule[0]===power)[5]}`).join('; ');
 return {name,bonuses,condition:condition||null,power:Object.keys(bonuses)[0],value:Object.values(bonuses)[0],description:(condition?CONDITIONS[condition]+': ':'')+description};
}
function rebalanceAmulet(slot) {
 if(!slot)return null;
 const exclusive=EXCLUSIVES.find(entry=>entry.id===slot.id);if(exclusive)return {...slot,...exclusive};
 const match=String(slot.id||'').match(/:v2:(\d+):([^:]+)$/);
 if(!match)return slot.id?null:slot;
 const design=designs(Number(match[1])).find(entry=>entry[0]===match[2]);
 return design?{...slot,...designFields(design)}:null;
}
function catalog(tiers) {
 return tiers.flatMap((tier,index)=>{
  const gem=gemIdentity(tier);
  return designs(index).map((design,offset)=>({id:`${tier.id}:v2:${index}:${design[0]}`,...gem,tierRank:index,...designFields(design),price:22+offset*5+Math.min(index,12)*3}));
 }).concat(EXCLUSIVES);
}
function cleanAmulets(user,entries) {
 const valid=new Set(entries.map(entry=>entry.id));
 return {amulets:Object.fromEntries(Object.entries(user.amulets||{}).filter(([id])=>valid.has(id))),
  amuletSlots:(user.amuletSlots||[]).map(slot=>slot&&valid.has(slot.id)?rebalanceAmulet(slot):null)};
}
function effects(user) {
 const result={};
 const slots=(user.amuletSlots||[]).slice(0,Math.max(1,Math.min(5,user.amuletSlotCount||1))).map(rebalanceAmulet).filter(Boolean);
 for(const slot of slots){
  if(!active(slot.condition,user,slots))continue;
  for(const [power,value] of Object.entries(slot.bonuses||{[slot.power]:slot.value})){
   const rule=ALL_POWERS.find(rule=>rule[0]===power);
   if(rule)result[power]=Math.max(result[power]||0,Math.min(slot.id==='road:forge'?2:rule[4],Number(value)||0));
  }
 }
 return result;
}
const round = value => Math.round(value * 100) / 100;
const discounted = (price, percent) => round(price * (1 - (percent || 0) / 100));
function changeAmulets(user, action, body, entries, now = Date.now()) {
  user={...user,...cleanAmulets(user,entries)};
  const owned = { ...(user.amulets || {}) };
  const slots = Array.from({ length: 5 }, (_, index) => (user.amuletSlots || [])[index] || null);
  const count = Math.max(1, Math.min(5, Number(user.amuletSlotCount) || 1));
  const buffs = effects(user);
  if (action === 'buy') {
    const entry = entries.find(entry => entry.id === body.amuletId);
    if (!entry) throw new Error('Amulet not found');
    if(entry.exclusive)throw new Error('This amulet is only earned on the trophy road');
    const price = Math.ceil(entry.price * (1 - (buffs.gemshop || 0) / 100));
    const gems = { ...(user.gems || {}) };
    if ((gems[entry.gemKey] || 0) < price) throw new Error(`Not enough ${entry.gemName}`);
    gems[entry.gemKey] -= price;
    owned[entry.id] = (owned[entry.id] || 0) + 1;
    return { amulets: owned, gems };
  }
  if (action === 'unlock') {
    if (body.expectedCount !== count) throw new Error('Slots changed. Refresh and try again.');
    if (count >= 5) throw new Error('All five slots are unlocked');
    const price = SLOT_PRICES[count];
    if ((user.balance || 0) < price) throw new Error('Not enough Footy');
    return { amuletSlotCount: count + 1, balance: round(user.balance - price) };
  }
  const index = body.slot;
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new Error('Invalid slot');
  if (action === 'equip') {
    const entry = entries.find(entry => entry.id === body.amuletId);
    if (slots[index]) throw new Error('Remove the current amulet first');
    if (!entry || !(owned[entry.id] > 0)) throw new Error('Amulet not in your inventory');
    owned[entry.id] -= 1;
    slots[index] = { ...entry, equippedAt: now, removableAt: now + LOCK_MS };
  } else if (action === 'remove') {
    const slot = slots[index];
    if (!slot) throw new Error('Slot is empty');
    if (user.isAdmin !== true && now < slot.removableAt) throw new Error('This amulet must stay equipped for five days');
    owned[slot.id] = (owned[slot.id] || 0) + 1;
    slots[index] = null;
  } else throw new Error('Unknown amulet action');
  return { amulets: owned, amuletSlots: slots };
}
module.exports = { EXCLUSIVES, catalog, cleanAmulets, effects, discounted, round, changeAmulets, rebalanceAmulet, SLOT_PRICES, LOCK_MS };
