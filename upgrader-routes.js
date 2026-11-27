const upgrades = require('./card-upgrades');
const catalog = require('./public/upgrader-catalog');
const { createCardReader, cardId, imageFilenames } = require('./card-data');

module.exports = function (app, db, authenticate, project) {
  const read = createCardReader(project);
  function route(method, path, handler) {
    app[method](path, async (req, res) => {
      res.set('Cache-Control', 'no-store');
      let owner;
      try { owner = await authenticate(req); }
      catch { return res.status(401).json({ error: 'Please log in again.' }); }
      try { return res.json(await handler(owner, req.body || {}, req.query)); }
      catch (error) { return res.status(error.status === 403 ? 403 : 400).json({ error: error.message }); }
    });
  }

  route('get', '/upgraders', async (owner, body, query) => {
    const counts = (await upgrades.wallet(db, owner).get()).data()?.counts ?? {};
    if (!query.token) return { counts };
    const token = catalog.get(query.token);
    if (!['upgradeToken', 'cardXpPotion'].includes(token?.kind)) throw Error('Choose an upgrader or potion.');
    return { counts, cards: await listCards(owner, token) };
  });

  route('get', '/upgraders/favourites', async (owner, body, query) => {
    const slots = upgrades.favouriteSlots((await upgrades.favourites(db, owner).get()).data());
    if (query.select === '1') {
      const [items, variants, preparations, catalogue] = await Promise.all([
        db.collection('items').where('buyerId', '==', owner).where('sold', '==', true).get(),
        upgrades.variants(db, owner).get(), upgrades.progressForOwner(db, owner).get(), imageFilenames(project)
      ]);
      const lookup = {
        variants: new Map(variants.docs.map(doc => [doc.id, doc.data()])),
        progress: new Map(preparations.docs.map(doc => [doc.id, doc.data()])),
        catalogue, details: new Map()
      };
      const cards = await Promise.all(items.docs.map(doc => favouriteCard(owner, doc, lookup)));
      return { slots, cards: cards.filter(Boolean) };
    }
    return { slots: await Promise.all(slots.map(async id => id
      ? await favouriteCard(owner, await db.collection('items').doc(id).get()) ?? { unavailable: true }
      : null)) };
  });

  async function favouriteCard(owner, doc, lookup) {
    const item = doc.data();
    const name = upgrades.ownedCardFilename(item, owner, { includeListed: true });
    if (!name || !upgrades.inventoryKey(doc.id)) return null;
    if (lookup && !lookup.details.has(name)) lookup.details.set(name, read(name, lookup.catalogue));
    const [card, variant, preparation] = await Promise.all([
      lookup ? lookup.details.get(name) : read(name),
      lookup ? lookup.variants.get(doc.id) : upgrades.variant(db, doc.id).get().then(doc => doc.data()),
      lookup ? lookup.progress.get(doc.id) : upgrades.progress(db, doc.id).get().then(doc => doc.data())
    ]);
    const upgrade = variant?.ownerId === owner && variant.baseCardId === cardId(name) ? variant : null;
    return { itemId: doc.id, name: card?.name ?? item.name ?? name,
      imageUrl: '/images/' + encodeURIComponent(name),
      level: upgrade?.level ?? 'normal', upgrade,
      tier: card?.tier ?? null, overall: upgrade?.currentOverall ?? card?.overall ?? null,
      effectiveness: upgrades.effectiveness(preparation, owner) };
  }

  route('post', '/upgraders/favourites', (owner, { slot, itemId }) => {
    if (!Number.isInteger(slot) || slot < 0 || slot >= upgrades.favouriteCount ||
        (itemId !== null && !upgrades.inventoryKey(itemId))) throw Error('Choose a valid favourite card slot.');
    return db.runTransaction(async tx => {
      const ref = upgrades.favourites(db, owner);
      const slots = upgrades.favouriteSlots((await tx.get(ref)).data());
      if (itemId !== null) {
        const item = (await tx.get(db.collection('items').doc(itemId))).data();
        if (!upgrades.ownedCardFilename(item, owner, { includeListed: true })) throw Error('Choose a card you own.');
        if (slots.some((id, index) => index !== slot && id === itemId)) throw Error('This card instance is already equipped.');
      }
      slots[slot] = itemId;
      tx.set(ref, { slots });
      return { slots };
    });
  });

  async function listCards(owner, token) {
    const isUpgrade = token?.kind === 'upgradeToken';
    const [items, records, catalogue] = await Promise.all([
      db.collection('items').where('buyerId', '==', owner).where('sold', '==', true).get(),
      upgrades.variants(db, owner).get(),
      imageFilenames(project)
    ]);
    const owned = new Map(records.docs.map(doc => [doc.id, doc.data()]));
    const details = new Map();
    const cards = await Promise.all(items.docs.map(async doc => {
      const name = upgrades.ownedCardFilename(doc.data(), owner);
      if (!name) return null;
      if (!details.has(name)) details.set(name, read(name, catalogue));
      const card = await details.get(name);
      let previous = owned.get(doc.id);
      if (isUpgrade) {
        if (!upgrades.inventoryKey(doc.id) || upgradeError(card, previous, token, records, owner, name)) return null;
        // A transferred instance can have an older variant outside the current owner's query.
        previous ??= (await upgrades.variant(db, doc.id).get()).data();
        if (previous && upgradeError(card, previous, token, records, owner, name)) return null;
      }
      const preparation = await upgrades.progress(db, doc.id).get();
      const effectiveness = upgrades.effectiveness(preparation.data(), owner);
      const error = token?.kind === 'cardXpPotion' && effectiveness >= token.target ? 'This potion would have no effect.' : '';
      return { itemId: doc.id, name: card?.name ?? 'Collection card', imageUrl: '/images/' + encodeURIComponent(name),
        level: previous?.level ?? 'normal', upgrade: previous ?? null, error, effectiveness };
    }));
    const available = cards.filter(Boolean);
    return isUpgrade ? available.sort((a, b) => b.effectiveness - a.effectiveness ||
      a.name.localeCompare(b.name) || a.itemId.localeCompare(b.itemId)) : available;
  }

  function upgradeError(card, previous, token, owned, owner, filename) {
    if (previous && (previous.ownerId !== owner || previous.baseCardId !== cardId(filename))) {
      return 'This card is no longer available in your inventory.';
    }
    const base = card && previous ? { ...card, stats: previous.baseStats } : card;
    return upgrades.eligible(base, previous, token) ||
      (upgrades.duplicate(owned, card.id, token.level) ? 'You already own this variant.' : '');
  }

  async function requireAdmin(actor) {
    if ((await db.collection('users').doc(actor).get()).data()?.isAdmin !== true) {
      throw Object.assign(Error('Administrator access is required.'), { status: 403 });
    }
  }
  route('get', '/upgraders/admin', async (actor, body, query) => {
    await requireAdmin(actor);
    if (query.player) {
      if (!upgrades.inventoryKey(query.player)) throw Error('Invalid player.');
      return { cards: await listCards(query.player) };
    }
    return { players: (await db.collection('users').get()).docs.map(doc => ({
      id: doc.id, name: doc.data().username || 'Unnamed player'
    })) };
  });

  function transaction(owner, body, signature, handler) {
    if (typeof body.requestId !== 'string' || !/^[\w-]{8,80}$/.test(body.requestId)) throw Error('Invalid request ID.');
    return db.runTransaction(async tx => {
      const ref = upgrades.wallet(db, owner);
      const receipt = ref.collection('requests').doc(body.requestId);
      const [prior, snapshot] = await Promise.all([tx.get(receipt), tx.get(ref)]);
      if (prior.exists) {
        if (prior.data().signature !== signature) throw Error('This request ID has already been used.');
        return { ...prior.data().result, counts: snapshot.data()?.counts ?? {} };
      }
      const counts = { ...snapshot.data()?.counts };
      const result = await handler(tx, counts);
      tx.set(ref, { counts });
      tx.set(receipt, { signature, result });
      return result;
    });
  }

  route('post', '/upgraders/craft', (owner, body) => {
    const { inputs, output } = upgrades.recipe(body.level, body.tier, body.shards);
    return transaction(owner, body, JSON.stringify(['craft', output, ...inputs.slice().sort()]), (tx, counts) => {
      inputs.forEach(id => upgrades.moveQuantity(counts, id, -1));
      upgrades.moveQuantity(counts, output, 1);
      app.locals?.events?.record(tx, owner, 'craft:' + body.requestId, ['CRAFT_UPGRADER'], { level: body.level, tier: body.tier });
      return { token: output, counts };
    });
  });

  async function ownedCard(tx, owner, itemId) {
    if (!upgrades.inventoryKey(itemId)) throw Error('Invalid card selection.');
    const item = (await tx.get(db.collection('items').doc(itemId))).data();
    if (!upgrades.ownedCardFilename(item, owner)) throw Error('This card is no longer available in that collection.');
  }

  route('post', '/upgraders/potion', (owner, body) => {
    const potion = catalog.get(body.token);
    if (potion?.kind !== 'cardXpPotion') throw Error('Choose a Card XP Potion.');
    return transaction(owner, body, JSON.stringify(['potion', body.itemId, potion.id]), async (tx, counts) => {
      await ownedCard(tx, owner, body.itemId);
      const ref = upgrades.progress(db, body.itemId);
      const current = upgrades.effectiveness((await tx.get(ref)).data(), owner);
      if (current >= potion.target) throw Error('This potion would have no effect.');
      upgrades.moveQuantity(counts, potion.id, -1);
      tx.set(ref, { ownerId: owner, value: potion.target });
      return { effectiveness: potion.target, counts };
    });
  });

  route('post', '/upgraders/admin', async (actor, body) => {
    await requireAdmin(actor);
    const potion = catalog.get(body.token);
    const owner = body.player;
    if (!upgrades.inventoryKey(owner) || potion?.kind !== 'cardXpPotion' || !['grant', 'set'].includes(body.action)) {
      throw Error('Choose a player, potion and action.');
    }
    return transaction(owner, body, JSON.stringify([actor, body.action, body.itemId, potion.id]), async (tx, counts) => {
      if (!(await tx.get(db.collection('users').doc(owner))).exists) throw Error('Player not found.');
      if (body.action === 'grant') upgrades.moveQuantity(counts, potion.id, 1);
      else {
        await ownedCard(tx, owner, body.itemId);
        tx.set(upgrades.progress(db, body.itemId), { ownerId: owner, value: potion.target });
      }
      return { counts, ...(body.action === 'set' ? { effectiveness: potion.target } : {}) };
    });
  });

  route('post', '/upgraders/apply', (owner, body) => {
    if (!upgrades.inventoryKey(body.itemId)) throw Error('Invalid card selection.');
    const token = catalog.get(body.token);
    return transaction(owner, body, JSON.stringify(['apply', body.itemId, body.token]), async (tx, counts) => {
      const itemRef = db.collection('items').doc(body.itemId);
      const variantRef = upgrades.variant(db, body.itemId);
      const preparationRef = upgrades.progress(db, body.itemId);
      const [item, existing, owned, preparation] = await Promise.all([
        tx.get(itemRef), tx.get(variantRef), tx.get(upgrades.variants(db, owner)), tx.get(preparationRef)
      ]);
      const data = item.data();
      const name = upgrades.ownedCardFilename(data, owner);
      const previous = existing.data();
      if (!name) {
        throw Error('This card is no longer available in your inventory.');
      }
      const card = await read(name);
      const base = previous ? { ...card, stats: previous.baseStats } : card;
      const error = upgradeError(card, previous, token, owned, owner, name);
      if (error) throw Error(error);
      upgrades.moveQuantity(counts, token.id, -1);
      const upgrade = { ...upgrades.roll(base, token, undefined, previous,
        upgrades.effectiveness(preparation.data(), owner)), createdAt: Date.now() };
      tx.set(variantRef, { ...upgrade, ownerId: owner });
      tx.set(preparationRef, { ownerId: owner, value: 0 });
      tx.update(itemRef, { upgrade });
      app.locals?.events?.record(tx, owner, 'upgrade:' + body.requestId, ['UPGRADE_CARD_TO_' + token.level.toUpperCase()],
        { tier: token.tier });
      return { upgrade, card: { name: card.name, imageUrl: card.imageUrl, overall: upgrade.currentOverall }, counts };
    });
  });
};
