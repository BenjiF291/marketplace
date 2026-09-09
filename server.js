const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { admin, db } = require('./firebase-server');
require('dotenv').config();

const app = express();
const { getAscendTierInfo, getAscendTierFromCardName, formatTierLabel, normalizeAscendString, canonicalizeCardKey } = require('./ascend-utils');

/* ------------------ CORS ------------------ */
// Must be first
app.use((req, res, next) => {
  // Allow requests from GitHub Pages, Firebase Hosting, and localhost
  const allowedOrigins = [
    'https://marketplace-aw8b.onrender.com/',
    'https://fishy-20779.web.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-User-Id');
  res.header('Access-Control-Max-Age', '3600');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

app.use(express.json());
app.use(express.static('public'));

/* ------------------ HELPERS ------------------ */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function isValidPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isValidPackColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function purchaseLimitKeyForItem(item) {
  if (item.itemType === 'pack' && item.packId) return `pack:${item.packId}`;
  if (item.imageUrl) return `card:${path.basename(item.imageUrl)}`;
  return `item:${item.name}`;
}

function serializeDate(value) {
  if (!value) return null;
  const date = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function userIsAdmin(userId) {
  if (!userId || typeof userId !== 'string') return false;
  const userDoc = await db.collection('users').doc(userId).get();
  return userDoc.exists && userDoc.data().isAdmin === true;
}

/* ------------------ INITIALIZE ADMIN ------------------ */
async function initializeTestUsers() {
  try {
    const usersRef = db.collection('users');

    // Prefer an existing 'admin' username (lowercase) if present, otherwise 'Admin'
    let adminSnap = await usersRef.where('username', '==', 'admin').get();
    if (adminSnap.empty) {
      adminSnap = await usersRef.where('username', '==', 'Admin').get();
    }

    if (adminSnap.empty) {
      // No existing admin-like user found; create a new lowercase 'admin' account
      await usersRef.add({
        username: 'admin',
        passwordHash: hashPassword('banana68'),
        balance: 1000,
        isAdmin: true,
        createdAt: new Date()
      });
      console.log('Created test user: admin');
    } else {
      const adminDoc = adminSnap.docs[0];
      if (adminDoc.data().isAdmin !== true) {
        await adminDoc.ref.update({ isAdmin: true });
        console.log(`Updated existing user ${adminDoc.data().username} to admin role`);
      }
    }

  } catch (error) {
    console.error('Error initializing admin:', error);
  }
}

initializeTestUsers();

/* ------------------ HEALTH CHECK ------------------ */
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

/* ------------------ SIGNUP ------------------ */
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).send('Username is required');
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).send('Password is required');
  }

  const cleanUsername = username.trim();

  try {
    const usersRef = db.collection('users');
    const existing = await usersRef.where('username', '==', cleanUsername).get();

    if (!existing.empty) {
      return res.status(400).send('Username already exists');
    }

    const newUser = await usersRef.add({
      username: cleanUsername,
      passwordHash: hashPassword(password),
      balance: 0,
      isAdmin: false,
      createdAt: new Date()
    });

    res.json({ id: newUser.id, username: cleanUsername, isAdmin: false });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).send('Signup failed');
  }
});

/* ------------------ LOGIN ------------------ */
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).send('Username is required');
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).send('Password is required');
  }

  const cleanUsername = username.trim();

  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('username', '==', cleanUsername).get();

    if (snapshot.empty) {
      return res.status(400).send('User not found');
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();

    if (user.passwordHash !== hashPassword(password)) {
      return res.status(400).send('Invalid password');
    }

    await userDoc.ref.update({ lastOnline: new Date() });
    res.json({ id: userDoc.id, username: user.username, isAdmin: user.isAdmin === true });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Login failed');
  }
});

/* ------------------ GET USERS ------------------ */
// Do NOT expose password hashes
app.get('/users', async (req, res) => {
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    const users = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        id: doc.id,
        username: data.username,
        balance: data.balance,
        isAdmin: data.isAdmin === true,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
        lastOnline: data.lastOnline ? (data.lastOnline.toDate ? data.lastOnline.toDate().toISOString() : new Date(data.lastOnline).toISOString()) : null,
        lastSpin: data.lastSpin ? (data.lastSpin.toDate ? data.lastSpin.toDate().toISOString() : new Date(data.lastSpin).toISOString()) : null,
        vipUntil: data.vipUntil ? (data.vipUntil.toDate ? data.vipUntil.toDate().toISOString() : new Date(data.vipUntil).toISOString()) : null
      });
    });

    res.json(users);
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).send('Error retrieving users');
  }
});

