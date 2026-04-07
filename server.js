const express = require('express');
const crypto = require('crypto');
const { admin, db } = require('./firebase-server');
require('dotenv').config();

const app = express();

// CORS middleware - MUST be first!
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Max-Age', '3600');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

app.use(express.json());
app.use(express.static('public'));

// Initialize test users in Firestore
async function initializeTestUsers() {
  try {
    const usersRef = db.collection('users');
    
    // Check if Alice exists
    const aliceSnap = await usersRef.where('username', '==', 'Alice').get();
    if (aliceSnap.empty) {
      await usersRef.add({
        username: 'Alice',
        passwordHash: hashPassword('demo123'),
        balance: 1000,
        createdAt: new Date()
      });
      console.log('Created test user: Alice');
    }
    
    // Check if Bob exists
    const bobSnap = await usersRef.where('username', '==', 'Bob').get();
    if (bobSnap.empty) {
      await usersRef.add({
        username: 'Bob',
        passwordHash: hashPassword('demo123'),
        balance: 500,
        createdAt: new Date()
      });
      console.log('Created test user: Bob');
    }
  } catch (error) {
    console.error('Error initializing test users:', error);
  }
}

initializeTestUsers();

// Password hashing helpers
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Signup
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).send("Username and password required");
  }

  try {
    const usersRef = db.collection('users');
    const existing = await usersRef.where('username', '==', username).get();

    if (!existing.empty) {
      return res.status(400).send("Username already exists");
    }

    const newUser = await usersRef.add({
      username,
      passwordHash: hashPassword(password),
      balance: 1000,
      createdAt: new Date()
    });

    res.json({ id: newUser.id, username });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).send('Signup failed');
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).send("Username and password required");
  }

  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('username', '==', username).get();

    if (snapshot.empty) {
      return res.status(400).send("User not found");
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();

    if (user.passwordHash !== hashPassword(password)) {
      return res.status(400).send("Invalid password");
    }

    res.json({ id: userDoc.id, username: user.username });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Login failed');
  }
});

// Get users
app.get('/users', async (req, res) => {
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    const users = [];
    snapshot.forEach(doc => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    res.json(users);
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).send('Error retrieving users');
  }
});

app.post('/transfer', async (req, res) => {
  const { fromId, toUsername, amount } = req.body;

  // Validate amount
  if (!amount || amount <= 0 || isNaN(amount)) {
    return res.status(400).send("Invalid amount - must be positive number");
  }

  try {
    const usersRef = db.collection('users');
    
    // Get sender
    const fromDoc = await usersRef.doc(fromId).get();
    if (!fromDoc.exists) {
      return res.status(400).send("Sender not found");
    }
    
    const fromUser = fromDoc.data();

    // Prevent self-transfer
    if (fromUser.username === toUsername) {
      console.log(`Transfer blocked: ${fromUser.username} tried to transfer money to themselves`);
      return res.status(400).send("You can't transfer money to yourself");
    }

    if (fromUser.balance < amount) {
      return res.status(400).send("Not enough money");
    }

    // Get recipient
    const toSnapshot = await usersRef.where('username', '==', toUsername).get();
    if (toSnapshot.empty) {
      return res.status(400).send("Recipient not found");
    }

    const toDoc = toSnapshot.docs[0];
    const toUser = toDoc.data();

    // Perform transaction
    await db.runTransaction(async (transaction) => {
      transaction.update(usersRef.doc(fromId), {
        balance: fromUser.balance - amount
      });

      transaction.update(toDoc.ref, {
        balance: toUser.balance + amount
      });
    });

    console.log(`Transferred ${amount} from ${fromUser.username} to ${toUser.username}`);
    res.send("Transfer complete");

  } catch (error) {
    console.error("Transfer error:", error);
    res.status(500).send("Transfer failed");
  }
});

app.post('/delete-item', async (req, res) => {
  const { itemId, userId } = req.body;

  try {
    const itemsRef = db.collection('items');
    const itemDoc = await itemsRef.doc(itemId).get();

    if (!itemDoc.exists) {
      return res.status(400).send("Item not found");
    }

    const item = itemDoc.data();
    if (item.sellerId !== userId) {
      return res.status(403).send("Not your item");
    }

    await itemsRef.doc(itemId).delete();
    res.send("Item deleted");

  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).send('Error deleting item');
  }
});

// Get items
app.get('/items', async (req, res) => {
  try {
    const itemsRef = db.collection('items');
    const snapshot = await itemsRef
      .where('sold', '==', false)
      .orderBy('createdAt', 'desc')
      .get();
    
    const items = [];
    snapshot.forEach(doc => {
      items.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    res.json(items);
  } catch (error) {
    console.error('Error getting items:', error);
    res.status(500).send('Error retrieving items');
  }
});

// Add item
app.post('/items', async (req, res) => {
  const { name, price, sellerId } = req.body;

  // Validate inputs
  if (!name || !name.trim()) {
    return res.status(400).send("Item name is required");
  }
  if (!price || price <= 0) {
    return res.status(400).send("Invalid price - must be positive");
  }

  try {
    await db.collection('items').add({
      name: name.trim(),
      price,
      sellerId,
      sold: false,
      createdAt: new Date()
    });
    
    res.send("Item added");
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).send('Error adding item');
  }
});

// Buy item
app.post('/buy', async (req, res) => {
  const { itemId, buyerId } = req.body;

  try {
    const itemsRef = db.collection('items');
    const usersRef = db.collection('users');
    
    // Get item
    const itemDoc = await itemsRef.doc(itemId).get();
    if (!itemDoc.exists || itemDoc.data().sold) {
      return res.status(400).send("Item unavailable");
    }

    const item = itemDoc.data();

    // Get buyer
    const buyerDoc = await usersRef.doc(buyerId).get();
    if (!buyerDoc.exists) {
      return res.status(400).send("Buyer not found");
    }

    const buyer = buyerDoc.data();
    if (buyer.balance < item.price) {
      return res.status(400).send("Not enough money");
    }

    // Get seller
    const sellerDoc = await usersRef.doc(item.sellerId).get();
    if (!sellerDoc.exists) {
      return res.status(400).send("Seller not found");
    }

    const seller = sellerDoc.data();

    // Perform transaction
    await db.runTransaction(async (transaction) => {
      // Deduct from buyer
      transaction.update(usersRef.doc(buyerId), {
        balance: buyer.balance - item.price
      });

      // Add to seller
      transaction.update(usersRef.doc(item.sellerId), {
        balance: seller.balance + item.price
      });

      // Mark item as sold and record purchase details
      transaction.update(itemsRef.doc(itemId), {
        sold: true,
        buyerId: buyerId,
        purchasedAt: new Date()
      });
    });

    res.send("Purchase successful");

  } catch (error) {
    console.error('Error buying item:', error);
    res.status(500).send('Purchase failed');
  }
});

// Get inventory for current user
app.get('/inventory', async (req, res) => {
  const buyerId = req.query.buyerId;

  if (!buyerId) {
    return res.status(400).send('BuyerId required');
  }

  try {
    const itemsRef = db.collection('items');
    const snapshot = await itemsRef.where('buyerId', '==', buyerId).get();

    const items = [];
    snapshot.forEach(doc => {
      items.push({
        id: doc.id,
        ...doc.data()
      });
    });

    items.sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));

    res.json(items);
  } catch (error) {
    console.error('Error getting inventory:', error);
    res.status(500).send('Error retrieving inventory');
  }
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));