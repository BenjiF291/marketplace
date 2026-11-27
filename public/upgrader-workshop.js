(() => {
  const { definitions, tiers, id, get } = UpgraderCatalog;
  const inventory = document.getElementById('upgraderInventory');
  const dialog = document.createElement('dialog');
  dialog.className = 'upgrader-workshop';
  dialog.setAttribute('aria-labelledby', 'upgraderTitle');
  document.body.append(dialog);
  let counts = {}, busy = false, refreshId = 0, pending, potionPanel;
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const button = (text, action, className = 'btn') => {
    const result = node('button', text, className);
    result.type = 'button';
    result.onclick = action;
    return result;
  };
  const quantity = key => counts[key] || 0;
  const label = key => get(key).name;
  const missingArt = new Set();
  function itemArt(key, eager = false) {
    const frame = node('span', '', 'upgrader-art');
    const source = UpgraderCatalog.artwork(key);
    if (!source || missingArt.has(source)) { frame.hidden = true; return frame; }
    const image = node('img');
    image.alt = '';
    image.decoding = 'async';
    image.loading = eager ? 'eager' : 'lazy';
    image.style.visibility = 'hidden';
    image.onload = () => { image.style.visibility = ''; };
    image.onerror = () => { missingArt.add(source); frame.remove(); };
    if (!eager) image.fetchPriority = 'low';
    image.src = source;
    frame.append(image);
    return frame;
  }
  async function request(path = '', body) {
    const response = await fetch(API_URL + '/upgraders' + path, {
      headers: resourceHeaders(), ...(body ? { method: 'POST', body: JSON.stringify(body) } : {})
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) throw Error(result?.error || (response.status === 404
      ? 'The server does not provide the upgrader service.' : 'Could not complete the upgrader request.'));
    return result;
  }
  function holdings(title, entries, showEmpty = false) {
      const section = node('section');
      const list = node('div', '', 'upgrader-holdings');
      for (const entry of entries) {
        if (!showEmpty && !quantity(entry.id)) continue;
        const tile = node('div', '', 'upgrader-tile');
        if (entry.tier) tile.dataset.tier = entry.tier.toLowerCase();
        if (entry.level) tile.dataset.upgrade = entry.level;
        tile.dataset.empty = String(!quantity(entry.id));
        tile.title = entry.description;
        tile.append(itemArt(entry.id), node('strong', label(entry.id)), node('span', 'Owned: ' + quantity(entry.id), 'upgrader-quantity'));
        if (entry.tier) tile.append(node('small', entry.tier));
        if (entry.kind === 'upgradeToken') {
          const use = button('Use Upgrader', () => chooseCard(entry));
          use.disabled = !quantity(entry.id);
          tile.append(use);
        }
        if (entry.kind === 'cardXpPotion') tile.append(button('Use Potion', () => chooseCard(entry)));
        list.append(tile);
      }
      section.append(node('h3', title), list.childElementCount ? list : node('p', 'None owned'));
      return section;
  }
  function updatePotions() {
    if (potionPanel?.isConnected) potionPanel.replaceChildren(holdings('Card XP Potions', UpgraderCatalog.rewards.cardXpPotion));
  }
  function refresh() {
    if (pending) return pending;
    const current = ++refreshId;
    pending = request().then(result => {
      if (!result.counts || typeof result.counts !== 'object' || Array.isArray(result.counts)) {
        throw Error('The server did not return upgrader inventory.');
      }
      if (current === refreshId) {
        counts = result.counts ?? {};
        updatePotions();
      }
      return null;
    }).catch(error => error.message).finally(() => { pending = null; });
    return pending;
  }
  function shell(title) {
    dialog.classList.remove('favourite-picker-dialog');
    const heading = node('h2', title);
    heading.id = 'upgraderTitle';
    const header = node('header');
    const titleBlock = node('div');
    titleBlock.append(heading);
    if (title === 'Upgrader Workshop') titleBlock.append(node('p', 'Forge powerful upgraders from rare materials.'));
    header.append(titleBlock, button('Close', () => { if (!busy) dialog.close(); }));
    const content = node('div');
    const status = node('div', '', 'upgrader-status');
    status.setAttribute('role', 'status');
    dialog.replaceChildren(header, content, status);
    if (!dialog.open) dialog.showModal();
    return { content, status };
  }
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  async function commit(path, payload, control, status, success) {
    if (busy) return;
    busy = control.disabled = true;
    dialog.querySelector('header button').disabled = true;
    try {
      const result = await request(path, payload);
      refreshId++;
      counts = result.counts;
      updatePotions();
      success(result);
    } catch (error) {
      status.textContent = error.message;
      control.disabled = false;
      dialog.querySelector('header button').disabled = false;
    } finally { busy = false; }
  }
  async function openWorkshop() {
    const { content, status } = shell('Upgrader Workshop');
    status.textContent = 'Loading workshop inventory…';
    const error = await refresh();
    if (!dialog.open || !content.isConnected) return;
    if (error) {
      status.textContent = 'Workshop inventory is unavailable. ' + error;
      return;
    }
    workshop();
  }
  function workshop(award) {
    const { content, status } = shell('Upgrader Workshop');
    let level = 'epic', tier = '', shards = ['', ''], requestId = crypto.randomUUID();
    let view = 'Crafting';
    let lastRecipe;
    if (award) {
      const reveal = node('section', '', 'upgrader-forge-reveal');
      reveal.dataset.upgrade = get(award.token).level;
      const orbit = node('div', '', 'upgrader-forge-orbit');
      for (const key of award.ingredients) orbit.append(itemArt(key, true));
      reveal.append(orbit, itemArt(award.token, true), node('strong', label(award.token) + ' crafted'),
        button('Skip animation', () => reveal.classList.add('is-skipped')));
      status.append(reveal);
      requestAnimationFrame(() => reveal.scrollIntoView({ block: 'nearest' }));
    }
    function update() {
      const focused = content.contains(document.activeElement) ? document.activeElement.dataset.forgeControl : '';
      const recipeKey = [level, tier, ...shards].join(':');
      if (lastRecipe !== recipeKey) requestId = crypto.randomUUID();
      lastRecipe = recipeKey;
      const toggle = node('div', '', 'upgrader-controls upgrader-modes');
      for (const mode of ['epic', 'legendary']) {
        const choice = button(mode === 'epic' ? 'Epic Crafting' : 'Legendary Crafting', () => {
          level = mode;
          shards = ['', ''];
          update();
        });
        choice.setAttribute('aria-pressed', String(level === mode));
        choice.dataset.upgrade = mode;
        choice.dataset.forgeControl = mode;
        toggle.append(choice);
      }
      const layout = node('div', '', 'upgrader-layout');
      layout.dataset.upgrade = level;
      const selectors = node('section', '', 'upgrader-selectors');
      const slots = node('div', '', 'upgrader-altar');
      slots.dataset.mode = level;
      function select(title, options, selected, change) {
        const group = node('fieldset', '', 'upgrader-choices');
        group.append(node('legend', title));
        const grid = node('div', '', 'upgrader-choice-grid');
        for (const { key, value, reason } of options) {
          const option = button(get(key).tier, () => change(value), 'upgrader-ingredient-choice');
          option.disabled = Boolean(reason);
          option.title = reason || label(key);
          option.setAttribute('aria-pressed', String(key === selected));
          option.dataset.tier = get(key).tier.toLowerCase();
          option.dataset.forgeControl = title + ':' + key;
          option.prepend(itemArt(key));
          option.append(node('small', reason || '×' + quantity(key)));
          grid.append(option);
        }
        group.append(grid);
        selectors.append(group);
      }
      select('Core', tiers.map(value => ({ key: id('core', value), value })), tier ? id('core', tier) : '',
        value => { tier = value; shards = ['', '']; update(); });
      const required = level === 'legendary' ? tiers.filter(value => value !== tier) : shards;
      if (level === 'epic') {
        shards.forEach((picked, index) => select('Shard ' + (index + 1),
          tiers.map(value => ({ key: id('shard', value), value,
            reason: value === tier ? 'Matches the core' : shards[1 - index] === value ? 'Already selected' :
              !quantity(id('shard', value)) ? 'Missing' : '' })),
          picked ? id('shard', picked) : '', value => { shards[index] = value; update(); }));
      }
      const selectedIngredients = [
        tier ? id('core', tier) : '',
        ...(tier || level === 'epic' ? required.map(value => value && id('shard', value)) : Array(5).fill(''))
      ];
      selectedIngredients.forEach((key, index) => {
        const slot = node('div', '', 'upgrader-slot');
        if (key) {
          slot.dataset.tier = get(key).tier.toLowerCase();
          slot.dataset.missing = String(!quantity(key));
          slot.append(itemArt(key, true));
        }
        slot.append(node('strong', key ? get(key).tier : index ? 'Shard' : 'Core'),
          node('small', key ? '×' + quantity(key) : 'Empty'));
        slots.append(slot);
      });
      const preview = node('div', '', 'upgrader-result');
      preview.append(node('strong', tier ? label(id(level, tier)) : 'Choose a core'));
      if (tier) {
        preview.prepend(itemArt(id(level, tier), true));
        const ingredients = [id('core', tier), ...required.filter(Boolean).map(value => id('shard', value))];
        const list = node('ul', '', 'upgrader-ingredients');
        for (const key of ingredients) list.append(node('li', label(key) + ' × 1 · ' + quantity(key) + ' owned'));
        preview.append(list);
      }
      const craft = button('Forge Upgrader', () => commit('/craft', { level, tier, shards: required, requestId }, craft, status, result => {
        workshop({ token: result.token, ingredients: selectedIngredients });
      }), 'btn btn-primary');
      craft.disabled = !tier || !quantity(id('core', tier)) || required.some(value => !value || !quantity(id('shard', value)));
      preview.append(craft);
      layout.append(selectors, slots, preview);
      const crafting = node('section');
      crafting.append(node('h3', 'Crafting'), toggle, layout);
      const nav = node('nav', '', 'upgrader-controls');
      nav.setAttribute('aria-label', 'Workshop sections');
      for (const name of ['Materials', 'Crafting', 'Upgrader Tokens']) {
        const tab = button(name, () => { view = name; update(); });
        tab.setAttribute('aria-pressed', String(view === name));
        tab.dataset.forgeControl = name;
        nav.append(tab);
      }
      content.replaceChildren(nav);
      if (view === 'Materials') content.append(holdings('Upgrade Shards', UpgraderCatalog.rewards.upgradeShard, true),
        holdings('Upgrader Cores', UpgraderCatalog.rewards.upgradeCore, true));
      if (view === 'Crafting') content.append(crafting);
      if (view === 'Upgrader Tokens') content.append(
        holdings('Epic Upgraders', UpgraderCatalog.rewards.upgradeToken.filter(item => item.level === 'epic'), true),
        holdings('Legendary Upgraders', UpgraderCatalog.rewards.upgradeToken.filter(item => item.level === 'legendary'), true)
      );
      if (focused) content.querySelector('[data-forge-control="' + CSS.escape(focused) + '"]')?.focus({ preventScroll: true });
    }
    update();
  }
  async function chooseCard(token) {
    const { content, status } = shell(token.name);
    status.textContent = 'Loading cards…';
    try {
      const { cards } = await request('?token=' + encodeURIComponent(token.id));
      if (!dialog.open || !content.isConnected) return;
      const isUpgrade = token.kind === 'upgradeToken';
      const list = node('div', '', 'upgrader-card-grid');
      content.append(itemArt(token.id, true));
      if (isUpgrade && !cards.length) {
        content.append(node('p', 'No eligible cards for this upgrader.'),
          node('p', 'Requires ' + (token.level === 'epic' ? 'a Normal' : 'an Epic') + ' ' + token.tier + ' card.'));
        status.textContent = '';
        return;
      }
      const tiles = cards.map(card => {
        const tile = button(card.name, () => token.kind === 'cardXpPotion' ? confirmPotion(token, card) : confirmUpgrade(token, card), 'upgrader-tile');
        tile.setAttribute('aria-label', card.name);
        const image = node('img');
        image.src = card.imageUrl;
        image.alt = '';
        image.loading = 'lazy';
        tile.prepend(window.BenBalCard.collectibleFace(image, card.upgrade));
        if (isUpgrade) {
          const details = node('span', '', 'upgrader-card-details');
          details.id = 'upgrader-card-' + card.itemId;
          details.append(node('span', card.level === 'epic' ? 'Epic' : 'Normal'),
            node('strong', 'Upgrade Effectiveness ' + card.effectiveness + '%'),
            node('span', '+' + UpgraderCatalog.points(card.effectiveness) + ' total stat points'));
          tile.setAttribute('aria-describedby', details.id);
          tile.append(details);
        } else if (card.effectiveness !== undefined) tile.append(node('small', 'Effectiveness ' + card.effectiveness + '%'));
        tile.disabled = Boolean(card.error);
        if (card.error) tile.append(node('small', card.error));
        return { tile, name: card.name.toLocaleLowerCase() };
      });
      if (isUpgrade) {
        const search = node('input');
        search.type = 'search';
        const label = node('label', 'Search eligible cards', 'upgrader-card-search');
        label.append(search);
        content.append(label, status);
        const filter = () => {
          const query = search.value.trim().toLocaleLowerCase();
          const matches = tiles.filter(entry => entry.name.includes(query));
          list.replaceChildren(...matches.map(entry => entry.tile));
          const total = cards.length + (cards.length === 1 ? ' eligible card' : ' eligible cards');
          status.textContent = !query ? total : matches.length
            ? matches.length + ' of ' + total : 'No matching cards · ' + total;
        };
        search.addEventListener('input', filter);
        filter();
      } else {
        list.append(...tiles.map(entry => entry.tile));
        status.textContent = cards.length ? '' : 'Your collection has no available cards.';
      }
      content.append(list);
    } catch (error) { status.textContent = error.message; }
  }
  function statBreakdown(upgrade, overall) {
    const stats = node('dl', '', 'upgrader-stat-list');
    for (const [key, value] of Object.entries(upgrade.effectiveStats)) {
      const base = upgrade.baseStats[key];
      stats.append(node('dt', key.toUpperCase()), node('dd',
        base + ' → ' + value + ' (+' + (value - base) + ' points)'));
    }
    const power = Object.values(upgrade.effectiveStats).reduce((total, value) => total + value, 0);
    const current = upgrade.currentOverall ?? overall;
    const heading = node('p', 'Card Power ' + power + (Number.isFinite(current) ? ' · Overall ' + current : '') +
      (Number.isFinite(upgrade.baseOverall) ? ' · Base Overall ' + upgrade.baseOverall : ''));
    return [heading, stats];
  }
  function confirmPotion(potion, card) {
    const { content, status } = shell('Use Card XP Potion?');
    const requestId = crypto.randomUUID();
    const control = button('Confirm Potion', () => commit('/potion', { requestId, token: potion.id, itemId: card.itemId },
      control, status, result => {
        shell(card.name).content.append(node('p', 'Upgrade Effectiveness is now ' + result.effectiveness + '%.'));
      }), 'btn btn-primary');
    content.append(node('h3', card.name), node('p', 'Upgrade Effectiveness ' + card.effectiveness + '% → ' + potion.target + '%'),
      button('Cancel', () => { if (!busy) chooseCard(potion); }), control);
  }
  function confirmUpgrade(token, card) {
    const { content, status } = shell('Upgrade card?');
    const requestId = crypto.randomUUID();
    const image = node('img');
    image.src = card.imageUrl;
    image.alt = card.name;
    const preview = window.BenBalCard.collectibleFace(image, card.upgrade);
    preview.classList.add('upgrader-preview');
    const actions = node('div', '', 'upgrader-controls');
    const confirm = button('Confirm Upgrade', () => commit('/apply', {
      token: token.id, itemId: card.itemId, requestId
    }, confirm, status, result => {
      const reveal = shell(card.name + ' — ' + (token.level === 'epic' ? 'Epic' : 'Legendary'));
      const face = window.BenBalCard.collectibleFace(image, { ...result.upgrade, level: token.level,
        currentOverall: result.upgrade.currentOverall ?? result.card.overall });
      face.classList.add('upgrader-preview', 'upgrader-reveal');
      reveal.content.append(face, ...statBreakdown(result.upgrade, result.card.overall),
        node('p', 'Upgrade Effectiveness reset to 0%.'));
      loadInventory();
    }), 'btn btn-primary');
    actions.append(button('Cancel', () => { if (!busy) chooseCard(token); }), confirm);
    content.append(itemArt(token.id, true), preview, node('h3', card.name), node('p', card.level + ' → ' + token.level),
      node('p', token.name + ' · Upgrade Effectiveness ' + (card.effectiveness ?? 0) + '%'),
      node('p', '+' + UpgraderCatalog.points(card.effectiveness ?? 0) + ' total stat points distributed randomly. Effectiveness resets to 0%.'), actions);
  }
  const admin = document.querySelector('#upgraderAdmin .upgrader-holdings');
  async function managePotions() {
    const { content, status } = shell('Card XP Potion Testing');
    const player = node('select');
    const card = node('select');
    const choice = node('select');
    const grant = button('Grant Potion', () => save('grant'));
    const set = button('Set Effectiveness for Testing', () => save('set'));
    player.add(new Option('Choose player', ''));
    card.add(new Option('Choose card', ''));
    for (const item of definitions.filter(entry => entry.kind === 'cardXpPotion')) choice.add(new Option(item.name, item.id));
    player.setAttribute('aria-label', 'Player');
    card.setAttribute('aria-label', 'Owned card');
    choice.setAttribute('aria-label', 'Potion target');
    function update() {
      grant.disabled = busy || !player.value;
      set.disabled = busy || !player.value || !card.value;
    }
    let listRequest = 0;
    async function loadCards() {
      const current = ++listRequest;
      card.replaceChildren(new Option('Choose card', ''));
      update();
      if (!player.value) return;
      try {
        const { cards } = await request('/admin?player=' + encodeURIComponent(player.value));
        if (current !== listRequest) return;
        for (const entry of cards) card.add(new Option(entry.name + ' · ' + entry.effectiveness + '%', entry.itemId));
      } catch (error) { status.textContent = error.message; }
    }
    async function save(action) {
      if (busy) return;
      busy = true;
      update();
      try {
        await request('/admin', { requestId: crypto.randomUUID(), player: player.value, itemId: card.value, token: choice.value, action });
        status.textContent = action === 'grant' ? 'Potion granted.' : 'Testing effectiveness saved.';
        if (action === 'set') await loadCards();
      } catch (error) { status.textContent = error.message; }
      finally { busy = false; update(); }
    }
    player.onchange = loadCards;
    card.onchange = update;
    content.append(player, card, choice, grant, set);
    update();
    try {
      const { players } = await request('/admin');
      for (const entry of players) player.add(new Option(entry.name, entry.id));
    } catch (error) { status.textContent = error.message; }
  }
  admin?.before(button('Card XP Potion Testing', managePotions));
  for (const entry of definitions) {
    const tile = node('article', '', 'upgrader-tile');
    tile.append(node('strong', label(entry.id)), node('small', entry.description));
    admin?.append(tile);
  }
  inventory.append(button('Upgrader Workshop', openWorkshop, 'btn btn-primary'));
  async function openFavourites() {
    const { content, status } = shell('Favourite Cards');
    status.textContent = 'Loading favourite cards…';
    try {
      const { slots } = await request('/favourites');
      const list = node('div', '', 'upgrader-holdings');
      for (const [slot, card] of slots.entries()) {
        const tile = node('section', '', 'upgrader-tile favourite-card-slot');
        tile.append(node('h3', 'Slot ' + (slot + 1)));
        if (card && !card.unavailable) {
          const image = node('img');
          image.src = card.imageUrl;
          image.alt = '';
          const progress = node('progress');
          progress.max = 100;
          progress.value = card.effectiveness;
          progress.setAttribute('aria-label', 'Upgrade Effectiveness');
          tile.append(window.BenBalCard.collectibleFace(image, card.upgrade), node('strong', card.name), node('span', card.level, 'favourite-card-level'),
            node('span', 'Upgrade Effectiveness ' + card.effectiveness + '%'), progress,
            node('span', 'Next upgrade: +' + UpgraderCatalog.points(card.effectiveness) + ' total stat points'));
        } else tile.append(node('p', card ? 'Card no longer owned.' : 'Empty slot'));
        tile.append(button(card ? 'Change' : 'Equip card', () => chooseFavourite(slot)));
        if (card) {
          const remove = button('Remove', () => saveFavourite(slot, null, status, remove));
          tile.append(remove);
        }
        list.append(tile);
      }
      content.append(node('p', 'Favourites earn Upgrade Effectiveness in completed Ben-Bal matches, even when they aren’t in your lineup.'), list);
      status.textContent = '';
    } catch (error) { status.textContent = error.message; }
  }

  async function chooseFavourite(slot) {
    if (busy) return;
    const { content, status } = shell('Choose a favourite for slot ' + (slot + 1));
    dialog.classList.add('favourite-picker-dialog');
    content.className = 'favourite-picker-content';
    const filters = node('div', '', 'favourite-picker-filters');
    filters.append(button('Back to Favourite Cards', () => { if (!busy) openFavourites(); }));
    content.append(filters, status);
    status.textContent = 'Loading owned cards…';
    try {
      const { slots, cards } = await request('/favourites?select=1');
      if (!dialog.open || !content.isConnected) return;
      renderFavouritePicker(slot, slots, cards, filters, content, status);
    } catch (error) { status.textContent = error.message; }
  }

  function renderFavouritePicker(slot, slots, cards, filters, content, status) {
    const tiers = [...UpgraderCatalog.tiers].reverse();
    const baseTier = tier => UpgraderCatalog.tierKey(String(tier ?? '').replace(/^Rare /, ''));
    const ranks = new Map(tiers.map((tier, rank) => [baseTier(tier), rank]));
    const order = card => (ranks.get(baseTier(card.tier)) ?? tiers.length) * 2 + Number(!card.tier?.startsWith('Rare '));
    cards.sort((a, b) => order(a) - order(b) || (b.overall ?? -1) - (a.overall ?? -1) ||
      a.name.localeCompare(b.name) || a.itemId.localeCompare(b.itemId));
    const tier = node('select');
    tier.append(new Option('All Tiers', ''), ...tiers.map(name => new Option(name, baseTier(name))));
    const tierLabel = node('label', 'Filter by Tier');
    tierLabel.append(tier);
    const search = node('input');
    search.type = 'search';
    search.placeholder = 'Search your cards...';
    const searchLabel = node('label', 'Search your cards');
    searchLabel.append(search);
    const scroll = node('div', '', 'favourite-picker-scroll');
    const grid = node('div', '', 'favourite-picker-grid');
    scroll.append(grid);
    content.append(scroll);
    let matches = [];
    let rendered = 0;
    const reset = button('Reset filters', () => {
      tier.value = search.value = '';
      update();
    });
    filters.append(tierLabel, searchLabel, reset);
    const appendCards = (count) => {
      if (rendered >= matches.length) return;
      const batch = matches.slice(rendered, rendered + count);
      grid.append(...batch.map(card => {
        const tile = button('', () => saveFavourite(slot, card.itemId, status, tile), 'upgrader-tile favourite-picker-card');
        tile.disabled = slots.some((id, index) => index !== slot && id === card.itemId);
        const image = node('img');
        image.src = card.imageUrl;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        const progress = node('progress');
        progress.max = 100;
        progress.value = card.effectiveness;
        progress.setAttribute('aria-label', 'Upgrade Effectiveness');
        const info = node('span', '', 'favourite-picker-card-info');
        info.append(node('strong', card.name), node('span', card.tier === 'Lightling' ? 'Lightning' : card.tier || 'Tier unavailable'),
          node('span', card.level, 'favourite-card-level'), node('span', 'Upgrade Effectiveness: ' + card.effectiveness + '%'), progress);
        if (tile.disabled) info.append(node('strong', 'Already Favourite', 'favourite-picker-equipped'));
        else if (slots[slot] === card.itemId) info.append(node('strong', 'Current slot'));
        const art = node('span', '', 'favourite-picker-art');
        art.append(window.BenBalCard.collectibleFace(image, card.upgrade));
        tile.append(art, info);
        return tile;
      }));
      rendered += batch.length;
    };
    const update = () => {
      const query = search.value.trim().toLocaleLowerCase();
      const inTier = tier.value ? cards.filter(card => baseTier(card.tier) === tier.value) : cards;
      matches = inTier.filter(card => card.name.toLocaleLowerCase().includes(query));
      rendered = 0;
      grid.replaceChildren();
      appendCards(48);
      const count = matches.length + (query ? ' matching' : '') + (matches.length === 1 ? ' card' : ' cards');
      status.textContent = !cards.length ? "You don't own any cards yet." : !inTier.length ? 'No cards found in this tier.'
        : !matches.length ? 'No matching cards found.' : count;
      reset.disabled = !tier.value && !search.value;
      scroll.scrollTop = 0;
    };
    scroll.addEventListener('scroll', () => {
      if (scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 320) appendCards(24);
    }, { passive: true });
    tier.addEventListener('change', update);
    search.addEventListener('input', update);
    update();
  }

  async function saveFavourite(slot, itemId, status, control) {
    if (busy) return;
    busy = control.disabled = true;
    dialog.querySelector('header button').disabled = true;
    try {
      await request('/favourites', { slot, itemId });
      await openFavourites();
    } catch (error) {
      status.textContent = error.message;
      control.disabled = false;
      dialog.querySelector('header button').disabled = false;
    } finally { busy = false; }
  }

  window.UpgraderWorkshop = { refresh, open: openWorkshop, openFavourites, async showPotions(panel) {
    potionPanel = panel;
    panel.textContent = 'Loading Card XP Potions…';
    const error = await refresh();
    if (error && potionPanel === panel) panel.textContent = 'Card XP Potions are unavailable. ' + error;
  }, inspect(name, upgrade, overall) {
    shell(name).content.append(...statBreakdown(upgrade, overall));
  } };
})();