/* ------------------ SPIN WHEEL ------------------ */
app.post('/spin-wheel', async (req, res) => {
  const { userId } = req.body;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).send('Invalid userId');
  }

  const rewards = [8, 10, 12, 16, 20, 24];
  const cooldownMs = 23 * 60 * 60 * 1000;

  try {
    const usersRef = db.collection('users');
    const userRef = usersRef.doc(userId);

    let rewardAmount;
    let newBalance;
    let nextSpinAt;

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const user = userDoc.data();
      const now = new Date();
      const lastSpin = user.lastSpin ? user.lastSpin.toDate ? user.lastSpin.toDate() : new Date(user.lastSpin) : null;

      if (lastSpin) {
        const elapsed = now.getTime() - lastSpin.getTime();
        if (elapsed < cooldownMs) {
          nextSpinAt = new Date(lastSpin.getTime() + cooldownMs);
          throw new Error('Too soon');
        }
      }

      // Pick base reward
      rewardAmount = rewards[Math.floor(Math.random() * rewards.length)];

      // If user has an active VIP, double the reward
      const vipUntil = user.vipUntil ? (user.vipUntil.toDate ? user.vipUntil.toDate() : new Date(user.vipUntil)) : null;
      if (vipUntil && vipUntil.getTime() > now.getTime()) {
        rewardAmount = rewardAmount * 2;
      }

      newBalance = (user.balance || 0) + rewardAmount;
      nextSpinAt = new Date(now.getTime() + cooldownMs);

      transaction.update(userRef, {
        balance: newBalance,
        lastSpin: now,
        lastSpinAmount: rewardAmount
      });
    });

    res.json({ amount: rewardAmount, balance: newBalance, nextSpinAt: nextSpinAt.toISOString() });
  } catch (error) {
    console.error('Spin wheel error:', error);

    if (error.message === 'User not found') {
      return res.status(400).send(error.message);
    }

    if (error.message === 'Too soon') {
      return res.status(400).json({ error: 'You can only spin once every 23 hours.', nextSpinAt: nextSpinAt?.toISOString() });
    }

    res.status(500).send('Could not spin the wheel');
  }
});

/* ------------------ TRANSFER ------------------ */
app.post('/transfer', async (req, res) => {
  const { fromId, toUsername, amount } = req.body;

  if (!fromId || typeof fromId !== 'string') {
    return res.status(400).send('Invalid sender');
  }

  if (!toUsername || typeof toUsername !== 'string' || !toUsername.trim()) {
    return res.status(400).send('Invalid recipient');
  }

  if (!isValidPositiveNumber(amount)) {
    return res.status(400).send('Invalid amount');
  }

  const cleanToUsername = toUsername.trim();

  try {
    const usersRef = db.collection('users');
    const transferHistoryRef = db.collection('transactions').doc();

    await db.runTransaction(async (transaction) => {
      const fromRef = usersRef.doc(fromId);
      const fromDoc = await transaction.get(fromRef);

      if (!fromDoc.exists) {
        throw new Error('Sender not found');
      }

      const fromUser = fromDoc.data();

      if (fromUser.username === cleanToUsername) {
        throw new Error("You can't transfer to yourself");
      }

      if (fromUser.balance < amount) {
        throw new Error('Not enough money');
      }

      const toSnapshot = await usersRef.where('username', '==', cleanToUsername).get();

      if (toSnapshot.empty) {
        throw new Error('Recipient not found');
      }

      const toDoc = toSnapshot.docs[0];
      const toUser = toDoc.data();

      transaction.update(fromRef, {
        balance: fromUser.balance - amount
      });

      transaction.update(toDoc.ref, {
        balance: toUser.balance + amount
      });

      transaction.set(transferHistoryRef, {
        type: 'transfer',
        fromId,
        fromUsername: fromUser.username,
        toId: toDoc.id,
        toUsername: toUser.username,
        participantIds: [fromId, toDoc.id],
        amount,
        createdAt: new Date()
      });
    });

    console.log(`Transferred ${amount} from ${fromId} to ${cleanToUsername}`);
    res.send('Transfer complete');
  } catch (error) {
    console.error('Transfer error:', error);

    if (
      error.message === 'Sender not found' ||
      error.message === 'Recipient not found' ||
      error.message === 'Not enough money' ||
      error.message === "You can't transfer to yourself"
    ) {
      return res.status(400).send(error.message);
    }

    res.status(500).send('Transfer failed');
  }
});

/* ------------------ GET ITEMS ------------------ */
app.get('/items', async (req, res) => {
  try {
    const itemsRef = db.collection('items');
    const [snapshot, usersSnapshot] = await Promise.all([
      itemsRef.get(),
      db.collection('users').get()
    ]);
    const hostIds = new Set();
    usersSnapshot.forEach(doc => {
      if (doc.data().isAdmin === true) hostIds.add(doc.id);
    });

    const items = [];
    const groupedListings = new Map();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.sold !== true) {
        const item = {
          id: doc.id,
          name: data.name || 'Unknown Item',
          price: data.price || 0,
          sellerId: data.sellerId || '',
          isHostListing: hostIds.has(data.sellerId),
          imageUrl: data.imageUrl || null,
          limitOnePerUser: data.limitOnePerUser === true,
          listingGroupId: data.listingGroupId || null,
          perUserLimit: data.perUserLimit || null,
          stock: 1,
          sold: data.sold || false,
          createdAt: data.createdAt
        };
        if (item.listingGroupId) {
          const existing = groupedListings.get(item.listingGroupId);
          if (existing) existing.stock += 1;
          else groupedListings.set(item.listingGroupId, item);
        } else {
          items.push(item);
        }
      }
    });
    items.push(...groupedListings.values());

    // Sort by creation date (newest first)
    items.sort((a, b) => {
      const aTime = a.createdAt?._seconds || 0;
      const bTime = b.createdAt?._seconds || 0;
      return bTime - aTime;
    });

    res.json(items);
  } catch (error) {
    console.error('Error getting items:', error);
    res.status(500).send('Error retrieving items');
  }
});

