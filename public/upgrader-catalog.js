(() => {
  const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Lightning', 'Ultra'];
  const tierKey = tier => String(tier ?? '').toLowerCase().replace(/^lightling$/, 'lightning');
  const id = (kind, tier) => kind + ':' + tierKey(tier);
  const definitions = tiers.flatMap(tier => [
    { kind: 'upgradeShard', id: id('shard', tier), tier, name: tier + ' Upgrade Shard', icon: '◈', description: 'Combine with a core and shards from distinct tiers.' },
    { kind: 'upgradeCore', id: id('core', tier), tier, name: tier + ' Upgrader Core', icon: '⬢', description: 'Determines the crafted token’s target tier.' },
    ...['epic', 'legendary'].map(level => ({
      kind: 'upgradeToken', id: id(level, tier), tier, level, targetTiers: [tier],
      name: level[0].toUpperCase() + level.slice(1) + ' ' + tier + ' Upgrader',
      icon: level === 'epic' ? '✦' : '✺', description: level === 'epic' ? 'Upgrades a Normal card.' : 'Replaces the rolls on an Epic card.'
    }))
  ]).concat([50, 75, 100].map(target => ({ kind: 'cardXpPotion', id: 'card-xp:' + target, target,
    name: target + '% Card XP Potion', icon: '⚗', description: 'Raises Upgrade Effectiveness to at least ' + target + '%.' })));
  const get = key => definitions.find(definition => definition.id === key);
  const artwork = key => {
    const [type, tier] = key.split(':');
    const prefix = { shard: 'upgrade-shard', core: 'upgrader-core', epic: 'upgrader-epic',
      legendary: 'upgrader-legendary' }[type];
    return prefix && tiers.some(name => tierKey(name) === tier)
      ? 'assets/upgraders/' + prefix + '-' + tier + '.png?v=36-transparent' : '';
  };
  const rewards = Object.fromEntries(['upgradeShard', 'upgradeCore', 'upgradeToken', 'cardXpPotion']
    .map(kind => [kind, definitions.filter(item => item.kind === kind)]));
  const points = effectiveness => 1 + Math.round(19 * effectiveness / 100);
  const api = { tiers, definitions, tierKey, id, get, rewards, points, artwork };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.UpgraderCatalog = api;
})();
