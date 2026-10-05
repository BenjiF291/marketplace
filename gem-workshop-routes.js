const { effects } = require('./amulet-utils');
const { gemIdentity } = require('./gem-utils');
const { workshopAction, dyeInventory, DYE_AREAS, refineryProgress } = require('./gem-workshop-utils');
const {isDeepStrictEqual}=require('node:util');
function snapshot(user,tiers){return {dyeYield:5+(effects(user).pigment||0),gems:require('./gem-wallet').wallet(user.gems),tiers:tiers.map(gemIdentity),compressor:true,refinery:refineryProgress(user,tiers),dyes:dyeInventory(user),theme:user.gemTheme||{},areas:DYE_AREAS};}
module.exports = (app, db, getTiers) => {
  app.get('/gem-workshop', async (req, res) => {
    const id = req.header('X-User-Id');
    if (!id) return res.status(401).send('Missing user');
    try {
      const [doc, tiers] = await Promise.all([db.collection('users').doc(id).get(), getTiers()]);
      if (!doc.exists) return res.status(404).send('User not found');
      const user = doc.data();
      res.json(snapshot(user,tiers));
    } catch (error) { res.status(500).send('Could not load gem workshop'); }
  });
  app.post('/gem-workshop/:action', async (req, res) => {
    const id = req.header('X-User-Id');
    if (!id) return res.status(401).send('Missing user');
    try {
      const result=await db.runTransaction(async tx => {
        const ref = db.collection('users').doc(id);
        const user = await tx.get(ref);
        const tiers = await tx.get(db.collection('ascendTiers').orderBy('order', 'asc'));
        if (!user.exists) throw new Error('User not found');
        const change=workshopAction(user.data(), tiers.docs.map(doc => ({ ...doc.data(), id: doc.id })), req.params.action, req.body);
        const spentDye=change.gemDyes&&Object.entries(user.data().gemDyes||{}).some(([k,v])=>Number(change.gemDyes[k]||0)<Number(v));
        const activity=({upgrade:'refinery upgrade',compress:'compression','craft-dye':'dye crafting'})[req.params.action]||(spentDye?'dye applied':null);
        const changed=Object.entries(change).some(([key,value])=>!isDeepStrictEqual(user.data()[key]??{},value));
        const update=changed?{...change,...require('./town-hall-progress').gameplay(user.data(),activity)}:{};
        if(changed)tx.update(ref,update);
        return snapshot({...user.data(),...update},tiers.docs.map(doc=>({...doc.data(),id:doc.id})));
      });
      res.json({ success: true, ...result });
    } catch (error) { res.status(400).send(error.message); }
  });
};