/* ------------------ ADMIN ITEM IMAGE ------------------ */
app.post('/items/image', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { itemId, imageUrl } = req.body;

  if (!requesterId || typeof requesterId !== 'string') {
    return res.status(401).send('Missing X-User-Id header');
  }

  if (!itemId || typeof itemId !== 'string') {
    return res.status(400).send('Invalid itemId');
  }

  try {
    const isAdmin = await userIsAdmin(requesterId);
    if (!isAdmin) {
      return res.status(403).send('Forbidden');
    }

    const itemRef = db.collection('items').doc(itemId);
    const itemDoc = await itemRef.get();

    if (!itemDoc.exists) {
      return res.status(400).send('Item not found');
    }

    const updatePayload = {};
    if (!imageUrl) {
      updatePayload.imageUrl = null;
    } else if (typeof imageUrl === 'string') {
      updatePayload.imageUrl = imageUrl.trim();
    }

    await itemRef.update(updatePayload);
    res.send('Item image updated');
  } catch (error) {
    console.error('Error updating item image:', error);
    res.status(500).send('Error updating item image');
  }
});

/* ------------------ CARD IMAGE LIST ------------------ */
app.get('/card-images', async (req, res) => {
  try {
    const imagesDir = path.join(__dirname, 'public', 'images');
    if (!fs.existsSync(imagesDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(imagesDir)
      .filter(file => ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(path.extname(file).toLowerCase()))
      .sort();

    res.json(files);
  } catch (error) {
    console.error('Error reading card images:', error);
    res.status(500).send('Error reading card images');
  }
});

/* ------------------ PACKS ------------------ */
app.get('/packs', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  if (!requesterId || !(await userIsAdmin(requesterId))) {
    return res.status(403).send('Forbidden');
  }

  try {
    const snapshot = await db.collection('packs').orderBy('createdAt', 'desc').get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (error) {
    console.error('Error getting packs:', error);
    res.status(500).send('Error retrieving packs');
  }
});

app.post('/packs', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { name, cardIds, color } = req.body;

  if (!requesterId || !(await userIsAdmin(requesterId))) {
    return res.status(403).send('Forbidden');
  }
  if (!name || typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
    return res.status(400).send('Enter a pack name up to 80 characters');
  }
  if (!Array.isArray(cardIds) || cardIds.length === 0 || cardIds.length > 100) {
    return res.status(400).send('Choose between 1 and 100 cards');
  }
  if (color !== undefined && !isValidPackColor(color)) return res.status(400).send('Invalid pack color');

  const cards = [...new Set(cardIds)];
  if (cards.some(card => typeof card !== 'string' || card !== path.basename(card))) {
    return res.status(400).send('Invalid card selection');
  }

  const imagesDir = path.join(__dirname, 'public', 'images');
  if (cards.some(card => !fs.existsSync(path.join(imagesDir, card)))) {
    return res.status(400).send('One or more selected card images do not exist');
  }

  try {
    const pack = await db.collection('packs').add({
      name: name.trim(),
      cardIds: cards,
      color: color || '#667eea',
      createdBy: requesterId,
      createdAt: new Date()
    });
    res.status(201).json({ success: true, id: pack.id });
  } catch (error) {
    console.error('Error creating pack:', error);
    res.status(500).send('Could not create pack');
  }
});

app.put('/packs/:packId', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { name, cardIds, color } = req.body;
  const { packId } = req.params;

  if (!requesterId || !(await userIsAdmin(requesterId))) {
    return res.status(403).send('Forbidden');
  }
  if (!name || typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
    return res.status(400).send('Enter a pack name up to 80 characters');
  }
  if (!Array.isArray(cardIds) || cardIds.length === 0 || cardIds.length > 100) {
    return res.status(400).send('Choose between 1 and 100 cards');
  }
  if (color !== undefined && !isValidPackColor(color)) return res.status(400).send('Invalid pack color');

  const cards = [...new Set(cardIds)];
  if (cards.some(card => typeof card !== 'string' || card !== path.basename(card))) {
    return res.status(400).send('Invalid card selection');
  }
  const imagesDir = path.join(__dirname, 'public', 'images');
  if (cards.some(card => !fs.existsSync(path.join(imagesDir, card)))) {
    return res.status(400).send('One or more selected card images do not exist');
  }

  try {
    const packRef = db.collection('packs').doc(packId);
    const packDoc = await packRef.get();
    if (!packDoc.exists) return res.status(404).send('Pack not found');
    if (packDoc.data().createdBy !== requesterId) return res.status(403).send('You can only edit packs you created');

    await packRef.update({ name: name.trim(), cardIds: cards, color: color || '#667eea', updatedAt: new Date() });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating pack:', error);
    res.status(500).send('Could not update pack');
  }
});

app.post('/grant-pack', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { username, packId, quantity } = req.body;
  const qty = Number(quantity);

  if (!requesterId || !(await userIsAdmin(requesterId))) return res.status(403).send('Forbidden');
  if (!username || typeof username !== 'string' || !packId || typeof packId !== 'string') {
    return res.status(400).send('Select a user and a pack');
  }
  if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
    return res.status(400).send('Quantity must be a whole number between 1 and 20');
  }

  try {
    const [recipientSnapshot, packDoc] = await Promise.all([
      username === '__all__'
        ? db.collection('users').get()
        : db.collection('users').where('username', '==', username.trim()).limit(1).get(),
      db.collection('packs').doc(packId).get()
    ]);
    if (recipientSnapshot.empty) return res.status(400).send('Recipient not found');
    if (!packDoc.exists) return res.status(400).send('Pack not found');

    const pack = packDoc.data();
    const writes = [];
    recipientSnapshot.docs.forEach(recipientDoc => {
      for (let i = 0; i < qty; i++) writes.push({
        recipientId: recipientDoc.id,
        name: `${pack.name} Pack`,
        itemType: 'pack',
        packId,
        packColor: pack.color || '#667eea',
        price: 0,
        sellerId: requesterId,
        sold: true,
        purchasedAt: new Date(),
        sourceItemId: null,
        imageUrl: null,
        createdAt: new Date()
      });
    });
    for (let start = 0; start < writes.length; start += 500) {
      const batch = db.batch();
      writes.slice(start, start + 500).forEach(write => {
        const { recipientId, ...packItem } = write;
        batch.set(db.collection('items').doc(), { ...packItem, buyerId: recipientId });
      });
      await batch.commit();
    }
    res.json({ success: true, granted: writes.length });
  } catch (error) {
    console.error('Error granting pack:', error);
    res.status(500).send('Could not grant pack');
  }
});

