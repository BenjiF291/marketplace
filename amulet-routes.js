const { catalog, effects, changeAmulets, SLOT_PRICES, discounted, rebalanceAmulet } = require('./amulet-utils');
module.exports = function(app, db, getTiers) {
  app.get('/amulets', async (req, res) => {
    const id = req.header('X-User-Id');
    if (!id) return res.status(401).send('Missing user');
    try {
      const [user, tiers] = await Promise.all([db.collection('users').doc(id).get(), getTiers()]);
      if (!user.exists) return res.status(404).send('User not found');
      const data = user.data();
      const buffs = effects(data);
      res.json({ catalog: catalog(tiers), owned: data.amulets || {}, slots: (data.amuletSlots || []).map(rebalanceAmulet),
        slotCount: data.amuletSlotCount || 1, slotPrices: SLOT_PRICES,
        gems: data.gems || {}, balance: data.balance || 0, isAdmin: data.isAdmin === true, effects: buffs, vipPrice: discounted(300, buffs.vip), vipDays: 30 + (buffs.vipdays || 0), serverNow: Date.now() });
    } catch (error) { res.status(500).send('Could not load amulets'); }
  });
  app.post('/amulets/:action', async (req, res) => {
    const id = req.header('X-User-Id');
    if (!id) return res.status(401).send('Missing user');
    try {
      await db.runTransaction(async transaction => {
        const ref = db.collection('users').doc(id);
        const user = await transaction.get(ref);
        const tiers = await transaction.get(db.collection('ascendTiers').orderBy('order', 'asc'));
        if (!user.exists) throw new Error('User not found');
        const entries = catalog(tiers.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        transaction.update(ref, changeAmulets(user.data(), req.params.action, req.body, entries));
      });
      res.json({ success: true });
    } catch (error) { res.status(400).send(error.message); }
  });
  app.post('/admin/grant-resource', async (req, res) => {
    const id = req.header('X-User-Id');
    const { userId, kind, amuletId, quantity } = req.body;
    if (!id) return res.status(401).send('Missing user');
    if (!userId || typeof userId !== 'string' || userId.includes('/') || !Number.isSafeInteger(quantity) || quantity < 1 || !['footy', 'amulet'].includes(kind)) return res.status(400).send('Invalid grant');
    try {
      await db.runTransaction(async transaction => {
        const ref = db.collection('users').doc(userId);
        const [admin, user] = await transaction.getAll(db.collection('users').doc(id), ref);
        if (!admin.exists || admin.data().isAdmin !== true) { const e = new Error('Forbidden'); e.status = 403; throw e; }
        if (!user.exists) throw new Error('Player not found');
        if (kind === 'footy') {
          const balance = Number(user.data().balance || 0) + quantity;
          if (!Number.isFinite(balance) || balance > Number.MAX_SAFE_INTEGER) throw new Error('Amount too large');
          transaction.update(ref, { balance });
        } else {
          const tiers = await transaction.get(db.collection('ascendTiers').orderBy('order', 'asc'));
          const entries = catalog(tiers.docs.map(doc => ({ ...doc.data(), id: doc.id })));
          if (!entries.some(entry => entry.id === amuletId)) throw new Error('Amulet not found');
          const amulets = { ...(user.data().amulets || {}) };
          amulets[amuletId] = (amulets[amuletId] || 0) + quantity;
          if (!Number.isSafeInteger(amulets[amuletId])) throw new Error('Amount too large');
          transaction.update(ref, { amulets });
        }
      });
      res.json({ success: true });
    } catch (error) { res.status(error.status || 400).send(error.message); }
  });
};
