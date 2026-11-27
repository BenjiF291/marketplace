(() => {
  'use strict';
  const engine = typeof module !== 'undefined' ? require('./ben-bal-match-engine') : window.BenBalMatchEngine;
  const { roles } = typeof module !== 'undefined' ? require('./ben-bal-card') : window.BenBalCard;
  const { slots, counters, playable, prepareCard } = engine;

  const profile = entry => [entry.total, ...roles.map(action => entry.values[action].primary.effective),
    entry.total ** 2, Number(entry.role !== 'keeper' && entry.card.benBal.naturalPosition !== entry.role)];
  const add = (a, b) => a.map((value, i) => value + b[i]);

  function generateTeam(catalogue, player, random = Math.random, special = null) {
    const pool = [...new Map(catalogue.filter(playable).map(card => [card.id, card])).values()];
    if (pool.length < slots.length) throw Error('The robot needs at least 11 playable catalogue cards.');
    const limited = pool.map(card => Boolean(special?.(card)));
    if (limited.filter(value => !value).length + Number(limited.includes(true)) < slots.length) {
      throw Error('There are too few eligible cards for the robot lineup.');
    }
    const availableRoles = [...roles, 'keeper'];
    const powers = pool.map(card => Object.fromEntries(availableRoles.map(role => [role, profile(prepareCard(card, '', role))])));
    const at = (slotIndex, cardIndex) => powers[cardIndex][slots[slotIndex].role];
    const targetProfile = Array.isArray(player) ? player.map(profile).reduce(add) : null;
    const target = targetProfile ? targetProfile[0] : player;
    const tolerance = target * .05;
    const pacing = .972 + random() * .016;
    let best, bestCost = Infinity;

    function cost(values) {
      const distance = Math.abs(values[0] - target);
      if (distance > tolerance) return 10 + distance;
      const desired = targetProfile ? target * pacing : target;
      let loss = Math.abs(values[0] - desired) / Math.max(1, target) + values[5] * .009;
      if (targetProfile) {
        for (let i = 1; i <= 3; i++) loss += .23 * Math.abs(values[i] - targetProfile[i] * pacing) / Math.max(1, targetProfile[i]);
        loss += .14 * Math.abs(values[4] - targetProfile[4] * pacing ** 2) / Math.max(1, targetProfile[4]);
      }
      return loss;
    }

    function search(picks) {
      const used = new Set(picks);
      let total = picks.map((card, i) => at(i, card)).reduce(add);
      let current = cost(total);
      for (let step = 0; step < 16; step++) {
        const hasSpecial = picks.some(index => limited[index]);
        let change, improvement = current;
        const consider = (next, from, to, replacement) => {
          const gap = cost(next);
          if (gap < improvement) {
            improvement = gap;
            change = { next, from, to, replacement };
          }
        };
        picks.forEach((card, i) => {
          const remainder = total.map((value, metric) => value - at(i, card)[metric]);
          for (let candidate = 0; candidate < pool.length; candidate++) {
            if (!used.has(candidate) && (!limited[candidate] || limited[card] || !hasSpecial)) {
              consider(add(remainder, at(i, candidate)), i, -1, candidate);
            }
          }
          for (let j = i + 1; j < picks.length; j++) {
            const other = picks[j];
            consider(remainder.map((value, metric) =>
              value - at(j, other)[metric] + at(i, other)[metric] + at(j, card)[metric]), i, j, other);
          }
        });
        if (!change) break;
        const { next, from, to, replacement } = change;
        if (to === -1) {
          used.delete(picks[from]);
          used.add(replacement);
        } else {
          picks[to] = picks[from];
        }
        picks[from] = replacement;
        total = next;
        current = improvement;
      }
      if (current < bestCost) {
        best = picks.slice();
        bestCost = current;
      }
    }

    const indices = pool.map((_, index) => index);
    for (let trial = 0; trial < 7; trial++) {
      const shuffled = indices.slice();
      for (let i = 0; i < slots.length; i++) {
        const hasSpecial = shuffled.slice(0, i).some(index => limited[index]);
        const available = shuffled.slice(i).filter(index => !hasSpecial || !limited[index]);
        const j = shuffled.indexOf(available[Math.floor(random() * available.length)], i);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      search(shuffled.slice(0, slots.length));
    }

    if (bestCost >= 10) {
      // Exact minimum and maximum assignments use the small 3â€“3â€“4â€“1 role capacities.
      // This gives the closest possible result when the target is outside the catalogue range.
      const groups = availableRoles.map(role => slots.filter(slot => slot.role === role).length);
      for (const direction of [-1, 1]) {
        let states = new Map([['0,0,0,0,0', { total: 0, picks: [] }]]);
        powers.forEach((card, index) => {
          const next = new Map(states);
          for (const [key, state] of states) {
            const counts = key.split(',').map(Number);
            availableRoles.forEach((role, i) => {
              if (counts[i] === groups[i] || (counts[4] && limited[index])) return;
              const updated = counts.slice();
              updated[i]++;
              updated[4] += Number(limited[index]);
              const stateKey = updated.join(',');
              const total = state.total + card[role][0];
              if (!next.has(stateKey) || direction * total > direction * next.get(stateKey).total) {
                next.set(stateKey, { total, picks: [...state.picks, { index, role }] });
              }
            });
          }
          states = next;
        });
        const extremes = [0, 1].map(count => states.get([...groups, count].join(','))).filter(Boolean);
        const extreme = extremes.reduce((best, candidate) =>
          !best || direction * candidate.total > direction * best.total ? candidate : best, null);
        const sorted = availableRoles.flatMap(role => extreme.picks.filter(pick => pick.role === role).map(pick => pick.index));
        search(sorted);
      }
    }
    return slots.map(({ slot, role }, index) => prepareCard(pool[best[index]], slot, role));
  }

  function createPolicy(random = Math.random, playerTeam = []) {
    // Store only the pre-match Overall distribution and identities for removing revealed cards.
    const ratings = playerTeam.map(({ card }) => ({ id: card.id, overall: card.overall }));
    const baseline = [44, 58, 72, 84];
    const strength = (entry, action) => entry.values[action].primary.effective + entry.values[action].secondary.effective * .14;

    function likelyRatings(revealed) {
      const used = new Set(revealed.map(card => card.id));
      return ratings.map(card => used.has(card.id) ? null : card.overall).filter(value => value !== null);
    }

    function choose(unused, context, actions) {
      const { remaining, score, revealed, overall, action: declared } = context;
      const gap = score.robot - score.player;
      const clinch = gap > 0 && gap + 1 > remaining - 1 && gap <= remaining;
      const urgent = clinch || remaining <= 2 || (gap < 0 && -gap >= remaining - 2);
      const reserve = urgent ? .04 : (.30 + Math.max(-.12, Math.min(.16, gap * .045))) * Math.min(1, (remaining - 1) / 4);
      const versatility = unused.map(entry => roles.reduce((sum, key) => sum + strength(entry, key), 0) / 3);
      const low = Math.min(...versatility), high = Math.max(...versatility);
      const guesses = declared ? [overall] : likelyRatings(revealed);
      const samples = guesses.length ? guesses : baseline;
      const options = unused.flatMap((entry, i) => actions.map(action => {
        const opponentAction = counters[action];
        const evidence = revealed.filter(card => card.action === opponentAction);
        const calibration = evidence.reduce((sum, card) => sum + card.primary - (12 + .83 * card.overall), 0) / (evidence.length + 4);
        const chance = samples.reduce((sum, overall) => {
          const demand = Math.min(107, 12 + overall * .83 + calibration);
          return sum + 1 / (1 + Math.exp((demand - strength(entry, action)) / 10));
        }, 0) / samples.length;
        return { id: entry.card.id, action, chance, cost: (versatility[i] - low) / (high - low || 1) };
      }));
      const bestChance = Math.max(...options.map(option => option.chance));
      const canConcede = !urgent && remaining >= 4 && score.robot + remaining - 1 > score.player + 1;
      const sacrifice = canConcede && bestChance < .35;
      const ranked = options.map(option => ({
        ...option, utility: option.chance - option.cost * (sacrifice ? .82 : reserve) + random() * (urgent ? .018 : .075)
      }));
      return ranked.reduce((best, option) => option.utility > best.utility ? option : best);
    }

    return {
      initiate(unused, context) {
        const { id, action } = choose(unused, context, roles);
        return { id, action };
      },
      respond(unused, context) {
        return { id: choose(unused, context, [counters[context.action]]).id };
      }
    };
  }

  const api = { generateTeam, createPolicy };
  if (typeof module !== 'undefined') module.exports = api;
  else window.BenBalRobot = api;
})();
