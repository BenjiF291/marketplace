const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { admin, db } = require('./firebase-server');
require('dotenv').config();

const app = express();

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
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
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

async function userIsAdmin(userId) {
  if (!userId || typeof userId !== 'string') return false;
  const userDoc = await db.collection('users').doc(userId).get();
  return userDoc.exists && userDoc.data().isAdmin === true;
}

/* ------------------ INIT TEST USERS ------------------ */
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

    const aliceSnap = await usersRef.where('username', '==', 'Alice').get();
    if (aliceSnap.empty) {
      await usersRef.add({
        username: 'Alice',
        passwordHash: hashPassword('demo123'),
        balance: 1000,
        isAdmin: false,
        createdAt: new Date()
      });
      console.log('Created test user: Alice');
    } else {
      const aliceDoc = aliceSnap.docs[0];
      if (aliceDoc.data().isAdmin === true) {
        await aliceDoc.ref.update({ isAdmin: false });
        console.log('Removed admin role from Alice');
      }
    }

    const bobSnap = await usersRef.where('username', '==', 'Bob').get();
    if (bobSnap.empty) {
      await usersRef.add({
        username: 'Bob',
        passwordHash: hashPassword('demo123'),
        balance: 500,
        isAdmin: false,
        createdAt: new Date()
      });
      console.log('Created test user: Bob');
    }
  } catch (error) {
    console.error('Error initializing test users:', error);
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
      balance: 1000,
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
  const cooldownMs = 24 * 60 * 60 * 1000;

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
      return res.status(400).json({ error: 'You can only spin once every 24 hours.', nextSpinAt: nextSpinAt?.toISOString() });
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
    const snapshot = await itemsRef.get();

    const items = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.sold !== true) {
        items.push({
          id: doc.id,
          name: data.name || 'Unknown Item',
          price: data.price || 0,
          sellerId: data.sellerId || '',
          sold: data.sold || false,
          createdAt: data.createdAt
        });
      }
    });

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
    const targetSnapshot = await usersRef.where('username', '==', username.trim()).get();
    if (targetSnapshot.empty) {
      return res.status(400).send('Recipient not found');
    }

    const recipientDoc = targetSnapshot.docs[0];
    const recipientId = recipientDoc.id;

    let imageFile = cardId.trim();
    if (!path.extname(imageFile)) {
      imageFile = `${imageFile}.png`;
    }

    const imagesDir = path.join(__dirname, 'public', 'images');
    const imagePath = path.join(imagesDir, imageFile);
    if (!fs.existsSync(imagePath)) {
      return res.status(400).send('Card image not found');
    }

    const batchPromises = [];
    for (let i = 0; i < qty; i++) {
      batchPromises.push(db.collection('items').add({
        name: `Card ${cardId}`,
        price: 0,
        sellerId: requesterId,
        sold: true,
        buyerId: recipientId,
        purchasedAt: new Date(),
        sourceItemId: null,
        imageUrl: `/images/${imageFile}`,
        createdAt: new Date()
      }));
    }

    await Promise.all(batchPromises);
    res.json({ success: true, granted: qty });
  } catch (error) {
    console.error('Error granting item:', error);
    res.status(500).send('Error granting item');
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
  const { name, price, sellerId, sourceItemId, imageUrl } = req.body;

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

    // If listing from inventory, mark the source item as listedForSale
    if (sourceItemId) {
      const sourceItemRef = db.collection('items').doc(sourceItemId);
      const sourceItemDoc = await sourceItemRef.get();
      if (sourceItemDoc.exists) {
        await sourceItemRef.update({ listedForSale: true });
      }
    }

    await db.collection('items').add({
      name: cleanName,
      price,
      sellerId,
      sold: false,
      buyerId: null,
      purchasedAt: null,
      sourceItemId: sourceItemId || null,
      imageUrl: imageUrl || null,
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

    await db.runTransaction(async (transaction) => {
      const itemRef = itemsRef.doc(itemId);
      const itemDoc = await transaction.get(itemRef);

      if (!itemDoc.exists) {
        throw new Error('Item unavailable');
      }

      const item = itemDoc.data();

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

      if (buyer.balance < item.price) {
        throw new Error('Not enough money');
      }

      const sellerRef = usersRef.doc(item.sellerId);
      const sellerDoc = await transaction.get(sellerRef);

      if (!sellerDoc.exists) {
        throw new Error('Seller not found');
      }

      const seller = sellerDoc.data();

      // If the listing came from inventory, read the source item BEFORE performing writes
      let sourceItemRef = null;
      let sourceItemDoc = null;
      if (item.sourceItemId) {
        sourceItemRef = itemsRef.doc(item.sourceItemId);
        sourceItemDoc = await transaction.get(sourceItemRef);
      }

      // Perform writes (all reads must be done before these)
      transaction.update(buyerRef, {
        balance: buyer.balance - item.price
      });

      transaction.update(sellerRef, {
        balance: seller.balance + item.price
      });

      transaction.update(itemRef, {
        sold: true,
        buyerId: buyerId,
        purchasedAt: new Date()
      });

      // Delete the original source inventory item atomically (if it exists)
      if (sourceItemDoc && sourceItemDoc.exists) {
        transaction.delete(sourceItemRef);
      }
    });
    res.send('Purchase successful');
  } catch (error) {
    console.error('Error buying item:', error);

    if (
      error.message === 'Item unavailable' ||
      error.message === 'Buyer not found' ||
      error.message === 'Seller not found' ||
      error.message === 'Not enough money' ||
      error.message === "You can't buy your own item"
    ) {
      return res.status(400).send(error.message);
    }

    // Return error message to help debug purchase failures
    res.status(500).send(error.message || 'Purchase failed');
  }
});

/* ------------------ INVENTORY ------------------ */
app.get('/inventory', async (req, res) => {
  // Require the requester to identify themselves via the X-User-Id header.
  // This prevents callers from requesting other users' inventories.
  const requesterId = req.header('X-User-Id');
  const { buyerId } = req.query;

  if (!requesterId || typeof requesterId !== 'string') {
    return res.status(401).send('Missing X-User-Id header');
  }

  // If a buyerId query param is provided, it must match the requester.
  if (buyerId && buyerId !== requesterId) {
    return res.status(403).send('Forbidden');
  }

  const userId = requesterId;

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

  const VIP_PRICE = 200; // cost in Footy for 30 days
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