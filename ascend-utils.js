const TIER_SEQUENCE = ['bronze', 'rare-bronze', 'silver', 'rare-silver', 'gold', 'rare-gold', 'platinum', 'lightning', 'ultra'];

const ascendUtils = {
  TIER_SEQUENCE,
  formatTierLabel,
  getAscendTierFromCardName,
  getAscendTierInfo,
  normalizeAscendString
};

if (typeof window !== 'undefined') {
  window.AscendUtils = ascendUtils;
}

function normalizeAscendString(value) {
  if (value === null || value === undefined) return '';
  const raw = String(value)
    .replace(/.*[\\/]/, '')
    .replace(/\.[^.]+$/, '')
    .toLowerCase();

  return raw
    .replace(/^zz\d+-?/i, '')
    .replace(/[-_\s]+/g, '-');
}

function canonicalizeCardKey(cardName) {
  const normalized = normalizeAscendString(cardName);
  if (!normalized) return '';

  const tierInfo = getAscendTierInfo(normalized);
  if (tierInfo && tierInfo.currentTier) {
    return tierInfo.currentTier;
  }

  const pieces = normalized.split('-');
  if (pieces.length <= 2) return normalized;
  return pieces.slice(0, -1).join('-');
}

function getAscendTierFromCardName(cardName) {
  if (!cardName) return null;

  const normalized = normalizeAscendString(cardName);
  const tierPriority = [
    'rare-gold',
    'rare-silver',
    'rare-bronze',
    'ultra',
    'lightning',
    'platinum',
    'gold',
    'silver',
    'bronze'
  ];

  const match = tierPriority.find(tier => normalized.includes(tier));
  return match || null;
}

function formatTierLabel(tier) {
  if (!tier) return null;
  return tier
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getAscendTierInfo(cardName) {
  const currentTier = getAscendTierFromCardName(cardName);
  if (!currentTier) {
    return {
      currentTier: null,
      nextTier: null,
      nextPackName: null,
      canAscend: false,
      packName: null
    };
  }

  const currentIndex = TIER_SEQUENCE.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex >= TIER_SEQUENCE.length - 1) {
    return {
      currentTier,
      nextTier: null,
      nextPackName: null,
      canAscend: false,
      packName: null
    };
  }

  const nextTier = TIER_SEQUENCE[currentIndex + 1];
  const nextPackName = formatTierLabel(nextTier);

  return {
    currentTier,
    nextTier,
    nextPackName,
    canAscend: true,
    packName: `${nextPackName} Pack`
  };
}

module.exports = {
  ...ascendUtils,
  canonicalizeCardKey
};
