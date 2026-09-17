const { vipPercent, vipPrice } = require('./marketplace-utils');
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { admin, db } = require('./firebase-server');
require('dotenv').config();

const app = express();
const brawlAuth = require('./brawl-auth')(db);
const { getAscendTierInfo, getAscendTierFromCardName, formatTierLabel, normalizeAscendString, canonicalizeCardKey } = require('./ascend-utils');
const { effects: amuletEffects, discounted, round: roundFooty } = require('./amulet-utils');
const battleTimeouts = require('./battle-timeout').createTimeoutService(db, amuletEffects, roundFooty);
setInterval(() => battleTimeouts.recover().catch(error => console.error('Battle timer recovery:', error)), 15000).unref();
battleTimeouts.recover().catch(error => console.error('Battle timer recovery:', error));
const { sortCardsByTier } = require('./card-order');
const battleEngine = require('./public/practice-engine');
const { validateBattleCard } = require('./battle-utils');
const { gemIdentity, converterProgress, upgradeConverter, requireUnlockedTier, gemRecipe, validateGemCards } = require('./gem-utils');

/* ------------------ CORS ------------------ */
// Must be first
app.use((req, res, next) => {
  // Allow requests from GitHub Pages, Firebase Hosting, and localhost
  const allowedOrigins = [
    'https://marketplace-aw8b.onrender.com',
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

let marketplaceSyncRunning = false;

async function runMarketplaceSync() {
  if (marketplaceSyncRunning) return;
  marketplaceSyncRunning = true;
  try {
    await syncPlannedMarketplaceListings();
  } catch (error) {
    console.error('Scheduled listing sync failed:', error);
  } finally {
    marketplaceSyncRunning = false;
  }
}

setInterval(runMarketplaceSync, 60000);

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

const DEFAULT_ASCEND_TIERS = [
  'Bronze',
  'Rare Bronze',
  'Silver',
  'Rare Silver',
  'Gold',
  'Rare Gold',
  'Platinum',
  'Lightning',
  'Ultra'
];

const DEFAULT_TIER_COLORS = {
  backgroundColor: '#eeeeee',
  nameColor: '#d9b936',
  scoreColor: '#0a7385'
};

function normalizeTierColors(tier) {
  return {
    backgroundColor: /^#[0-9a-fA-F]{6}$/.test(tier.backgroundColor || '') ? tier.backgroundColor : DEFAULT_TIER_COLORS.backgroundColor,
    nameColor: /^#[0-9a-fA-F]{6}$/.test(tier.nameColor || '') ? tier.nameColor : DEFAULT_TIER_COLORS.nameColor,
    scoreColor: /^#[0-9a-fA-F]{6}$/.test(tier.scoreColor || '') ? tier.scoreColor : DEFAULT_TIER_COLORS.scoreColor
  };
}

async function ensureDefaultAscendTiers() {
  try {
    const tiersRef = db.collection('ascendTiers');
    const snapshot = await tiersRef.orderBy('order', 'asc').get();
    if (!snapshot.empty) return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const writes = DEFAULT_ASCEND_TIERS.map((name, index) => ({
      name,
      order: index,
      cards: [],
      packs: [],
      ...DEFAULT_TIER_COLORS,
      createdAt: new Date()
    }));

    const batch = db.batch();
    writes.forEach(entry => {
      batch.set(tiersRef.doc(), entry);
    });
    await batch.commit();
    return writes;
  } catch (error) {
    console.error('Error ensuring default ascend tiers:', error);
    return [];
  }
}

async function getAscendTierConfig() {
  const tiers = await ensureDefaultAscendTiers();
  return tiers
    .map(tier => ({
      ...tier,
      sellPrice: Number(tier.sellPrice) || 0,
      ...normalizeTierColors(tier)
    }))
    .sort((a, b) => Number(a.order) - Number(b.order));
}

async function listingCurrency(key = 'footy') {
  if (!key || key === 'footy') return { currency: 'footy', currencyName: 'Footy' };
  const tiers = await getAscendTierConfig();
  const gem = tiers.map(gemIdentity).find(gem => gem.gemKey === key);
  if (!gem) throw new Error('Unknown gem currency');
  return { currency: gem.gemKey, currencyName: gem.gemName };
}

async function createMarketplaceListingEntries({ sellerId, itemType, productId, price, quantity, perUserLimit, scheduledAt, expiresAt, currency = 'footy', vipDiscountPercent = 0, listingGroupIdOverride = null, planRef = null }) {
  const money = await listingCurrency(currency);
  if (money.currency !== 'footy' && !Number.isSafeInteger(price)) throw new Error('Gem prices must be whole numbers');
  let itemName;
  let imageUrl = null;
  let packId = null;
  let packColor = null;
  const stock = Number(quantity);
  const maxPerUser = Number(perUserLimit) || 0;

  if (itemType === 'card') {
    if (!productId || typeof productId !== 'string' || productId !== path.basename(productId)) {
      throw new Error('Invalid card');
    }
    const imagePath = path.join(__dirname, 'public', 'images', productId);
    if (!fs.existsSync(imagePath)) throw new Error('Card image not found');
    itemName = `Card ${productId}`;
    imageUrl = `/images/${productId}`;
  } else {
    const packDoc = await db.collection('packs').doc(productId).get();
    if (!packDoc.exists) throw new Error('Pack not found');
    packId = packDoc.id;
    itemName = `${packDoc.data().name} Pack`;
    packColor = packDoc.data().color || '#667eea';
  }

  const groupRef = listingGroupIdOverride ? db.collection('marketListingGroups').doc(listingGroupIdOverride) : db.collection('marketListingGroups').doc();
  const writeListing = batch => {
  batch.set(groupRef, {
    sellerId,
    name: itemName,
    itemType,
    packId,
    packColor,
    imageUrl,
    price,
    ...money,
    vipDiscountPercent,
    stock,
    soldCount: 0,
    perUserLimit: maxPerUser || null,
    purchaseCounts: {},
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
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
    ...money,
    vipDiscountPercent,
      sellerId,
      sold: false,
      buyerId: null,
      purchasedAt: null,
      sourceItemId: null,
      listingGroupId: groupRef.id,
      perUserLimit: maxPerUser || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdAt: new Date()
    });
  }

    if (planRef) batch.update(planRef, { status: 'published', publishedAt: new Date(), listingGroupId: groupRef.id });
  };
  if (planRef) {
    return db.runTransaction(async transaction => {
      const plan = await transaction.get(planRef);
      if (!plan.exists || plan.data().status !== 'scheduled') return null;
      writeListing(transaction);
      return groupRef.id;
    });
  }
  const batch = db.batch();
  writeListing(batch);
  await batch.commit();
  return groupRef.id;
}

async function syncPlannedMarketplaceListings() {
  const now = new Date();

  const scheduledPlans = await db.collection('marketListingPlans').where('status', '==', 'scheduled').get();
  for (const doc of scheduledPlans.docs) {
    const data = doc.data();
    const scheduledAt = data.scheduledAt ? (data.scheduledAt.toDate ? data.scheduledAt.toDate() : new Date(data.scheduledAt)) : null;
    if (!scheduledAt || now.getTime() < scheduledAt.getTime()) continue;

    try {
      const groupId = await createMarketplaceListingEntries({
        sellerId: data.sellerId,
        itemType: data.itemType,
        productId: data.productId,
        price: Number(data.price),
        currency: data.currency || 'footy',
        quantity: Number(data.quantity),
        vipDiscountPercent: vipPercent(data.vipDiscountPercent),
        perUserLimit: Number(data.perUserLimit) || 0,
        scheduledAt: scheduledAt.toISOString(),
        expiresAt: data.expiresAt ? (data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt)).toISOString() : null,
        listingGroupIdOverride: data.listingGroupId || null,
        planRef: doc.ref
      });

    } catch (error) {
      console.error('Error publishing scheduled listing:', error);
    }
  }

  const activePlans = await db.collection('marketListingPlans').where('status', '==', 'published').get();
  for (const doc of activePlans.docs) {
    const data = doc.data();
    const expiresAt = data.expiresAt ? (data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt)) : null;
    if (!expiresAt || now.getTime() < expiresAt.getTime()) continue;

    const listingGroupId = data.listingGroupId;
    if (listingGroupId) {
      const itemsSnapshot = await db.collection('items').where('listingGroupId', '==', listingGroupId).get();
      const batch = db.batch();
      itemsSnapshot.docs.forEach(itemDoc => batch.delete(itemDoc.ref));
      if (itemsSnapshot.docs.length > 0) await batch.commit();
      await db.collection('marketListingGroups').doc(listingGroupId).delete().catch(() => {});
    }

    await doc.ref.update({ status: 'expired', expiredAt: now });
  }
}

async function findTierForCard(cardFileName) {
  const tiers = await getAscendTierConfig();
  const normalized = path.basename(String(cardFileName || ''));
  return tiers.find(tier => (tier.cards || []).some(card => path.basename(String(card)) === normalized));
}

