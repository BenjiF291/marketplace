const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cards } = require('./data/card-statistics.json');
const { readAllocations } = require('./ben-bal-allocations');
const { naturalPosition, orderActionStats } = require('./public/ben-bal-card');
const { slots, counters, playable, prepareCard, prepareTeam, resolve, createMatch } = require('./public/ben-bal-match-engine');
const { createPolicy, generateTeam } = require('./public/ben-bal-robot');

const pairs = {
  attack: { primary: 'pow', secondary: 'ama' },
  dribble: { primary: 'size', secondary: 'rang' },
  defence: { primary: 'loy', secondary: 'acu' }
};

function card(id, [pow, ama, size, rang, loy, acu], overall = 1) {
  const stats = { pow, ama, size, rang, loy, acu };
  const allocation = orderActionStats(stats, pairs);
  return { id, name: id, overall, stats, benBal: { ...allocation, naturalPosition: naturalPosition(stats, allocation) } };
}

function uniformTeam(prefix, value) {
  return slots.map(({ slot, role }) => prepareCard(card(prefix + slot, Array(6).fill(value)), slot, role));
}

function rng(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const power = team => team.reduce((sum, entry) => sum + entry.total, 0);

test('match rules use matching counters and stop at the first decisive effective comparison', () => {
  assert.deepEqual(counters, { attack: 'defence', defence: 'attack', dribble: 'dribble' });
  const player = prepareCard(card('player', [90, 70, 60, 0, 0, 0], 1), 'gk', 'keeper');
  const opponent = values => prepareCard(card('robot', values, 99), 'gk', 'keeper');
  const compare = values => resolve(player, 'attack', opponent(values), 'defence');
  assert.deepEqual(compare([99, 99, 99, 99, 89, 88]).comparisons, [{ stage: 'primary', player: 90, robot: 89 }]);
  assert.equal(compare([99, 99, 99, 99, 90, 69]).winner, 'player');
  assert.equal(compare([99, 99, 99, 99, 90, 69]).comparisons.length, 2);
  const total = compare([10, 5, 25, 15, 90, 70]);
  assert.deepEqual(total.comparisons.at(-1), { stage: 'total', player: 220, robot: 215 });
  assert.equal(total.winner, 'player');
  assert.equal(compare([10, 5, 25, 20, 90, 70]).winner, 'draw');
  assert.throws(() => resolve(player, 'attack', opponent([1, 1, 1, 1, 1, 1]), 'attack'), /Invalid action/);
  resolve(player, 'defence', opponent([1, 1, 1, 1, 1, 1]), 'attack');
  resolve(player, 'dribble', opponent([1, 1, 1, 1, 1, 1]), 'dribble');
});

test('penalties affect both action stats and total power with flooring and goalkeeper exemption', () => {
  const original = card('position', [80, 20, 7, 4, 30, 2]);
  const out = prepareCard(original, 'def1', 'defence');
  const natural = prepareCard(original, 'att1', 'attack');
  const keeper = prepareCard(original, 'gk', 'keeper');
  assert.equal(out.values.attack.primary.effective, 70);
  assert.equal(out.values.attack.secondary.effective, 10);
  assert.equal(out.values.dribble.primary.effective, 0);
  assert.equal(out.values.dribble.secondary.effective, 0);
  assert.equal(out.total, 100);
  assert.equal(natural.total, 143);
  assert.equal(keeper.total, natural.total);
  assert.deepEqual(original.stats, { pow: 80, ama: 20, size: 7, rang: 4, loy: 30, acu: 2 });
});

test('formation validation rejects short, malformed, duplicate and incomplete lineups', () => {
  const team = uniformTeam('player', 25);
  const catalogue = new Map(team.map(({ card }) => [card.id, card]));
  const lineup = Object.fromEntries(team.map(({ slot, card }) => [slot, card.id]));
  assert.deepEqual(prepareTeam(lineup, catalogue), team);
  assert.throws(() => prepareTeam({}, catalogue), /Fill all 11/);
  const { gk, ...short } = lineup;
  assert.throws(() => prepareTeam({ ...short, invalid: gk }, catalogue), /formation/);
  assert.throws(() => prepareTeam({ ...lineup, gk: lineup.att1 }, catalogue), /one team slot/);
  assert.throws(() => prepareTeam({ ...lineup, gk: 'invalid' }, catalogue), /valid Ben-Bal allocation/);
  const keeper = catalogue.get(gk);
  assert.equal(playable({ ...keeper, stats: { ...keeper.stats, pow: null } }), false);
  assert.equal(playable({ ...keeper, benBal: { ...keeper.benBal, attack: { primary: 'size', secondary: 'ama' } } }), false);
});

function finishMatch(playerValue, robotValue) {
  const player = uniformTeam('player', playerValue), robot = uniformTeam('robot', robotValue);
  const calls = [];
  const match = createMatch(player, robot, {
    initiate(...args) {
      assert.equal(args.length, 2);
      assert.deepEqual(Object.keys(args[1]).sort(), ['remaining', 'revealed', 'round', 'score']);
      calls.push('initiate');
      return { id: args[0][0].card.id, action: 'attack' };
    },
    respond(unused, publicChoice) {
      assert.deepEqual(Object.keys(publicChoice).sort(), ['action', 'overall', 'remaining', 'revealed', 'round', 'score']);
      assert.equal(publicChoice.action, 'attack');
      assert.equal(publicChoice.overall, 1);
      assert.equal(publicChoice.revealed.length, publicChoice.round - 1);
      assert.ok(publicChoice.revealed.every((card, index) => card.id === player[index].card.id));
      calls.push('respond');
      return { id: unused[0].card.id };
    }
  });
  assert.throws(() => match.advance(), /Resolve/);
  assert.throws(() => match.submit(player[0].card.id), /Choose Attack/);
  assert.throws(() => match.submit('bogus', 'attack'), /unused/);
  for (let round = 1; round <= 11; round++) {
    const view = match.view();
    const odd = round % 2;
    assert.equal(view.round, round);
    assert.equal(view.robotRemaining, 12 - round);
    assert.equal(view.initiative, odd ? 'player' : 'robot');
    assert.equal(view.phase, odd ? 'player-initiation' : 'player-response');
    assert.deepEqual(view.hidden, odd ? null : { overall: 1, action: 'attack' });
    assert.equal(view.result, null);
    assert.equal(view.history, null);
    assert.equal(view.robotPitch.filter(tile => tile.revealed).length, round - 1);
    assert.deepEqual(Object.keys(view.robotPitch.find(tile => !tile.revealed)).sort(), ['overall', 'revealed', 'slot']);
    if (round > 1) assert.throws(() => match.submit(player[0].card.id, 'attack'), /unused/);
    if (!odd) assert.throws(() => match.submit(player[round - 1].card.id, 'attack'), /automatic/);
    match.submit(player[round - 1].card.id, odd ? 'attack' : undefined);
    assert.equal(match.view().result.playerAction, odd ? 'attack' : 'defence');
    assert.equal(match.view().result.robotAction, odd ? 'defence' : 'attack');
    assert.throws(() => match.submit(player[round - 1].card.id, 'attack'), /already/);
    match.advance();
  }
  const final = match.view();
  assert.equal(final.phase, 'complete');
  assert.equal(final.round, 11);
  assert.equal(final.history.length, 11);
  assert.equal(final.robotRemaining, 0);
  assert.equal(final.winner, playerValue === robotValue ? 'draw' : playerValue > robotValue ? 'player' : 'robot');
  assert.deepEqual(calls, ['respond', 'initiate', 'respond', 'initiate', 'respond', 'initiate', 'respond', 'initiate', 'respond', 'initiate', 'respond']);
  for (const side of ['player', 'robot']) assert.equal(new Set(final.history.map(result => result[side].card.id)).size, 11);
  assert.throws(() => match.advance(), /Resolve/);
  assert.throws(() => match.submit(player[0].card.id, 'attack'), /already/);
  return final.score;
}

test('exactly 11 alternating rounds spend each card once and protect hidden player data', () => {
  assert.deepEqual(finishMatch(90, 40), { player: 11, robot: 0, draw: 0 });
  assert.deepEqual(finishMatch(40, 90), { player: 0, robot: 11, draw: 0 });
  assert.deepEqual(finishMatch(40, 40), { player: 0, robot: 0, draw: 11 });
});

test('robot sacrifices a low-probability round early and commits its best counter under pressure', () => {
  const own = [
    prepareCard(card('reserve', [69, 58, 68, 56, 74, 64]), 'gk', 'keeper'),
    prepareCard(card('spare', [41, 35, 30, 20, 42, 29]), 'gk', 'keeper')
  ];
  const policy = createPolicy(() => 0);
  const choice = { action: 'attack', overall: 99, revealed: [] };
  assert.equal(policy.respond(own, { ...choice, round: 2, remaining: 10, score: { robot: 0, player: 1 } }).id, 'spare');
  assert.equal(policy.respond(own, { ...choice, round: 10, remaining: 2, score: { robot: 3, player: 4 } }).id, 'reserve');
  assert.equal(policy.respond(own, { ...choice, round: 8, remaining: 4, score: { robot: 4, player: 1 } }).id, 'reserve');
  const specialist = prepareCard(card('dribbler', [40, 38, 98, 88, 42, 39]), 'gk', 'keeper');
  assert.deepEqual(policy.initiate([...own, specialist], { round: 11, remaining: 1, score: { robot: 5, player: 5 }, revealed: [] }),
    { id: 'dribbler', action: 'dribble' });
});

test('robot lineup prefers natural roles and tracks the player action profile', async () => {
  const allocations = await readAllocations(__dirname);
  const source = cards.filter(card => allocations.has(card.id)).map(card => {
    const allocation = allocations.get(card.id);
    return { ...card, benBal: { ...allocation, naturalPosition: naturalPosition(card.stats, allocation) } };
  });
  const player = generateTeam(source, 4200, rng(51));
  const opponent = generateTeam(source, player, rng(52));
  const primary = (team, action) => team.reduce((sum, entry) => sum + entry.values[action].primary.effective, 0);
  assert.ok(Math.abs(power(opponent) - power(player)) <= power(player) * .05);
  assert.ok(opponent.filter(entry => entry.role !== 'keeper' && entry.role === entry.card.benBal.naturalPosition).length >= 8);
  for (const action of ['attack', 'dribble', 'defence']) {
    assert.ok(Math.abs(primary(opponent, action) - primary(player, action)) <= primary(player, action) * .12);
  }
});

test('robot uses real catalogue cards, balances effective formation power and varies its XI', async () => {
  const allocations = await readAllocations(__dirname);
  const source = cards.filter(card => allocations.has(card.id)).map(card => {
    const allocation = allocations.get(card.id);
    return { ...card, benBal: { ...allocation, naturalPosition: naturalPosition(card.stats, allocation) } };
  });
  const target = 4200;
  const first = generateTeam(source, target, rng(10));
  const second = generateTeam(source, target, rng(234));
  for (const team of [first, second]) {
    assert.equal(team.length, 11);
    assert.equal(new Set(team.map(entry => entry.card.id)).size, 11);
    assert.deepEqual(team.map(({ slot, role }) => ({ slot, role })), slots);
    assert.ok(team.every(entry => source.includes(entry.card) && playable(entry.card)));
    assert.ok(Math.abs(power(team) - target) <= target * .05);
  }
  assert.notDeepEqual(new Set(first.map(entry => entry.card.id)), new Set(second.map(entry => entry.card.id)));
  const tinyPool = uniformTeam('tiny', 20).map(entry => entry.card);
  assert.throws(() => generateTeam(tinyPool.slice(1), target, rng(1)), /at least 11/);
  assert.equal(power(generateTeam(tinyPool, target, rng(2))), 900);
  assert.equal(power(generateTeam(tinyPool, 0, rng(3))), 900);

  const match = createMatch(first, second, createPolicy(rng(4)));
  for (const entry of first) {
    const { initiative, hidden } = match.view();
    match.submit(entry.card.id, initiative === 'player' ? 'attack' : undefined);
    const { result } = match.view();
    assert.equal(result.robotAction, counters[result.playerAction]);
    if (hidden) assert.equal(result.robotAction, hidden.action);
    match.advance();
  }
  assert.equal(match.view().history.length, 11);
  assert.equal(new Set(match.view().history.map(result => result.robot.card.id)).size, 11);
});
