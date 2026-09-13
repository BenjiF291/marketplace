const { gemIdentity } = require('./gem-utils');
const DYE_AREAS = { background: 'Page background', header: 'Header', panels: 'Section panels', navigation: 'Navigation tabs', buttons: 'Primary buttons', success: 'Buy and success buttons', borders: 'Panel borders', inputs: 'Input fields', balance: 'Footy balance', converter: 'Gem converter', machine: 'Conversion chamber', amulets: 'Amulet shop background', slots: 'Empty amulet slots', notices: 'Status messages' };
const CRAFT_COST = { 'rare-silver': 10, gold: 5, 'rare-gold': 2 };
function dyeInventory(user) {
  // Convert each previously purchased permanent color into one batch of five dyes.
  if (Array.isArray(user.gemDyes)) return Object.fromEntries(user.gemDyes.map(key => [key, 5]));
  return { ...(user.gemDyes || {}) };
}
function workshopAction(user, tiers, action, body) {
  const gems = { ...(user.gems || {}) };
  const identities = tiers.map(gemIdentity);
  if (action === 'craft') {
    if (user.gemCompressor === true) throw new Error('You already own a gem compressor');
    for (const [key, cost] of Object.entries(CRAFT_COST)) if (!(gems[key] >= cost)) throw new Error('Crafting requires 10 Opals, 5 Citrine and 2 Emeralds');
    for (const [key, cost] of Object.entries(CRAFT_COST)) gems[key] -= cost;
    return { gems, gemCompressor: true };
  }
  if (action === 'compress') {
    if (user.gemCompressor !== true) throw new Error('Craft a gem compressor first');
    const index = identities.findIndex(gem => gem.gemKey === body.gemKey);
    if (index < 0 || index >= identities.length - 1) throw new Error('This gem has no next tier');
    if (!Number.isSafeInteger(body.quantity) || body.quantity < 1 || !Number.isSafeInteger(body.quantity * 4)) throw new Error('Enter a positive whole output quantity');
    if (!(gems[body.gemKey] >= body.quantity * 4)) throw new Error('Not enough gems');
    const next = identities[index + 1].gemKey;
    const total = Number(gems[next] || 0) + body.quantity;
    if (!Number.isSafeInteger(total)) throw new Error('Gem balance too large');
    gems[body.gemKey] -= body.quantity * 4; gems[next] = total;
    return { gems };
  }
  const dyes = dyeInventory(user);
  if (action === 'craft-dye') {
    if (!identities.some(gem => gem.gemKey === body.gemKey)) throw new Error('Unknown gem');
    if (!(gems[body.gemKey] >= 1)) throw new Error('You need one matching gem');
    const total = Number(dyes[body.gemKey] || 0) + 5;
    if (!Number.isSafeInteger(total)) throw new Error('Dye balance too large');
    gems[body.gemKey] -= 1; dyes[body.gemKey] = total;
    return { gems, gemDyes: dyes };
  }
  if (action === 'dye') {
    const theme = { ...(user.gemTheme || {}) };
    if (body.area !== 'all' && !Object.hasOwn(DYE_AREAS, body.area)) throw new Error('Unknown interface area');
    if (body.gemKey !== '') {
      if (!identities.some(gem => gem.gemKey === body.gemKey)) throw new Error('Unknown gem');
      if (!(dyes[body.gemKey] >= 1)) throw new Error('Craft more dye of this color first');
      dyes[body.gemKey] -= 1;
    }
    for (const area of body.area === 'all' ? Object.keys(DYE_AREAS) : [body.area]) {
      if (body.gemKey === '') delete theme[area]; else theme[area] = body.gemKey;
    }
    return { gemTheme: theme, gemDyes: dyes };
  }
  throw new Error('Unknown workshop action');
}
module.exports = { workshopAction, dyeInventory, DYE_AREAS, CRAFT_COST };
