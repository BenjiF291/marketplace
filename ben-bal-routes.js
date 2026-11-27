const { cardId, createCardReader, imageFilenames } = require('./card-data');
const { createBenBalReader } = require('./ben-bal-allocations');
const { formation } = require('./public/ben-bal-card');
const rewards = require('./ben-bal-rewards');
const leagueRules = require('./ben-bal-leagues');
const upgrades = require('./card-upgrades');
const { prepareTeam, playable, roundCount } = require('./public/ben-bal-match-engine');

const slots = new Set(formation.flatMap(row => row.slots));
const imageOrigins = new Set(['https://marketplace-aw8b.onrender.com', 'https://fishy-20779.web.app']);

function inventoryFilename(item) {
  if (item.listedForSale === true || item.packId ||
      (item.itemType && item.itemType !== 'card') || typeof item.imageUrl !== 'string') return null;
  try {
    const url = new URL(item.imageUrl, 'https://marketplace-aw8b.onrender.com');
    if (!imageOrigins.has(url.origin) && !/^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(url.origin)) {
      return null;
    }
    const match = /^\/images\/([^/]+)$/.exec(url.pathname);
    if (!match) return null;
    const filename = decodeURIComponent(match[1]);
    return /^[^/\\]+\.(?:png|jpe?g|webp|gif)$/i.test(filename) ? filename : null;
  } catch {
    return null;
  }
}

function ownedIdentities(snapshot, records) {
  const owned = new Map();
  for (const doc of snapshot.docs) {
    const item = doc.data();
    const filename = inventoryFilename(item);
    if (!filename) continue;
    const base = cardId(filename);
    const record = records.get(doc.id);
    const upgrade = record?.baseCardId === base && record.ownerId === item.buyerId ? record : null;
    const id = upgrade?.variantId ?? base;
    if (!owned.has(id)) owned.set(id, { id, base, upgrade, name: item.name || filename });
  }
  return owned;
}

function validLineup(lineup) {
  if (!lineup || typeof lineup !== 'object' || Array.isArray(lineup)) return false;
  const entries = Object.entries(lineup);
  return entries.every(([slot, id]) => slots.has(slot) && typeof id === 'string' && id.length > 0 && id.length <= 255) &&
    new Set(entries.map(([, id]) => id)).size === entries.length;
}

