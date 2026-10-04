const { gemIdentity } = require('./gem-utils');
const DYE_AREAS = { background: 'Page background', header: 'Header', panels: 'Section panels', navigation: 'Navigation tabs', buttons: 'Primary buttons', success: 'Buy and success buttons', borders: 'Panel borders', inputs: 'Input fields', balance: 'Footy balance', converter: 'Gem converter', machine: 'Conversion chamber', amulets: 'Amulet shop background', slots: 'Empty amulet slots', notices: 'Status messages' };
const { effects } = require('./amulet-utils');
function refineryProgress(user,tiers){
 const identities=tiers.map(gemIdentity),max=Math.max(0,identities.length-1);
 // Players who paid for the old all-tier machine keep its unlocked recipes.
 const level=Number.isSafeInteger(user.gemRefineryLevel)?Math.max(0,Math.min(max,user.gemRefineryLevel)):(user.gemCompressor===true?max:0);
 const next=identities[level+1];return {level,max,current:identities[level]||null,nextUpgrade:next?{...next,costs:identities.slice(0,level+2).map((g,i)=>({...g,amount:i===level+1?5:10}))}:null};
}
function dyeInventory(user) {
  // Convert each previously purchased permanent color into one batch of five dyes.
  if (Array.isArray(user.gemDyes)) return Object.fromEntries(user.gemDyes.map(key => [key, 5]));
  return { ...(user.gemDyes || {}) };
}
function workshopAction(user, tiers, action, body) {
  const gems = require('./gem-wallet').wallet(user.gems);
  const identities = tiers.map(gemIdentity);
  if(action==='craft')throw Error('The refinery no longer needs crafting. Upgrade it to unlock the next gem tier.');
  if(action==='upgrade'){
    const next=refineryProgress(user,tiers).nextUpgrade;
    if(!next||body.tierId!==next.tierId)throw Error('That refinery upgrade is no longer available. Refresh and try again.');
    for(const cost of next.costs)if((gems[cost.gemKey]||0)<cost.amount)throw Error(`You need ${cost.amount} ${cost.gemName} for this upgrade.`);
    for(const cost of next.costs)gems[cost.gemKey]-=cost.amount;
    return {gems,gemRefineryLevel:refineryProgress(user,tiers).level+1};
  }
  if (action === 'compress') {
    const index = identities.findIndex(gem => gem.gemKey === body.gemKey);
    if (index < 0 || index >= identities.length - 1) throw new Error('This gem has no next tier');
    if(index+1>refineryProgress(user,tiers).level)throw Error('Upgrade your refinery to unlock this output gem.');
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
    const total = Number(dyes[body.gemKey] || 0) + 5 + (effects(user).pigment || 0);
    if (!Number.isSafeInteger(total)) throw new Error('Dye balance too large');
    gems[body.gemKey] -= 1; dyes[body.gemKey] = total;
    return { gems, gemDyes: dyes };
  }
  if (action === 'confirm-dyes') {
    if (!body.changes || typeof body.changes !== 'object' || Array.isArray(body.changes) || Object.keys(body.changes).length > Object.keys(DYE_AREAS).length) throw new Error('Invalid dye changes');
    const theme = { ...(user.gemTheme || {}) };
    const costs = {};
    for (const [area, key] of Object.entries(body.changes)) {
      if (!Object.hasOwn(DYE_AREAS, area) || typeof key !== 'string' || (key && !identities.some(gem => gem.gemKey === key))) throw new Error('Invalid dye target or color');
      if ((theme[area] || '') === key) continue;
      if ((body.originalTheme?.[area] || '') !== (theme[area] || '')) throw new Error('Your saved colors changed in another session. Cancel and reopen dye mode.');
      if (key) costs[key] = (costs[key] || 0) + 1;
    }
    for (const [key, cost] of Object.entries(costs)) {
      if (!(dyes[key] >= cost)) throw new Error('Not enough dye to confirm all changes');
      dyes[key] -= cost;
    }
    for (const [area, key] of Object.entries(body.changes)) {
      if (key) theme[area] = key; else delete theme[area];
    }
    return { gemTheme: theme, gemDyes: dyes };
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
module.exports = { workshopAction, dyeInventory, DYE_AREAS, refineryProgress };
