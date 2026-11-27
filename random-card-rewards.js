const { createCardReader, imageFilenames, isSpecialTier } = require('./card-data');
const { tiers, tierKey } = require('./public/upgrader-catalog');

const kind = 'randomCardByTier';
const definitions = tiers.flatMap(tier =>
  ['regular', ...(['Bronze', 'Silver', 'Gold'].includes(tier) ? ['rare'] : []), 'special'].map(category => ({
    id: tierKey(tier) + ':' + category,
    tier,
    category,
    name: 'Random ' + (category === 'rare' ? 'Rare ' : category === 'special' ? 'Special ' : '') + tier + ' Card'
  })));

const key = tier => tierKey(String(tier || '').trim());

function pools(cards, tierDocuments) {
  const assignments = new Map();
  const standard = new Set(tiers.map(key));
  for (const tier of tierDocuments) {
    const assignedTier = key(tier.name);
    if (!standard.has(assignedTier)) continue;
    for (const reference of tier.cards || []) {
      if (typeof reference !== 'string') continue;
      const filename = reference.split(/[/\\]/).pop();
      const assigned = assignments.get(filename) ?? new Set();
      assigned.add(assignedTier);
      assignments.set(filename, assigned);
    }
  }
  const groups = new Map(definitions.map(definition => [definition.id, new Map()]));
  for (const { filename, card } of cards) {
    let id;
    if (isSpecialTier(card.tier)) {
      const eligible = new Set([...(assignments.get(filename) ?? []), ...(assignments.get(card.id) ?? [])]);
      if (eligible.size === 1) id = [...eligible][0] + ':special';
    } else {
      const tier = key(card.tier);
      id = tier.startsWith('rare ') ? tier.slice(5) + ':rare' : tier + ':regular';
    }
    groups.get(id)?.set(card.id, { filename, name: card.name });
  }
  return definitions.map(definition => {
    const members = [...groups.get(definition.id).values()];
    return Object.defineProperty({ ...definition, count: members.length }, 'members', { value: members });
  });
}

async function catalogue(project, tierDocuments) {
  const files = await imageFilenames(project);
  const read = createCardReader(project);
  const cards = [];
  for (let offset = 0; offset < files.length; offset += 16) {
    const batch = await Promise.all(files.slice(offset, offset + 16)
      .map(async filename => ({ filename, card: await read(filename, files) })));
    cards.push(...batch.filter(entry => entry.card));
  }
  return pools(cards, tierDocuments);
}

module.exports = { kind, definitions, pools, catalogue };