async function findTierForPack(packId) {
  const tiers = await getAscendTierConfig();
  return tiers.find(tier => (tier.packs || []).some(pack => String(pack) === String(packId)));
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

app.get('/battle-cards', async (req, res) => {
  try {
    const [snapshot, tiers] = await Promise.all([
      db.collection('battleCards').orderBy('createdAt', 'desc').get(),
      getAscendTierConfig()
    ]);
    const cards = snapshot.docs.map(doc => {
      const data = doc.data();
      const tier = tiers.find(candidate => (candidate.cards || []).includes(data.linkedCardImage));
      return {
        id: doc.id,
        name: data.name,
        averageScore: Number(data.averageScore) || 0,
        top: Number(data.top) || 0,
        right: Number(data.right) || 0,
        bottom: Number(data.bottom) || 0,
        left: Number(data.left) || 0,
        familyName: data.familyName || null,
        mirrorPower: data.mirrorPower || null,
        linkedCardImage: data.linkedCardImage || null,
        color: data.color || '#eeeeee',
        tierColors: tier ? normalizeTierColors(tier) : null,
        createdAt: serializeDate(data.createdAt)
      };
    });
    res.json(sortCardsByTier(cards, tiers));
  } catch (error) {
    console.error('Error loading battle cards:', error);
    res.status(500).send('Could not load battle cards');
  }
});

app.get('/battle-inventory', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  if (!requesterId || typeof requesterId !== 'string') return res.status(401).send('Missing X-User-Id header');

  try {
    const [itemsSnapshot, battleCardsSnapshot, tiers] = await Promise.all([
      db.collection('items').where('buyerId', '==', requesterId).where('sold', '==', true).get(),
      db.collection('battleCards').get(),
      getAscendTierConfig()
    ]);
    const ownedImages = new Set();
    itemsSnapshot.forEach(doc => {
      const item = doc.data();
      if (item.listedForSale !== true && item.itemType !== 'battle-card' && item.imageUrl) {
        ownedImages.add(path.basename(item.imageUrl));
      }
    });

    const battleItems = [];
    battleCardsSnapshot.forEach(doc => {
      const card = doc.data();
      const tier = tiers.find(candidate => (candidate.cards || []).includes(card.linkedCardImage));
      if (ownedImages.has(card.linkedCardImage)) {
        battleItems.push({
          id: doc.id,
          battleCardId: doc.id,
          name: card.name,
          itemType: 'battle-card',
          familyName: card.familyName || null,
          mirrorPower: card.mirrorPower || null,
          linkedCardImage: card.linkedCardImage,
          color: card.color || '#eeeeee',
          tierColors: tier ? normalizeTierColors(tier) : null,
          averageScore: Number(card.averageScore) || 0,
          top: Number(card.top) || 0,
          right: Number(card.right) || 0,
          bottom: Number(card.bottom) || 0,
          left: Number(card.left) || 0
        });
      }
    });
    res.json(sortCardsByTier(battleItems, tiers));
  } catch (error) {
    console.error('Error loading battle inventory:', error);
    res.status(500).send('Could not load battle inventory');
  }
});

/* ------------------ SAVED BATTLE DECKS ------------------ */
app.get('/battle-decks', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  if (!requesterId || typeof requesterId !== 'string') return res.status(401).send('Missing X-User-Id header');
  try {
    const snapshot = await db.collection('battleDecks').where('userId', '==', requesterId).get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => new Date(serializeDate(b.createdAt) || 0) - new Date(serializeDate(a.createdAt) || 0)));
  } catch (error) {
    console.error('Error loading battle decks:', error);
    res.status(500).send('Could not load battle decks');
  }
});

app.post('/battle-decks', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { name, cardIds, color } = req.body || {};
  if (!requesterId || typeof requesterId !== 'string') return res.status(401).send('Missing X-User-Id header');
  if (!name || typeof name !== 'string' || !name.trim() || name.trim().length > 50) return res.status(400).send('Enter a deck name up to 50 characters');
  if (!Array.isArray(cardIds) || cardIds.length !== 6 || new Set(cardIds).size !== cardIds.length || cardIds.some(id => typeof id !== 'string')) return res.status(400).send('A saved deck must contain exactly six different cards');
  if (!isBattleColor(color)) return res.status(400).send('Choose a valid player color');
  try {
    const ownedCards = await getBattleCardsForUser(requesterId);
    const ownedById = new Map(ownedCards.map(card => [card.id, card]));
    if (cardIds.some(id => !ownedById.has(id))) return res.status(400).send('One or more selected cards are not in your inventory');
    if (!battleEngine.validSpecials(cardIds.map(id => ownedById.get(id)))) return res.status(400).send('Only one special card is allowed per deck');
    const deckRef = await db.collection('battleDecks').add({
      userId: requesterId,
      name: name.trim(),
      cardIds,
      color,
      createdAt: new Date()
    });
    res.status(201).json({ success: true, id: deckRef.id });
  } catch (error) {
    console.error('Error saving battle deck:', error);
    res.status(500).send('Could not save battle deck');
  }
});

app.delete('/battle-decks/:deckId', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { deckId } = req.params;
  if (!requesterId || typeof requesterId !== 'string') return res.status(401).send('Missing X-User-Id header');
  try {
    const deckRef = db.collection('battleDecks').doc(deckId);
    const deckDoc = await deckRef.get();
    if (!deckDoc.exists || deckDoc.data().userId !== requesterId) return res.status(404).send('Deck not found');
    await deckRef.delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting battle deck:', error);
    res.status(500).send('Could not delete battle deck');
  }
});

function battleMatchView(id, data) {
  battleTimeouts.schedule(id, data);
  return {
    id,
    status: data.status,
    averageLimit: data.averageLimit,
    participantIds: data.participantIds,
    participants: data.participants,
    decks: data.decks,
    colors: data.colors,
    ready: data.ready,
    starterId: data.starterId || null,
    starterCard: data.starterCard || null,
    prize: Number(data.prize) || 0,
    prizePaid: data.prizePaid === true,
    endReason: data.endReason || null,
    serverNow: Date.now(),
    paidPrize: data.paidPrize ?? data.prize,
    timeControlSeconds: Number(data.timeControlSeconds) || 90,
    clocks: data.clocks || {},
    turnStartedAt: serializeDate(data.turnStartedAt),
    turnPlayerId: data.turnPlayerId || null,
    board: data.board || Array(16).fill(null),
    playedCards: data.playedCards || [],
    interruptsUsed: data.interruptsUsed || {},
    winnerId: data.winnerId || null,
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt)
  };
}

async function getBattleCardsForUser(userId) {
  const [itemsSnapshot, battleCardsSnapshot] = await Promise.all([
    db.collection('items').where('buyerId', '==', userId).where('sold', '==', true).get(),
    db.collection('battleCards').get()
  ]);
  const ownedImages = new Set();
  itemsSnapshot.forEach(doc => {
    const item = doc.data();
    if (item.listedForSale !== true && item.itemType !== 'battle-card' && item.imageUrl) ownedImages.add(path.basename(item.imageUrl));
  });
  return battleCardsSnapshot.docs
    .filter(doc => ownedImages.has(doc.data().linkedCardImage))
    .map(doc => ({
      id: doc.id,
      name: doc.data().name,
      familyName: doc.data().familyName || null,
      mirrorPower: doc.data().mirrorPower || null,
      linkedCardImage: doc.data().linkedCardImage || null,
      color: doc.data().color || '#eeeeee',
      averageScore: Number(doc.data().averageScore) || 0,
      top: Number(doc.data().top) || 0,
      right: Number(doc.data().right) || 0,
      bottom: Number(doc.data().bottom) || 0,
      left: Number(doc.data().left) || 0
    }));
}

function isBattleColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function otherBattlePlayer(match, playerId) {
  return match.participantIds.find(id => id !== playerId);
}

function battleCardForBoard(card, playerId, color) {
  return {
    cardId: card.id,
    ownerId: playerId,
    playedBy: playerId,
    name: card.name,
    familyName: card.familyName || null,
    mirrorPower: card.mirrorPower || null,
    linkedCardImage: card.linkedCardImage || null,
    color,
    averageScore: card.averageScore,
    top: card.top,
    right: card.right,
    bottom: card.bottom,
    left: card.left
  };
}

