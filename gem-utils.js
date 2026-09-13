const GEM_NAMES = {
  bronze: 'Ruby', 'rare-bronze': 'Garnet', silver: 'Moonstone',
  'rare-silver': 'Opal', gold: 'Citrine', 'rare-gold': 'Emerald',
  platinum: 'Sapphire', lightning: 'Amethyst', ultra: 'Diamond'
};

function gemRecipe(tier, count = 1) {
  if (!Number.isInteger(count) || count < 1 || count > 3) throw new Error('Select one to three cards');
  const price = Number(tier.sellPrice);
  if (!Number.isFinite(price) || price <= 0) throw new Error('This tier needs a sell price before conversion');
  const key = String(tier.name).trim().toLowerCase().replace(/\s+/g, '-');
  return {
    tierId: tier.id, tierName: tier.name,
    gemName: GEM_NAMES[key] || `${tier.name} Crystal`,
    gemKey: GEM_NAMES[key] ? key : `tier-${tier.id}`,
    cost: Math.round(price * 1.5 * count * 100) / 100,
    reward: [0, 3, 7, 12][count]
  };
}

function validateGemCards(items, ids, tier, userId) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 3 || new Set(ids).size !== ids.length) {
    throw new Error('Select one to three different inventory cards');
  }
  const cards = new Set((tier.cards || []).map(value => String(value).split(/[\\/]/).pop()));
  if (items.length !== ids.length || items.some(item => !item || item.buyerId !== userId || item.sold !== true ||
    item.listedForSale === true || (item.itemType && item.itemType !== 'card') ||
    !cards.has(String(item.imageUrl || item.name || '').split(/[\\/]/).pop()))) {
    throw new Error('Selected cards must be available, owned cards from this tier');
  }
}

module.exports = { gemRecipe, validateGemCards };
