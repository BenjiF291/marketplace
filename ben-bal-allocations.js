const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { roles, statKeys, naturalPosition, orderActionStats } = require('./public/ben-bal-card');

const allocationFile = project => path.join(project, 'data', 'ben-bal-allocations.json');
const complete = card => statKeys.every(key => Number.isFinite(card.stats?.[key]));
const isDraftSeed = value => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const pendingAllocationFile = (project, id) => path.join(project, '.card-creator', id + '.ben-bal.json');

function validPairs(allocation) {
  const keys = roles.flatMap(role => [allocation?.[role]?.primary, allocation?.[role]?.secondary]);
  return statKeys.every(key => keys.includes(key));
}

function allocationFor(identity) {
  const order = statKeys.map(key => ({
    key, hash: createHash('sha256').update(JSON.stringify(['ben-bal-v1', identity, key])).digest('hex')
  })).sort((a, b) => a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0);
  return Object.fromEntries(roles.map((role, i) => [
    role, { primary: order[2 * i].key, secondary: order[2 * i + 1].key }
  ]));
}

function samePairs(a, b) {
  return validPairs(a) && validPairs(b) && roles.every(role => {
    const { primary, secondary } = a[role];
    const other = b[role];
    return (primary === other.primary && secondary === other.secondary) ||
      (primary === other.secondary && secondary === other.primary);
  });
}

function validateDraft(attachment, stats) {
  if (!isDraftSeed(attachment?.seed) || !complete({ stats }) ||
      !samePairs(attachment.allocation, allocationFor(attachment.seed)))
    throw Error('Invalid Ben-Bal draft allocation.');
  return orderActionStats(stats, Object.fromEntries(roles.map(role => {
    const { primary, secondary } = attachment.allocation[role];
    return [role, { primary, secondary }];
  })));
}

async function readPendingAllocation(project, id) {
  if (!/^[a-f0-9]{64}$/.test(id)) return null;
  try {
    const record = JSON.parse(await fs.readFile(pendingAllocationFile(project, id), 'utf8'));
    if (record?.cardId !== id || !validPairs(record.allocation))
      throw Error('Invalid pending Ben-Bal allocation.');
    return record.allocation;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readAllocations(project) {
  let data;
  try {
    data = JSON.parse(await fs.readFile(allocationFile(project), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return new Map();
    throw error;
  }
  if (data?.schemaVersion !== 1 || !Array.isArray(data.allocations)) {
    throw Error('Invalid Ben-Bal allocation manifest.');
  }
  const allocations = new Map();
  for (const { cardId, ...allocation } of data.allocations) {
    if (typeof cardId !== 'string' || !cardId || allocations.has(cardId) ||
        !validPairs(allocation)) {
      throw Error('Invalid or duplicate Ben-Bal allocation for ' + cardId);
    }
    allocations.set(cardId, allocation);
  }
  return allocations;
}

function assignAllocations(cards, allocations) {
  for (const card of cards) {
    if (!complete(card)) continue;
    const allocation = allocations.get(card.id) ?? allocationFor(card.id);
    allocations.set(card.id, orderActionStats(card.stats, allocation));
  }
  return {
    schemaVersion: 1,
    allocations: [...allocations.keys()].sort().map(cardId => ({ cardId, ...allocations.get(cardId) }))
  };
}

function createBenBalReader(project, readCard) {
  let pending;
  return async (identifier, catalogue) => {
    const card = await readCard(identifier, catalogue);
    if (!card) return null;
    pending ??= readAllocations(project).catch(error => {
      pending = undefined;
      throw error;
    });
    const stored = complete(card) && ((await pending).get(card.id) ?? await readPendingAllocation(project, card.id));
    // Local stat corrections can be visible before the next packaging run.
    const allocation = stored && complete(card) ? orderActionStats(card.stats, stored) : null;
    return {
      ...card,
      benBal: allocation
        ? { ...allocation, naturalPosition: naturalPosition(card.stats, allocation) }
        : null
    };
  };
}

module.exports = { allocationFile, readAllocations, assignAllocations, createBenBalReader, allocationFor,
  isDraftSeed, samePairs, validateDraft, pendingAllocationFile, readPendingAllocation };