app.post('/battle-matches', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { opponentId, averageLimit, prize } = req.body || {};
  const { timeControlSeconds } = req.body || {};
  const limit = Number(averageLimit);
  const matchPrize = Number(prize);
  if (!requesterId || typeof requesterId !== 'string') return res.status(401).send('Missing X-User-Id header');
  if (!opponentId || typeof opponentId !== 'string' || opponentId === requesterId) return res.status(400).send('Choose another player');
  if (!Number.isInteger(limit) || limit < 1 || limit > 99) return res.status(400).send('Average limit must be a whole number from 1 to 99');
  if (!Number.isInteger(matchPrize) || matchPrize < 0 || matchPrize > 1000000000) return res.status(400).send('Prize must be a whole number of 0 or more');
  if (!Number.isInteger(timeControlSeconds) || timeControlSeconds < 15 || timeControlSeconds > 3600) return res.status(400).send('Time control must be between 15 and 3600 seconds');

  try {
    const usersRef = db.collection('users');
    const [requesterDoc, opponentDoc] = await Promise.all([usersRef.doc(requesterId).get(), usersRef.doc(opponentId).get()]);
    if (!requesterDoc.exists || !opponentDoc.exists) return res.status(404).send('Player not found');
    const now = new Date();
    const matchRef = db.collection('battleMatches').doc();
    const match = {
      status: 'setup',
      averageLimit: limit,
      prize: matchPrize,
      prizePaid: false,
      timeControlSeconds,
      clocks: { [requesterId]: timeControlSeconds * 1000, [opponentId]: timeControlSeconds * 1000 },
      participantIds: [requesterId, opponentId],
      participants: {
        [requesterId]: { username: requesterDoc.data().username },
        [opponentId]: { username: opponentDoc.data().username }
      },
      decks: { [requesterId]: [], [opponentId]: [] },
      colors: { [requesterId]: null, [opponentId]: null },
      ready: { [requesterId]: false, [opponentId]: false },
      starterId: null,
      starterCard: null,
      turnPlayerId: null,
      board: Array(16).fill(null),
      createdAt: now,
      updatedAt: now
    };
    await matchRef.set(match);
    res.status(201).json(battleMatchView(matchRef.id, match));
  } catch (error) {
    console.error('Create battle match error:', error);
    res.status(500).send('Could not invite player');
  }
});

app.get('/battle-matches', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  if (!requesterId || typeof requesterId !== 'string') return res.status(401).send('Missing X-User-Id header');
  try {
    const snapshot = await db.collection('battleMatches').where('participantIds', 'array-contains', requesterId).get();
    const matches = snapshot.docs
      .map(doc => battleMatchView(doc.id, doc.data()))
      .filter(match => match.status === 'setup')
      .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')));
    res.json(matches);
  } catch (error) {
    console.error('List battle matches error:', error);
    res.status(500).send('Could not load battle invitations');
  }
});

app.get('/battle-matches/:matchId', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  if (!requesterId || typeof requesterId !== 'string') return res.status(401).send('Missing X-User-Id header');
  try {
    const matchDoc = await db.collection('battleMatches').doc(req.params.matchId).get();
    if (!matchDoc.exists || !matchDoc.data().participantIds.includes(requesterId)) return res.status(404).send('Match not found');
    const match = matchDoc.data();
    const expired = require('./battle-timeout').timeoutResult(match);
    res.json(battleMatchView(matchDoc.id, expired ? await battleTimeouts.expire(matchDoc.id) || match : match));
  } catch (error) {
    console.error('Load battle match error:', error);
    res.status(500).send('Could not load match');
  }
});

app.post('/battle-matches/:matchId/cancel', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  if (!requesterId || typeof requesterId !== 'string') return res.status(401).send('Missing X-User-Id header');
  try {
    const matchRef = db.collection('battleMatches').doc(req.params.matchId);
    await db.runTransaction(async tx => {
      const doc = await tx.get(matchRef);
      if (!doc.exists || !doc.data().participantIds.includes(requesterId)) throw new Error('Match not found');
      if (await battleTimeouts.settle(tx, matchRef, doc.data())) return;
      if (['setup', 'board'].includes(doc.data().status)) tx.update(matchRef, { status: 'cancelled', updatedAt: new Date() });
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Cancel battle match error:', error);
    res.status(500).send('Could not cancel match');
  }
});

app.post('/battle-matches/:matchId/deck', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { cardIds, color } = req.body || {};
  if (!requesterId || typeof requesterId !== 'string') return res.status(401).send('Missing X-User-Id header');
  if (!Array.isArray(cardIds) || cardIds.length > 6 || new Set(cardIds).size !== cardIds.length || cardIds.some(id => typeof id !== 'string')) return res.status(400).send('A deck can contain up to six different cards');
  if (!isBattleColor(color)) return res.status(400).send('Choose a valid player color');
  try {
    const matchRef = db.collection('battleMatches').doc(req.params.matchId);
    const result = await db.runTransaction(async transaction => {
      const matchDoc = await transaction.get(matchRef);
      if (!matchDoc.exists || !matchDoc.data().participantIds.includes(requesterId)) throw new Error('Match not found');
      const match = matchDoc.data();
      if (match.status !== 'setup') throw new Error('Deck setup is closed');
      const ownedCards = await getBattleCardsForUser(requesterId);
      const ownedById = new Map(ownedCards.map(card => [card.id, card]));
      if (cardIds.some(id => !ownedById.has(id))) throw new Error('One or more selected cards are not in your inventory');
      if (!battleEngine.validSpecials(cardIds.map(id => ownedById.get(id)))) throw new Error('Only one special card is allowed per deck');
      const total = cardIds.reduce((sum, id) => sum + ownedById.get(id).averageScore, 0);
      if (cardIds.length === 6 && total > match.averageLimit * 6 + battleEngine.budgetBonus(cardIds.map(id => ownedById.get(id)))) throw new Error('This deck is above the match average limit');
      const decks = { ...match.decks, [requesterId]: cardIds };
      const opponentId = otherBattlePlayer(match, requesterId);
      if (match.colors?.[opponentId] === color) throw new Error('Choose a color different from the other player');
      const colors = { ...match.colors, [requesterId]: color };
      const ready = { ...match.ready, [requesterId]: false };
      transaction.update(matchRef, { decks, colors, ready, updatedAt: new Date() });
      return { ...match, decks, colors, ready, updatedAt: new Date() };
    });
    res.json(battleMatchView(req.params.matchId, result));
  } catch (error) {
    if (['Only one special card is allowed per deck', 'Match not found', 'Deck setup is closed', 'One or more selected cards are not in your inventory', 'This deck is above the match average limit', 'Choose a valid player color', 'Choose a color different from the other player'].includes(error.message)) return res.status(400).send(error.message);
    console.error('Save battle deck error:', error);
    res.status(500).send('Could not save deck');
  }
});

app.post('/battle-matches/:matchId/ready', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  if (!requesterId || typeof requesterId !== 'string') return res.status(401).send('Missing X-User-Id header');
  try {
    const matchRef = db.collection('battleMatches').doc(req.params.matchId);
    const result = await db.runTransaction(async transaction => {
      const matchDoc = await transaction.get(matchRef);
      if (!matchDoc.exists || !matchDoc.data().participantIds.includes(requesterId)) throw new Error('Match not found');
      const match = matchDoc.data();
      if (match.status !== 'setup') throw new Error('Match setup is closed');
      const deck = match.decks?.[requesterId] || [];
      if (Number(match.prize || 0) > 0) {
        const playerDoc = await transaction.get(db.collection('users').doc(requesterId));
        if (!playerDoc.exists || Number(playerDoc.data().balance || 0) < Number(match.prize)) throw new Error('You cannot cover the agreed prize');
      }
      if (deck.length !== 6) throw new Error('Choose exactly six cards before Ready');
      const cards = await getBattleCardsForUser(requesterId);
      if (!battleEngine.validSpecials(cards.filter(card => deck.includes(card.id)))) throw new Error('Only one special card is allowed per deck');
      const scoreById = new Map(cards.map(card => [card.id, card.averageScore]));
      const total = deck.reduce((sum, id) => sum + (scoreById.get(id) ?? Infinity), 0);
      if (total > match.averageLimit * 6 + battleEngine.budgetBonus(cards.filter(card => deck.includes(card.id)))) throw new Error('This deck is above the match average limit');
      const ready = { ...match.ready, [requesterId]: true };
      const bothReady = match.participantIds.every(id => ready[id] === true);
      let status = 'setup';
      let starterId = match.starterId || null;
      let turnPlayerId = match.turnPlayerId || null;
      let starterCard = match.starterCard || null;
      let board = match.board || Array(16).fill(null);
      if (bothReady) {
        const totals = new Map();
        for (const participantId of match.participantIds) {
          const participantCards = await getBattleCardsForUser(participantId);
          const scoreById = new Map(participantCards.map(card => [card.id, card.averageScore]));
          totals.set(participantId, (match.decks[participantId] || []).reduce((sum, id) => sum + (scoreById.get(id) || 0), 0));
        }
        starterId = match.participantIds[0];
        if (totals.get(match.participantIds[1]) > totals.get(starterId)) starterId = match.participantIds[1];
        turnPlayerId = starterId;
        const turnStartedAt = new Date();
        const allBattleCards = await db.collection('battleCards').get();
        const starterCandidates = allBattleCards.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          familyName: doc.data().familyName || null,
          mirrorPower: doc.data().mirrorPower || null,
          linkedCardImage: doc.data().linkedCardImage || null,
          color: '#8a8f98',
          averageScore: Number(doc.data().averageScore) || 0,
          top: Number(doc.data().top) || 0,
          right: Number(doc.data().right) || 0,
          bottom: Number(doc.data().bottom) || 0,
          left: Number(doc.data().left) || 0
        }));
        starterCard = battleEngine.starterCard(starterCandidates, [{averageScore:[...totals.values()].reduce((sum,n)=>sum+n,0)/12}]);
        board = Array(16).fill(null);
        board[5] = starterCard;
        status = 'board';
      }
      const turnStartedAtValue = bothReady ? new Date() : match.turnStartedAt || null;
      transaction.update(matchRef, { ready, status, starterId, turnPlayerId, starterCard, board, turnStartedAt: turnStartedAtValue, updatedAt: new Date() });
      return { ...match, ready, status, starterId, turnPlayerId, starterCard, board, turnStartedAt: turnStartedAtValue, updatedAt: new Date() };
    });
    res.json(battleMatchView(req.params.matchId, result));
  } catch (error) {
    if (['Only one special card is allowed per deck', 'Match not found', 'Match setup is closed', 'Choose exactly six cards before Ready', 'This deck is above the match average limit', 'You cannot cover the agreed prize'].includes(error.message)) return res.status(400).send(error.message);
    console.error('Ready battle match error:', error);
    res.status(500).send('Could not ready the match');
  }
});