app.post('/open-pack', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { itemId } = req.body;
  if (!requesterId || typeof requesterId !== 'string') return res.status(401).send('Missing X-User-Id header');
  if (!itemId || typeof itemId !== 'string') return res.status(400).send('Invalid pack item');

  try {
    const result = await db.runTransaction(async transaction => {
      const packItemRef = db.collection('items').doc(itemId);
      const packItemDoc = await transaction.get(packItemRef);
      if (!packItemDoc.exists) throw new Error('Pack not found');
      const packItem = packItemDoc.data();
      if (packItem.itemType !== 'pack' || packItem.buyerId !== requesterId || packItem.sold !== true || packItem.listedForSale === true) {
        throw new Error('You cannot open this pack');
      }

      const packDoc = await transaction.get(db.collection('packs').doc(packItem.packId));
      if (!packDoc.exists || !Array.isArray(packDoc.data().cardIds) || packDoc.data().cardIds.length === 0) {
        throw new Error('Pack has no available cards');
      }
      const pack = packDoc.data();
      const cardId = pack.cardIds[crypto.randomInt(pack.cardIds.length)];
      const cardRef = db.collection('items').doc();
      transaction.set(cardRef, {
        name: `Card ${cardId}`,
        itemType: 'card',
        price: 0,
        sellerId: packItem.sellerId,
        sold: true,
        buyerId: requesterId,
        purchasedAt: new Date(),
        sourceItemId: null,
        imageUrl: `/images/${cardId}`,
        createdAt: new Date(),
        openedFromPackId: packItem.packId
      });
      transaction.delete(packItemRef);
      return { cardId, packColor: packItem.packColor || pack.color || '#667eea' };
    });
    res.json({ success: true, cardId: result.cardId, imageUrl: `/images/${result.cardId}`, packColor: result.packColor });
  } catch (error) {
    const expectedErrors = ['Pack not found', 'You cannot open this pack', 'Pack has no available cards'];
    if (expectedErrors.includes(error.message)) return res.status(400).send(error.message);
    console.error('Error opening pack:', error);
    res.status(500).send('Could not open pack');
  }
});

/* ------------------ GRANT ITEM ------------------ */
app.post('/grant-item', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { username, cardId, quantity } = req.body;

  if (!requesterId || typeof requesterId !== 'string') {
    return res.status(401).send('Missing X-User-Id header');
  }

  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).send('Invalid username');
  }

  if (!cardId || typeof cardId !== 'string' || !cardId.trim()) {
    return res.status(400).send('Invalid cardId');
  }

  const qty = Number(quantity) || 0;
  if (!Number.isInteger(qty) || qty <= 0 || qty > 20) {
    return res.status(400).send('Quantity must be a whole number between 1 and 20');
  }

  try {
    const isAdmin = await userIsAdmin(requesterId);
    if (!isAdmin) {
      return res.status(403).send('Forbidden');
    }

    const usersRef = db.collection('users');
    const targetSnapshot = username === '__all__'
      ? await usersRef.get()
      : await usersRef.where('username', '==', username.trim()).get();
    if (targetSnapshot.empty) {
      return res.status(400).send('Recipient not found');
    }

    let imageFile = cardId.trim();
    if (!path.extname(imageFile)) {
      imageFile = `${imageFile}.png`;
    }

    const imagesDir = path.join(__dirname, 'public', 'images');
    const imagePath = path.join(imagesDir, imageFile);
    if (!fs.existsSync(imagePath)) {
      return res.status(400).send('Card image not found');
    }

    const writes = [];
    targetSnapshot.docs.forEach(recipientDoc => {
      for (let i = 0; i < qty; i++) writes.push({
        name: `Card ${cardId}`,
        itemType: 'card',
        price: 0,
        sellerId: requesterId,
        sold: true,
        buyerId: recipientDoc.id,
        purchasedAt: new Date(),
        sourceItemId: null,
        imageUrl: `/images/${imageFile}`,
        createdAt: new Date()
      });
    });
    for (let start = 0; start < writes.length; start += 500) {
      const batch = db.batch();
      writes.slice(start, start + 500).forEach(write => batch.set(db.collection('items').doc(), write));
      await batch.commit();
    }
    res.json({ success: true, granted: writes.length });
  } catch (error) {
    console.error('Error granting item:', error);
    res.status(500).send('Error granting item');
  }
});

