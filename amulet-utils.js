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
const STANDARD_GEMS = ['bronze', 'rare-bronze', 'silver', 'rare-silver', 'gold', 'rare-gold', 'platinum', 'lightning', 'ultra'];
const OLD_CURVES = { wheel: [2, 1], converter: [3, 1], salvage: [2, 1], pack: [1, .5], vip: [2, 1], market: [1, .5], ascend: [1, .5], battle: [1, .5], gemshop: [2, 1], vipdays: [.5, .25] };
function rebalanceAmulet(slot) {
  if (!slot) return slot;
  const exclusive=EXCLUSIVES.find(entry=>entry.id===slot.id);if(exclusive)return {...slot,...exclusive};
  const rule = ALL_POWERS.find(rule => rule[0] === slot.power);
  if (!rule) return slot;
  let rank = Number.isInteger(slot.tierRank) ? slot.tierRank : STANDARD_GEMS.indexOf(slot.gemKey);
  // Older equipped snapshots lack a rank. Recover custom tiers from their original curve.
  if (rank < 0 && slot.id && OLD_CURVES[slot.power]) {
    const [base, step] = OLD_CURVES[slot.power];
    rank = Math.max(0, Math.round((Number(slot.value) - base) / step));
  }
  if (!Number.isFinite(rank) || rank < 0) return slot;
  const rawValue = Math.min(rule[4], rule[2] + rank * rule[3]);
  const value=EXTRA_POWERS.some(entry=>entry[0]===slot.power)?Math.floor(rawValue):rawValue;
  return { ...slot, tierRank: rank, value, description: `${['converter', 'vip', 'market', 'gemshop'].includes(slot.power) ? '' : '+'}${value} ${rule[5]}` };
}
function catalog(tiers) {
  return tiers.flatMap((tier, index) => {
    const gem = gemIdentity(tier);
    const standard = Array.from({ length: 5 }, (_, offset) => {
      const [power, name, base, step, cap, description] = POWERS[(index * 3 + offset) % POWERS.length];
      const value = Math.min(cap, base + index * step);
      return { id: `${tier.id}:${power}`, ...gem, tierRank: index, name: `${gem.gemName} ${name}`, power, value,
        description: `+${value} ${description}`.replace('+', ['converter', 'vip', 'market', 'gemshop'].includes(power) ? '' : '+'),
        price: 18 + offset * 3 + Math.min(index, 12) * 2 };
    });
    const extra=Array.from({length:2},(_,offset)=>{
      const [power,name,base,step,cap,description]=EXTRA_POWERS[(index+offset)%4];
      const value=Math.floor(Math.min(cap,base+index*step));
      return {id:`${tier.id}:${power}`,...gem,tierRank:index,name:`${gem.gemName} ${name}`,power,value,description:`${value} ${description}`,price:35+offset*7+Math.min(index,12)*3};
    });
    return [...standard,...extra];
  }).concat(EXCLUSIVES);
}
function effects(user) {
  const result = {};
  for (const slot of (user.amuletSlots || []).slice(0, Math.max(1, Math.min(5, user.amuletSlotCount || 1)))) {
    if (!slot) continue;
    const rule = ALL_POWERS.find(rule => rule[0] === slot.power);
    if (rule) result[slot.power] = Math.max(result[slot.power] || 0, Math.min(slot.id==='road:forge'?2:rule[4], Number(rebalanceAmulet(slot).value) || 0));
  }
  return result;
}
const round = value => Math.round(value * 100) / 100;
const discounted = (price, percent) => round(price * (1 - (percent || 0) / 100));
function changeAmulets(user, action, body, entries, now = Date.now()) {
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
module.exports = { EXCLUSIVES, catalog, effects, discounted, round, changeAmulets, rebalanceAmulet, SLOT_PRICES, LOCK_MS };
