function sortCardsByTier(items, tiers) {
  const basename = value => String(value || '').split(/[\\/]/).pop();
  const ordered = [...tiers].sort((a, b) => Number(a.order) - Number(b.order));
  const cards = new Map(), packs = new Map();
  ordered.forEach((tier, index) => {
    for (const card of tier.cards || []) if (!cards.has(basename(card))) cards.set(basename(card), index);
    for (const pack of tier.packs || []) if (!packs.has(String(pack))) packs.set(String(pack), index);
  });
  const rank = item => item.itemType === 'pack' ? packs.get(String(item.packId)) ?? Infinity : cards.get(basename(item.linkedCardImage || item.imageUrl || item.name)) ?? Infinity;
  return items.sort((a, b) => rank(a) - rank(b) || String(a.name || a.id || '').localeCompare(String(b.name || b.id || '')));
}
module.exports = { sortCardsByTier };
