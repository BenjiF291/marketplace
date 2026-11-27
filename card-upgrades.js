const { randomInt } = require('node:crypto');
const catalog = require('./public/upgrader-catalog');
const { statKeys, orderActionStats, naturalPosition, upgradedOverall } = require('./public/ben-bal-card');

const wallet = (db, owner) => db.collection('upgradeWallets').doc(owner);
const variant = (db, item) => db.collection('cardUpgrades').doc(item);
const variants = (db, owner) => db.collection('cardUpgrades').where('ownerId', '==', owner);
const variantId = (base, level) => base + '~' + level;
const kinds = ['upgradeShard', 'upgradeCore', 'upgradeToken', 'cardXpPotion'];
const progress = (db, item) => db.collection('cardEffectiveness').doc(item);
const progressForOwner = (db, owner) => db.collection('cardEffectiveness').where('ownerId', '==', owner);
const effectiveness = (record, owner) => record?.ownerId === owner && Number.isFinite(record.value)
  ? Math.min(100, Math.max(0, record.value)) : 0;
const favouriteCount = 3;
const favourites = (db, owner) => db.collection('cardFavourites').doc(owner);
const inventoryKey = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value);
function favouriteSlots(record) {
  const seen = new Set();
  return Array.from({ length: favouriteCount }, (_, slot) => {
    const id = record?.slots?.[slot];
    if (!inventoryKey(id) || seen.has(id)) return null;
    seen.add(id);
    return id;
  });
}

function ownedCardFilename(item, owner, { includeListed = false } = {}) {
  if (!item || item.buyerId !== owner || item.sold !== true || (!includeListed && item.listedForSale) ||
      item.packId || (item.itemType && item.itemType !== 'card') || typeof item.imageUrl !== 'string') return '';
  try {
    const url = new URL(item.imageUrl, 'https://marketplace-aw8b.onrender.com');
    if (!['https://marketplace-aw8b.onrender.com', 'https://fishy-20779.web.app'].includes(url.origin) &&
        !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url.origin)) return '';
    const match = /^\/images\/([^/]+)$/.exec(url.pathname);
    const name = match ? decodeURIComponent(match[1]) : '';
    return /^[^/\\]+\.(png|jpe?g|webp|gif)$/i.test(name) ? name : '';
  } catch { return ''; }
}

async function favouriteProgress(tx, db, owner, snapshot, winner) {
  const increment = { player: 3, draw: 2, robot: 1 }[winner];
  if (!increment) return [];
  return (await Promise.all(favouriteSlots({ slots: snapshot }).filter(Boolean).map(async id => {
    const ref = progress(db, id);
    const [item, preparation] = await Promise.all([tx.get(db.collection('items').doc(id)), tx.get(ref)]);
    if (!ownedCardFilename(item.data(), owner, { includeListed: true })) return null;
    const current = effectiveness(preparation.data(), owner);
    return current < 100 ? { ref, value: Math.min(100, current + increment) } : null;
  }))).filter(Boolean);
}
const requiresPackProof = pack => Array.isArray(pack?.rewardCards) &&
  pack.rewardCards.some(card => Array.isArray(card?.options) && card.options.some(option => (kinds.includes(option?.kind) || option?.kind === 'randomCardByTier')));
const packProof = (db, itemId) => db.collection('upgradePackProofs').doc(itemId);
function markPack(tx, db, item, ownerId, packId, pack) {
  if (!requiresPackProof(pack)) return {};
  tx.set(packProof(db, item.id), { ownerId, packId });
  return { upgradePack: true };
}

function recipe(level, tier, shards) {
  if (!['epic', 'legendary'].includes(level) || !catalog.tiers.includes(tier) ||
      !Array.isArray(shards) || shards.length !== (level === 'epic' ? 2 : 5) ||
      shards.some(shard => !catalog.tiers.includes(shard)) || new Set([tier, ...shards]).size !== shards.length + 1) {
    throw Error('Choose one core and shards from distinct tiers.');
  }
  return { inputs: [catalog.id('core', tier), ...shards.map(shard => catalog.id('shard', shard))],
    output: catalog.id(level, tier) };
}

function moveQuantity(counts, id, delta) {
  const value = (counts[id] ?? 0) + delta;
  if (!Number.isSafeInteger(value) || value < 0) throw Error('Insufficient upgrade materials or tokens.');
  if (value) counts[id] = value;
  else delete counts[id];
}

