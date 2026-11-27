'use strict';

const { createHmac, randomBytes } = require('node:crypto');
const { createMatch, prepareCard, roundCount } = require('./public/ben-bal-match-engine');
const { generateTeam, createPolicy } = require('./public/ben-bal-robot');
const leagues = require('./ben-bal-leagues');

const limit = 3;
const packId = 'ben-bal-daily-pack';
const source = 'ben-bal-daily';
const definitionId = () => process.env.BEN_BAL_DAILY_PACK_ID || packId;
const unconfigured = 'Daily Pack contents are not configured yet. Your pack is still in your inventory.';
const calendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit'
});

function dayKey(now) {
  const parts = Object.fromEntries(calendar.formatToParts(now).map(({ type, value }) => [type, value]));
  return [parts.year, parts.month, parts.day].join('-');
}

function seededRandom(seed) {
  let index = 0;
  return () => createHmac('sha256', seed).update(String(index++)).digest().readUInt32BE() / 2 ** 32;
}

function matchmakingTeam(player) {
  const { baseCard } = require('./card-upgrades');
  return player.map(entry => entry.card.upgrade
    ? prepareCard(baseCard(entry.card), entry.slot, entry.role) : entry);
}

function start(player, pool, now, league) {
  const seed = randomBytes(32).toString('hex');
  const robot = generateTeam(pool, matchmakingTeam(player), seededRandom(randomBytes(32)), league ? leagues.isSpecial : null);
  return { seed, player, robot, moves: [], startedAt: now.getTime() };
}

function engine(state, count = state.moves.length) {
  const match = createMatch(state.player, state.robot, createPolicy(seededRandom(state.seed), state.player));
  for (const { cardId, action } of state.moves.slice(0, count)) {
    match.submit(cardId, action || undefined);
    match.advance();
  }
  return match;
}

function applyMove(state, input) {
  const { round, cardId, action } = input;
  if (!Number.isInteger(round) || round < 1 || round > roundCount || typeof cardId !== 'string' ||
      ![null, 'attack', 'dribble', 'defence'].includes(action)) throw Error('Invalid round selection.');
  const previous = state.moves[round - 1];
  if (round > state.moves.length + 1 || (previous && (previous.cardId !== cardId || previous.action !== action))) {
    throw Error('That round has already changed.');
  }
  const match = engine(state, round - 1);
  match.submit(cardId, action || undefined);
  const result = match.view();
  match.advance();
  const next = match.view();
  // Keep the detailed history on the server. The client receives only the current round and pitch.
  delete next.history;
  return { result, next, previous: Boolean(previous), move: { cardId, action } };
}

function dailyProgress(day, count, awarded = false) {
  return { day, count, limit, awarded };
}

async function settle(tx, db, userId, matchRef, winner, now, league) {
  if (!leagues.leagues.includes(league)) throw Error('A valid league is required to award a pack.');
  const day = dayKey(now);
  const counter = db.collection('benBalDailyRewards').doc(userId).collection('days').doc(day + '--' + league);
  const count = (await tx.get(counter)).data()?.count ?? 0;
  const configured = (await tx.get(leagues.settings(db))).data()?.[league]?.packId;
  const definition = configured && configured !== packId ? await tx.get(db.collection('packs').doc(configured)) : null;
  const pack = leagues.packInfo(definition);
  const progress = { ...dailyProgress(day, count), league, pack };
  if (winner !== 'player' || count >= limit || !pack) return progress;
  tx.set(counter, { count: count + 1 });
  const itemRef = db.collection('items').doc();
  const proof = require('./card-upgrades').markPack(tx, db, itemRef, userId, pack.id, definition.data());
  tx.set(itemRef, {
    ...proof,
    name: pack.name, itemType: 'pack', packId: pack.id, packColor: pack.color, imageUrl: pack.imageUrl,
    price: 0, sellerId: userId, buyerId: userId, sold: true, listedForSale: false,
    createdAt: now, purchasedAt: now, source, benBalMatchId: matchRef.id
  });
  return { ...progress, count: count + 1, awarded: true };
}

module.exports = { start, matchmakingTeam, engine, applyMove, dayKey, dailyProgress, settle, source, packId, definitionId, unconfigured };