/* ------------------ ADMIN DIRECT MARKETPLACE LISTINGS ------------------ */
app.post('/admin/market-listings', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { itemType, productId, price, quantity, perUserLimit } = req.body;
  const stock = Number(quantity);
  const maxPerUser = Number(perUserLimit) || 0;

  if (!requesterId || !(await userIsAdmin(requesterId))) return res.status(403).send('Forbidden');
  if (!['card', 'pack'].includes(itemType)) return res.status(400).send('Invalid item type');
  if (!isValidPositiveNumber(price)) return res.status(400).send('Invalid price');
  if (!Number.isInteger(stock) || stock < 1 || stock > 100) return res.status(400).send('Stock must be between 1 and 100');
  if (!Number.isInteger(maxPerUser) || maxPerUser < 0 || maxPerUser > stock) {
    return res.status(400).send('Maximum per user must be between 0 and the stock amount');
  }

  try {
    let itemName;
    let imageUrl = null;
    let packId = null;
    let packColor = null;
    if (itemType === 'card') {
      if (!productId || typeof productId !== 'string' || productId !== path.basename(productId)) {
        return res.status(400).send('Invalid card');
      }
      const imagePath = path.join(__dirname, 'public', 'images', productId);
      if (!fs.existsSync(imagePath)) return res.status(400).send('Card image not found');
      itemName = `Card ${productId}`;
      imageUrl = `/images/${productId}`;
    } else {
      const packDoc = await db.collection('packs').doc(productId).get();
      if (!packDoc.exists) return res.status(400).send('Pack not found');
      packId = packDoc.id;
      itemName = `${packDoc.data().name} Pack`;
      packColor = packDoc.data().color || '#667eea';
    }

    const groupRef = db.collection('marketListingGroups').doc();
    const batch = db.batch();
    batch.set(groupRef, {
      sellerId: requesterId,
      name: itemName,
      itemType,
      packId,
      packColor,
      imageUrl,
      price,
      stock,
      soldCount: 0,
      perUserLimit: maxPerUser || null,
      purchaseCounts: {},
      createdAt: new Date()
    });
    for (let i = 0; i < stock; i++) {
      batch.set(db.collection('items').doc(), {
        name: itemName,
        itemType,
        packId,
        packColor,
        imageUrl,
        price,
        sellerId: requesterId,
        sold: false,
        buyerId: null,
        purchasedAt: null,
        sourceItemId: null,
        listingGroupId: groupRef.id,
        perUserLimit: maxPerUser || null,
        createdAt: new Date()
      });
    }
    await batch.commit();
    res.status(201).json({ success: true, stock, listingGroupId: groupRef.id });
  } catch (error) {
    console.error('Error creating marketplace listing:', error);
    res.status(500).send('Could not create marketplace listing');
  }
});

