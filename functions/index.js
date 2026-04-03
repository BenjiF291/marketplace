const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize test users
async function initializeTestUsers() {
  try {
    const usersRef = db.collection('users');
    
    const aliceSnap = await usersRef.where('username', '==', 'Alice').get();
    if (aliceSnap.empty) {
      await usersRef.add({
        username: 'Alice',
        balance: 1000,
        createdAt: new Date()
      });
      console.log('Created test user: Alice');
    }
    
    const bobSnap = await usersRef.where('username', '==', 'Bob').get();
    if (bobSnap.empty) {
      await usersRef.add({
        username: 'Bob',
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

// Transfer
app.post('/transfer', async (req, res) => {
  const { fromId, toUsername, amount } = req.body;

  try {
    const usersRef = db.collection('users');
    
    const fromDoc = await usersRef.doc(fromId).get();
    if (!fromDoc.exists) {
      return res.status(400).send("Sender not found");
    }
    
    const fromUser = fromDoc.data();
    if (fromUser.balance < amount) {
      return res.status(400).send("Not enough money");
    }

    const toSnapshot = await usersRef.where('username', '==', toUsername).get();
    if (toSnapshot.empty) {
      return res.status(400).send("Recipient not found");
    }

    const toDoc = toSnapshot.docs[0];
    const toUser = toDoc.data();

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

// Get items
app.get('/items', async (req, res) => {
  try {
    const itemsRef = db.collection('items');
    const snapshot = await itemsRef.where('sold', '==', false).get();
    
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

  try {
    await db.collection('items').add({
      name,
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

// Delete item
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

// Buy item
app.post('/buy', async (req, res) => {
  const { itemId, buyerId } = req.body;

  try {
    const itemsRef = db.collection('items');
    const usersRef = db.collection('users');
    
    const itemDoc = await itemsRef.doc(itemId).get();
    if (!itemDoc.exists || itemDoc.data().sold) {
      return res.status(400).send("Item unavailable");
    }

    const item = itemDoc.data();

    const buyerDoc = await usersRef.doc(buyerId).get();
    if (!buyerDoc.exists) {
      return res.status(400).send("Buyer not found");
    }

    const buyer = buyerDoc.data();
    if (buyer.balance < item.price) {
      return res.status(400).send("Not enough money");
    }

    const sellerDoc = await usersRef.doc(item.sellerId).get();
    if (!sellerDoc.exists) {
      return res.status(400).send("Seller not found");
    }

    const seller = sellerDoc.data();

    await db.runTransaction(async (transaction) => {
      transaction.update(usersRef.doc(buyerId), {
        balance: buyer.balance - item.price
      });

      transaction.update(usersRef.doc(item.sellerId), {
        balance: seller.balance + item.price
      });

      transaction.update(itemsRef.doc(itemId), {
        sold: true
      });
    });

    res.send("Purchase successful");

  } catch (error) {
    console.error('Error buying item:', error);
    res.status(500).send('Purchase failed');
  }
});

exports.api = functions.https.onRequest(app);
