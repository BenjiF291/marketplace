const upgrades = require('./card-upgrades');
const catalog = require('./public/upgrader-catalog');
const { createCardReader, imageFilenames } = require('./card-data');
const randomCards = require('./random-card-rewards');
const { hasRewards } = require('./pack-builder');
const { createHash } = require('node:crypto');
const { dayKey } = require('./ben-bal-rewards');

const objectives = {
  WIN_BEN_BAL_MATCH: ['Win Ben-Bal matches', ['league']],
  COMPLETE_BEN_BAL_MATCH: ['Complete Ben-Bal matches', ['league']],
  OPEN_PACK: ['Open packs', ['pack']],
  UPGRADE_CARD_TO_EPIC: ['Upgrade cards to Epic', ['tier']],
  UPGRADE_CARD_TO_LEGENDARY: ['Upgrade cards to Legendary', ['tier']],
  CRAFT_UPGRADER: ['Craft upgraders', ['tier', 'level']],
  PURCHASE_ITEM: ['Buy Marketplace items', []],
  SELL_ITEM: ['Sell Marketplace items', []]
};
const themes = ['Royal Gold', 'Electric Blue', 'Epic Purple', 'Legendary Gold', 'Emerald Green', 'Crimson Red', 'Midnight'];
const icons = ['⚽', '🏆', '🎁', '⚡', '🔥', '💎', '👑', '★', '🃏', '🪙'];
const categories = ['Ben-Bal', 'Collection', 'Marketplace', 'Upgrades', 'General'];
const key = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const effectiveStart = event => Math.max(event.start ?? 0, event.publishedAt?.toMillis?.() ?? 0);
const status = (event, now) => event.cancelled ? 'cancelled' : !event.start ? 'draft'
  : now < effectiveStart(event) ? 'upcoming' : now >= event.end ? 'past' : 'active';
const packLocation = (db, id) => db.collection(id?.startsWith('event-') ? 'eventPackSnapshots' : 'packs').doc(id);
const matches = (objective, action) => action.types.includes(objective.type) &&
  Object.entries(objective.filters).every(([filter, value]) => action[filter] === value);
const validInt = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
function text(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }

function configuration(body, draft = false) {
  const name = text(body.name, 90);
  if (!name) throw Error('Enter an event name.');
  const result = { name, description: text(body.description, 700),
    icon: icons.includes(body.icon) ? body.icon : icons[0], theme: themes.includes(body.theme) ? body.theme : themes[0],
    category: categories.includes(body.category) ? body.category : 'General' };
  if (!Array.isArray(body.objectives) || body.objectives.length > 6) throw Error('Configure up to six objectives.');
  result.objectives = body.objectives.map(input => {
    if (!Object.hasOwn(objectives, input.type) || !['once', 'repeat', 'milestone'].includes(input.mode))
      throw Error('Choose a valid objective and completion mode.');
    const filters = Object.fromEntries(objectives[input.type][1].filter(k => input.filters?.[k])
      .map(k => [k, text(input.filters[k], 150)]));
    if (['tier', 'league'].some(k => filters[k] && !catalog.tiers.includes(filters[k])) ||
      filters.level && !['epic', 'legendary'].includes(filters.level) || filters.pack?.includes('/')) throw Error('Invalid objective filter.');
    const rows = input.mode === 'milestone' ? input.milestones : [{ target: input.target, rewards: input.rewards }];
    if (!Array.isArray(rows) || !rows.length || rows.length > 12) throw Error('Configure one to twelve reward thresholds.');
    const thresholds = rows.map(row => {
      if (!validInt(row.target, 1, 100000) || !Array.isArray(row.rewards) || row.rewards.length > 8) throw Error('Invalid objective threshold or reward bundle.');
      const rewards = row.rewards.map(reward => {
        const { kind, amount } = reward, id = text(reward.id, 255);
        if (!(kind === 'footy' ? validInt(Math.round(amount * 100), 1, 100000000) && Math.round(amount * 100) / 100 === amount
          : validInt(amount, 1, 20))) throw Error('Invalid reward quantity.');
        if (!['footy', 'pack', 'card', randomCards.kind, ...upgrades.kinds].includes(kind) ||
          kind !== 'footy' && ((!id && !draft) || id.includes('/') || id.includes(String.fromCharCode(92)))) throw Error('Invalid reward.');
        if (draft && !id && kind !== 'footy') return { kind, id, amount };
        if (upgrades.kinds.includes(kind) && catalog.get(id)?.kind !== kind) throw Error('Unknown upgrader reward.');
        if (kind === randomCards.kind && !randomCards.definitions.some(entry => entry.id === id)) throw Error('Unknown card reward tier.');
        return { kind, id, amount };
      });
      return { target: row.target, rewards };
    }).sort((a, b) => a.target - b.target);
    if (new Set(thresholds.map(row => row.target)).size !== thresholds.length) throw Error('Milestone thresholds must be distinct.');
    return { type: input.type, mode: input.mode, filters, thresholds };
  });
  result.limits = {};
  for (const field of ['player', 'global', 'daily']) {
    const limit = body.limits?.[field] ?? null;
    if (limit !== null && !validInt(limit, 1, 1000000)) throw Error('Invalid reward limit.');
    result.limits[field] = limit;
  }
  result.schedule = { start: body.schedule?.start ?? null, end: body.schedule?.end ?? null,
    duration: body.schedule?.duration ?? 86400000 };
  return result;
}

