(() => {
  'use strict';

  const roles = ['attack', 'dribble', 'defence'];
  const statKeys = ['pow', 'ama', 'size', 'rang', 'loy', 'acu'];
  const positions = { attack: 'Attacker', dribble: 'Midfielder', defence: 'Defender' };
  const formation = [
    { label: 'ATT', role: 'attack', slots: ['att1', 'att2', 'att3'] },
    { label: 'MID', role: 'dribble', slots: ['mid1', 'mid2', 'mid3'] },
    { label: 'DEF', role: 'defence', slots: ['def1', 'def2', 'def3', 'def4'] },
    { label: 'GK', role: 'keeper', slots: ['gk'] }
  ];
  const backgrounds = {
    Bronze: 'image19.png', 'Rare Bronze': 'image12.png', Silver: 'image20.png',
    'Rare Silver': 'image22.jpeg', Gold: 'image18.jpeg', 'Rare Gold': 'image17.png',
    Platinum: 'image7.png', Lightling: 'image1.png', Ultra: 'image2.png', Super: 'image13.jpeg',
    Fighter: 'image28.jpeg', Mirror: 'image40.png', 'Low-pointers': 'image31.jpeg',
    Mini: 'image25.jpeg', Genius: 'image37.png', MOTM: 'image34.jpeg'
  };

  function naturalPosition(stats, allocation) {
    // Equal primaries keep the earlier role in Attack, Dribble, Defence order.
    return roles.reduce((best, role) =>
      stats[allocation[role].primary] > stats[allocation[best].primary] ? role : best);
  }

  function orderActionStats(stats, allocation) {
    return Object.fromEntries(roles.map(role => {
      const { primary, secondary } = allocation[role];
      return [role, stats[secondary] > stats[primary]
        ? { primary: secondary, secondary: primary }
        : { primary, secondary }];
    }));
  }

  function cardValues(card, slotRole) {
    const { stats, benBal } = card;
    if (!benBal) return null;
    const penalty = slotRole && slotRole !== 'keeper' && slotRole !== benBal.naturalPosition ? 10 : 0;
    const values = {};
    for (const role of roles) {
      values[role] = {};
      for (const slot of ['primary', 'secondary']) {
        const key = benBal[role][slot];
        values[role][slot] = { key, base: stats[key], effective: Math.max(0, stats[key] - penalty) };
      }
    }
    return { penalty, values };
  }

  const lightArtwork = new Set(['Bronze', 'Rare Bronze', 'Silver', 'Rare Silver', 'Gold', 'Rare Gold',
    'Low-pointers', 'Genius']);

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function upgradeStamp(level) {
    const stamp = element('span', 'upgraded-card-badge', level === 'epic' ? 'EPIC' : 'LEGENDARY');
    stamp.dataset.upgrade = level;
    return stamp;
  }

  function upgradedOverall(baseOverall, baseStats, effectiveStats) {
    const gain = statKeys.reduce((sum, key) => sum + effectiveStats[key] - baseStats[key], 0);
    return baseOverall + Math.max(0, Math.ceil(gain / statKeys.length));
  }

  function collectibleFace(image, upgrade, card) {
    if (!upgrade) return image;
    const face = element('span', 'collectible-upgrade');
    face.dataset.upgrade = upgrade.level;
    const file = new URL(image.src, document.baseURI).pathname.split('/').pop().toLowerCase();
    const tier = file.replace(/^zz\d+-/, '').split(/[_\.]/)[0];
    face.dataset.template = /^(ultra-|super-)/.test(tier) ? tier.split('-')[0] : tier;
    if (/_[a-f\d]{64}\./.test(file)) face.dataset.edition = 'catalogue';
    if (file.startsWith('zz3-')) face.dataset.edition = 'third';
    const fit = () => {
      if (image.naturalWidth) face.style.setProperty('--art-ratio', image.naturalWidth / image.naturalHeight);
    };
    image.addEventListener('load', fit);
    fit();
    face.append(image, upgradeStamp(upgrade.level));
    if (!upgrade.effectiveStats || !statKeys.every(key => Number.isFinite(upgrade.effectiveStats[key]))) return face;
    // Reviewed legacy images can lack the source layers needed by Card Creator.
    const legacy = () => {
      if (!face.contains(image)) return;
      const current = upgrade.currentOverall ?? (Number.isFinite(upgrade.baseOverall ?? card?.overall) && upgrade.baseStats
        ? upgradedOverall(upgrade.baseOverall ?? card.overall, upgrade.baseStats, upgrade.effectiveStats) : null);
      if (Number.isFinite(current)) face.append(element('strong', 'collectible-current-overall', current));
      const stats = element('span', 'collectible-current-stats');
      for (const key of statKeys) {
        const stat = element('span', 'collectible-current-stat');
        stat.dataset.stat = key;
        stat.append(element('span', '', key.toUpperCase()), element('strong', '', upgrade.effectiveStats[key]));
        stats.append(stat);
      }
      face.append(stats);
    };
    const render = window.CollectibleCardRenderer?.render;
    if (!render) legacy();
    else render(image, upgrade, card).then(result => {
      if (!result) return legacy();
      if (!face.contains(image)) return;
      result.canvas.setAttribute('aria-hidden', 'true');
      face.prepend(result.canvas);
      image.dataset.collectibleDescription = result.accessible;
      image.setAttribute('aria-label', (image.getAttribute('role') === 'button' ? 'Enlarge ' : '') + result.accessible);
      face.dataset.rendered = 'collectible';
    }).catch(legacy);
    return face;
  }

  function cardFace(card, slotRole) {
    const face = element('div', 'ben-bal-face');
    if (card.upgrade) face.dataset.upgrade = card.upgrade.level;
    if (Object.hasOwn(backgrounds, card.tier)) {
      face.style.setProperty('--ben-bal-art', 'url("assets/ben-bal/' + backgrounds[card.tier] + '")');
      face.dataset.artwork = card.tier;
      face.classList.toggle('ben-bal-light-art', lightArtwork.has(card.tier));
    }
    const identity = element('div', 'ben-bal-identity');
    const data = cardValues(card, slotRole);
    const rating = element('div', 'ben-bal-rating');
    rating.append(element('strong', 'ben-bal-overall', card.overall ?? '—'));
    if (data) rating.append(element('span', 'ben-bal-position', positions[card.benBal.naturalPosition]));
    const signature = element('div', 'ben-bal-signature');
    signature.append(
      element('strong', 'ben-bal-name', card.name),
      element('span', 'ben-bal-tier', card.tier ?? 'Marketplace card')
    );
    if (data?.penalty) signature.append(element('span', 'ben-bal-penalty', '−10 to all six stats'));
    identity.append(rating, signature);
    face.append(identity);
    if (card.upgrade) {
      const badge = upgradeStamp(card.upgrade.level);
      badge.title = Object.keys(card.upgrade.baseStats ?? {}).map(key =>
        `${key.toUpperCase()} ${card.upgrade.baseStats[key]} → ${card.stats[key]}`).join('\n');
      face.append(badge);
    }
    if (!data) {
      face.append(element('span', 'ben-bal-unavailable', 'Ben-Bal stats unavailable'));
      return face;
    }
    const blocks = element('div', 'ben-bal-stats');
    blocks.classList.toggle('has-penalty', data.penalty > 0);
    for (const role of roles) {
      const block = element('div', 'ben-bal-stat');
      block.dataset.action = role;
      block.classList.toggle('is-natural', role === card.benBal.naturalPosition);
      block.append(element('span', 'ben-bal-stat-label', role));
      for (const slot of ['primary', 'secondary']) {
        const { key, base, effective } = data.values[role][slot];
        const line = element('div', 'ben-bal-' + slot);
        if (data.penalty) line.append(element('del', '', base));
        line.append(element('strong', '', effective), element('span', '', key.toUpperCase()));
        block.append(line);
      }
      blocks.append(block);
    }
    face.append(blocks);
    return face;
  }

  const model = { roles, statKeys, positions, formation, backgrounds, naturalPosition, orderActionStats, cardValues, cardFace, collectibleFace, upgradeStamp, upgradedOverall };
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  else window.BenBalCard = model;
})();
