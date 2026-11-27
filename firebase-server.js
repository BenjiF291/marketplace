const admin = require('firebase-admin');

if (process.env.FIRESTORE_EMULATOR_HOST) {
  const projectId = process.env.GCLOUD_PROJECT;
  if (!/^(?:127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST) ||
      !/^demo-[a-z0-9-]+$/.test(projectId ?? '')) {
    throw new Error('Firestore emulator requires a loopback host and a demo project.');
  }
  admin.initializeApp({ projectId });
} else {
  const serviceAccount = process.env.FIREBASE_KEY
    ? JSON.parse(process.env.FIREBASE_KEY)
    : require('./serviceAccountKey.json');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

module.exports = { admin, db };