function createEngine(db, project, clock = Date.now, commitTimestamp = () => null) {
  const events = db.collection('fishyEvents');
  const actions = db.collection('fishyEventActions');
  const notices = db.collection('fishyEventReceipts');
  const stats = id => db.collection('fishyEventStats').doc(id);
  const reader = createCardReader(project);

  function record(tx, owner, source, types, attributes = {}, at = clock()) {
    // A settled action is written in the original gameplay transaction.
    tx.set(actions.doc(key(owner, source)), { owner, source, types, ...attributes, at, nextAttempt: at, attempts: 0 });
  }

  async function prepare(event, eventId) {
    if (!event.objectives.length || event.objectives.some(o => o.thresholds.some(row => !row.rewards.length)))
      throw Error('Configure objectives and rewards before scheduling or activating.');
    const itemBudget = event.objectives.reduce((total, o) => total + Math.max(...o.thresholds.map(row =>
      row.rewards.reduce((count, r) => count + (['pack', 'card', randomCards.kind].includes(r.kind) ? r.amount : 0), 0))), 0);
    if (itemBudget > 225) throw Error('The combined event bundle exceeds 225 inventory items per action.');
    const sources = new Map(), files = await imageFilenames(project);
    let pools;
    for (const objective of event.objectives) {
      if (objective.filters.pack) {
        const pack = objective.filters.pack === 'daily' ? { name: 'Free daily pack' }
          : (await db.collection('packs').doc(objective.filters.pack).get()).data();
        if (!pack) throw Error('The objective pack does not exist.');
        objective.filterLabels = { pack: pack.name ?? objective.filters.pack };
      }
      for (const row of objective.thresholds) for (const reward of row.rewards) {
        if (reward.kind === 'pack') {
          const pack = (await db.collection('packs').doc(reward.id).get()).data();
          if (!hasRewards(pack)) throw Error('The selected pack is unavailable.');
          reward.label = pack.name;
          reward.snapshot = 'event-' + key(eventId, reward.id);
          sources.set(reward.snapshot, { ...pack, eventOriginalPackId: reward.id });
        } else if (reward.kind === 'card') {
          const card = await reader(reward.id, files);
          if (!card) throw Error('The selected card has no valid catalogue record.');
          reward.filename = decodeURIComponent(card.imageUrl.split('/').pop());
          reward.label = card.name;
        } else if (reward.kind === randomCards.kind) {
          pools ??= await randomCards.catalogue(project, (await db.collection('ascendTiers').get()).docs.map(doc => doc.data()));
          const pool = pools.find(p => p.id === reward.id);
          if (!pool?.members.length) throw Error('The selected random card pool is empty.');
          reward.pool = pool.members.map(member => member.filename);
          reward.label = pool.name;
        } else reward.label = reward.kind === 'footy' ? 'Footy' : catalog.get(reward.id).name;
      }
    }
    if (sources.size > 100 || Buffer.byteLength(JSON.stringify(event)) > 700000)
      throw Error('Reduce the number or size of reward configurations before publishing.');
    return sources;
  }

  async function save(id, body, operation) {
    const ref = id ? events.doc(id) : events.doc();
    const previous = (await ref.get()).data();
    const now = clock(), before = previous && status(previous, now);
    if (id && !previous) throw Error('Event not found.');
    let next, snapshots = new Map();
    if (operation === 'duplicate') {
      return save(null, { ...previous, name: previous.name + ' (copy)', schedule: { duration: previous.schedule.duration },
        objectives: previous.objectives.map(o => ({ ...o, ...o.thresholds[0], milestones: o.thresholds })) }, 'draft');
    }
    if (operation === 'delete' && before !== 'draft' || operation === 'cancel' && before !== 'upcoming' ||
      operation === 'end' && before !== 'active' || operation === 'archive' && !['past', 'cancelled'].includes(before))
      throw Error('This action is unavailable for the current status.');
    if (operation === 'end') next = { ...previous, end: now };
    else if (operation === 'cancel') next = { ...previous, cancelled: true };
    else if (operation === 'archive') next = { ...previous, archived: true };
    else if (operation === 'presentation' && before === 'active') {
      const { name, description, icon, theme } = configuration({ ...body, objectives: [] });
      next = { ...previous, name, description, icon, theme };
    } else if (['draft', 'schedule', 'activate'].includes(operation)) {
      if (before && !['draft', 'upcoming'].includes(before)) throw Error('Activated events can only be edited for presentation.');
      next = { ...configuration(body, operation === 'draft'), start: null, end: null, version: 0 };
      if (operation !== 'draft') {
        const start = operation === 'activate' ? now : next.schedule.start;
        const end = next.schedule.end ?? start + next.schedule.duration;
        if (!validInt(start, now, now + 365 * 86400000) || !validInt(end, start + 1, start + 365 * 86400000))
          throw Error('Use a future schedule with an end after the start.');
        next.start = start;
        next.end = end;
        snapshots = await prepare(next, ref.id);
      }
    } else if (operation !== 'delete') throw Error('Invalid event action.');
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if ((current?.version ?? 0) !== (previous?.version ?? 0) || current && status(current, clock()) !== before)
        throw Error('The event changed. Reload it before trying again.');
      if (operation === 'delete') tx.delete(ref);
      else {
        if (operation === 'schedule' && next.start <= clock()) throw Error('Choose a later start time.');
        if (operation === 'activate') {
          const start = clock();
          const end = next.schedule.end ?? start + next.schedule.duration;
          if (end <= start) throw Error('Choose a later end time.');
          next = { ...next, start, end };
        }
        for (const [id, pack] of snapshots) tx.set(packLocation(db, id), pack);
        const publication = ['activate', 'schedule'].includes(operation) ? { publishedAt: commitTimestamp() } : {};
        tx.set(ref, { ...next, ...publication, version: (current?.version ?? 0) + 1, updatedAt: now });
      }
    });
    return { id: ref.id };
  }

  async function settle(eventId, actionRef, action) {
    const ref = events.doc(eventId);
    const player = ref.collection('participants').doc(action.owner);
    const receipt = ref.collection('actions').doc(actionRef.id);
    const aggregate = stats(eventId);
    await db.runTransaction(async tx => {
      const [eventDoc, prior, participant, totals] = await Promise.all([tx.get(ref), tx.get(receipt), tx.get(player), tx.get(aggregate)]);
      const event = eventDoc.data();
      if (prior.exists || !event?.start || event.cancelled || action.at < effectiveStart(event) || action.at >= event.end) return;
      const selected = event.objectives.map((objective, index) => ({ objective, index })).filter(({ objective }) => matches(objective, action));
      if (!selected.length) return;
      const p = participant.data() ?? { progress: {}, rewarded: 0, daily: {}, earned: {} };
      const s = totals.data() ?? { players: 0, actions: 0, completions: 0, rewarded: 0, earned: {} };
      const day = dayKey(new Date(action.at)), daily = p.daily[day] ?? 0;
      const awards = [];
      let rewardedToday = daily;
      for (const { objective, index } of selected) {
        const count = (p.progress[index] ?? 0) + 1;
        p.progress[index] = count;
        const reached = objective.thresholds.find(row => objective.mode === 'repeat' ? count % row.target === 0 : count === row.target);
        if (!reached) continue;
        s.completions++;
        const { limits } = event;
        if ((limits.player !== null && p.rewarded >= limits.player) || (limits.global !== null && s.rewarded >= limits.global) ||
            (limits.daily !== null && rewardedToday >= limits.daily)) continue;
        awards.push(...reached.rewards);
        p.rewarded++;
        s.rewarded++;
        rewardedToday++;
      }
      const user = db.collection('users').doc(action.owner);
      if (awards.length) {
        const account = (await tx.get(user)).data();
        if (!account) throw Error('Event reward account unavailable.');
        const packs = new Map();
        for (const reward of awards.filter(r => r.kind === 'pack')) if (!packs.has(reward.snapshot)) {
          const pack = (await tx.get(packLocation(db, reward.snapshot))).data();
          if (!hasRewards(pack)) throw Error('Event pack snapshot missing.');
          packs.set(reward.snapshot, pack);
        }
        const itemCount = awards.reduce((sum, r) => sum + (['card', 'pack', randomCards.kind].includes(r.kind) ? r.amount : 0), 0);
        if (itemCount > 225) throw Error('Event bundle exceeds transaction capacity.');
        await upgrades.grant(tx, db, action.owner, awards);
        const inventory = [];
        const footy = awards.filter(r => r.kind === 'footy').reduce((sum, r) => sum + r.amount, 0);
        if (footy) tx.update(user, { balance: require('./amulet-utils').round((Number(account.balance) || 0) + footy) });
        awards.forEach((reward, rewardIndex) => {
          const { kind, amount, label } = reward;
          const type = kind + ':' + reward.id;
          for (const summary of [p.earned, s.earned]) summary[type] = { label, amount: (summary[type]?.amount ?? 0) + amount };
          if (!['card', 'pack', randomCards.kind].includes(kind)) return;
          const pack = packs.get(reward.snapshot);
          for (let i = 0; i < amount; i++) {
            const item = db.collection('items').doc();
            const filename = reward.filename ?? reward.pool?.[parseInt(key(eventId, actionRef.id, rewardIndex, i).slice(0, 8), 16) % reward.pool.length];
            const proof = pack ? upgrades.markPack(tx, db, item, action.owner, reward.snapshot, pack) : {};
            inventory.push({ itemId: item.id, kind: pack ? 'pack' : 'card', id: pack ? reward.id : filename });
            tx.set(item, { ...proof, name: pack?.name ?? 'Card ' + filename, price: 0, sold: true, listedForSale: false,
              itemType: pack ? 'pack' : 'card', packId: pack ? reward.snapshot : null, packColor: pack?.color ?? null,
              imageUrl: pack ? null : '/images/' + encodeURIComponent(filename), source: 'event',
              buyerId: action.owner, sellerId: action.owner, sourceItemId: null, createdAt: new Date(), purchasedAt: new Date() });
          }
        });
        tx.set(notices.doc(key(eventId, actionRef.id)), { owner: action.owner, eventId, eventName: event.name,
          source: action.source, at: action.at, acknowledged: false, inventory,
          rewards: awards.map(({ kind, label, amount }) => ({ kind, label, amount })) });
      }
      if (rewardedToday !== daily) p.daily[day] = rewardedToday;
      s.players += Number(!participant.exists);
      s.actions++;
      tx.set(player, p);
      tx.set(aggregate, s);
      tx.set(receipt, { source: action.source, at: action.at, owner: action.owner, rewarded: awards.length > 0 });
    });
  }

  let processing = false;
  async function drain() {
    if (processing) return;
    processing = true;
    try {
      const now = clock();
      const batch = await actions.where('nextAttempt', '<=', now).orderBy('nextAttempt').limit(20).get();
      if (!batch.docs.length) return;
      const queue = batch.docs.map(doc => {
        const row = doc.data();
        return { doc, action: { ...row, at: doc.createTime?.toMillis() ?? row.at } };
      });
      const candidates = await events.where('end', '>', Math.min(...queue.map(row => row.action.at))).get();
      await Promise.all(queue.map(async ({ doc, action }) => {
        try {
          const outcomes = await Promise.allSettled(candidates.docs
            .filter(e => effectiveStart(e.data()) <= action.at && action.at < e.data().end && !e.data().cancelled)
            .map(e => settle(e.id, doc.ref, action)));
          if (outcomes.some(result => result.status === 'rejected')) throw Error('Event reward processing will retry.');
          await doc.ref.delete();
        } catch {
          await db.runTransaction(async tx => {
            const current = (await tx.get(doc.ref)).data();
            if (current) tx.update(doc.ref, { attempts: current.attempts + 1,
              nextAttempt: now + Math.min(3600000, 5000 * 2 ** Math.min(current.attempts, 10)) });
          });
        }
      }));
    } finally { processing = false; }
  }

  return { events, notices, stats, save, record, drain, reader, packRef: id => packLocation(db, id) };
}

module.exports = { createEngine, objectives, themes, icons, categories, status, effectiveStart, packLocation };
