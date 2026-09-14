const test = require('node:test');
const assert = require('node:assert/strict');
const { deadline, timeoutResult, createTimeoutService } = require('./battle-timeout');
const match = { status: 'board', participantIds: ['a','b'], turnPlayerId: 'a', turnStartedAt: new Date(1000), clocks: { a: 1000, b: 5000 }, board: [{ownerId:'a'}], prize: 10 };
test('at zero the active player loses regardless of board score, without changing board', () => {
  assert.equal(deadline(match), 2000);
  assert.equal(timeoutResult(match, 1999), null);
  const result = timeoutResult(match, 2000);
  assert.equal(result.winnerId, 'b'); assert.equal(result.clocks.a, 0);
  assert.equal(result.status, 'finished'); assert.equal(result.turnPlayerId, null);
  assert.equal(result.board, undefined);
  assert.equal(timeoutResult({...match, status:'finished'}, 5000), null);
  assert.equal(timeoutResult({...match, turnStartedAt:null}, 5000), null);
});
test('timeout settlement pays once and still ends a match if funds have fallen', async () => {
  const docs = { a: {balance: 4}, b: {balance: 10} };
  const db = { collection: () => ({doc: id => ({id})}) };
  const service = createTimeoutService(db, () => ({}), value => value);
  let saved = match;
  const tx = { getAll: async (...refs) => refs.map(ref => ({ exists: true, data: () => docs[ref.id] })),
    update: (ref, update) => { if(ref.id === 'match') saved = {...saved,...update}; else docs[ref.id] = {...docs[ref.id],...update}; } };
  await service.settle(tx, {id:'match'}, saved);
  assert.equal(saved.winnerId, 'b'); assert.equal(saved.paidPrize, 4);
  assert.equal(docs.a.balance, 0); assert.equal(docs.b.balance, 14);
  assert.equal(await service.settle(tx, {id:'match'}, saved), null);
  assert.equal(docs.b.balance, 14);
});
