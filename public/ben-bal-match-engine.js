(() => {
  'use strict';
  const { roles, statKeys, formation, cardValues, naturalPosition } =
    typeof module !== 'undefined' ? require('./ben-bal-card') : window.BenBalCard;
  const slots = formation.flatMap(row => row.slots.map(slot => ({ slot, role: row.role })));
  const roundCount = slots.length;
  const counters = Object.freeze({ attack: 'defence', dribble: 'dribble', defence: 'attack' });

  function playable(card) {
    if (!card?.id || !Number.isFinite(card.overall) ||
        !statKeys.every(key => Number.isFinite(card.stats?.[key]))) return false;
    const keys = roles.flatMap(role => [card.benBal?.[role]?.primary, card.benBal?.[role]?.secondary]);
    return statKeys.every(key => keys.includes(key)) &&
      card.benBal.naturalPosition === naturalPosition(card.stats, card.benBal) &&
      roles.every(role => card.stats[card.benBal[role].primary] >= card.stats[card.benBal[role].secondary]);
  }

  function prepareCard(card, slot, role) {
    const { values } = cardValues(card, role);
    const total = roles.reduce((sum, action) => sum + values[action].primary.effective + values[action].secondary.effective, 0);
    return { card, slot, role, values, total };
  }

  function prepareTeam(lineup, cardsById) {
    if (!lineup || Object.keys(lineup).length !== roundCount || slots.some(({ slot }) => !Object.hasOwn(lineup, slot))) {
      throw Error('Fill all 11 slots in the 4–3–3 formation before playing.');
    }
    if (new Set(Object.values(lineup)).size !== roundCount) throw Error('Each card can occupy only one team slot.');
    return slots.map(({ slot, role }) => {
      const card = cardsById.get(lineup[slot]);
      if (!playable(card)) throw Error('Every selected card must be available with a valid Ben-Bal allocation.');
      return prepareCard(card, slot, role);
    });
  }

  function resolve(player, playerAction, robot, robotAction) {
    if (!roles.includes(playerAction) || counters[playerAction] !== robotAction) throw Error('Invalid action matchup.');
    const comparisons = [];
    for (const stage of ['primary', 'secondary', 'total']) {
      const a = stage === 'total' ? player.total : player.values[playerAction][stage].effective;
      const b = stage === 'total' ? robot.total : robot.values[robotAction][stage].effective;
      comparisons.push({ stage, player: a, robot: b });
      if (a !== b) return Object.freeze({ player, playerAction, robot, robotAction, comparisons, winner: a > b ? 'player' : 'robot' });
    }
    return Object.freeze({ player, playerAction, robot, robotAction, comparisons, winner: 'draw' });
  }

  function createMatch(playerTeam, robotTeam, robotPolicy) {
    const player = new Map(playerTeam.map(entry => [entry.card.id, entry]));
    const robot = new Map(robotTeam.map(entry => [entry.card.id, entry]));
    if (player.size !== roundCount || robot.size !== roundCount ||
        playerTeam.length !== roundCount || robotTeam.length !== roundCount) throw Error('Both teams require 11 distinct cards.');
    const history = [];
    const revealedRobot = new Map();
    let initiative = 'player', phase = 'player-initiation', pending = null;

    function scorecard() {
      const score = { player: 0, robot: 0, draw: 0 };
      for (const { winner } of history) score[winner]++;
      return score;
    }

    function decisionContext() {
      return {
        round: history.length + 1,
        remaining: roundCount - history.length,
        score: scorecard(),
        revealed: history.map(({ player, playerAction, winner }) => ({
          id: player.card.id, overall: player.card.overall, action: playerAction,
          primary: player.values[playerAction].primary.effective, winner
        }))
      };
    }

    function validRobotChoice(selection) {
      if (!robot.has(selection?.id)) throw Error('The robot could not select an available card.');
      return robot.get(selection.id);
    }

    return {
      view() {
        const score = scorecard();
        const finished = phase === 'complete';
        return {
          phase, initiative, score, round: Math.min(roundCount, history.length + (phase === 'result' || phase === 'complete' ? 0 : 1)),
          player: playerTeam.map(entry => ({ ...entry, used: !player.has(entry.card.id) })),
          robotRemaining: robot.size,
          robotPitch: robotTeam.map(({ slot, card }) => ({
            slot, overall: card.overall, revealed: revealedRobot.get(slot) ?? null
          })),
          rounds: history.map(result => result.winner),
          hidden: phase === 'player-response' ? { overall: pending.entry.card.overall, action: pending.action } : null,
          result: phase === 'result' ? history.at(-1) : null,
          history: finished ? history.slice() : null,
          winner: finished ? (score.player === score.robot ? 'draw' : score.player > score.robot ? 'player' : 'robot') : null
        };
      },
      submit(id, action) {
        if (phase !== 'player-initiation' && phase !== 'player-response') throw Error('This round has already been confirmed.');
        const own = player.get(id);
        if (!own) throw Error('Choose an unused card.');
        let result;
        if (phase === 'player-initiation') {
          if (!roles.includes(action)) throw Error('Choose Attack, Dribble or Defence.');
          const opponent = validRobotChoice(robotPolicy.respond([...robot.values()], {
            ...decisionContext(), action, overall: own.card.overall
          }));
          result = resolve(own, action, opponent, counters[action]);
        } else {
          if (action !== undefined) throw Error('The counter action is automatic.');
          result = resolve(own, counters[pending.action], pending.entry, pending.action);
        }
        player.delete(id);
        robot.delete(result.robot.card.id);
        revealedRobot.set(result.robot.slot, result.robot);
        history.push(result);
        pending = null;
        phase = 'result';
      },
      advance() {
        if (phase !== 'result') throw Error('Resolve this round before continuing.');
        if (history.length === roundCount) {
          phase = 'complete';
          return;
        }
        if (initiative === 'player') {
          const selection = robotPolicy.initiate([...robot.values()], decisionContext());
          const entry = validRobotChoice(selection);
          if (!roles.includes(selection.action)) throw Error('The robot could not select an action.');
          pending = { entry, action: selection.action };
          initiative = 'robot';
          phase = 'player-response';
        } else {
          initiative = 'player';
          phase = 'player-initiation';
        }
      }
    };
  }

  const api = { slots, roundCount, counters, playable, prepareCard, prepareTeam, resolve, createMatch };
  if (typeof module !== 'undefined') module.exports = api;
  else window.BenBalMatchEngine = api;
})();
