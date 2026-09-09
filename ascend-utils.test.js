const assert = require('assert');
const { getAscendTierFromCardName, getAscendTierInfo } = require('./ascend-utils');

assert.strictEqual(getAscendTierFromCardName('bronze_ari'), 'bronze');
assert.strictEqual(getAscendTierFromCardName('Rare-bronze_liza'), 'rare-bronze');
assert.strictEqual(getAscendTierFromCardName('zz5-Rare-Gold_Rob'), 'rare-gold');
assert.strictEqual(getAscendTierFromCardName('Ultra_boris'), 'ultra');
assert.strictEqual(getAscendTierFromCardName('zz2-Lightning_naomi'), 'lightning');
assert.strictEqual(require('./ascend-utils').canonicalizeCardKey('zz5-Bronze_Effie.png'), 'bronze');
assert.strictEqual(require('./ascend-utils').canonicalizeCardKey('Bronze_Mats.png'), 'bronze');

assert.deepStrictEqual(getAscendTierInfo('bronze_ari'), {
  currentTier: 'bronze',
  nextTier: 'rare-bronze',
  nextPackName: 'Rare Bronze',
  canAscend: true,
  packName: 'Rare Bronze Pack'
});

assert.deepStrictEqual(getAscendTierInfo('Rare-bronze_liza'), {
  currentTier: 'rare-bronze',
  nextTier: 'silver',
  nextPackName: 'Silver',
  canAscend: true,
  packName: 'Silver Pack'
});

assert.deepStrictEqual(getAscendTierInfo('Ultra_boris'), {
  currentTier: 'ultra',
  nextTier: null,
  nextPackName: null,
  canAscend: false,
  packName: null
});

console.log('Ascend tier tests passed.');
