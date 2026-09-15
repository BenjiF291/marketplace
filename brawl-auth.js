const crypto = require('crypto');
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
module.exports = db => ({
  async issue(userId) {
    const token=crypto.randomBytes(32).toString('hex');
    await db.collection('loginSessions').doc(digest(token)).set({userId,expiresAt:Date.now()+30*24*60*60*1000});
    return token;
  },
  async authenticate(req) {
    const token=(req.header('Authorization')||'').replace(/^Bearer /,'');
    if(!/^[a-f0-9]{64}$/.test(token))throw new Error('Please log in again to play ranked Brawl.');
    const doc=await db.collection('loginSessions').doc(digest(token)).get();
    if(!doc.exists||doc.data().expiresAt<=Date.now()||doc.data().userId!==req.header('X-User-Id'))throw new Error('Session expired. Please log in again.');
    return doc.data().userId;
  }
});
