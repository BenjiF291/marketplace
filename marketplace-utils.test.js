const assert = require('node:assert/strict');
const { normalizeSellPrice, normalizeScheduleDate, getListingStatus } = require('./marketplace-utils');

assert.equal(normalizeSellPrice(50), 50);
assert.equal(normalizeSellPrice('75.5'), 75.5);
assert.equal(normalizeSellPrice('abc'), null);
assert.equal(normalizeSellPrice(-1), null);

const futureIso = new Date(Date.now() + 60_000).toISOString();
const pastIso = new Date(Date.now() - 60_000).toISOString();
assert.equal(normalizeScheduleDate(futureIso) instanceof Date, true);
assert.equal(normalizeScheduleDate('bad-date'), null);
assert.equal(getListingStatus({ scheduledAt: futureIso, expiresAt: pastIso }, new Date(Date.now() + 30_000)), 'scheduled');
assert.equal(getListingStatus({ scheduledAt: pastIso, expiresAt: futureIso }, new Date(Date.now() + 30_000)), 'active');
assert.equal(getListingStatus({ scheduledAt: pastIso, expiresAt: pastIso }, new Date(Date.now() + 30_000)), 'expired');

console.log('marketplace-utils tests passed');
