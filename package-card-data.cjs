const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { readLocalCard, imageFilenames, cardId, releaseFile, readRelease, publicCard } = require('./card-data');
const { allocationFile, readAllocations, assignAllocations, readPendingAllocation } = require('./ben-bal-allocations');

async function writeRelease(file, data) {
  const temporary = file + '.' + randomUUID() + '.tmp';
  try {
    await fs.writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { flag: 'wx', flush: true });
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

async function packageCardData(project = __dirname) {
  const filenames = await imageFilenames(project);
  const ids = new Set();
  const cards = [];
  const previous = await readRelease(project);
  for (const filename of filenames) {
    const id = cardId(filename);
    if (ids.has(id)) throw Error('Duplicate catalogue card ID: ' + id);
    ids.add(id);
    const result = await readLocalCard(project, filename);
    if (result.status === 'invalid') throw Error('Invalid structured record for ' + filename);
    const card = result.card ?? publicCard(previous?.get(filename), filename);
    if (card) cards.push({ filename, ...card });
  }
  if (!cards.length) throw Error('No structured card records found.');
  const file = releaseFile(project);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const stored = await readAllocations(project);
  for (const card of cards) {
    if (stored.has(card.id) || !Object.values(card.stats).every(Number.isFinite)) continue;
    const pending = await readPendingAllocation(project, card.id);
    if (pending) stored.set(card.id, pending);
  }
  const allocations = assignAllocations(cards, stored);
  await writeRelease(allocationFile(project), allocations);
  await writeRelease(file, { schemaVersion: 1, cards });
  return { included: cards.length, missing: filenames.length - cards.length };
}

if (require.main === module) {
  packageCardData().then(({ included, missing }) => {
    console.log('Packaged ' + included + ' cards. Catalogue images without data: ' + missing + '.');
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { packageCardData };