function registerBenBal(app, db, authenticate, project) {
  const read = createBenBalReader(project, createCardReader(project));
  async function ownedCards(snapshot, owner, tx) {
    const records = new Map();
    if (owner) {
      const query = upgrades.variants(db, owner);
      const result = await (tx ? tx.get(query) : query.get());
      for (const doc of result.docs) records.set(doc.id, doc.data());
    }
    return ownedIdentities(snapshot, records);
  }
  const resolve = async item => {
    const { ownerId, ...upgrade } = item.upgrade || {};
    return upgrades.applyVariant(await read(item.base), item.upgrade ? upgrade : null);
  };
  let catalogue;
  const knownLeague = league => leagueRules.leagues.includes(league);
  const invalidLeague = res => res.status(400).json({ error: 'Choose one of the six Ben-Bal leagues.' });
  const leagueTeam = (team, league) => league ? team.collection('leagues').doc(league) : team;

  function route(handle, unavailable = 'Ben-Bal teams are temporarily unavailable.') {
    return async (req, res) => {
      res.set('Cache-Control', 'no-store');
      let userId;
      try {
        userId = await authenticate(req);
      } catch {
        return res.status(401).json({ error: 'Please log in again to open Ben-Bal.' });
      }
      const team = db.collection('benBalTeams').doc(userId);
      const inventory = db.collection('items').where('buyerId', '==', userId).where('sold', '==', true);
      try {
        return await handle(req, res, team, inventory, userId);
      } catch (error) {
        console.error('Ben-Bal team:', error);
        return res.status(503).json({ error: unavailable });
      }
    };
  }

  app.get('/ben-bal/leagues', route(async (req, res, team, inventory, userId) => {
    const day = rewards.dayKey(new Date());
    const [tiers, settings] = await Promise.all([db.collection('ascendTiers').get(), leagueRules.settings(db).get()]);
    const ids = leagueRules.tiersFrom(tiers);
    const days = db.collection('benBalDailyRewards').doc(userId).collection('days');
    const leagues = await Promise.all(leagueRules.leagues.map(async name => {
      const packId = settings.data()?.[name]?.packId;
      const [count, pack] = await Promise.all([days.doc(day + '--' + name).get(),
        packId && packId !== rewards.packId ? db.collection('packs').doc(packId).get() : null]);
      return { name, tierId: ids[name], count: count.data()?.count ?? 0, pack: leagueRules.packInfo(pack) };
    }));
    res.json({ leagues });
  }));

  for (const method of ['get', 'put']) app[method]('/ben-bal/admin/leagues', route(async (req, res, team, inventory, userId) => {
    if ((await db.collection('users').doc(userId).get()).data()?.isAdmin !== true) {
      return res.status(403).json({ error: 'Administrator access is required.' });
    }
    const packs = (await db.collection('packs').get()).docs.map(leagueRules.packInfo)
      .filter(pack => pack && pack.id !== rewards.packId).sort((a, b) => a.name.localeCompare(b.name));
    const ref = leagueRules.settings(db);
    if (method === 'get') return res.json({ config: (await ref.get()).data() ?? {}, packs, leagues: leagueRules.leagues });
    let config;
    try { config = leagueRules.validateConfig(req.body, new Set(packs.map(pack => pack.id))); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    await ref.set(config);
    return res.json({ config });
  }));

  app.get('/ben-bal/team', route(async (req, res, team, inventory, userId) => {
    const league = req.query.league;
    if (league !== undefined && !knownLeague(league)) return invalidLeague(res);
    team = leagueTeam(team, league);
    const result = await db.runTransaction(async tx => {
      const [saved, items] = await Promise.all([tx.get(team), tx.get(inventory)]);
      const config = league ? (await tx.get(leagueRules.settings(db))).data()?.[league] : null;
      const owned = await ownedCards(items, league ? userId : null, tx);
      const lineup = saved.data()?.lineup ?? {};
      const entries = Object.entries(lineup);
      const current = entries.filter(([, id]) => owned.has(id));
      const removed = entries.length - current.length;
      const cleanLineup = Object.fromEntries(current);
      if (removed) tx.set(team, { schemaVersion: 1, lineup: cleanLineup });
      let collection = [...owned.values()];
      if (league) {
        collection = (await Promise.all(collection.map(async item => {
          const card = await resolve(item);
          return { id: item.id, name: item.name, ...(item.upgrade ? { card } : {}),
            special: leagueRules.isSpecial(card), eligibility: leagueRules.eligibility(card, league, config) };
        }))).filter(card => card.special || !card.eligibility);
        return { lineup: cleanLineup, owned: collection, removed, tiers: leagueRules.eligibleTiers(league), range: config?.range ?? null };
      }
      return { lineup: cleanLineup, owned: collection.map(({ id, name }) => ({ id, name })), removed };
    });
    return res.json(result);
  }));

  app.put('/ben-bal/team', route(async (req, res, team, inventory, userId) => {
    const league = req.query.league;
    if (league !== undefined && !knownLeague(league)) return invalidLeague(res);
    team = leagueTeam(team, league);
    const lineup = req.body?.lineup;
    if (!validLineup(lineup)) {
      return res.status(400).json({ error: 'Use a valid slot for each card and select each identity only once.' });
    }
    const ids = Object.values(lineup);
    const saved = await db.runTransaction(async tx => {
      const owned = await ownedCards(await tx.get(inventory), league ? userId : null, tx);
      if (ids.some(id => !owned.has(id))) return 'A selected card is no longer in your available collection.';
      const cards = await Promise.all(ids.map(id => resolve(owned.get(id))));
      if (cards.some(card => !card?.benBal)) return 'A selected card is missing Ben-Bal statistics.';
      if (league) {
        const error = leagueRules.lineupError(cards, league, (await tx.get(leagueRules.settings(db))).data()?.[league]);
        if (error) return error;
      }
      tx.set(team, { schemaVersion: 1, lineup });
      return '';
    });
    if (saved) return res.status(409).json({ error: saved });
    return res.json({ lineup });
  }));

  const setup = route(async (req, res, team, inventory, userId) => {
    const legacy = req.path === '/ben-bal/robot-setup';
    const league = req.body?.league;
    if (!legacy && !knownLeague(league)) return invalidLeague(res);
    const lineup = req.body?.lineup;
    if (!validLineup(lineup) || Object.keys(lineup).length !== roundCount) {
      return res.status(400).json({ error: 'Fill all 11 formation slots with distinct cards.' });
    }
    const owned = await ownedCards(await inventory.get(), legacy ? null : userId);
    const ids = Object.values(lineup);
    if (ids.some(id => !owned.has(id))) {
      return res.status(409).json({ error: 'A selected card is no longer in your available inventory. Reload your team to update it.' });
    }
    const cards = await Promise.all(ids.map(id => resolve(owned.get(id))));
    if (!cards.every(playable)) {
      return res.status(409).json({ error: 'A selected card is missing valid Ben-Bal statistics or an allocation.' });
    }
    let config, marketplaceTierId;
    if (!legacy) {
      const [settings, tiers] = await Promise.all([leagueRules.settings(db).get(), db.collection('ascendTiers').get()]);
      config = settings.data()?.[league];
      marketplaceTierId = leagueRules.tiersFrom(tiers)[league];
      if (!marketplaceTierId) return res.status(409).json({ error: 'The Marketplace tier for this league is unavailable or ambiguous.' });
      const error = leagueRules.lineupError(cards, league, config);
      if (error) return res.status(409).json({ error });
    }
    catalogue ??= imageFilenames(project).then(async ids => {
      const pool = [];
      for (let offset = 0; offset < ids.length; offset += 12) {
        pool.push(...(await Promise.all(ids.slice(offset, offset + 12).map(id => read(id, ids)))).filter(playable));
      }
      return pool;
    }).catch(error => {
      catalogue = undefined;
      throw error;
    });
    const all = await catalogue;
    const pool = legacy ? all : all.filter(card => !leagueRules.eligibility(card, league, config));
    const regular = pool.filter(card => !leagueRules.isSpecial(card)).length;
    if ((legacy ? pool.length : regular + Number(pool.length > regular)) < roundCount) {
      return res.status(503).json({ error: 'There are too few eligible catalogue cards for this robot team.' });
    }
    if (req.path === '/ben-bal/robot-setup') return res.json({ cards, pool });
    const player = prepareTeam(lineup, new Map(cards.map(card => [card.id, card])));
    const state = rewards.start(player, pool, new Date(), league);
    const ref = db.collection('benBalMatches').doc();
    await db.runTransaction(async tx => {
      const favourites = await tx.get(upgrades.favourites(db, userId));
      tx.set(ref, { ...state, userId, league, marketplaceTierId, favourites: upgrades.favouriteSlots(favourites.data()) });
    });
    return res.json({ id: ref.id, league, view: rewards.engine(state).view() });
  }, 'Could not prepare the robot match. Try again in a moment.');
  app.post('/ben-bal/robot-setup', setup);
  app.post('/ben-bal/matches', setup);

  app.post('/ben-bal/matches/:id/round', route(async (req, res, team, inventory, userId) => {
    if (!/^[a-zA-Z0-9]{20}$/.test(req.params.id)) return res.status(404).json({ error: 'Match not found.' });
    const ref = db.collection('benBalMatches').doc(req.params.id);
    const now = new Date();
    const reply = await db.runTransaction(async tx => {
      const state = (await tx.get(ref)).data();
      if (!state || state.userId !== userId) return { status: 404, error: 'Match not found.' };
      if (!knownLeague(state.league) && !state.reward) return { status: 409, error: 'Start a new league match to continue.' };
      if (!state.reward && now.getTime() - state.startedAt > 24 * 60 * 60 * 1000) {
        return { status: 409, error: 'This match has expired. Start a new match.' };
      }
      let round;
      try { round = rewards.applyMove(state, req.body || {}); }
      catch (error) { return { status: 409, error: error.message }; }
      const { result, next, previous, move } = round;
      let reward = next.phase === 'complete' ? state.reward : null;
      if (!previous) {
        if (next.phase === 'complete') {
          const progress = await upgrades.favouriteProgress(tx, db, userId, state.favourites, next.winner);
          reward = await rewards.settle(tx, db, userId, ref, next.winner, now, state.league);
          for (const { ref: preparation, value } of progress) tx.set(preparation, { ownerId: userId, value });
        }
        tx.update(ref, { moves: [...state.moves, move], ...(reward ? { reward } : {}) });
      }
      return { result, next, reward };
    });
    if (reply.status) return res.status(reply.status).json({ error: reply.error });
    return res.json(reply);
  }, 'Could not confirm this round. Try the same move again.'));

}

module.exports = registerBenBal;
