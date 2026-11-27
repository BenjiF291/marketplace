const { hasRewards } = require('./pack-builder');
const { isSpecialTier } = require('./card-data');

const leagues = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Lightning', 'Ultra'];
const rareTiers = new Map([['Bronze', 'Rare Bronze'], ['Silver', 'Rare Silver'], ['Gold', 'Rare Gold']]);
const tierKey = name => String(name ?? '').trim().toLowerCase().replace(/^lightling$/, 'lightning');
const isSpecial = card => isSpecialTier(card?.tier);
const settings = db => db.collection('benBalSettings').doc('leagues');

function eligibleTiers(league) {
  return rareTiers.has(league) ? [league, rareTiers.get(league)] : [league];
}

function tiersFrom(snapshot) {
  return Object.fromEntries(leagues.map(name => {
    const matches = snapshot.docs.filter(doc => tierKey(doc.data().name) === tierKey(name));
    return [name, matches.length === 1 ? matches[0].id : null];
  }));
}

function eligibility(card, league, config) {
  if (!card?.benBal) return 'Ben-Bal statistics unavailable.';
  if (eligibleTiers(league).some(tier => tierKey(card.tier) === tierKey(tier))) return '';
  if (!isSpecial(card)) return 'This card belongs to a different tier.';
  if (!config?.range) return 'Special cards require an administrator-configured Overall range.';
  const { min, max } = config.range;
  return card.overall >= min && card.overall <= max ? '' : `Special card Overall must be ${min} to ${max}.`;
}

function lineupError(cards, league, config) {
  return cards.map(card => eligibility(card, league, config)).find(Boolean) ||
    (cards.filter(isSpecial).length > 1 ? 'Only one Special card may be assigned.' : '');
}

function packInfo(doc) {
  const pack = doc?.data();
  if (!hasRewards(pack) || typeof pack.name !== 'string' || !pack.name.trim() ||
      (pack.cardIds != null && !Array.isArray(pack.cardIds)) ||
      (pack.rewardCards != null && !Array.isArray(pack.rewardCards))) return null;
  const imageUrl = typeof pack.imageUrl === 'string' && /^\/(?!\/)/.test(pack.imageUrl) && !pack.imageUrl.includes('\\')
    ? pack.imageUrl : null;
  return { id: doc.id, name: pack.name, color: pack.color || '#93722a', imageUrl };
}

function validateConfig(body, packs) {
  if (!body || Object.keys(body).length !== leagues.length) throw Error('Configure all six leagues.');
  return Object.fromEntries(leagues.map(name => {
    const record = body[name];
    if (!record || !(record.packId === null || packs.has(record.packId))) throw Error(name + ': Select a valid Marketplace pack.');
    const range = record.range;
    if (range !== null && (!Number.isInteger(range?.min) || !Number.isInteger(range?.max) ||
        range.min < 0 || range.max > 100 || range.min > range.max)) throw Error(name + ': Enter a valid Overall range.');
    return [name, { packId: record.packId, range }];
  }));
}

module.exports = { leagues, eligibleTiers, isSpecial, settings, tiersFrom, eligibility, lineupError, packInfo, validateConfig };