/* ------------------ TEST ITEMS ------------------ */
app.get('/test-items', async (req, res) => {
  try {
    console.log('Testing items collection access...');
    const itemsRef = db.collection('items');
    const snapshot = await itemsRef.limit(1).get();
    console.log('Test query successful, docs count:', snapshot.size);
    res.json({ success: true, count: snapshot.size });
  } catch (error) {
    console.error('Test failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ------------------ ADD ITEM ------------------ */
app.post('/items', async (req, res) => {
  const { name, price, sellerId, sourceItemId, imageUrl, limitOnePerUser } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).send('Invalid item name');
  }

  if (!isValidPositiveNumber(price)) {
    return res.status(400).send('Invalid item price');
  }

  if (!sellerId || typeof sellerId !== 'string') {
    return res.status(400).send('Invalid seller');
  }

  const cleanName = name.trim();

  try {
    const sellerDoc = await db.collection('users').doc(sellerId).get();

    if (!sellerDoc.exists) {
      return res.status(400).send('Seller not found');
    }

    let sourceItem = null;
    // If listing from inventory, verify ownership and preserve its type (including packs).
    if (sourceItemId) {
      const sourceItemRef = db.collection('items').doc(sourceItemId);
      const sourceItemDoc = await sourceItemRef.get();
      if (!sourceItemDoc.exists || sourceItemDoc.data().buyerId !== sellerId || sourceItemDoc.data().sold !== true || sourceItemDoc.data().listedForSale === true) {
        return res.status(400).send('Selected inventory item is unavailable');
      }
      sourceItem = sourceItemDoc.data();
      await sourceItemRef.update({ listedForSale: true });
    }

    await db.collection('items').add({
      name: cleanName,
      price,
      sellerId,
      sold: false,
      buyerId: null,
      purchasedAt: null,
      sourceItemId: sourceItemId || null,
      imageUrl: sourceItem ? sourceItem.imageUrl || null : imageUrl || null,
      itemType: sourceItem ? sourceItem.itemType || 'card' : 'card',
      packId: sourceItem ? sourceItem.packId || null : null,
      packColor: sourceItem ? sourceItem.packColor || null : null,
      purchaseLimitKey: sourceItem ? sourceItem.purchaseLimitKey || purchaseLimitKeyForItem(sourceItem) : purchaseLimitKeyForItem({ name: cleanName, imageUrl }),
      limitOnePerUser: limitOnePerUser === true,
      createdAt: new Date()
    });

    // // Cheat code: listing banana for 68 coins gives 1e50 coins
    // if (cleanName === 'banana' && price === 68) 
    // {
    //   const currentBalance = sellerDoc.data().balance || 0;

    //   await db.collection('users').doc(sellerId).update({
    //     balance: currentBalance + 1e50
    //   });
    // }

    res.send('Item added');
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).send('Error adding item');
  }
});

/* ------------------ DELETE ITEM ------------------ */
app.post('/delete-item', async (req, res) => {
  const { itemId, userId } = req.body;

  if (!itemId || typeof itemId !== 'string') {
    return res.status(400).send('Invalid itemId');
  }

  if (!userId || typeof userId !== 'string') {
    return res.status(400).send('Invalid userId');
  }

  try {
    const itemsRef = db.collection('items');

    await db.runTransaction(async (transaction) => {
      const itemRef = itemsRef.doc(itemId);
      const itemDoc = await transaction.get(itemRef);

      if (!itemDoc.exists) {
        throw new Error('Item not found');
      }

      const item = itemDoc.data();

      if (String(item.sellerId) !== String(userId)) {
        throw new Error('Not your item');
      }

      if (item.sold) {
        throw new Error('Cannot delete a sold item');
      }

      // If this listing came from inventory, mark source item as no longer listed
      if (item.sourceItemId) {
        const sourceItemRef = itemsRef.doc(item.sourceItemId);
        const sourceItemDoc = await transaction.get(sourceItemRef);
        if (sourceItemDoc.exists) {
          transaction.update(sourceItemRef, { listedForSale: false });
        }
      }

      transaction.delete(itemRef);
    });

    res.send('Item deleted');
  } catch (error) {
    console.error('Error deleting item:', error);

    if (
      error.message === 'Item not found' ||
      error.message === 'Not your item' ||
      error.message === 'Cannot delete a sold item'
    ) {
      return res.status(400).send(error.message);
    }

    res.status(500).send('Error deleting item');
  }
});

/* ------------------ BUY ITEM ------------------ */
app.post('/buy', async (req, res) => {
  const { itemId, buyerId } = req.body;

  if (!itemId || typeof itemId !== 'string') {
    return res.status(400).send('Invalid itemId');
  }

  if (!buyerId || typeof buyerId !== 'string') {
    return res.status(400).send('Invalid buyerId');
  }

  try {
    const itemsRef = db.collection('items');
    const usersRef = db.collection('users');

    const purchase = await db.runTransaction(async (transaction) => {
      let itemRef = itemsRef.doc(itemId);
      const itemDoc = await transaction.get(itemRef);

      if (!itemDoc.exists) {
        throw new Error('Item unavailable');
      }

      let item = itemDoc.data();

      let listingGroupRef = null;
      let listingGroup = null;
      if (item.listingGroupId) {
        const listingItems = await transaction.get(itemsRef.where('listingGroupId', '==', item.listingGroupId));
        const availableItemDoc = listingItems.docs.find(doc => doc.data().sold !== true);
        if (!availableItemDoc) throw new Error('Item unavailable');
        itemRef = availableItemDoc.ref;
        item = availableItemDoc.data();
        listingGroupRef = db.collection('marketListingGroups').doc(item.listingGroupId);
        const listingGroupDoc = await transaction.get(listingGroupRef);
        if (!listingGroupDoc.exists) throw new Error('Item unavailable');
        listingGroup = listingGroupDoc.data();
        const purchasedCount = Number(listingGroup.purchaseCounts && listingGroup.purchaseCounts[buyerId]) || 0;
        if (listingGroup.perUserLimit && purchasedCount >= listingGroup.perUserLimit) {
          throw new Error('You have reached this listing\'s purchase limit');
        }
      }

      if (item.sold) {
        throw new Error('Item unavailable');
      }

      if (String(item.sellerId) === String(buyerId)) {
        throw new Error("You can't buy your own item");
      }

      const buyerRef = usersRef.doc(buyerId);
      const buyerDoc = await transaction.get(buyerRef);

      if (!buyerDoc.exists) {
        throw new Error('Buyer not found');
      }

      const buyer = buyerDoc.data();

      const sellerRef = usersRef.doc(item.sellerId);
      const sellerDoc = await transaction.get(sellerRef);

      if (!sellerDoc.exists) {
        throw new Error('Seller not found');
      }

      const seller = sellerDoc.data();
      const vipUntil = buyer.vipUntil ? (buyer.vipUntil.toDate ? buyer.vipUntil.toDate() : new Date(buyer.vipUntil)) : null;
      const hasActiveVip = vipUntil && vipUntil.getTime() > Date.now();
      const hasHostDiscount = hasActiveVip && seller.isAdmin === true;
      const purchasePrice = hasHostDiscount ? Math.ceil(item.price * 0.9) : item.price;

      if (buyer.balance < purchasePrice) {
        throw new Error('Not enough money');
      }

      // If the listing came from inventory, read the source item BEFORE performing writes
      let sourceItemRef = null;
      let sourceItemDoc = null;
      if (item.sourceItemId) {
        sourceItemRef = itemsRef.doc(item.sourceItemId);
        sourceItemDoc = await transaction.get(sourceItemRef);
      }

      if (item.limitOnePerUser === true) {
        const previousPurchases = await transaction.get(itemsRef.where('buyerId', '==', buyerId));
        const purchaseLimitKey = item.purchaseLimitKey || purchaseLimitKeyForItem(item);
        const alreadyPurchased = previousPurchases.docs.some(doc => {
          const previousItem = doc.data();
          return previousItem.purchasedViaMarketplace === true && previousItem.purchaseLimitKey === purchaseLimitKey;
        });
        if (alreadyPurchased) {
          throw new Error('You may only buy this item once');
        }
      }

      // Perform writes (all reads must be done before these)
      transaction.update(buyerRef, {
        balance: buyer.balance - purchasePrice
      });

      transaction.update(sellerRef, {
        balance: seller.balance + purchasePrice
      });

      transaction.update(itemRef, {
        sold: true,
        buyerId: buyerId,
        purchasedAt: new Date(),
        purchasePrice,
        purchasedViaMarketplace: true
      });

      if (listingGroupRef) {
        const purchaseCounts = { ...(listingGroup.purchaseCounts || {}) };
        purchaseCounts[buyerId] = (Number(purchaseCounts[buyerId]) || 0) + 1;
        transaction.update(listingGroupRef, {
          soldCount: (Number(listingGroup.soldCount) || 0) + 1,
          purchaseCounts
        });
      }

      // Delete the original source inventory item atomically (if it exists)
      if (sourceItemDoc && sourceItemDoc.exists) {
        transaction.delete(sourceItemRef);
      }

      return { purchasePrice, hasHostDiscount, listedPrice: item.price };
    });
    res.json({
      success: true,
      purchasePrice: purchase.purchasePrice,
      discountApplied: purchase.hasHostDiscount,
      discountAmount: purchase.listedPrice - purchase.purchasePrice
    });
  } catch (error) {
    console.error('Error buying item:', error);

    if (
      error.message === 'Item unavailable' ||
      error.message === 'Buyer not found' ||
      error.message === 'Seller not found' ||
      error.message === 'Not enough money' ||
      error.message === 'You may only buy this item once' ||
      error.message === "You have reached this listing's purchase limit" ||
      error.message === "You can't buy your own item"
    ) {
      return res.status(400).send(error.message);
    }

    // Return error message to help debug purchase failures
    res.status(500).send(error.message || 'Purchase failed');
  }
});

/* ------------------ HISTORY ------------------ */
app.get('/history', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  if (!requesterId || typeof requesterId !== 'string') {
    return res.status(401).send('Missing X-User-Id header');
  }

  try {
    const usersRef = db.collection('users');
    const itemsRef = db.collection('items');
    const [requesterDoc, transfersSnapshot, purchasesSnapshot, salesSnapshot, usersSnapshot] = await Promise.all([
      usersRef.doc(requesterId).get(),
      db.collection('transactions').where('participantIds', 'array-contains', requesterId).get(),
      itemsRef.where('buyerId', '==', requesterId).where('sold', '==', true).get(),
      itemsRef.where('sellerId', '==', requesterId).where('sold', '==', true).get(),
      usersRef.get()
    ]);

    if (!requesterDoc.exists) {
      return res.status(404).send('User not found');
    }

    const usernames = new Map();
    usersSnapshot.forEach(doc => usernames.set(doc.id, doc.data().username || 'Unknown user'));

    const transfers = transfersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        from: data.fromUsername || usernames.get(data.fromId) || 'Unknown user',
        to: data.toUsername || usernames.get(data.toId) || 'Unknown user',
        amount: data.amount || 0,
        occurredAt: serializeDate(data.createdAt)
      };
    });

    const itemTrades = [];
    purchasesSnapshot.forEach(doc => {
      const item = doc.data();
      itemTrades.push({
        id: doc.id,
        direction: 'bought',
        itemName: item.name || 'Unknown item',
        counterparty: usernames.get(item.sellerId) || 'Unknown user',
        amount: item.price || 0,
        occurredAt: serializeDate(item.purchasedAt)
      });
    });
    salesSnapshot.forEach(doc => {
      const item = doc.data();
      itemTrades.push({
        id: doc.id,
        direction: 'sold',
        itemName: item.name || 'Unknown item',
        counterparty: usernames.get(item.buyerId) || 'Unknown user',
        amount: item.price || 0,
        occurredAt: serializeDate(item.purchasedAt)
      });
    });

    const newestFirst = (a, b) => new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0);
    res.json({
      transfers: transfers.sort(newestFirst),
      itemTrades: itemTrades.sort(newestFirst)
    });
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).send('Error retrieving history');
  }
});