async function grant(tx, db, owner, rewards) {
  const upgrades = rewards.filter(reward => kinds.includes(reward.kind));
  if (!upgrades.length) return;
  const ref = wallet(db, owner);
  const counts = { ...(await tx.get(ref)).data()?.counts };
  for (const reward of upgrades) {
    if (catalog.get(reward.id)?.kind !== reward.kind || !Number.isSafeInteger(reward.amount) || reward.amount < 1) {
      throw Error('Invalid upgrade reward.');
    }
    moveQuantity(counts, reward.id, reward.amount);
  }
  tx.set(ref, { counts });
}

function eligible(card, previous, token) {
  if (!token || token.kind !== 'upgradeToken') return 'Choose an Upgrader Token.';
  if (!card || !statKeys.every(key => Number.isFinite(card.stats?.[key]))) return 'This card has incomplete base statistics.';
  if (!token.targetTiers.some(tier => catalog.tierKey(tier) === catalog.tierKey(card.tier))) return 'The token targets a different card tier.';
  if (previous?.level !== (token.level === 'legendary' ? 'epic' : undefined)) {
    return token.level === 'legendary' ? 'Legendary requires an Epic card.' : 'Epic requires a Normal card.';
  }
  return '';
}

function roll(card, token, random = randomInt, previous, preparation = 0) {
  const baseStats = { ...(previous?.baseStats ?? card.stats) };
  const baseOverall = previous?.baseOverall ?? card.overall;
  const effectiveStats = { ...(previous?.effectiveStats ?? baseStats) };
  const points = catalog.points(preparation);
  const bonuses = Object.fromEntries(statKeys.map(key => [key, 0]));
  for (let n = 0; n < points; n++) {
    const key = statKeys[random(0, statKeys.length)];
    bonuses[key]++;
    effectiveStats[key]++;
  }
  const bonusesByLevel = { ...previous?.bonusesByLevel, [token.level]: bonuses };
  if (previous?.level === 'epic' && !bonusesByLevel.epic) {
    bonusesByLevel.epic = previous.bonuses ??
      Object.fromEntries(statKeys.map(key => [key, previous.effectiveStats[key] - baseStats[key]]));
  }
  return { baseCardId: card.id, variantId: variantId(card.id, token.level), level: token.level,
    baseStats, baseOverall, bonuses, bonusesByLevel, effectiveStats, points, preparation,
    currentOverall: Math.max(upgradedOverall(baseOverall, baseStats, effectiveStats),
      (previous?.currentOverall ?? (previous ? upgradedOverall(baseOverall, baseStats, previous.effectiveStats) : baseOverall)) + 1) };
}

function applyVariant(card, upgrade) {
  if (!card || !upgrade || upgrade.baseCardId !== card.id) return card;
  const stats = upgrade.effectiveStats;
  const baseOverall = upgrade.baseOverall ?? card.overall;
  const currentOverall = upgrade.currentOverall ?? upgradedOverall(baseOverall, upgrade.baseStats, stats);
  const pairs = card.benBal && orderActionStats(stats, card.benBal);
  return { ...card, id: upgrade.variantId, name: card.name + ' — ' + (upgrade.level === 'epic' ? 'Epic' : 'Legendary'),
    stats, upgrade: { ...upgrade, baseOverall, currentOverall }, overall: currentOverall,
    benBal: pairs ? { ...pairs, naturalPosition: naturalPosition(stats, pairs) } : null };
}

function baseCard(card) {
  if (!card.upgrade) return card;
  const stats = card.upgrade.baseStats;
  const pairs = orderActionStats(stats, card.benBal);
  return { ...card, stats, overall: card.upgrade.baseOverall ?? card.overall,
    benBal: { ...pairs, naturalPosition: naturalPosition(stats, pairs) } };
}

function duplicate(snapshot, baseCardId, level) {
  return snapshot.docs.some(doc => doc.data().baseCardId === baseCardId && doc.data().level === level);
}

module.exports = { wallet, variant, variants, variantId, inventoryKey, kinds, recipe, moveQuantity, grant,
  eligible, roll, applyVariant, upgradedOverall, baseCard, progress, effectiveness, duplicate, requiresPackProof, packProof, markPack,
  favouriteCount, favourites, favouriteSlots, favouriteProgress, ownedCardFilename, progressForOwner };
