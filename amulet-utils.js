const { gemIdentity } = require('./gem-utils');
const SLOT_PRICES = [0, 50, 150, 500, 1000];
const LOCK_MS = 5 * 24 * 60 * 60 * 1000;
const POWERS = [
  ['wheel', 'Fortune Dial', 2, 1, 10, 'extra Footy per wheel spin'],
  ['converter', 'Crystal Furnace', 3, 1, 12, '% off converter Footy costs'],
  ['salvage', 'Reclaimer', 2, 1, 10, '% extra Footy when selling cards to their tier'],
  ['pack', 'Unsealer', 1, 0.5, 5, 'Footy each time you open a pack'],
  ['vip', 'Royal Seal', 2, 1, 10, '% off VIP purchases'],
  ['market', 'Bargainer', 1, 0.5, 5, '% off Footy purchases from the host (seller still receives full payment)'],
  ['ascend', 'Rising Star', 1, 0.5, 5, 'Footy per successful ascension'],
  ['battle', 'Victor Crest', 1, 0.5, 5, '% extra Footy on a battle win (maximum 5 Footy)'],
  ['gemshop', 'Artisan Seal', 2, 1, 10, '% off amulet gem prices (rounded up)'],
  ['vipdays', 'Timekeeper', 0.5, 0.25, 3, 'extra days with each VIP purchase']
];
function catalog(tiers) {
  return tiers.flatMap((tier, index) => {
    const gem = gemIdentity(tier);
    return Array.from({ length: 5 }, (_, offset) => {
      const [power, name, base, step, cap, description] = POWERS[(index * 3 + offset) % POWERS.length];
      const value = Math.min(cap, base + index * step);
      return { id: `${tier.id}:${power}`, ...gem, name: `${gem.gemName} ${name}`, power, value,
        description: `+${value} ${description}`.replace('+', ['converter', 'vip', 'market', 'gemshop'].includes(power) ? '' : '+'),
        price: 18 + offset * 3 + Math.min(index, 12) * 2 };
    });
  });
}
function effects(user) {
  const result = {};
  for (const slot of (user.amuletSlots || []).slice(0, Math.max(1, Math.min(5, user.amuletSlotCount || 1)))) {
    if (!slot) continue;
    const rule = POWERS.find(rule => rule[0] === slot.power);
    if (rule) result[slot.power] = Math.max(result[slot.power] || 0, Math.min(rule[4], Number(slot.value) || 0));
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
module.exports = { catalog, effects, discounted, round, changeAmulets, SLOT_PRICES, LOCK_MS };