app.post('/battle-matches/:matchId/place', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { cardId, position, options = {} } = req.body || {};
  const cell = Number(position);
  if (!requesterId || typeof requesterId !== 'string') return res.status(401).send('Missing X-User-Id header');
  if (typeof cardId !== 'string' || !Number.isInteger(cell) || cell < 0 || cell > 15) return res.status(400).send('Choose a card and board space');

  try {
    const matchRef = db.collection('battleMatches').doc(req.params.matchId);
    const result = await db.runTransaction(async transaction => {
      const matchDoc = await transaction.get(matchRef);
      if (!matchDoc.exists || !matchDoc.data().participantIds.includes(requesterId)) throw new Error('Match not found');
      const match = matchDoc.data();
      const expired = await battleTimeouts.settle(transaction, matchRef, match);
      if (expired) return expired;
      const moveTime = new Date();
      if (match.status !== 'board') throw new Error('The board is not active');
      const interrupted = match.turnPlayerId !== requesterId;
      const deck = match.decks?.[requesterId] || [];
      if (!deck.includes(cardId)) throw new Error('That card is not in your deck');
      let board = Array.isArray(match.board) ? [...match.board] : Array(16).fill(null);
      const playedCards = match.playedCards || board.filter(entry => entry && (entry.playedBy || entry.ownerId) !== 'starter').map(entry => ({playerId:entry.playedBy || entry.ownerId,cardId:entry.cardId}));

      if (playedCards.some(entry => entry.playerId === requesterId && entry.cardId === cardId)) throw new Error('That card has already been played');
      const playerCards = await getBattleCardsForUser(requesterId);
      const opponentId = otherBattlePlayer(match, requesterId);
      const card = playerCards.find(entry => entry.id === cardId);
      if (!card) throw new Error('That card is no longer available');
      const interruptsUsed = {...(match.interruptsUsed || {})};
      const started = match.turnStartedAt?.toDate ? match.turnStartedAt.toDate() : new Date(match.turnStartedAt);
      if(interrupted && (battleEngine.ability(card)!=='mirror-interrupt' || interruptsUsed[requesterId] || moveTime-started<15000))throw new Error('It is not your turn');
      if(interrupted)interruptsUsed[requesterId]=true;
      if(!battleEngine.canPlace(board,card,cell,options))throw new Error('Choose a legal board space');
      const placed = battleCardForBoard(card, requesterId, match.colors[requesterId]);
      board = battleEngine.play(board, placed, cell, requesterId, match.colors, {...options,interrupt:interrupted});
      playedCards.push({playerId:requesterId,cardId});

      // Decrement the current player's clock by the time taken for this turn
      const now = moveTime;
      const turnStarted = match.turnStartedAt ? (match.turnStartedAt.toDate ? match.turnStartedAt.toDate() : new Date(match.turnStartedAt)) : now;
      const elapsedMs = Math.max(0, now.getTime() - turnStarted.getTime());
      const clocks = { ...(match.clocks || {}) };
      const currentClock = Math.max(0, (Number(clocks[requesterId]) || 0) - (interrupted ? 0 : elapsedMs));
      clocks[requesterId] = currentClock;
      const timeOut = !interrupted && currentClock <= 0;

      const totalCards = match.participantIds.reduce((sum, id) => sum + (match.decks?.[id] || []).length, 0);
      const isFinished = timeOut || playedCards.length >= totalCards;
      const ownedCounts = match.participantIds.map(id => ({ id, count: board.filter(entry => entry?.ownerId === id).length }));
      const highestCount = Math.max(...ownedCounts.map(entry => entry.count));
      const winners = ownedCounts.filter(entry => entry.count === highestCount);
      const winnerId = timeOut ? opponentId : isFinished && winners.length === 1 ? winners[0].id : null;
      const remaining = id => (match.decks[id] || []).length - playedCards.filter(entry=>entry.playerId===id).length;
      const preferredTurn = interrupted ? match.turnPlayerId : opponentId;
      const nextTurn = isFinished ? null : remaining(preferredTurn)>0 ? preferredTurn : requesterId;
      const status = isFinished ? 'finished' : 'board';
      const turnStartedAtValue = isFinished ? null : interrupted ? match.turnStartedAt : now;
      let prizePaid = match.prizePaid === true;
      if (isFinished && !prizePaid && Number(match.prize || 0) > 0) {
        const firstUserRef = db.collection('users').doc(match.participantIds[0]);
        const secondUserRef = db.collection('users').doc(match.participantIds[1]);
        const firstUserDoc = await transaction.get(firstUserRef);
        const secondUserDoc = await transaction.get(secondUserRef);
        const prize = Number(match.prize);
        if (!firstUserDoc.exists || !secondUserDoc.exists || Number(firstUserDoc.data().balance || 0) < prize || Number(secondUserDoc.data().balance || 0) < prize) {
          throw new Error('A player cannot cover the agreed prize');
        }
        if (winnerId) {
          const winnerRef = db.collection('users').doc(winnerId);
          const loserId = otherBattlePlayer(match, winnerId);
          const loserRef = db.collection('users').doc(loserId);
          const winnerDoc = winnerId === match.participantIds[0] ? firstUserDoc : secondUserDoc;
          const loserDoc = loserId === match.participantIds[0] ? firstUserDoc : secondUserDoc;
          const battleBonus = roundFooty(Math.min(50, prize * (amuletEffects(winnerDoc.data()).battle || 0) / 100));
          transaction.update(winnerRef, { balance: Number(winnerDoc.data().balance || 0) + prize + battleBonus });
          transaction.update(loserRef, { balance: Number(loserDoc.data().balance || 0) - prize });
        }
        prizePaid = true;
      }
      transaction.update(matchRef, { board, playedCards, interruptsUsed, status, winnerId, prizePaid, turnPlayerId: nextTurn, clocks, turnStartedAt: turnStartedAtValue, updatedAt: new Date() });
      return { ...match, board, playedCards, interruptsUsed, status, winnerId, prizePaid, turnPlayerId: nextTurn, clocks, turnStartedAt: turnStartedAtValue, updatedAt: new Date() };
    });
    res.json(battleMatchView(req.params.matchId, result));
  } catch (error) {
    const expected = ['Choose a legal board space', 'Choose an attack side', 'Choose a special card to copy', 'Match not found', 'The board is not active', 'It is not your turn', 'That card is not in your deck', 'That board space is occupied', 'That card has already been played', 'That card is no longer available', 'A player cannot cover the agreed prize'];
    if (expected.includes(error.message)) return res.status(400).send(error.message);
    console.error('Place battle card error:', error);
    res.status(500).send('Could not place card');
  }
});

app.put('/admin/battle-cards/:cardId/power', async (req,res) => {
  if (!(await userIsAdmin(req.header('X-User-Id')))) return res.status(403).send('Forbidden');
  const mirrorPower=req.body?.mirrorPower;
  const familyName=String(req.body?.familyName||'').trim();
  if(familyName.length>80)return res.status(400).send('Family name is too long');
  if(mirrorPower&&!battleEngine.MIRROR_POWERS[mirrorPower])return res.status(400).send('Choose a valid Mirror power');
  try {
    const ref=db.collection('battleCards').doc(req.params.cardId);
    await db.runTransaction(async tx=>{
      const doc=await tx.get(ref);
      if(!doc.exists)throw new Error('Card not found');
      if(mirrorPower&&!battleEngine.isMirror(doc.data()))throw new Error('Choose a Mirror card');
      tx.update(ref,{...(mirrorPower?{mirrorPower}:{}),...(req.body?.familyName!==undefined?{familyName}:{})});
    });
    res.json({success:true,mirrorPower});
  }catch(error){res.status(400).send(error.message);}
});

app.post('/admin/battle-cards', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  if (!requesterId || !(await userIsAdmin(requesterId))) {
    return res.status(403).send('Forbidden');
  }

  const validation = validateBattleCard(req.body || {});
  if (!validation.valid) {
    return res.status(400).send(validation.error || 'Invalid battle card');
  }

  try {
    const card = validation.normalized;
    const cardRef = await db.collection('battleCards').add({
      ...card,
      createdAt: new Date()
    });

    res.status(201).json({ id: cardRef.id, card });
  } catch (error) {
    console.error('Error creating battle card:', error);
    res.status(500).send('Could not create battle card');
  }
});