/* ------------------ INVENTORY ------------------ */
app.post('/ascend', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { cardKey } = req.body;

  if (!requesterId || typeof requesterId !== 'string') {
    return res.status(401).send('Missing X-User-Id header');
  }

  if (!cardKey || typeof cardKey !== 'string' || !cardKey.trim()) {
    return res.status(400).send('Select a card to ascend');
  }

  const cleanCardKey = path.basename(cardKey.trim());
  const groupKey = canonicalizeCardKey(cleanCardKey);
  const tierInfo = getAscendTierInfo(groupKey);

  if (!tierInfo || !tierInfo.canAscend) {
    return res.status(400).send('This card cannot be ascended');
  }

  try {
    const itemsRef = db.collection('items');
    const snapshot = await itemsRef
      .where('buyerId', '==', requesterId)
      .where('sold', '==', true)
      .get();

    const matchingCards = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(item => item.itemType !== 'pack' && item.listedForSale !== true)
      .filter(item => {
        const imageName = item.imageUrl ? path.basename(item.imageUrl) : '';
        return canonicalizeCardKey(imageName) === groupKey;
      });

    if (matchingCards.length < 3) {
      return res.status(400).send('You need at least 3 copies of this card to ascend');
    }

    const selectedCards = matchingCards.slice(0, 3);
    const packName = tierInfo.packName;
    const packColor = {
      'rare-bronze': '#b07600',
      'silver': '#b0bec5',
      'rare-silver': '#8ca1b5',
      'gold': '#d7b737',
      'rare-gold': '#e5b024',
      'platinum': '#dfe7f3',
      'lightning': '#6ad6ff'
    }[tierInfo.nextTier] || '#667eea';

    const imagesDir = path.join(__dirname, 'public', 'images');
    const nextTierCards = fs.existsSync(imagesDir)
      ? fs.readdirSync(imagesDir)
          .filter(file => ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(path.extname(file).toLowerCase()))
          .filter(file => normalizeAscendString(file).includes(normalizeAscendString(tierInfo.nextTier)))
      : [];

    const packRef = db.collection('packs').doc();
    await db.runTransaction(async transaction => {
      const packDoc = await transaction.get(packRef);
      if (packDoc.exists) {
        throw new Error('Pack creation collision');
      }

      transaction.set(packRef, {
        name: packName,
        color: packColor,
        cardIds: nextTierCards.length > 0 ? nextTierCards : [cleanCardKey],
        createdBy: requesterId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      selectedCards.forEach(card => {
        transaction.delete(db.collection('items').doc(card.id));
      });

      transaction.set(db.collection('items').doc(), {
        name: packName,
        itemType: 'pack',
        packId: packRef.id,
        packColor: packColor,
        price: 0,
        sellerId: requesterId,
        sold: true,
        buyerId: requesterId,
        purchasedAt: new Date(),
        sourceItemId: null,
        createdAt: new Date()
      });
    });

    res.json({ success: true, packName, nextTier: tierInfo.nextTier });
  } catch (error) {
    console.error('Error ascending card:', error);
    res.status(500).send(error.message || 'Could not ascend card');
  }
});

app.get('/inventory', async (req, res) => {
  // Require the requester to identify themselves via the X-User-Id header.
  // This prevents callers from requesting other users' inventories.
  const requesterId = req.header('X-User-Id');
  const { buyerId } = req.query;

  if (!requesterId || typeof requesterId !== 'string') {
    return res.status(401).send('Missing X-User-Id header');
  }

  let userId = requesterId;
  if (buyerId && buyerId !== requesterId) {
    const isAdmin = await userIsAdmin(requesterId);
    if (!isAdmin) {
      return res.status(403).send('Forbidden');
    }
    userId = buyerId;
  }

  try {
    const itemsRef = db.collection('items');
    const snapshot = await itemsRef
      .where('buyerId', '==', userId)
      .where('sold', '==', true)
      .get();

    const inventoryItems = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Filter out items that are currently listed for sale
      if (data.listedForSale !== true) {
        inventoryItems.push({
          id: doc.id,
          ...data
        });
      }
    });

    inventoryItems.sort((a, b) => {
      const left = String(a.name || '').toLocaleLowerCase();
      const right = String(b.name || '').toLocaleLowerCase();
      return left.localeCompare(right);
    });

    res.json(inventoryItems);
  } catch (error) {
    console.error('Error getting inventory:', error);
    res.status(500).send('Error retrieving inventory');
  }
});

