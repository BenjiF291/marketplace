const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createBenBalReader } = require('./ben-bal-allocations');
const { statKeys } = require('./public/ben-bal-card');

const normalTiers = new Set(['Bronze', 'Rare Bronze', 'Silver', 'Rare Silver', 'Gold', 'Rare Gold',
  'Platinum', 'Lightling', 'Ultra', 'Super']);
const specialTiers = new Set(['Fighter', 'Mirror', 'Low-pointers', 'Mini', 'Genius', 'MOTM']);
const isSpecialTier = tier => specialTiers.has(tier);
const imageExtension = /\.(?:png|jpe?g|webp|gif)$/i;
const { backgrounds } = require('./public/ben-bal-card');
const { cardId, packageId } = require('./public/card-identity');

// Mirrors the Card Creator V8.3/V8.4 filename lookup without depending on its checkout.
function sidecarName(filename) {
  const key = packageId(filename) ?? 'legacy-' + createHash('sha256').update(filename).digest('hex');
  return key + '.card.json';
}

async function imageFilenames(project) {
  let entries;
  try {
    entries = await fs.readdir(path.join(project, 'public', 'images'), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return entries.filter(entry => entry.isFile() && imageExtension.test(entry.name)).map(entry => entry.name).sort();
}

function publicCard(record, filename) {
  if (record?.id !== cardId(filename) || record.filename !== filename ||
      typeof record.name !== 'string' || !record.name.trim() || record.name.length > 100 ||
      !Number.isFinite(record.overall) || !(normalTiers.has(record.tier) || specialTiers.has(record.tier))) return null;

  const stats = {};
  for (const key of statKeys) {
    const value = record.stats?.[key];
    if (Number.isFinite(value)) stats[key] = value;
    else if (specialTiers.has(record.tier) && (value === null || value === '--')) stats[key] = null;
    else return null;
  }
  return {
    id: record.id, name: record.name, tier: record.tier, overall: record.overall,
    stats, imageUrl: '/images/' + encodeURIComponent(filename),
    ...(backgrounds[record.tier] &&
      ((record.noPicture === true && record.templateId === backgrounds[record.tier]) ||
       record.collectible?.templateId === backgrounds[record.tier])
      ? { collectible: { templateId: backgrounds[record.tier] } } : {})
  };
}

async function readLocalCard(project, filename) {
  const file = path.join(project, '.card-creator', sidecarName(filename));
  try {
    if (!(await fs.lstat(file)).isFile()) return { status: 'invalid' };
    const record = JSON.parse(await fs.readFile(file, 'utf8'));
    const card = record?.schemaVersion === 1 && publicCard(record, filename);
    return card ? { card } : { status: 'invalid' };
  } catch (error) {
    if (error.code === 'ENOENT') return { status: 'missing' };
    if (error instanceof SyntaxError) return { status: 'invalid' };
    throw error;
  }
}

function releaseFile(project) {
  return path.join(project, 'data', 'card-statistics.json');
}

async function readRelease(project) {
  try {
    const release = JSON.parse(await fs.readFile(releaseFile(project), 'utf8'));
    if (release?.schemaVersion !== 1 || !Array.isArray(release.cards)) return null;
    const byFilename = new Map();
    for (const record of release.cards) {
      if (byFilename.has(record?.filename)) byFilename.set(record.filename, null);
      else byFilename.set(record?.filename, record);
    }
    return byFilename;
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return null;
    throw error;
  }
}

function createCardReader(project) {
  let packaged;
  return async function getCardData(identifier, catalogue) {
    if (typeof identifier !== 'string' || !identifier || identifier.length > 255) return null;
    const filenames = Array.isArray(catalogue) ? catalogue : await imageFilenames(project);
    const matches = filenames.filter(filename =>
      filename === identifier || cardId(filename) === identifier);
    if (matches.length !== 1) return null;
    const [filename] = matches;
    if (cardId(filename) !== filename && filenames.filter(other => cardId(other) === cardId(filename)).length !== 1) return null;
    const local = await readLocalCard(project, filename);
    if (local.card || local.status === 'invalid') return local.card ?? null;
    packaged ??= readRelease(project).catch(error => {
      packaged = undefined;
      throw error;
    });
    const record = (await packaged)?.get(filename);
    return publicCard(record, filename);
  };
}

function registerCardData(app, project) {
  const read = createCardReader(project);
  const readBenBal = createBenBalReader(project, read);
  app.get('/card-display-names', async (req, res) => {
    try {
      const filenames = await imageFilenames(project);
      const names = [];
      for (let offset = 0; offset < filenames.length; offset += 16) {
        const batch = filenames.slice(offset, offset + 16);
        const cards = await Promise.all(batch.map(filename => read(filename, filenames)));
        cards.forEach((card, index) => {
          if (card) names.push({ filename: batch[index], id: card.id, name: card.name, tier: card.tier });
        });
      }
      return res.json(names);
    } catch {
      return res.status(503).json({ error: 'Card names temporarily unavailable.' });
    }
  });
  app.get('/card-data', async (req, res) => {
    try {
      const reader = req.query.mode === 'ben-bal' ? readBenBal : read;
      const card = await reader(req.query.card);
      if (!card) return res.status(404).json({ error: 'Card statistics unavailable.' });
      return res.json(card);
    } catch {
      return res.status(503).json({ error: 'Card statistics temporarily unavailable.' });
    }
  });
}

module.exports = {
  isSpecialTier,
  registerCardData, createCardReader, readLocalCard, imageFilenames, cardId, releaseFile, readRelease, publicCard
};
