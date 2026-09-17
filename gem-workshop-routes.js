const { effects } = require('./amulet-utils');
const { gemIdentity } = require('./gem-utils');
const { workshopAction, dyeInventory, DYE_AREAS } = require('./gem-workshop-utils');
module.exports = (app, db, getTiers) => {
  app.get('/gem-workshop', async (req, res) => {
    const id = req.header('X-User-Id');
    if (!id) return res.status(401).send('Missing user');
    try {
      const [doc, tiers] = await Promise.all([db.collection('users').doc(id).get(), getTiers()]);
      if (!doc.exists) return res.status(404).send('User not found');
      const user = doc.data();
      res.json({ dyeYield:5+(effects(user).pigment||0), gems: user.gems || {}, tiers: tiers.map(gemIdentity), compressor: user.gemCompressor === true, dyes: dyeInventory(user), theme: user.gemTheme || {}, areas: DYE_AREAS });
    } catch (error) { res.status(500).send('Could not load gem workshop'); }
  });
  app.post('/gem-workshop/:action', async (req, res) => {
    const id = req.header('X-User-Id');
    if (!id) return res.status(401).send('Missing user');
    try {
      await db.runTransaction(async tx => {
        const ref = db.collection('users').doc(id);
        const user = await tx.get(ref);
        const tiers = await tx.get(db.collection('ascendTiers').orderBy('order', 'asc'));
        if (!user.exists) throw new Error('User not found');
        tx.update(ref, workshopAction(user.data(), tiers.docs.map(doc => ({ ...doc.data(), id: doc.id })), req.params.action, req.body));
      });
      res.json({ success: true });
    } catch (error) { res.status(400).send(error.message); }
  });
};