app.delete('/admin/battle-cards/:cardId', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { cardId } = req.params;

  if (!requesterId || !(await userIsAdmin(requesterId))) {
    return res.status(403).send('Forbidden');
  }

  if (!cardId || typeof cardId !== 'string') {
    return res.status(400).send('Invalid battle card');
  }

  try {
    const ref = db.collection('battleCards').doc(cardId);
    const cardDoc = await ref.get();
    if (!cardDoc.exists) {
      return res.status(404).send('Battle card not found');
    }

    await ref.delete();
    const issuedItems = await db.collection('items').where('battleCardId', '==', cardId).get();
    for (let start = 0; start < issuedItems.docs.length; start += 500) {
      const batch = db.batch();
      issuedItems.docs.slice(start, start + 500).forEach(itemDoc => batch.delete(itemDoc.ref));
      await batch.commit();
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting battle card:', error);
    res.status(500).send('Could not delete battle card');
  }
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

    res.json({ id: newUser.id, username: cleanUsername, isAdmin: false, sessionToken: await brawlAuth.issue(newUser.id) });
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
    res.json({ id: userDoc.id, username: user.username, isAdmin: user.isAdmin === true, sessionToken: await brawlAuth.issue(userDoc.id) });
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
    const userId = req.query.userId;
    if (userId !== undefined && (typeof userId !== 'string' || !userId || userId.includes('/'))) {
      return res.status(400).send('Invalid userId');
    }
    // Self/account refreshes need one document; player pickers still need the directory.
    const snapshot = userId ? await usersRef.doc(userId).get() : await usersRef.get();
    const docs = userId ? (snapshot.exists ? [snapshot] : []) : snapshot.docs;

    const users = [];
    docs.forEach(doc => {
      const data = doc.data();
      users.push({
        id: doc.id,
        username: data.username,
        balance: data.balance,
        isAdmin: data.isAdmin === true,
        createdAt: serializeDate(data.createdAt),
        lastOnline: serializeDate(data.lastOnline),
        lastSpin: serializeDate(data.lastSpin),
        vipUntil: serializeDate(data.vipUntil)
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
  const cooldownMs = 7 * 60 * 60 * 1000;

  let nextSpinAt;
  try {
    const usersRef = db.collection('users');
    const userRef = usersRef.doc(userId);

    let rewardAmount;
    let baseReward;
    let newBalance;

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
      baseReward = rewardAmount;

      // If user has an active VIP, double the reward
      const vipUntil = user.vipUntil ? (user.vipUntil.toDate ? user.vipUntil.toDate() : new Date(user.vipUntil)) : null;
      if (vipUntil && vipUntil.getTime() > now.getTime()) {
        rewardAmount = rewardAmount * 2;
      }

      rewardAmount += amuletEffects(user).wheel || 0;
      const wheelSpinCount=(Number(user.wheelSpinCount)||0)+1;
      if(wheelSpinCount%3===0)rewardAmount+=amuletEffects(user).wheelstreak||0;
      newBalance = (user.balance || 0) + rewardAmount;
      nextSpinAt = new Date(now.getTime() + cooldownMs);

      transaction.update(userRef, {
        balance: newBalance,
        lastSpin: now,
        wheelSpinCount,
        lastSpinAmount: rewardAmount
      });
    });

    res.json({ amount: rewardAmount, baseReward, balance: newBalance, nextSpinAt: nextSpinAt.toISOString() });
  } catch (error) {
    console.error('Spin wheel error:', error);

    if (error.message === 'User not found') {
      return res.status(400).send(error.message);
    }

    if (error.message === 'Too soon') {
      return res.status(400).json({ error: 'You can only spin once every 7 hours.', nextSpinAt: nextSpinAt?.toISOString() });
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
    const viewerId = req.header('X-User-Id');
    const [snapshot, usersSnapshot, viewerDoc] = await Promise.all([
      itemsRef.get(),
      db.collection('users').where('isAdmin', '==', true).get(),
      typeof viewerId === 'string' && viewerId && !viewerId.includes('/')
        ? db.collection('users').doc(viewerId).get() : Promise.resolve(null)
    ]);
    const hostIds = new Set();
    usersSnapshot.forEach(doc => {
      if (doc.data().isAdmin === true) hostIds.add(doc.id);
    });

    const viewer=viewerDoc?.data()||{};
    const vipExpiry=viewer.vipUntil?.toDate ? viewer.vipUntil.toDate() : new Date(viewer.vipUntil||0);
    const viewerHasVip=vipExpiry.getTime()>Date.now();
    const now = Date.now();
    const items = [];
    const groupedListings = new Map();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.sold !== true && data.itemType !== 'battle-card') {
        const scheduledAt = data.scheduledAt ? (data.scheduledAt.toDate ? data.scheduledAt.toDate() : new Date(data.scheduledAt)) : null;
        const expiresAt = data.expiresAt ? (data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt)) : null;

        if (scheduledAt && scheduledAt.getTime() > now) return;
        if (expiresAt && expiresAt.getTime() <= now) return;

        const item = {
          id: doc.id,
          name: data.name || 'Unknown Item',
          price: data.price || 0,
          currency: data.currency || 'footy', currencyName: data.currencyName || 'Footy',
          sellerId: data.sellerId || '',
          isHostListing: hostIds.has(data.sellerId),
          imageUrl: data.imageUrl || null,
          itemType: data.itemType || (data.packId ? 'pack' : 'card'),
          packColor: data.packColor || '#667eea',
          packId: data.packId || null,
          limitOnePerUser: data.limitOnePerUser === true,
          listingGroupId: data.listingGroupId || null,
          perUserLimit: data.perUserLimit || null,
          stock: 1,
          sold: data.sold || false,
          createdAt: data.createdAt
        };
        item.vipDiscountPercent=item.isHostListing?vipPercent(data.vipDiscountPercent):0;
        item.vipPrice=vipPrice(item.price,item.vipDiscountPercent,item.currency);
        item.vipDiscountApplied=viewerHasVip&&item.vipDiscountPercent>0;
        const memberPrice=item.vipDiscountApplied?item.vipPrice:item.price;
        item.payablePrice=item.isHostListing&&item.currency==='footy'?discounted(memberPrice,amuletEffects(viewer).market):memberPrice;
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

    sortCardsByTier(items, await getAscendTierConfig());

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

    res.json(sortCardsByTier(files.map(name => ({ name })), await getAscendTierConfig()).map(card => card.name));
  } catch (error) {
    console.error('Error reading card images:', error);
    res.status(500).send('Error reading card images');
  }
});

/* ------------------ ASCEND TIERS ------------------ */
app.get('/ascend-tier-config', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  if (!requesterId || typeof requesterId !== 'string') {
    return res.status(401).send('Missing X-User-Id header');
  }

  try {
    const tiers = await getAscendTierConfig();
    res.json(tiers);
  } catch (error) {
    console.error('Error loading ascend tier config:', error);
    res.status(500).send('Could not load tier config');
  }
});

app.post('/ascend-tier-config', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { name, order, sellPrice, backgroundColor, nameColor, scoreColor } = req.body;

  if (!requesterId || !(await userIsAdmin(requesterId))) {
    return res.status(403).send('Forbidden');
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).send('Enter a tier name');
  }

  const tierOrder = Number(order);
  if (!Number.isInteger(tierOrder) || tierOrder < 0) {
    return res.status(400).send('Tier order must be a valid integer');
  }

  const tierSellPrice = Number(sellPrice);
  if (!Number.isFinite(tierSellPrice) || tierSellPrice < 0) {
    return res.status(400).send('Sell price must be a valid non-negative number');
  }

  const colors = normalizeTierColors({ backgroundColor, nameColor, scoreColor });

  try {
    const tierRef = db.collection('ascendTiers').doc();
    const tier = {
      name: name.trim(),
      order: tierOrder,
      sellPrice: tierSellPrice,
      cards: [],
      packs: [],
      ...colors,
      createdAt: new Date()
    };
    await tierRef.set(tier);
    res.status(201).json({ success: true, id: tierRef.id, ...tier });
  } catch (error) {
    console.error('Error creating tier:', error);
    res.status(500).send('Could not create tier');
  }
});

app.put('/ascend-tier-config/:tierId', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { tierId } = req.params;
  const { name, order, sellPrice, backgroundColor, nameColor, scoreColor } = req.body;

  if (!requesterId || !(await userIsAdmin(requesterId))) {
    return res.status(403).send('Forbidden');
  }
  if (!tierId || typeof tierId !== 'string') {
    return res.status(400).send('Invalid tier');
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).send('Enter a tier name');
  }

  const tierOrder = Number(order);
  if (!Number.isInteger(tierOrder) || tierOrder < 0) {
    return res.status(400).send('Tier order must be a valid integer');
  }

  const tierSellPrice = Number(sellPrice);
  if (!Number.isFinite(tierSellPrice) || tierSellPrice < 0) {
    return res.status(400).send('Sell price must be a valid non-negative number');
  }

  const colors = normalizeTierColors({ backgroundColor, nameColor, scoreColor });

  try {
    await db.collection('ascendTiers').doc(tierId).update({
      name: name.trim(),
      order: tierOrder,
      sellPrice: tierSellPrice,
      ...colors,
      updatedAt: new Date()
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating tier:', error);
    res.status(500).send('Could not update tier');
  }
});

