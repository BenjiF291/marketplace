const functions = require('firebase-functions');

// The old function predates Marketplace sessions. Current Marketplace clients
// use the authenticated backend for account and inventory operations.
exports.api = functions.https.onRequest((req, res) => {
  res.status(410).json({ error: 'This Marketplace API has been retired.' });
});
