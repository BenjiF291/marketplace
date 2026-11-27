const { cards } = require('../data/card-statistics.json');
const { readAllocations } = require('../ben-bal-allocations');
const { naturalPosition, roles } = require('../public/ben-bal-card');
const { counters, createMatch, prepareCard, slots } = require('../public/ben-bal-match-engine');
const { createPolicy, generateTeam } = require('../public/ben-bal-robot');
const path = require('node:path');

function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function fieldTeam(pool, random) {
  const available = pool.slice();
  return slots.map(({ slot, role }) => {
    const natural = available.filter(card => card.benBal.naturalPosition === role);
    const candidates = natural.length && random() < .8 ? natural : available;
    const card = candidates[Math.floor(random() * candidates.length)];
    available.splice(available.indexOf(card), 1);
    return prepareCard(card, slot, role);
  });
}

function play(strategy, view, random) {
  const available = view.player.filter(entry => !entry.used);
  const actions = view.hidden ? [counters[view.hidden.action]] : roles;
  if (strategy === 'random') {
    return [available[Math.floor(random() * available.length)].card.id,
      view.hidden ? undefined : actions[Math.floor(random() * actions.length)]];
  }
  const options = available.flatMap(entry => actions.map(action => {
    const { primary, secondary } = entry.values[action];
    const value = primary.effective + secondary.effective * .12;
    let utility = value;
    if (strategy === 'conservative' && view.round < 10) {
      const demand = view.hidden ? 12 + view.hidden.overall * .83 : 73;
      const chance = 1 / (1 + Math.exp((demand - value) / 10));
      utility = chance - entry.total * .00025;
    }
    return { id: entry.card.id, action, utility };
  }));
  const selected = options.reduce((best, option) => option.utility > best.utility ? option : best);
  return [selected.id, view.hidden ? undefined : selected.action];
}

async function main() {
  const samples = Number(process.argv[2] ?? 120);
  if (!Number.isInteger(samples) || samples < 1) throw Error('Provide a positive sample count.');
  const allocations = await readAllocations(path.resolve(__dirname, '..'));
  const pool = cards.filter(card => allocations.has(card.id)).map(card => {
    const allocation = allocations.get(card.id);
    return { ...card, benBal: { ...allocation, naturalPosition: naturalPosition(card.stats, allocation) } };
  });
  const stats = Object.fromEntries(['random', 'greedy', 'conservative'].map(strategy =>
    [strategy, { player: 0, robot: 0, draw: 0 }]));
  let inRange = 0;
  for (let sample = 0; sample < samples; sample++) {
    const player = fieldTeam(pool, seeded(sample * 733 + 19));
    const robot = generateTeam(pool, player, seeded(sample * 1499 + 193));
    const power = team => team.reduce((sum, entry) => sum + entry.total, 0);
    if (Math.abs(power(robot) - power(player)) <= power(player) * .05) inRange++;
    for (const [strategy, results] of Object.entries(stats)) {
      const match = createMatch(player, robot, createPolicy(seeded(sample * 1109 + 127), player));
      const playerRandom = seeded(sample * 133 + 57);
      while (match.view().phase !== 'complete') {
        match.submit(...play(strategy, match.view(), playerRandom));
        match.advance();
      }
      results[match.view().winner]++;
    }
  }
  console.log(JSON.stringify({ perStrategy: samples, inRange, results: Object.fromEntries(
    Object.entries(stats).map(([strategy, record]) => [strategy, {
      ...record, playerWinPercent: Number((100 * record.player / samples).toFixed(1))
    }])
  ) }, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