app.delete('/ascend-tier-config/:tierId', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { tierId } = req.params;

  if (!requesterId || !(await userIsAdmin(requesterId))) {
    return res.status(403).send('Forbidden');
  }

  try {
    const tierRef = db.collection('ascendTiers').doc(tierId);
    const tierDoc = await tierRef.get();
    if (!tierDoc.exists) return res.status(404).send('Tier not found');
    await tierRef.delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting tier:', error);
    res.status(500).send('Could not delete tier');
  }
});

app.post('/ascend-tier-assignment', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { tierId, type, value, action } = req.body;

  if (!requesterId || !(await userIsAdmin(requesterId))) {
    return res.status(403).send('Forbidden');
  }
  if (!tierId || typeof tierId !== 'string') {
    return res.status(400).send('Invalid tier');
  }
  if (!['card', 'pack'].includes(type)) {
    return res.status(400).send('Invalid assignment type');
  }
  if (!value || typeof value !== 'string' || !value.trim()) {
    return res.status(400).send('Invalid value');
  }
  if (!['add', 'remove'].includes(action)) {
    return res.status(400).send('Invalid action');
  }

  try {
    const tierRef = db.collection('ascendTiers').doc(tierId);
    const tierDoc = await tierRef.get();
    if (!tierDoc.exists) return res.status(404).send('Tier not found');

    const tierData = tierDoc.data();
    const field = type === 'card' ? 'cards' : 'packs';
    const values = Array.isArray(tierData[field]) ? tierData[field] : [];
    const trimmed = type === 'card' ? path.basename(value.trim()) : value.trim();
    const nextValues = action === 'add'
      ? [...new Set([...values, trimmed])]
      : values.filter(entry => String(entry) !== String(trimmed));

    await tierRef.update({ [field]: nextValues, updatedAt: new Date() });
    res.json({ success: true, [field]: nextValues });
  } catch (error) {
    console.error('Error updating tier assignments:', error);
    res.status(500).send('Could not update tier assignments');
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

  const packGemRoll=crypto.randomInt(100);
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
      const openerRef = db.collection('users').doc(requesterId);
      const opener = await transaction.get(openerRef);
      const packBonus = amuletEffects(opener.data() || {}).pack || 0;
      const rubyBonus=packGemRoll<(amuletEffects(opener.data()||{}).packgem||0)?1:0;
      if(packBonus||rubyBonus)transaction.update(openerRef,{balance:roundFooty(Number(opener.data().balance||0)+packBonus),gems:{...(opener.data().gems||{}),bronze:Number(opener.data().gems?.bronze||0)+rubyBonus}});
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
      return { cardId, packBonus, rubyBonus, packColor: packItem.packColor || pack.color || '#667eea' };
    });
    res.json({ success: true, packBonus: result.packBonus, rubyBonus: result.rubyBonus, cardId: result.cardId, imageUrl: `/images/${result.cardId}`, packColor: result.packColor });
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
      for (let i = 0; i < qty; i++) {
        writes.push({
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
      }
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
app.delete('/admin/market-listings/planned/:planId', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  if (!requesterId || !(await userIsAdmin(requesterId))) return res.status(403).send('Forbidden');
  const { planId } = req.params;
  if (!planId || planId.includes('/')) return res.status(400).send('Invalid planned listing');
  try {
    await db.runTransaction(async transaction => {
      const ref = db.collection('marketListingPlans').doc(planId);
      const doc = await transaction.get(ref);
      if (!doc.exists) return;
      if (doc.data().status !== 'scheduled') {
        const error = new Error('This listing is no longer planned. Remove live stock from the marketplace instead.');
        error.status = 409; throw error;
      }
      transaction.delete(ref);
    });
    res.json({ success: true });
  } catch (error) {
    res.status(error.status || 500).send(error.message || 'Could not delete planned listing');
  }
});

app.post('/admin/market-listings/planned/:planId/dismiss', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  if (!requesterId || !(await userIsAdmin(requesterId))) return res.status(403).send('Forbidden');
  const { planId } = req.params;
  if (!planId || planId.includes('/')) return res.status(400).send('Invalid planned listing');
  try {
    await db.runTransaction(async transaction => {
      const ref = db.collection('marketListingPlans').doc(planId);
      const doc = await transaction.get(ref);
      if (!doc.exists) return;
      if (!['published', 'expired'].includes(doc.data().status)) {
        const error = new Error('Only published or expired notices can be dismissed');
        error.status = 409; throw error;
      }
      transaction.update(ref, { dismissed: true, dismissedAt: new Date() });
    });
    res.json({ success: true });
  } catch (error) {
    res.status(error.status || 500).send(error.message || 'Could not dismiss notice');
  }
});

app.get('/admin/market-listings/planned', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  if (!requesterId || !(await userIsAdmin(requesterId))) return res.status(403).send('Forbidden');

  try {
    const snapshot = await db.collection('marketListingPlans').orderBy('scheduledAt', 'asc').get();
    const plans = snapshot.docs.filter(doc => doc.data().dismissed !== true).map(doc => {
      const data = doc.data();
      const scheduledAt = data.scheduledAt ? (data.scheduledAt.toDate ? data.scheduledAt.toDate().toISOString() : new Date(data.scheduledAt).toISOString()) : null;
      const expiresAt = data.expiresAt ? (data.expiresAt.toDate ? data.expiresAt.toDate().toISOString() : new Date(data.expiresAt).toISOString()) : null;

      return {
        id: doc.id,
        itemType: data.itemType,
        productId: data.productId,
        productName: data.productName || data.productId,
        price: Number(data.price) || 0,
        quantity: Number(data.quantity) || 0,
        vipDiscountPercent: vipPercent(data.vipDiscountPercent),
        perUserLimit: Number(data.perUserLimit) || 0,
        scheduledAt,
        expiresAt,
        status: data.status || 'scheduled',
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : new Date(data.createdAt).toISOString()) : null
      };
    });

    res.json(plans);
  } catch (error) {
    console.error('Error loading planned marketplace listings:', error);
    res.status(500).send('Could not load planned listings');
  }
});

