const { createEngine, objectives, themes, icons, categories, status, effectiveStart } = require('./event-manager');
const { imageFilenames } = require('./card-data');
const { hasRewards } = require('./pack-builder');
const random = require('./random-card-rewards');
const upgrades = require('./public/upgrader-catalog');
const { FieldPath, FieldValue } = require('firebase-admin/firestore');

module.exports = function register(app, db, authenticate, project) {
  const engine = createEngine(db, project, Date.now, () => FieldValue.serverTimestamp());
  const { events, notices, stats } = engine;
  function route(method, path, admin, handle) {
    app[method](path, async (req, res) => {
      res.set('Cache-Control', 'private, no-store');
      let owner;
      try { owner = await authenticate(req); } catch { return res.status(401).json({ error: 'Please sign in again.' }); }
      try {
        if (admin && (await db.collection('users').doc(owner).get()).data()?.isAdmin !== true)
          return res.status(403).json({ error: 'Administrator access required.' });
        return res.json(await handle(req, owner));
      } catch (error) { return res.status(400).json({ error: error.message }); }
    });
  }
  const identity = value => {
    if (typeof value !== 'string' || !/^[\w-]{1,150}$/.test(value)) throw Error('Invalid event identifier.');
    return value;
  };
  const safe = (doc, now) => {
    const record = doc.data(), { publishedAt, ...event } = record;
    return { ...event, start: event.start ? effectiveStart(record) : null, id: doc.id, status: status(record, now), objectives: event.objectives.map(o => ({
      ...o, label: objectives[o.type]?.[0] ?? o.type, thresholds: o.thresholds.map(row => ({ target: row.target,
        rewards: row.rewards.map(({ kind, amount, id, label }) => ({ kind, amount, id, label: label ?? id })) }))
    })) };
  };
  const order = (a, b) => (b.start ?? b.updatedAt) - (a.start ?? a.updatedAt);
  route('get', '/admin/events', true, async () => {
    const now = Date.now(), collection = await events.get();
    const list = await Promise.all(collection.docs.map(async doc => ({
      ...safe(doc, now), stats: (await stats(doc.id).get()).data() ?? {}
    })));
    return { now, events: list.sort(order) };
  });
  route('get', '/admin/events/catalogue', true, async () => {
    const [packDocs, files, tiers] = await Promise.all([
      db.collection('packs').get(), imageFilenames(project), db.collection('ascendTiers').get()
    ]);
    const cards = [];
    for (let offset = 0; offset < files.length; offset += 20) {
      const batch = await Promise.all(files.slice(offset, offset + 20).map(name => engine.reader(name, files)));
      cards.push(...batch.filter(Boolean).map(card => ({ id: card.id, name: card.name, tier: card.tier, imageUrl: card.imageUrl })));
    }
    return { objectives, themes, icons, categories, tiers: upgrades.tiers,
      packs: packDocs.docs.filter(doc => hasRewards(doc.data())).map(doc => ({ id: doc.id, name: doc.data().name })),
      cards, random: (await random.catalogue(project, tiers.docs.map(doc => doc.data()))).filter(pool => pool.count),
      materials: upgrades.definitions };
  });
  route('post', '/admin/events', true, req => engine.save(req.body.id ? identity(req.body.id) : null, req.body, req.body.operation));
  route('get', '/admin/events/:id/results', true, async req => {
    const id = identity(req.params.id);
    const ref = events.doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw Error('Event not found.');
    const kind = req.query.tab === 'rewards' ? 'actions' : 'participants';
    let query = ref.collection(kind).orderBy(FieldPath.documentId());
    if (req.query.after) query = query.startAfter(identity(req.query.after));
    const page = (await query.limit(26).get()).docs;
    const rows = await Promise.all(page.slice(0, 25).map(async row => {
      const data = row.data(), owner = kind === 'participants' ? row.id : data.owner;
      const player = (await db.collection('users').doc(owner).get()).data();
      if (kind === 'participants') return { name: player?.username ?? 'Unavailable player', ...data };
      if (!data.rewarded) return { name: player?.username ?? 'Unavailable player', ...data };
      const { createHash } = require('node:crypto');
      const receipt = createHash('sha256').update(JSON.stringify([id, row.id])).digest('hex');
      return { name: player?.username ?? 'Unavailable player', ...data, rewards: (await notices.doc(receipt).get()).data()?.rewards ?? [] };
    }));
    return { event: safe(doc, Date.now()), stats: (await stats(id).get()).data() ?? {},
      rows, next: page.length > 25 ? page[24].id : null };
  });
  route('get', '/events', false, async (req, owner) => {
    const now = Date.now(), collection = await events.where('end', '>', now - 30 * 86400000).get();
    const list = await Promise.all(collection.docs.filter(doc => {
      const data = doc.data();
      return data.start && !data.archived && !data.cancelled;
    }).map(async doc => {
      const event = safe(doc, now);
      const [progress, total] = await Promise.all([doc.ref.collection('participants').doc(owner).get(),
        event.limits.global === null ? null : stats(doc.id).get()]);
      return { ...event, player: progress.data() ?? null,
        remainingGlobal: event.limits.global === null ? null : Math.max(0, event.limits.global - (total.data()?.rewarded ?? 0)) };
    }));
    return { now, events: list.sort(order) };
  });
  route('get', '/events/receipts', false, async (req, owner) => {
    const receipts = await notices.where('owner', '==', owner).where('acknowledged', '==', false).limit(20).get();
    return { receipts: receipts.docs.map(doc => {
      const { owner, ...receipt } = doc.data();
      return { ...receipt, id: doc.id };
    }).sort((a, b) => a.at - b.at) };
  });
  route('post', '/events/receipts/:id', false, (req, owner) => db.runTransaction(async tx => {
    const ref = notices.doc(identity(req.params.id));
    const receipt = (await tx.get(ref)).data();
    if (receipt?.owner !== owner) throw Error('Receipt unavailable.');
    tx.update(ref, { acknowledged: true });
    return { acknowledged: true };
  }));
  const timer = setInterval(() => engine.drain().catch(error => console.error('Event worker:', error.message)), 10000);
  timer.unref();
  return engine;
};