/* ------------------ START SERVER ------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

/* ------------------ MAKE ADMIN (temporary, secured) ------------------ */
// Use only if you need to promote an existing username to admin.
// Requires environment variable ADMIN_SECRET to be set to a shared secret.
app.post('/make-admin', async (req, res) => {
  const { username, secret } = req.body;

  if (!process.env.ADMIN_SECRET) {
    return res.status(500).send('Server not configured for make-admin');
  }

  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).send('Forbidden');
  }

  if (!username || typeof username !== 'string') {
    return res.status(400).send('Invalid username');
  }

  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('username', '==', username).get();

    if (snapshot.empty) {
      return res.status(400).send('User not found');
    }

    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({ isAdmin: true });

    res.send(`Promoted ${username} to admin`);
  } catch (error) {
    console.error('Error promoting user to admin:', error);
    res.status(500).send('Could not promote user');
  }
});

/* ------------------ BUY VIP ------------------ */
// Users can purchase VIP for a fixed price (in Footy). VIP lasts 30 days and
// purchasing while already VIP extends the expiry by 30 days.
app.post('/buy-vip', async (req, res) => {
  const requesterId = req.header('X-User-Id');

  if (!requesterId || typeof requesterId !== 'string') {
    return res.status(401).send('Missing X-User-Id header');
  }

  const VIP_PRICE = 300; // cost in Footy for 30 days
  const DURATION_MS = 30 * 24 * 60 * 60 * 1000;

  try {
    const usersRef = db.collection('users');
    const userRef = usersRef.doc(requesterId);

    let newVipUntil;
    let newBalance;

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error('User not found');

      const user = userDoc.data();
      const now = new Date();
      const currentVip = user.vipUntil ? (user.vipUntil.toDate ? user.vipUntil.toDate() : new Date(user.vipUntil)) : null;
      const oneDayMs = 24 * 60 * 60 * 1000;

      if (currentVip && currentVip.getTime() > now.getTime() + oneDayMs) {
        throw new Error('You can only renew VIP when one day or less remains');
      }

      const baseTime = (currentVip && currentVip.getTime() > now.getTime()) ? currentVip.getTime() : now.getTime();
      newVipUntil = new Date(baseTime + DURATION_MS);

      if ((user.balance || 0) < VIP_PRICE) {
        throw new Error('Not enough money');
      }

      newBalance = (user.balance || 0) - VIP_PRICE;

      transaction.update(userRef, {
        balance: newBalance,
        vipUntil: newVipUntil
      });
    });

    res.json({ vipUntil: newVipUntil.toISOString(), balance: newBalance });
  } catch (error) {
    console.error('Buy VIP error:', error);
    if (error.message === 'User not found' || error.message === 'Not enough money') {
      return res.status(400).send(error.message);
    }
    res.status(500).send('Could not purchase VIP');
  }
});