app.post('/admin/market-listings', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { itemType, productId, price, quantity, perUserLimit, scheduledAt, expiresAt, currency = 'footy', vipDiscountPercent = 0 } = req.body;
  const stock = Number(quantity);
  const maxPerUser = Number(perUserLimit) || 0;
  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  const expirationDate = expiresAt ? new Date(expiresAt) : null;

  if (!requesterId || !(await userIsAdmin(requesterId))) return res.status(403).send('Forbidden');
  if (!Number.isInteger(vipDiscountPercent) || vipDiscountPercent < 0 || vipDiscountPercent > 99) return res.status(400).send('VIP discount must be a whole percentage from 0 to 99');
  if (!['card', 'pack'].includes(itemType)) return res.status(400).send('Invalid item type');
  if (!isValidPositiveNumber(price)) return res.status(400).send('Invalid price');
  if (!Number.isInteger(stock) || stock < 1 || stock > 100) return res.status(400).send('Stock must be between 1 and 100');
  if (!Number.isInteger(maxPerUser) || maxPerUser < 0 || maxPerUser > stock) {
    return res.status(400).send('Maximum per user must be between 0 and the stock amount');
  }
  if (scheduledDate && Number.isNaN(scheduledDate.getTime())) return res.status(400).send('Scheduled time is invalid');
  if (expirationDate && Number.isNaN(expirationDate.getTime())) return res.status(400).send('Expiration time is invalid');
  if (scheduledDate && expirationDate && expirationDate.getTime() <= scheduledDate.getTime()) {
    return res.status(400).send('Expiration time must be after the scheduled time');
  }

  try {
    const money = await listingCurrency(currency);
    if (currency !== 'footy' && !Number.isSafeInteger(price)) return res.status(400).send('Gem prices must be whole numbers');
    if (scheduledDate && scheduledDate.getTime() > Date.now()) {
      const planRef = db.collection('marketListingPlans').doc();
      const plan = {
        sellerId: requesterId,
        itemType,
        productId,
        productName: productId,
        ...money,
        price,
        vipDiscountPercent,
        quantity: stock,
        perUserLimit: maxPerUser || null,
        scheduledAt: scheduledDate,
        expiresAt: expirationDate,
        status: 'scheduled',
        createdAt: new Date()
      };
      await planRef.set(plan);
      return res.status(201).json({ success: true, scheduled: true, listingPlanId: planRef.id, scheduledAt: scheduledDate.toISOString(), expiresAt: expirationDate ? expirationDate.toISOString() : null });
    }

    const groupId = await createMarketplaceListingEntries({
      sellerId: requesterId,
      currency,
      itemType,
      productId,
      price,
      vipDiscountPercent,
      quantity: stock,
      perUserLimit: maxPerUser,
      scheduledAt: null,
      expiresAt: expirationDate ? expirationDate.toISOString() : null
    });

    res.status(201).json({ success: true, stock, listingGroupId: groupId, scheduled: false });
  } catch (error) {
    console.error('Error creating marketplace listing:', error);
    res.status(500).send(error.message || 'Could not create marketplace listing');
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
  const { name, price, sellerId, sourceItemId, imageUrl, limitOnePerUser, currency = 'footy' } = req.body;
  if (req.header('X-User-Id') !== sellerId) return res.status(403).send('Forbidden');

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
    const money = await listingCurrency(currency);
    if (currency !== 'footy' && !Number.isSafeInteger(price)) return res.status(400).send('Gem prices must be whole numbers');
    const sellerDoc = await db.collection('users').doc(sellerId).get();

    if (!sellerDoc.exists) {
      return res.status(400).send('Seller not found');
    }

    await db.runTransaction(async transaction => {
    let sourceItem = null;
    // If listing from inventory, verify ownership and preserve its type (including packs).
    if (!sourceItemId && sellerDoc.data().isAdmin !== true) throw new Error('Select an inventory item');
    if (sourceItemId) {
      const sourceItemRef = db.collection('items').doc(sourceItemId);
      const sourceItemDoc = await transaction.get(sourceItemRef);
      if (!sourceItemDoc.exists || sourceItemDoc.data().buyerId !== sellerId || sourceItemDoc.data().sold !== true || sourceItemDoc.data().listedForSale === true || sourceItemDoc.data().itemType === 'battle-card') {
        throw new Error('Selected inventory item is unavailable');
      }
      sourceItem = sourceItemDoc.data();
      transaction.update(sourceItemRef, { listedForSale: true });
    }

    transaction.set(db.collection('items').doc(), {
      name: cleanName,
      price,
      ...money,
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

    });

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
  if (req.header('X-User-Id') !== buyerId) return res.status(403).send('Forbidden');

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
      if (item.sold || item.itemType === 'battle-card') throw new Error('Item unavailable');

      let listingGroupRef = null;
      let listingGroup = null;
      if (item.listingGroupId) {
        listingGroupRef = db.collection('marketListingGroups').doc(item.listingGroupId);
        const listingGroupDoc = await transaction.get(listingGroupRef);
        if (!listingGroupDoc.exists) throw new Error('Item unavailable');
        listingGroup = listingGroupDoc.data();
        const purchasedCount = Number(listingGroup.purchaseCounts && listingGroup.purchaseCounts[buyerId]) || 0;
        if (listingGroup.perUserLimit && purchasedCount >= listingGroup.perUserLimit) {
          throw new Error('You have reached this listing\'s purchase limit');
        }
      }

      const saleTime = value => value?.toDate ? value.toDate().getTime() : new Date(value).getTime();
      if (item.itemType === 'battle-card' || item.sold || (item.scheduledAt && saleTime(item.scheduledAt) > Date.now()) || (item.expiresAt && saleTime(item.expiresAt) <= Date.now())) {
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
      const currency = item.currency || 'footy';
      const hasHostDiscount = hasActiveVip && seller.isAdmin === true && vipPercent(item.vipDiscountPercent)>0;
      const sellerPayment = hasHostDiscount ? vipPrice(item.price,item.vipDiscountPercent,item.currency) : item.price;
      const purchasePrice = currency === 'footy' && seller.isAdmin === true ? discounted(sellerPayment, amuletEffects(buyer).market) : sellerPayment;
      if(req.body.expectedPrice!==undefined && req.body.expectedPrice!==purchasePrice)throw new Error('Price changed. Refresh the marketplace before buying.');
      const buyerFunds = currency === 'footy' ? Number(buyer.balance || 0) : Number((buyer.gems || {})[currency] || 0);
      if (!Number.isFinite(purchasePrice) || purchasePrice <= 0 || (currency !== 'footy' && !Number.isSafeInteger(purchasePrice))) throw new Error('Invalid listing price');
      if (buyerFunds < purchasePrice) {
        throw new Error('Not enough money');
      }

      // If the listing came from inventory, read the source item BEFORE performing writes
      let sourceItemRef = null;
      let sourceItemDoc = null;
      if (item.sourceItemId) {
        sourceItemRef = itemsRef.doc(item.sourceItemId);
        sourceItemDoc = await transaction.get(sourceItemRef);
        if (!sourceItemDoc.exists || sourceItemDoc.data().buyerId !== item.sellerId || sourceItemDoc.data().listedForSale !== true) throw new Error('Item unavailable');
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
      if (currency === 'footy') {
        transaction.update(buyerRef, { balance: roundFooty(buyerFunds - purchasePrice) });
        transaction.update(sellerRef, { balance: roundFooty(Number(seller.balance || 0) + sellerPayment) });
      } else {
        const buyerGems = { ...(buyer.gems || {}), [currency]: buyerFunds - purchasePrice };
        const sellerGems = { ...(seller.gems || {}), [currency]: Number((seller.gems || {})[currency] || 0) + sellerPayment };
        if (!Number.isSafeInteger(sellerGems[currency])) throw new Error('Gem balance too large');
        transaction.update(buyerRef, { gems: buyerGems });
        transaction.update(sellerRef, { gems: sellerGems });
      }

      transaction.update(itemRef, {
        sold: true,
        buyerId: buyerId,
        purchasedAt: new Date(),
        purchasePrice,
        sellerPayment,
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

      return { purchasePrice, hasHostDiscount, listedPrice: item.price, currencyName: item.currencyName || 'Footy' };
    });
    res.json({
      success: true,
      purchasePrice: purchase.purchasePrice,
      currencyName: purchase.currencyName,
      discountApplied: purchase.hasHostDiscount,
      discountAmount: purchase.listedPrice - purchase.purchasePrice
    });
  } catch (error) {
    console.error('Error buying item:', error);

    if (
      error.message === 'Price changed. Refresh the marketplace before buying.' ||
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
        amount: item.purchasePrice ?? item.price ?? 0,
        currencyName: item.currencyName || 'Footy',
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
        amount: item.sellerPayment ?? item.price ?? 0,
        currencyName: item.currencyName || 'Footy',
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

  try {
    const cleanedCardKey = path.basename(cardKey.trim());
    const tiers = await getAscendTierConfig();
    const currentTierIndex = tiers.findIndex(tier => (tier.cards || []).some(card => path.basename(String(card)) === cleanedCardKey));

    if (currentTierIndex === -1) {
      return res.status(400).send('This card is not assigned to any ascend tier');
    }
    if (currentTierIndex >= tiers.length - 1) {
      return res.status(400).send('This tier cannot be ascended any further');
    }

    const nextTier = tiers[currentTierIndex + 1];
    const rewardPackIds = Array.isArray(nextTier.packs) ? nextTier.packs : [];
    if (rewardPackIds.length === 0) {
      return res.status(400).send(`The ${nextTier.name} tier has no packs assigned yet`);
    }

    const itemsRef = db.collection('items');
    const snapshot = await itemsRef
      .where('buyerId', '==', requesterId)
      .where('sold', '==', true)
      .get();

    const matchingCards = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(item => item.itemType !== 'pack' && item.itemType !== 'battle-card' && item.listedForSale !== true)
      .filter(item => item.imageUrl && path.basename(item.imageUrl) === cleanedCardKey);

    if (matchingCards.length < 3) {
      return res.status(400).send('You need 3 copies of this card to ascend');
    }

    const selectedCards = matchingCards.slice(0, 3);
    const chosenPackId = rewardPackIds[Math.floor(Math.random() * rewardPackIds.length)];
    const packDoc = await db.collection('packs').doc(chosenPackId).get();
    if (!packDoc.exists) {
      return res.status(400).send('The configured reward pack is missing');
    }

    const pack = packDoc.data();
    const packName = pack.name || 'Pack';

    await db.runTransaction(async transaction => {
      const ascendUserRef = db.collection('users').doc(requesterId);
      const ascendUser = await transaction.get(ascendUserRef);
      const latestCards = await transaction.getAll(...selectedCards.map(card => itemsRef.doc(card.id)));
      if (latestCards.some(doc => !doc.exists || doc.data().buyerId !== requesterId || doc.data().listedForSale === true)) throw new Error('Selected cards are no longer available');
      const ascendBonus = amuletEffects(ascendUser.data() || {}).ascend || 0;
      if (ascendBonus) transaction.update(ascendUserRef, { balance: roundFooty(Number(ascendUser.data().balance || 0) + ascendBonus) });
      selectedCards.forEach(card => {
        transaction.delete(itemsRef.doc(card.id));
      });

      transaction.set(itemsRef.doc(), {
        name: `${packName} Pack`,
        itemType: 'pack',
        packId: chosenPackId,
        packColor: pack.color || '#667eea',
        price: 0,
        sellerId: requesterId,
        sold: true,
        buyerId: requesterId,
        purchasedAt: new Date(),
        sourceItemId: null,
        imageUrl: null,
        createdAt: new Date()
      });
    });

    res.json({ success: true, packName: `${packName} Pack`, nextTier: nextTier.name });
  } catch (error) {
    console.error('Error ascending card:', error);
    res.status(500).send(error.message || 'Could not ascend card');
  }
});

app.post('/sell-tier-card', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { itemId } = req.body;

  if (!requesterId || typeof requesterId !== 'string') {
    return res.status(401).send('Missing X-User-Id header');
  }
  if (!itemId || typeof itemId !== 'string') {
    return res.status(400).send('Invalid inventory item');
  }

  try {
    const itemRef = db.collection('items').doc(itemId);
    const itemDoc = await itemRef.get();
    if (!itemDoc.exists) return res.status(404).send('Inventory item not found');

    const item = itemDoc.data();
    if (item.buyerId !== requesterId || item.sold !== true || item.listedForSale === true || (item.itemType === 'pack' || item.itemType === 'battle-card')) {
      return res.status(400).send('This item cannot be sold');
    }

    const tier = await findTierForCard(item.imageUrl ? path.basename(item.imageUrl) : item.name);
    if (!tier || !(Number(tier.sellPrice) > 0)) {
      return res.status(400).send('This card tier does not have a sell price configured');
    }

    const userRef = db.collection('users').doc(requesterId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).send('User not found');

    const amount = await db.runTransaction(async transaction => {
      const latestUserDoc = await transaction.get(userRef);
      const latestItem = await transaction.get(itemRef);
      if (!latestItem.exists || latestItem.data().buyerId !== requesterId || latestItem.data().listedForSale === true) throw new Error('Card no longer available');
      const latestUser = latestUserDoc.data() || {};
      const updatedBalance = roundFooty(Number(latestUser.balance || 0) + Number(tier.sellPrice) * (1 + (amuletEffects(latestUser).salvage || 0) / 100));

      transaction.update(userRef, { balance: updatedBalance });
      transaction.delete(itemRef);
      return roundFooty(updatedBalance - Number(latestUser.balance || 0));
    });

    res.json({ success: true, amount });
  } catch (error) {
    console.error('Error selling card to tier:', error);
    res.status(500).send(error.message || 'Could not sell this card');
  }
});

app.get('/gem-converter', async (req, res) => {
  const userId = req.header('X-User-Id');
  if (!userId) return res.status(401).send('Missing X-User-Id header');
  try {
    const [user, tiers] = await Promise.all([db.collection('users').doc(userId).get(), getAscendTierConfig()]);
    if (!user.exists) return res.status(404).send('User not found');
    const progress = converterProgress(tiers, user.data());
    const recipes = tiers.map((tier, index) => ({
      ...gemIdentity(tier), cards: tier.cards || [], unlocked: index <= progress.level,
      rewards:[3,7,12+(amuletEffects(user.data()).fullbatch||0)],
      costs: Number(tier.sellPrice) > 0 ? [1, 2, 3].map(count => discounted(gemRecipe(tier, count).cost, amuletEffects(user.data()).converter)) : null
    }));
    res.json({ ...progress, recipes, gems: user.data().gems || {}, balance: Number(user.data().balance || 0) });
  } catch (error) {
    console.error('Error loading gem converter:', error);
    res.status(500).send('Could not load gem converter');
  }
});

app.post('/grant-gems', async (req, res) => {
  const requesterId = req.header('X-User-Id');
  const { userId, tierId, quantity } = req.body;
  if (!requesterId) return res.status(401).send('Missing X-User-Id header');
  if (typeof userId !== 'string' || !userId || userId.includes('/') ||
      typeof tierId !== 'string' || !tierId || tierId.includes('/') ||
      !Number.isSafeInteger(quantity) || quantity <= 0) return res.status(400).send('Choose a player, gem and positive whole quantity');
  try {
    const result = await db.runTransaction(async transaction => {
      const targetRef = db.collection('users').doc(userId);
      const [requester, target, tier] = await transaction.getAll(
        db.collection('users').doc(requesterId), targetRef, db.collection('ascendTiers').doc(tierId));
      if (!requester.exists || requester.data().isAdmin !== true) {
        const error = new Error('Forbidden'); error.status = 403; throw error;
      }
      if (!target.exists || !tier.exists) throw new Error('Player or gem tier not found');
      const gem = gemIdentity({ ...tier.data(), id: tier.id });
      const gems = { ...(target.data().gems || {}) };
      const total = Number(gems[gem.gemKey] || 0) + quantity;
      if (!Number.isSafeInteger(total) || total < 0) throw new Error('Gem balance exceeds the supported amount');
      gems[gem.gemKey] = total;
      transaction.update(targetRef, { gems });
      return { gemName: gem.gemName, quantity, total };
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 400).send(error.message || 'Could not grant gems');
  }
});

app.post('/gem-converter/upgrade', async (req, res) => {
  const userId = req.header('X-User-Id');
  if (!userId) return res.status(401).send('Missing X-User-Id header');
  if (typeof req.body.tierId !== 'string') return res.status(400).send('Choose the next upgrade');
  try {
    const result = await db.runTransaction(async transaction => {
      const userRef = db.collection('users').doc(userId);
      const user = await transaction.get(userRef);
      const tierSnapshot = await transaction.get(db.collection('ascendTiers').orderBy('order', 'asc'));
      if (!user.exists) throw new Error('User not found');
      const tiers = tierSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      const update = upgradeConverter(tiers, user.data(), req.body.tierId);
      transaction.update(userRef, update);
      return update;
    });
    res.json(result);
  } catch (error) {
    res.status(400).send(error.message || 'Could not upgrade converter');
  }
});

app.post('/gem-converter', async (req, res) => {
  const userId = req.header('X-User-Id');
  if (!userId) return res.status(401).send('Missing X-User-Id header');
  const { tierId, itemIds } = req.body;
  if (typeof tierId !== 'string' || !tierId || tierId.includes('/') || !Array.isArray(itemIds) ||
    itemIds.length < 1 || itemIds.length > 3 || new Set(itemIds).size !== itemIds.length ||
    itemIds.some(id => typeof id !== 'string' || !id || id.includes('/'))) {
    return res.status(400).send('Choose a tier and one to three different cards');
  }
  const converterRoll=crypto.randomInt(100);
  try {
    const result = await db.runTransaction(async transaction => {
      const userRef = db.collection('users').doc(userId);
      const refs = itemIds.map(id => db.collection('items').doc(id));
      const [user, tierDoc, ...cards] = await transaction.getAll(userRef, db.collection('ascendTiers').doc(tierId), ...refs);
      if (!user.exists || !tierDoc.exists) throw new Error('User or tier no longer exists');
      const tierSnapshot = await transaction.get(db.collection('ascendTiers').orderBy('order', 'asc'));
      requireUnlockedTier(tierSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })), user.data(), tierId);
      const tier = { ...tierDoc.data(), id: tierDoc.id };
      validateGemCards(cards.map(card => card.exists ? card.data() : null), itemIds, tier, userId);
      const recipe = gemRecipe(tier, itemIds.length);
      recipe.cost = discounted(recipe.cost, amuletEffects(user.data()).converter);
      const vipDate=user.data().vipUntil;
      const vipExpiry=vipDate?.toDate?vipDate.toDate():new Date(vipDate||0);
      recipe.vipBonus=vipExpiry.getTime()>Date.now()&&converterRoll<20?1:0;
      recipe.amuletBonus=itemIds.length===3?(amuletEffects(user.data()).fullbatch||0):0;
      recipe.reward+=recipe.vipBonus+recipe.amuletBonus;
      const balance = Number(user.data().balance || 0);
      if (!Number.isFinite(balance) || balance < recipe.cost) throw new Error('Not enough Footy');
      const gems = { ...(user.data().gems || {}) };
      gems[recipe.gemKey] = Number(gems[recipe.gemKey] || 0) + recipe.reward;
      const newBalance = Math.round((balance - recipe.cost) * 100) / 100;
      transaction.update(userRef, { balance: newBalance, gems });
      refs.forEach(ref => transaction.delete(ref));
      return { ...recipe, gems, balance: newBalance };
    });
    res.json(result);
  } catch (error) {
    res.status(400).send(error.message || 'Could not convert cards');
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
      if (data.listedForSale !== true && data.itemType !== 'battle-card') {
        inventoryItems.push({
          id: doc.id,
          ...data
        });
      }
    });

    sortCardsByTier(inventoryItems, await getAscendTierConfig());

    res.json(inventoryItems);
  } catch (error) {
    console.error('Error getting inventory:', error);
    res.status(500).send('Error retrieving inventory');
  }
});

require('./amulet-routes')(app, db, getAscendTierConfig);
require('./trophy-routes')(app, db, getBattleCardsForUser, brawlAuth.authenticate);
require('./gem-workshop-routes')(app, db, getAscendTierConfig);

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
      newVipUntil = new Date(baseTime + DURATION_MS + (amuletEffects(user).vipdays || 0) * oneDayMs);
      const vipPrice = discounted(VIP_PRICE, amuletEffects(user).vip);

      if ((user.balance || 0) < vipPrice) {
        throw new Error('Not enough money');
      }

      newBalance = roundFooty((user.balance || 0) - vipPrice);

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
