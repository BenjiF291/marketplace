const assert = require('node:assert/strict');
const { validateBattleCard } = require('./battle-utils');

assert.deepEqual(validateBattleCard({
  name: 'Wolf Fang',
  averageScore: 7.5,
  top: 4,
  right: 8,
  bottom: 6,
  left: 2
}), {
  valid: true,
  normalized: {
    name: 'Wolf Fang',
    averageScore: 7.5,
    top: 4,
    right: 8,
    bottom: 6,
    left: 2
  }
});

assert.equal(validateBattleCard({ name: '', averageScore: 7, top: 3, right: 4, bottom: 5, left: 6 }).valid, false);
assert.equal(validateBattleCard({ name: 'Bad', averageScore: -1, top: 3, right: 4, bottom: 5, left: 6 }).valid, false);

console.log('battle-utils tests passed');
