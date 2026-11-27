const assert = require('node:assert/strict');
const path = require('node:path');
const { once } = require('node:events');
const express = require('express');
const { chromium } = require(require.resolve('playwright', {
  paths: [path.resolve(__dirname, '../.ui-tools')]
}));
const { cards } = require('../data/card-statistics.json');
const { registerCardData, imageFilenames } = require('../card-data');
const { backgrounds, formation, naturalPosition, roles } = require('../public/ben-bal-card');
const { readAllocations } = require('../ben-bal-allocations');
const registerBenBal = require('../ben-bal-routes');
const rewards = require('../ben-bal-rewards');
const { leagues, eligibleTiers } = require('../ben-bal-leagues');
const { createBenBalReader } = require('../ben-bal-allocations');
const { createCardReader } = require('../card-data');
const { prepareTeam, playable } = require('../public/ben-bal-match-engine');
const root = path.resolve(__dirname, '..');
const account = { id: 'ben-bal-browser', username: 'Test captain', balance: 0 };
const village = {
  islandName: 'Test Island', level: 1, maxLevel: 9,
  layout: require('../public/village-layout').profile({}),
  economy: require('../village-economy').profile({})
};
const app = express();
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-User-Id');
  res.set('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());
app.get('/app.js', (req, res) => {
  const source = require('node:fs').readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
  const fixture = source.replace("'http://localhost:3000'", 'location.origin');
  assert.notEqual(fixture, source);
  res.type('text/javascript').send(fixture);
});
app.use(express.static(path.join(root, 'public')));
registerCardData(app, root);
app.get('/card-images', async (req, res) => res.json(await imageFilenames(root)));
let lineup = {};
let owned = cards.map(({ id, name }) => ({ id, name }));
const setupRequests = [];
app.get('/ben-bal/leagues', (req, res) => res.json({
  leagues: leagues.map(name => ({ name, count: 0, pack: null }))
}));
app.get('/ben-bal/team', (req, res) => {
  assert.equal(req.header('X-User-Id'), account.id);
  assert.match(req.header('Authorization'), /^Bearer test-session-/);
  if (req.query.league !== 'Bronze') return res.json({ lineup: {}, owned: [], removed: 0 });
  const eligible = new Set(owned.map(card => card.id));
  const current = Object.fromEntries(Object.entries(lineup).filter(([, id]) => eligible.has(id)));
  const removed = Object.keys(lineup).length - Object.keys(current).length;
  lineup = current;
  res.json({ lineup, owned, removed, tiers: eligibleTiers(req.query.league) });
});
app.put('/ben-bal/team', (req, res) => {
  assert.equal(req.header('X-User-Id'), account.id);
  assert.match(req.header('Authorization'), /^Bearer test-session-/);
  lineup = req.body.lineup;
  res.json({ lineup });
});
app.post('/ben-bal/matches', async (req, res) => {
  setupRequests.push(req.body.lineup);
  assert.equal(req.body.league, 'Bronze');
  const read = createBenBalReader(root, createCardReader(root));
  const pool = (await Promise.all(cards.map(card => read(card.id)))).filter(playable);
  const player = prepareTeam(req.body.lineup, new Map(pool.map(card => [card.id, card])));
  const state = rewards.start(player, pool, new Date());
  const ref = collection('benBalMatches').doc();
  await ref.set({ ...state, league: 'Bronze', userId: account.id });
  res.json({ id: ref.id, league: 'Bronze', view: rewards.engine(state).view() });
});
const records = new Map();
let recordId = 0;
function collection(path) {
  return { doc(id = String(++recordId).padStart(20, '0')) {
    const key = path + '/' + id;
    return { id, key, set: async value => records.set(key, structuredClone(value)),
      collection: name => collection(key + '/' + name) };
  } };
}
const browserDb = {
  async runTransaction(action) {
    const writes = [];
    const reply = await action({
      get: async ref => ({ data: () => records.get(ref.key) }),
      set: (ref, value) => writes.push(() => records.set(ref.key, structuredClone(value))),
      update: (ref, patch) => writes.push(() => records.set(ref.key, { ...records.get(ref.key), ...patch }))
    });
    writes.forEach(write => write());
    return reply;
  },
  collection(name) {
    if (name !== 'items') return collection(name);
    const query = {
      where: () => query,
      get: async () => ({ docs: owned.map(({ id, name }) => ({
        data: () => ({ name, itemType: 'card', imageUrl: cards.find(card => card.id === id).imageUrl })
      })) })
    };
    return query;
  }
};
registerBenBal(app, browserDb, async req => {
  assert.equal(req.header('X-User-Id'), account.id);
  assert.match(req.header('Authorization'), /^Bearer test-session-/);
  return account.id;
}, root);
app.get('/users', (req, res) => res.json([account]));
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/admin/village', (req, res) => res.json(village));
app.get('/ruby-shop', (req, res) => res.json({ catalog: [], character: {}, owned: {}, equipped: {} }));
app.get('/history', (req, res) => res.json({ transfers: [], items: [] }));
const previewCards = [cards[0], cards.find(card => card.tier === 'Mini')].map((card, index) => ({
  ...card, id: 'preview-' + index, price: 100, sellerId: 'preview-seller', itemType: 'card'
}));
app.use((req, res) => res.json([]));

async function checkMarketplaceViewer(page, width) {
  const height = width < 400 ? 568 : width === 768 ? 480 : width === 1280 ? 720 : 900;
  await page.setViewportSize({ width, height });
  if (width < 400) await page.emulateMedia({ reducedMotion: 'reduce' });
  const dialog = page.getByRole('dialog', { name: 'Enlarged card' });
  const flip = dialog.locator('.studio-card-flip');
  const rotor = dialog.locator('.studio-card-rotor');
  const back = dialog.locator('.studio-card-back');
  const first = page.locator('#items img.item-image').first();
  const artwork = await first.getAttribute('src');
  assert.equal(await page.locator('#cardDetails, .card-details-button').count(), 0);
  await first.click();
  await flip.locator('img').evaluate(img => img.decode());
  assert.equal(await flip.locator('img').getAttribute('src'), new URL(artwork, page.url()).href);
  await page.waitForFunction(() => document.querySelector('.studio-card-flip').getAttribute('aria-disabled') === 'false');
  const dimensions = () => dialog.evaluate(node => {
    const rect = element => element.getBoundingClientRect().toJSON();
    return { dialog: rect(node), card: rect(node.querySelector('.studio-card-flip')) };
  });
  const original = await dimensions();
  assert.ok(original.dialog.left >= 0 && original.dialog.right <= width && original.dialog.top >= 0 &&
    original.dialog.bottom <= height);
  assert.ok(await dialog.evaluate(node => node.scrollWidth === node.clientWidth && node.scrollHeight === node.clientHeight));
  assert.equal(await rotor.evaluate(node => getComputedStyle(node).transform), 'none');
  assert.equal(await rotor.evaluate(node => getComputedStyle(node).transformStyle), 'preserve-3d');
  assert.equal(await rotor.evaluate(node => getComputedStyle(node).transitionDuration), width < 400 ? '0s' : '0.7s');
  assert.equal(await back.evaluate(async (node, src) => {
    const card = await CardData.getCardData(CardData.identifierFromImage(src), { mode: 'ben-bal' });
    return node.firstElementChild?.isEqualNode(BenBalCard.cardFace(card));
  }, artwork), true);
  await flip.click();
  if (width >= 400) {
    await flip.dispatchEvent('click');
    assert.equal(await flip.getAttribute('class'), 'studio-card-flip is-flipped');
  }
  for (let index = 0; index < 3; index++) {
    await rotor.evaluate(async node => {
      getComputedStyle(node).transform;
      await Promise.all(node.getAnimations().map(animation => animation.finished));
    });
    assert.deepEqual(await dimensions(), original);
    const reversed = index % 2 === 0;
    assert.equal(await back.getAttribute('aria-hidden'), String(!reversed));
    if (reversed) {
      const face = await back.locator('.ben-bal-face').boundingBox();
      assert.ok(face.width <= original.card.width + 1 && face.height <= original.card.height + 1);
      assert.ok(Math.abs(face.width / face.height - 5 / 7) < .01);
    }
    if (index < 2) await flip.press('Enter');
  }
  await dialog.getByRole('button', { name: 'Close' }).click();
  for (const level of ['epic', 'legendary']) {
    await first.evaluate(async (thumbnail, level) => {
      const card = await CardData.getCardData(CardData.identifierFromImage(thumbnail.src), { mode: 'ben-bal' });
      const effectiveStats = { ...card.stats, pow: card.stats.pow + (level === 'epic' ? 5 : 8) };
      thumbnail.upgrade = { level, effectiveStats, baseStats: card.stats, baseOverall: card.overall,
        currentOverall: BenBalCard.upgradedOverall(card.overall, card.stats, effectiveStats) };
    }, level);
    const expected = await first.evaluate(image => image.upgrade);
    await first.click();
    await flip.locator('img').evaluate(img => img.decode());
    await page.waitForFunction(() => document.querySelector('.studio-card-flip').getAttribute('aria-disabled') === 'false');
    const front = flip.locator('.collectible-upgrade');
    const stamp = front.locator('.upgraded-card-badge');
    assert.equal(await stamp.textContent(), level.toUpperCase());
    assert.equal(await dialog.locator(':scope > .upgraded-card-badge').count(), 0);
    assert.equal(await front.locator('.collectible-current-overall').textContent(), String(expected.currentOverall));
    const frontStats = await front.locator('.collectible-current-stat').evaluateAll(rows =>
      Object.fromEntries(rows.map(row => [row.dataset.stat, Number(row.querySelector('strong').textContent)])));
    assert.deepEqual(frontStats, expected.effectiveStats);
    const bounds = await flip.evaluate(element => {
      const image = element.querySelector('img');
      const box = image.getBoundingClientRect();
      const stamp = element.querySelector('.upgraded-card-badge').getBoundingClientRect();
      return box.x >= 0 && box.y >= 0 && box.right <= innerWidth && box.bottom <= innerHeight &&
        Math.abs(box.width / box.height - image.naturalWidth / image.naturalHeight) < .01 &&
        stamp.left >= box.left && stamp.right <= box.right && stamp.top >= box.top && stamp.bottom <= box.bottom;
    });
    assert.ok(bounds);
    if (process.env.BEN_BAL_VIEWER_SCREENSHOTS) {
      await dialog.screenshot({ path: path.join(process.env.BEN_BAL_VIEWER_SCREENSHOTS, `upgraded-${level}-${width}.png`) });
    }
    await flip.click();
    await rotor.evaluate(async node => {
      getComputedStyle(node).transform;
      await Promise.all(node.getAnimations().map(animation => animation.finished));
    });
    assert.equal(await back.locator('.upgraded-card-badge').textContent(), level.toUpperCase());
    const combatStats = await back.locator('.ben-bal-primary, .ben-bal-secondary').evaluateAll(rows =>
      Object.fromEntries(rows.map(row => [row.querySelector('span').textContent.toLowerCase(), Number(row.querySelector('strong').textContent)])));
    assert.deepEqual(combatStats, expected.effectiveStats);
    assert.equal(await back.locator('.ben-bal-overall').textContent(), String(expected.currentOverall));
    assert.ok(await back.locator('.ben-bal-face').evaluate(node => {
      const box = node.getBoundingClientRect();
      return box.x >= 0 && box.y >= 0 && box.right <= innerWidth && box.bottom <= innerHeight;
    }));
    await dialog.getByRole('button', { name: 'Close' }).click();
  }
  await first.evaluate(image => { delete image.upgrade; });
  const migrated = cards.find(card => card.collectible?.templateId === 'image19.png');
  await first.evaluate((image, card) => {
    image.dataset.originalSource = image.src;
    image.src = card.imageUrl;
    const stats = { ...card.stats, pow: card.stats.pow + 8 };
    image.upgrade = { level: 'legendary', baseStats: card.stats, baseOverall: card.overall, effectiveStats: stats,
      currentOverall: BenBalCard.upgradedOverall(card.overall, card.stats, stats) };
  }, migrated);
  await first.click();
  const rendered = flip.locator('.collectible-upgrade[data-rendered="collectible"]');
  await rendered.waitFor();
  assert.equal(await rendered.locator('canvas').count(), 1);
  assert.equal(await rendered.locator('.collectible-current-overall, .collectible-current-stats').count(), 0);
  assert.match(await rendered.locator('img').getAttribute('aria-label'), new RegExp('POW ' + (migrated.stats.pow + 8) + ','));
  assert.equal(await rendered.locator('img').evaluate(img => getComputedStyle(img).opacity), '0');
  if (process.env.BEN_BAL_VIEWER_SCREENSHOTS) {
    await dialog.screenshot({ path: path.join(process.env.BEN_BAL_VIEWER_SCREENSHOTS, `migrated-legendary-${width}.png`) });
  }
  await dialog.getByRole('button', { name: 'Close' }).click();
  await first.evaluate(image => {
    image.src = image.dataset.originalSource;
    delete image.upgrade;
  });
  await first.click();
  assert.equal(await flip.getAttribute('class'), 'studio-card-flip');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await page.evaluate(() => footyStudio.navigate('inventory'));
  const inventory = page.locator('#inventoryItems img.item-image');
  await inventory.first().press('Enter');
  await page.waitForFunction(() => document.querySelector('.studio-card-flip').getAttribute('aria-disabled') === 'false');
  await dialog.getByRole('button', { name: 'Close' }).click();
  const response = page.waitForResponse(res => res.url().includes('/card-data?') && res.url().includes('mode=ben-bal'));
  await inventory.nth(1).click();
  assert.equal((await (await response).json()).benBal, null);
  await flip.click({ force: true });
  assert.equal(await flip.getAttribute('class'), 'studio-card-flip');
  assert.equal(await back.locator('.ben-bal-face').count(), 0);
  await dialog.getByRole('button', { name: 'Close' }).click();
  console.log(`Marketplace card viewer passed at ${width}px`);
}

async function checkCardLayout(faces) {
  const issues = await faces.evaluateAll(elements => elements.flatMap(face => {
    const outside = (inner, outer) => inner.left < outer.left - 1 || inner.right > outer.right + 1 ||
      inner.top < outer.top - 1 || inner.bottom > outer.bottom + 1;
    const faceRect = face.getBoundingClientRect();
    const rating = face.querySelector('.ben-bal-rating').getBoundingClientRect();
    const signature = face.querySelector('.ben-bal-signature').getBoundingClientRect();
    const failures = rating.bottom > signature.top ? ['rating and name overlap'] : [];
    const name = face.querySelector('.ben-bal-name').firstChild;
    for (const match of name.textContent.matchAll(/[\p{L}\p{M}]+/gu)) {
      const word = document.createRange();
      word.setStart(name, match.index);
      word.setEnd(name, match.index + match[0].length);
      if (word.getClientRects().length > 1) failures.push('split name: ' + match[0]);
    }
    const stats = face.querySelectorAll('.ben-bal-stat');
    for (const stat of stats) {
      for (const line of stat.children) {
        if (outside(line.getBoundingClientRect(), stat.getBoundingClientRect())) failures.push(line.textContent);
      }
      for (const value of stat.querySelectorAll('strong, span, del')) {
        const glyphs = document.createRange();
        glyphs.selectNodeContents(value);
        if (outside(glyphs.getBoundingClientRect(), stat.getBoundingClientRect())) failures.push(value.textContent);
      }
    }
    if (outside(signature, faceRect)) failures.push('name outside card');
    return failures.map(failure => face.querySelector('.ben-bal-name').textContent + ': ' + failure);
  }));
  assert.deepEqual(issues, []);
}

async function checkMatchViewport(match) {
  const problems = await match.evaluate(async dialog => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const issues = [];
    const bounds = element => element.getBoundingClientRect();
    const screen = bounds(dialog);
    const pitch = bounds(dialog.querySelector('.ben-match-pitches'));
    const scoreboard = bounds(dialog.querySelector('.ben-match-scoreboard'));
    const navigation = bounds(dialog.querySelector('.ben-match-pitch-nav'));
    const roster = [...dialog.querySelectorAll('#benMatchPlayerField .ben-match-pick')];
    const dock = [...dialog.querySelectorAll('#benMatchPreviewCard, #benMatchRobotSignal, #benMatchActions button')];
    const persistent = [...dialog.querySelectorAll('.ben-match-scoreboard > div, #benMatchTracker li, .ben-match-pitch-nav button')];
    const within = (child, parent) => child.width > 0 && child.height > 0 && child.left >= parent.left - 1 &&
      child.right <= parent.right + 1 && child.top >= parent.top - 1 && child.bottom <= parent.bottom + 1;
    if (dialog.scrollHeight > dialog.clientHeight + 1 || dialog.scrollWidth > dialog.clientWidth + 1) issues.push('scrollable dialog');
    dialog.scrollTop = 100;
    if (dialog.scrollTop > 1) issues.push('dialog scrolled');
    dialog.scrollTop = 0;
    if (roster.length !== 11 || persistent.filter(node => node.matches('li')).length !== 11) issues.push('missing cards or round markers');
    if (scoreboard.top - screen.top > 15 || scoreboard.bottom > navigation.top) issues.push('scoreboard should come before pitch navigation');
    const field = bounds(dialog.querySelector('#benMatchPlayerField'));
    const defender = bounds(roster[9]);
    const mystery = bounds(dialog.querySelector('#benMatchRobotSignal'));
    const overlapsMystery = rect => mystery.left < rect.right && mystery.right > rect.left &&
        mystery.top < rect.bottom && mystery.bottom > rect.top;
    if (overlapsMystery(defender)) issues.push('mystery card overlaps DEF4');
    if ([...dialog.querySelectorAll('.ben-match-scoreboard, #benMatchActions button')]
      .some(node => overlapsMystery(bounds(node)))) issues.push('mystery card overlaps match controls');
    for (const element of [...roster, ...dock, ...persistent]) {
      if (!within(bounds(element), screen)) issues.push('outside screen: ' + (element.id || element.textContent.trim()));
    }
    for (const element of roster) {
      if (!within(bounds(element), field)) issues.push('clipped formation card: ' + element.getAttribute('aria-label'));
    }
    for (const element of dock) {
      if (element.matches('button:enabled')) {
        const rect = bounds(element);
        if (!element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2))) {
          issues.push('counter cannot be clicked');
        }
      }
    }
    if (screen.bottom - pitch.bottom > 20) issues.push('extra space after pitch');
    return issues;
  });
  assert.deepEqual(problems, []);
}

async function measureMatchPitch(match) {
  return match.evaluate(dialog => {
    const measure = element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return [x, y, width, height];
    };
    return {
      pitch: measure(dialog.querySelector('#benMatchPitchViewport')),
      frame: measure(dialog.querySelector('.ben-match-pitches')),
      formation: [...dialog.querySelectorAll('#benMatchPlayerField .ben-match-pick')].map(measure)
    };
  });
}

async function checkPitchLayout(dialog) {
  const layout = await dialog.locator('#benBalPitch').evaluate(pitch => {
    const slots = Array.from(pitch.querySelectorAll('.ben-bal-slot'));
    const rects = slots.map(slot => slot.getBoundingClientRect());
    const field = pitch.parentElement.getBoundingClientRect();
    const lines = pitch.parentElement.querySelector('svg').getBoundingClientRect();
    return {
      slots: slots.length,
      markingsCoverField: lines.width === field.width && lines.height === field.height,
      overlap: rects.some((a, i) => rects.slice(i + 1).some(b =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)),
      scaled: slots.every((slot, i) => {
        const face = slot.querySelector('.ben-bal-face');
        if (!face) return true;
        const rect = face.getBoundingClientRect();
        return Math.abs(rect.width - rects[i].width) < 1.5 &&
          Math.abs(rect.height - rects[i].height) < 1.5;
      })
    };
  });
  assert.deepEqual(layout, { slots: 11, markingsCoverField: true, overlap: false, scaled: true });
}

async function captureCards(dialog, file, columns) {
  const gallery = await dialog.evaluateHandle((root, columns) => {
    const tiers = ['Bronze', 'Rare Bronze', 'Gold', 'Platinum', 'Ultra', 'Super', 'Mirror', 'MOTM']
      .slice(0, columns === 2 ? 6 : 8);
    const gallery = document.createElement('div');
    const entries = Array.from(root.querySelectorAll('#benBalCards .ben-bal-entry'));
    Object.assign(gallery.style, {
      display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: '14px', padding: '12px', background: '#fcf8ed', borderRadius: '12px'
    });
    for (const tier of tiers) {
      const entry = entries.find(entry => entry.querySelector('.ben-bal-face').dataset.artwork === tier);
      const clone = entry.cloneNode(true);
      clone.querySelector('button').remove();
      gallery.append(clone);
    }
    root.append(gallery);
    return gallery;
  }, columns);
  try {
    await gallery.asElement().screenshot({ path: file });
  } finally {
    await gallery.evaluate(node => node.remove());
    await gallery.dispose();
  }
}

async function main() {
  const listener = app.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const url = 'http://127.0.0.1:' + listener.address().port;
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined)
    });
    async function open(width, session) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      await context.addInitScript(({ account, session }) => {
        localStorage.setItem('userId', account.id);
        localStorage.setItem('username', account.username);
        localStorage.setItem('sessionToken', 'test-session-' + session);
        localStorage.setItem('footy-island-guide-v1:' + account.id, 'done');
      }, { account, session });
      await context.route('**/*', route => {
        const request = new URL(route.request().url());
        if (request.origin !== url) return route.abort();
        if (session.startsWith('viewer-') && ['/items', '/inventory'].includes(request.pathname)) {
          return route.fulfill({ json: previewCards });
        }
        return route.continue();
      });
      const page = await context.newPage();
      await page.goto(url + '/index.html');
      await page.locator('.village-viewport').waitFor({ state: 'visible' });
      await page.locator('.island-loading-screen').waitFor({ state: 'hidden' });
      await page.evaluate(() => Island.enter('market'));
      const street = page.getByRole('dialog', { name: 'Marketplace street' });
      const toolbar = street.getByRole('navigation', { name: 'Island tools' });
      await toolbar.getByRole('button', { name: /Expand island tools/ }).click();
      const launch = toolbar.getByRole('button', { name: 'BEN-BAL', exact: true });
      const [button, pack] = await Promise.all([
        launch.boundingBox(),
        toolbar.getByRole('button', { name: /^Pack shop/ }).boundingBox()
      ]);
      assert.ok(button && pack && button.y > 700 && button.x > pack.x &&
        button.x + button.width < width, 'BEN-BAL should be in view beside Pack shop');
      assert.equal(await page.locator('#islandTools').count(), 1);
      if (process.env.BEN_BAL_SCREENSHOTS) {
        await page.screenshot({ path: path.join(process.env.BEN_BAL_SCREENSHOTS, `ben-bal-toolbar-${width}.png`) });
      }
      await launch.click();
      await page.getByRole('button', { name: 'Enter Bronze League' }).waitFor();
      assert.equal(await page.locator('#benBalLeagues button').count(), 6);
      await page.getByRole('button', { name: 'Enter Bronze League' }).click();
      await page.locator('#benBalContent').waitFor({ state: 'visible' });
      const firstOpenStatus = await page.locator('#benBalStatus').innerText();
      await page.locator('#benBalClose').click();
      await toolbar.waitFor({ state: 'visible' });
      await page.locator('.market-stall[data-stall="cards"]').click();
      await page.locator('#marketplaceSection').waitFor({ state: 'visible' });
      if (session.startsWith('viewer-')) {
        await checkMarketplaceViewer(page, width);
        await context.close();
        return;
      }
      await page.locator('#islandTools').getByRole('button', { name: 'BEN-BAL', exact: true }).click();
      await page.getByRole('button', { name: 'Enter Bronze League' }).click();
      await page.locator('#benBalContent').waitFor({ state: 'visible' });
      return { context, page, firstOpenStatus };
    }

    await open(1440, 'viewer-desktop');
    await open(1280, 'viewer-laptop');
    await open(768, 'viewer-tablet');
    await open(320, 'viewer-mobile');
    const desktop = await open(1440, 'desktop');
    const { page } = desktop;
    const dialog = page.getByRole('dialog', { name: 'BEN-BAL' });
    const publicNames = await (await desktop.context.request.get(url + '/card-display-names')).json();
    const original = publicNames.find(card => card.filename === 'bronze_ari.png');
    const imported = publicNames.find(card => card.filename.startsWith('bronze_lucas-van-ginkel_')) ||
      publicNames.find(card => /^[a-f0-9]{64}$/.test(card.id));
    const sameName = publicNames.filter(card => card.name === 'Benjamin Liesker').slice(0, 2);
    assert.equal(sameName.length, 2);
    const examples = [original, imported, ...sameName];
    assert.ok(examples.every(Boolean));
    await page.evaluate(() => openPackCardPicker());
    const packCardPicker = page.getByRole('dialog', { name: 'Select cards for this pack' });
    for (const card of examples) {
      const option = packCardPicker.locator('label').filter({
        has: page.locator('input[value=' + JSON.stringify(card.filename) + ']')
      });
      assert.equal(await option.locator('span').textContent(), card.name);
      assert.equal(await option.locator('img').getAttribute('alt'), card.name);
      assert.equal(await option.locator('input').getAttribute('aria-label'), 'Include ' + card.name);
    }
    await packCardPicker.getByRole('button', { name: 'Cancel' }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(cards => {
      RewardOpening.play({ name: 'Display name fixture', result: { rewards: cards.map(card => ({
        kind: 'card', id: card.filename, amount: 1, label: '1 Card ' + card.filename
      })) } });
    }, examples);
    const opening = page.locator('dialog.reward-opening');
    await page.locator('dialog.reward-opening[data-phase="cards"]').waitFor();
    for (const card of examples) {
      const face = opening.locator('.reward-pack-card[aria-hidden="false"]:not(.reward-card-departing)');
      assert.equal(await face.locator('.reward-card-name').textContent(), card.name);
      const image = face.locator('.reward-card-picture img');
      assert.equal(await image.getAttribute('alt'), card.name);
      assert.equal(await image.evaluate(node => decodeURIComponent(new URL(node.src).pathname)), '/images/' + card.filename);
      await page.waitForFunction(() => {
        const image = document.querySelector('dialog.reward-opening .reward-pack-card[aria-hidden="false"]:not(.reward-card-departing) img');
        return image?.complete && image.naturalWidth > 0;
      });
      await opening.click({ position: { x: 10, y: 10 } });
    }
    await opening.waitFor({ state: 'hidden' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const incomplete = cards.filter(card => Object.values(card.stats).includes(null));
    assert.equal(await dialog.locator('.ben-bal-slot').count(), 11);
    assert.deepEqual(await dialog.locator('.ben-bal-line').evaluateAll(rows =>
      rows.map(row => Array.from(row.querySelectorAll('[data-slot]'), slot => slot.dataset.slot))),
    [['att1', 'att2', 'att3'], ['mid1', 'mid2', 'mid3'], ['def1', 'def2', 'def3', 'def4'], ['gk']]);
    assert.equal(await dialog.locator('.ben-bal-entry').count(), cards.length);
    assert.equal(await dialog.locator('.ben-bal-unavailable').count(), incomplete.length);
    assert.equal(await dialog.locator('.ben-bal-face img').count(), 0);
    assert.equal(await dialog.locator('.ben-bal-face:has(.ben-bal-stats):not(:has(.is-natural))').count(), 0);
    assert.equal(await dialog.locator('.ben-bal-face:has(.is-natural ~ .is-natural)').count(), 0);
    const art = await dialog.locator('.ben-bal-face').evaluateAll(faces =>
      Array.from(new Set(faces.map(face => getComputedStyle(face, '::before').backgroundImage.match(/ben-bal\/([^")]+)/)?.[1]))));
    assert.deepEqual(art.sort(), Object.values(backgrounds).sort());
    for (const asset of art) assert.ok((await desktop.context.request.get(url + '/assets/ben-bal/' + asset)).ok());
    assert.deepEqual(await dialog.locator('.ben-bal-stats').first().locator('.ben-bal-stat-label').allTextContents(), roles);
    const statCount = (cards.length - incomplete.length) * 3;
    assert.equal(await dialog.locator('.ben-bal-primary strong').count(), statCount);
    assert.equal(await dialog.locator('.ben-bal-secondary strong').count(), statCount);
    assert.ok(await dialog.locator('.ben-bal-stat').first().evaluate(stat =>
      parseFloat(getComputedStyle(stat.querySelector('.ben-bal-primary strong')).fontSize) >
      parseFloat(getComputedStyle(stat.querySelector('.ben-bal-secondary strong')).fontSize)));
    await checkCardLayout(dialog.locator('#benBalCards .ben-bal-face'));
    const allocations = await readAllocations(root);
    const expectedFaces = cards.filter(card => allocations.has(card.id) && Object.values(card.stats).every(Number.isFinite)).map(card => {
      const allocation = allocations.get(card.id);
      const position = naturalPosition(card.stats, allocation);
      return JSON.stringify([card.name, card.tier, card.overall, position,
        roles.flatMap(role => ['primary', 'secondary'].map(slot => {
          const key = allocation[role][slot];
          return [key.toUpperCase(), card.stats[key]];
        }))]);
    }).sort();
    const renderedFaces = await dialog.locator('.ben-bal-face:has(.ben-bal-stats)').evaluateAll(faces =>
      faces.map(face => JSON.stringify([
        face.querySelector('.ben-bal-name').textContent, face.dataset.artwork,
        Number(face.querySelector('.ben-bal-overall').textContent),
        face.querySelector('.is-natural').dataset.action,
        Array.from(face.querySelectorAll('.ben-bal-primary, .ben-bal-secondary'), line =>
          [line.querySelector('span').textContent, Number(line.querySelector('strong').textContent)])
      ])).sort());
    assert.deepEqual(renderedFaces, expectedFaces);
    if (process.env.BEN_BAL_SCREENSHOTS) {
      await captureCards(dialog, path.join(process.env.BEN_BAL_SCREENSHOTS, 'ben-bal-v1.5-desktop.png'), 4);
      await dialog.evaluate(node => { node.scrollTop = 0; });
    }
    await dialog.locator('[data-slot="def1"]').click();
    assert.equal(await dialog.locator('#benBalEligibleTiers').textContent(), 'Eligible tiers: Bronze, Rare Bronze.');
    await dialog.locator('#benBalTier').selectOption('Rare Bronze');
    assert.ok(await dialog.locator('#benBalCards .ben-bal-face').count() > 0);
    assert.equal(await dialog.locator('#benBalCards .ben-bal-face:not([data-artwork="Rare Bronze"])').count(), 0);
    await dialog.locator('#benBalTier').selectOption('Fighter');
    const fighterCount = cards.filter(card => card.tier === 'Fighter').length;
    assert.equal(await dialog.locator('.ben-bal-entry').count(), fighterCount);
    assert.equal(await dialog.getByRole('button', { name: /Assign card/ }).count(), fighterCount);
    assert.equal(await dialog.locator('.ben-bal-entry:has(.ben-bal-unavailable) button:disabled').count(),
      incomplete.filter(card => card.tier === 'Fighter').length);
    await dialog.locator('#benBalTier').selectOption('');
    await dialog.locator('#benBalPosition').selectOption('attack');
    await dialog.getByLabel('Min. overall').fill('50');
    await dialog.getByLabel('Min. attack primary').fill('55');
    await dialog.getByLabel('Min. dribble primary').fill('0');
    await dialog.getByLabel('Min. defence primary').fill('0');
    await dialog.locator('#benBalSort').selectOption('attack');
    const ratings = await dialog.locator('.ben-bal-entry .ben-bal-primary strong:first-child').evaluateAll(numbers =>
      numbers.filter((_, index) => index % 3 === 0).map(number => Number(number.textContent)));
    assert.ok(ratings.length > 0 && ratings.every((value, i) => value >= 55 && (!i || ratings[i - 1] >= value)));

    await dialog.locator('.ben-bal-entry button:enabled').first().click();
    assert.match(await dialog.locator('#benBalPreview').innerText(), /−10 to all six stats/);
    assert.equal(await dialog.locator('#benBalPreview del').count(), 6);
    await checkCardLayout(dialog.locator('#benBalPreview .ben-bal-face'));
    assert.match(await dialog.locator('[data-slot="def1"]').innerText(), /−10/);
    const defender = dialog.locator('[data-slot="def1"] .ben-bal-face');
    assert.equal(await defender.locator('.is-natural').count(), 1);
    assert.equal(await defender.locator('del').count(), 6);
    assert.ok(await defender.locator('.ben-bal-primary, .ben-bal-secondary').evaluateAll(lines =>
      lines.every(line => Number(line.querySelector('strong').textContent) ===
        Math.max(0, Number(line.querySelector('del').textContent) - 10))));
    assert.ok(await dialog.getByRole('button', { name: /Assigned to DEF 1/ }).isDisabled());
    const firstDefender = await defender.locator('.ben-bal-name').textContent();
    await dialog.locator('.ben-bal-entry button:enabled').first().click();
    assert.notEqual(await defender.locator('.ben-bal-name').textContent(), firstDefender);
    await dialog.getByRole('button', { name: 'Clear slot' }).click();
    assert.equal(await dialog.getByRole('button', { name: 'DEF 1 · Empty slot' }).getAttribute('aria-pressed'), 'true');
    await dialog.locator('.ben-bal-entry button:enabled').first().click();
    await dialog.locator('[data-slot="gk"]').click();
    await dialog.locator('.ben-bal-entry button:enabled').first().click();
    assert.equal(await dialog.locator('#benBalPreview del').count(), 0);
    const keeper = dialog.locator('[data-slot="gk"] .ben-bal-face');
    assert.equal(await keeper.locator('del').count(), 0);
    assert.equal(await keeper.locator('.ben-bal-stat strong').count(), 6);
    const collectionKeeper = dialog.locator('.ben-bal-entry:has(button[aria-label^="Assigned to GK"]) .ben-bal-face');
    const html = face => face.evaluate(node => node.outerHTML);
    assert.equal(await html(keeper), await html(collectionKeeper));
    await checkPitchLayout(dialog);
    await dialog.getByRole('button', { name: 'Save team' }).click();
    await dialog.getByText('Team saved.', { exact: true }).waitFor();
    assert.equal(Object.keys(lineup).length, 2);
    assert.notEqual(lineup.def1, lineup.gk);
    await dialog.getByRole('button', { name: 'Close' }).click();
    await page.locator('#marketplaceSection').waitFor({ state: 'visible' });
    await page.locator('#islandTools').getByRole('button', { name: 'BEN-BAL', exact: true }).click();
    await page.getByRole('button', { name: 'Enter Silver League' }).click();
    await dialog.getByText('0 / 11 assigned').waitFor();
    await dialog.getByRole('button', { name: 'Choose League' }).click();
    await page.getByRole('button', { name: 'Enter Bronze League' }).click();
    await dialog.getByText('2 / 11 assigned').waitFor();
    const savedLineup = { ...lineup };
    const eligible = cards.filter(card => allocations.has(card.id) && Object.values(card.stats).every(Number.isFinite));
    const rarities = ['Gold', 'Rare Silver', 'Rare Gold', 'Bronze', 'Ultra', 'Platinum', 'Lightling',
      'Mirror', 'Genius', 'MOTM', 'Super'];
    lineup = Object.fromEntries(formation
      .flatMap(row => row.slots).map((slot, index) => [slot, eligible.find(card => card.tier === rarities[index]).id]));
    if (process.env.BEN_BAL_PITCH_SCREENSHOTS) {
      await dialog.getByRole('button', { name: 'Close' }).click();
      await page.locator('#islandTools').getByRole('button', { name: 'BEN-BAL', exact: true }).click();
      await page.getByRole('button', { name: 'Enter Bronze League' }).click();
      await dialog.getByText('11 / 11 assigned').waitFor();
      await dialog.locator('[data-slot="mid2"]').click();
      await checkPitchLayout(dialog);
      await dialog.evaluate(node => { node.scrollTop = 0; });
      await page.mouse.move(0, 0);
      await page.screenshot({ path: path.join(process.env.BEN_BAL_PITCH_SCREENSHOTS, 'ben-bal-v1.6-desktop.png'), animations: 'disabled' });
      const mobilePreview = await open(480, 'pitch-preview');
      const pitchDialog = mobilePreview.page.getByRole('dialog', { name: 'BEN-BAL' });
      await pitchDialog.getByText('11 / 11 assigned').waitFor();
      await checkPitchLayout(pitchDialog);
      await pitchDialog.locator('[data-slot="mid2"]').click();
      await pitchDialog.evaluate(node => { node.scrollTop = 0; });
      await mobilePreview.page.screenshot({ path: path.join(process.env.BEN_BAL_PITCH_SCREENSHOTS, 'ben-bal-v1.6-mobile.png'), animations: 'disabled' });
      await mobilePreview.context.close();
    }
    lineup = savedLineup;
    if (process.env.BEN_BAL_PITCH_SCREENSHOTS) {
      await dialog.getByRole('button', { name: 'Close' }).click();
      await page.locator('#islandTools').getByRole('button', { name: 'BEN-BAL', exact: true }).click();
      await page.getByRole('button', { name: 'Enter Bronze League' }).click();
      await dialog.getByText('2 / 11 assigned').waitFor();
    }
    const play = dialog.getByRole('button', { name: 'Play Against Robot' });
    await play.click();
    assert.match(await dialog.locator('#benBalPlayStatus').textContent(), /Fill all 11/);
    assert.equal(setupRequests.length, 0);
    for (const input of await dialog.locator('#benBalFilters input').all()) await input.fill('');
    await dialog.locator('#benBalPosition').selectOption('');
    for (const slot of formation.flatMap(row => row.slots).filter(slot => !savedLineup[slot])) {
      await dialog.locator(`[data-slot="${slot}"]`).click();
      await dialog.locator('.ben-bal-entry button:enabled').first().click();
    }
    await play.click();
    const match = page.locator('#benBalMatch');
    const overlay = page.locator('#benMatchOverlay');
    await match.locator('#benMatchTracker [aria-label="Round 1: Unplayed"][aria-current]').waitFor();
    assert.equal(setupRequests.length, 1);
    assert.equal(Object.keys(setupRequests[0]).length, 11);
    assert.deepEqual(lineup, savedLineup);
    const vacant = match.locator('#benMatchPlayerField button:enabled');
    const skip = overlay.getByRole('button', { name: 'Skip Animation' });
    const next = overlay.getByRole('button', { name: 'Continue' });
    const actions = match.getByRole('group', { name: 'Choose an action' });
    const preview = match.locator('#benMatchPreviewCard');
    const signal = match.locator('#benMatchRobotSignal');
    const dock = match.locator('#benMatchPitchDock');
    const yourPitch = match.getByRole('button', { name: 'Your Pitch' });
    const robotPitch = match.getByRole('button', { name: 'Robot Pitch' });
    const robotField = match.locator('#benMatchRobotField');
    const tracker = match.locator('#benMatchTracker');
    assert.deepEqual(await match.locator('#benMatchPlayerField .ben-match-field-row').evaluateAll(rows => rows.map(row => row.children.length)), [3, 3, 4, 1]);
    assert.ok(await match.locator('#benMatchPlayerField .ben-bal-field-lines').evaluate(svg => {
      const centre = new DOMPoint(310, 370).matrixTransform(svg.getScreenCTM());
      const field = svg.parentElement.getBoundingClientRect();
      return Math.abs(centre.x - (field.left + field.width / 2)) < 2 &&
        Math.abs(centre.y - (field.top + field.height / 2)) < 2;
    }), 'the shared field graphic should fill the pitch');
    assert.equal(await tracker.locator('li').count(), 11);
    assert.ok(await tracker.evaluate(node => {
      const bar = node.parentElement.getBoundingClientRect();
      const [player, , robot] = node.parentElement.children;
      const track = node.getBoundingClientRect();
      return bar.height >= 45 && bar.height <= 60 && player.getBoundingClientRect().right <= track.left &&
        robot.getBoundingClientRect().left >= track.right;
    }));
    assert.match(await tracker.locator('[aria-current]').getAttribute('aria-label'), /Round 1: Unplayed/);
    await robotPitch.click();
    assert.equal(await robotPitch.getAttribute('aria-pressed'), 'true');
    assert.equal(await robotField.locator('.ben-match-mystery').count(), 11);
    assert.equal(await robotField.locator('.ben-bal-face, [title], [data-artwork], [aria-label]').count(), 0);
    assert.ok((await robotField.locator('.ben-match-mystery').allTextContents()).every(value => /^\d+$/.test(value)));
    await yourPitch.click();
    assert.ok(await match.evaluate(dialog => {
      const texts = ['Round 1 / 11 · You initiate', 'Back to Team Builder', 'Select a card, then choose its action.'];
      return texts.every(text => !dialog.textContent.includes(text)) &&
        !dialog.querySelector('#benMatchRound, #benMatchExit, #benMatchReturn, #benMatchStatus, .ben-match-header') &&
        [...dialog.querySelector('.ben-match-game').children].map(node => node.className).join(' ') ===
          'ben-match-scoreboard ben-match-pitches' &&
        [...dialog.querySelector('.ben-match-pitches').children].map(node => node.className).join(' ') ===
          'ben-match-pitch-nav ben-match-ground';
    }));
    await page.keyboard.press('Escape');
    await match.getByText(/match progress will be lost/).waitFor();
    await match.getByRole('button', { name: 'Keep Playing' }).click();
    await match.locator('#benMatchPitchTrack').evaluate(track =>
      Promise.all(track.getAnimations().map(animation => animation.finished.catch(() => {}))));
    assert.equal(await actions.isVisible(), false);
    const viewports = [[1440, 900], [1280, 640], [1024, 550], [800, 450], [740, 390], [667, 375],
      [620, 435], [580, 520], [568, 320], [390, 667], [320, 568], [320, 480]];
    const initialPitch = new Map();
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      initialPitch.set(`${width}×${height}`, await measureMatchPitch(match));
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await vacant.first().click();
    assert.deepEqual(await measureMatchPitch(match), initialPitch.get('1440×900'), 'player selection resized the pitch');
    assert.ok(await dock.evaluate(layer => {
      const rect = layer.getBoundingClientRect();
      const backdrop = getComputedStyle(layer);
      const preview = layer.querySelector('#benMatchPreviewCard');
      const slot = document.querySelector('#benMatchPlayerField [aria-pressed="true"]');
      return layer.parentElement.id === 'benBalMatch' && backdrop.position === 'fixed' &&
        rect.x === 0 && rect.y === 0 && rect.width === innerWidth && rect.height === innerHeight &&
        backdrop.backgroundColor === 'rgba(0, 0, 0, 0.35)' && backdrop.opacity === '1' &&
        getComputedStyle(preview).opacity === '1' && preview.offsetWidth > slot.offsetWidth &&
        backdrop.pointerEvents === 'none';
    }));
    assert.equal(await actions.isVisible(), true);
    assert.deepEqual(await actions.getByRole('button').allTextContents().then(items => items.map(item => item.trim())), ['Attack', 'Dribble', 'Defend']);
    assert.equal(await actions.locator('button:enabled').count(), 3);
    const firstId = await preview.getAttribute('data-selection');
    await vacant.nth(1).click();
    assert.notEqual(await preview.getAttribute('data-selection'), firstId);
    assert.equal(await vacant.first().getAttribute('aria-pressed'), 'false');
    assert.equal(await vacant.nth(1).getAttribute('aria-pressed'), 'true');
    assert.equal(await vacant.count(), 11);
    assert.equal(await overlay.isVisible(), false);
    assert.equal(await match.getByRole('button', { name: 'Confirm Card' }).count(), 0);
    const mapping = { attack: 'defence', defence: 'attack', dribble: 'dribble' };
    for (let round = 1; round <= 11; round++) {
      assert.equal(await vacant.count(), 12 - round);
      let action = 'attack';
      if (round % 2 === 0) {
        assert.ok(await signal.isVisible());
        assert.equal(await dock.evaluate(layer => getComputedStyle(layer).backgroundColor), 'rgba(0, 0, 0, 0)');
        assert.match(await signal.innerText(), /^\d+$/);
        assert.equal(await signal.locator('.ben-bal-face, [data-artwork], [title], [aria-label]').count(), 0);
        const declared = await signal.getAttribute('data-action');
        action = mapping[declared];
        assert.ok(action);
        if (round === 2) {
          for (const [width, height] of viewports) {
            await page.setViewportSize({ width, height });
            assert.deepEqual(await measureMatchPitch(match), initialPitch.get(`${width}×${height}`), `robot selected at ${width}×${height}`);
          }
          await page.setViewportSize({ width: 1440, height: 900 });
          const colours = await signal.evaluate(card => {
            const actual = card.dataset.action;
            const styles = ['attack', 'dribble', 'defence'].map(action => {
              card.dataset.action = action;
              return getComputedStyle(card.firstElementChild).backgroundImage;
            });
            card.dataset.action = actual;
            return styles;
          });
          assert.match(colours[0], /at 50% 0%, rgb\(239, 65, 59\)/);
          assert.match(colours[1], /at 0% 50%, rgb\(237, 120, 35\).*at 100% 50%, rgb\(237, 120, 35\)/);
          assert.match(colours[2], /at 50% 100%, rgb\(32, 215, 126\)/);
          assert.ok(await signal.evaluate(card => {
            const surface = getComputedStyle(card.firstElementChild);
            return surface.clipPath.startsWith('polygon(') && surface.color === 'rgb(255, 255, 255)' &&
              getComputedStyle(card, '::after').content === 'none';
          }));
        }
      } else {
        assert.equal(await signal.isVisible(), false);
      }
      await vacant.first().click();
      assert.equal(await dock.evaluate(layer => getComputedStyle(layer).backgroundColor), 'rgba(0, 0, 0, 0.35)');
      const choice = actions.locator(`button[data-action="${action}"]`);
      assert.equal(await actions.locator('button:enabled').count(), round % 2 ? 3 : 1);
      if (round === 2) {
        await actions.locator('button:disabled').first().dispatchEvent('click');
        assert.equal(await overlay.isVisible(), false);
        assert.ok(await dock.evaluate(node => {
          const field = node.getBoundingClientRect();
          const player = node.querySelector('#benMatchPreviewCard').getBoundingClientRect();
          const robot = node.querySelector('#benMatchRobotSignal').getBoundingClientRect();
          const buttons = Array.from(node.querySelectorAll('#benMatchActions button'), button => button.getBoundingClientRect());
          return player.left - field.left < 30 && field.right - robot.right < 30 && robot.left > buttons[0].right &&
            player.right <= buttons[0].left && buttons[0].bottom <= buttons[1].top && buttons[1].bottom <= buttons[2].top &&
            Math.abs(robot.width / player.width - .875) < .005;
        }));
        for (const [width, height] of viewports) {
          await page.setViewportSize({ width, height });
          const selectedPitch = await measureMatchPitch(match);
          const before = initialPitch.get(`${width}×${height}`);
          assert.deepEqual(selectedPitch, before, `player and robot selected at ${width}×${height}`);
          if (width === 1280 || width === 320 && height === 568) {
            console.log(`${width}×${height}: pitch ${before.pitch.slice(2).join('×')} before → ${selectedPitch.pitch.slice(2).join('×')} selected`);
            console.log(`Formation card: ${before.formation[0].slice(2).join('×')} before → ${selectedPitch.formation[0].slice(2).join('×')} selected`);
          }
          await checkMatchViewport(match).catch(error => {
            throw Error(`${width} × ${height}: ${error.message}`, { cause: error });
          });
        }
        if (process.env.BEN_BAL_MATCH_SCREENSHOTS) {
          await page.setViewportSize({ width: 1280, height: 640 });
          await page.screenshot({ path: path.join(process.env.BEN_BAL_MATCH_SCREENSHOTS, 'ben-bal-v2.7.5-desktop.png') });
        }
        await page.setViewportSize({ width: 1440, height: 900 });
      }
      if (round === 1) await choice.evaluate(button => { button.click(); button.click(); });
      else await choice.click();
      await overlay.waitFor();
      assert.equal(await dock.isVisible(), false);
      assert.ok(await overlay.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return node.matches(':modal') && rect.x === 0 && rect.y === 0 &&
          rect.width === innerWidth && rect.height === innerHeight &&
          node.contains(document.elementFromPoint(2, innerHeight - 2));
      }));
      if (round === 1) {
        const turn = overlay.locator('.ben-match-turn');
        assert.equal(await turn.evaluate(node => node.getAnimations()[0].effect.getTiming().duration), 1750);
        assert.equal(await turn.locator('.ben-match-turn-back').getAttribute('aria-hidden'), 'true');
        await page.keyboard.press('Escape');
        assert.ok(await overlay.isVisible());
      } else await skip.click();
      await next.waitFor();
      assert.equal(await overlay.locator('#benMatchRobotCard .ben-bal-face').count(), 1);
      assert.ok(await overlay.evaluate(node => {
        const player = node.querySelector('#benMatchPlayerCard').getBoundingClientRect();
        const robot = node.querySelector('#benMatchRobotCard').getBoundingClientRect();
        const leftValue = node.querySelector('.ben-match-player-value').getBoundingClientRect();
        const rightValue = node.querySelector('.ben-match-robot-value').getBoundingClientRect();
        return player.left >= 0 && player.right < robot.left && robot.right <= innerWidth &&
          player.bottom <= innerHeight && robot.bottom <= innerHeight && leftValue.right < rightValue.left;
      }));
      if (round === 1) {
        await checkCardLayout(overlay.locator('#benMatchArena .ben-bal-face'));
      }
      assert.equal(await match.locator('#benMatchPlayerField .is-used:disabled').count(), round);
      assert.equal(await robotField.locator('.is-used .ben-bal-face').count(), round);
      assert.equal(await robotField.locator('.ben-match-mystery').count(), 11 - round);
      assert.equal(await tracker.locator('li:not(.pending)').count(), round);
      assert.equal(await overlay.locator('#benMatchArena .is-compared, #benMatchArena .is-total').count(), 2);
      const scores = await match.locator('#benMatchPlayerScore, #benMatchRobotScore').allTextContents();
      assert.equal(scores.reduce((sum, score) => sum + Number(score), await tracker.locator('li.draw').count()), round);
      await next.click();
      assert.equal(await overlay.isVisible(), false);
    }
    assert.equal(await match.locator('#benMatchHistory').count(), 0);
    assert.match(await match.locator('#benMatchOutcome').textContent(), /^(VICTORY!|DEFEAT|DRAW)$/);
    const score = await match.locator('#benMatchFinalPlayer, #benMatchFinalRobot').allTextContents();
    assert.deepEqual(score, await match.locator('#benMatchPlayerScore, #benMatchRobotScore').allTextContents());
    assert.equal(await match.locator('#benMatchPacks li').count(), 3);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 830 });
      assert.ok(await match.evaluate(node => node.scrollWidth === node.clientWidth));
      await match.getByRole('button', { name: 'View Pitch' }).click();
      assert.equal(await match.locator('#benMatchPlayerField button:enabled').count(), 11);
      await robotPitch.click();
      assert.equal(await robotField.locator('button:enabled').count(), 11);
      assert.equal(await robotField.locator('.is-used, .ben-match-mystery').count(), 0);
      assert.equal(await actions.isVisible(), false);
      await robotField.locator('button').first().click();
      await page.locator('#benMatchInspect').waitFor();
      assert.equal(await page.locator('#benMatchInspect .ben-bal-stat strong').count(), 6);
      await page.locator('#benMatchInspectClose').click();
      await match.getByRole('button', { name: 'Back to Results' }).click();
      assert.deepEqual(score, await match.locator('#benMatchFinalPlayer, #benMatchFinalRobot').allTextContents());
    }
    await page.setViewportSize({ width: 390, height: 830 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await match.getByRole('button', { name: 'Play Again' }).click();
    await match.locator('#benMatchTracker [aria-label="Round 1: Unplayed"][aria-current]').waitFor();
    assert.equal(await vacant.count(), 11);
    assert.equal(setupRequests.length, 2);
    assert.deepEqual(setupRequests[0], setupRequests[1]);
    assert.ok(await match.evaluate(node => node.scrollWidth === node.clientWidth));
    const session = await desktop.context.newCDPSession(page);
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const tile = await vacant.first().boundingBox();
    const swipe = async (x, y, dx) => {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 4; step++) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 4, y }] });
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await swipe(tile.x + tile.width / 2, tile.y + tile.height / 2, -85);
    assert.equal(await robotPitch.getAttribute('aria-pressed'), 'true');
    assert.equal(await match.locator('#benMatchPlayerField [aria-pressed="true"]').count(), 0);
    const viewport = await match.locator('#benMatchPitchViewport').boundingBox();
    await swipe(viewport.x + viewport.width / 3, viewport.y + 25, 85);
    assert.equal(await yourPitch.getAttribute('aria-pressed'), 'true');
    await vacant.first().click();
    const dribble = actions.getByRole('button', { name: 'Dribble', exact: true });
    const actionBounds = await dribble.boundingBox();
    assert.ok(actionBounds && actionBounds.height >= 44 && actionBounds.y + actionBounds.height <= 830);
    await dribble.click();
    await next.waitFor();
    assert.equal(await skip.isVisible(), false);
    assert.equal(await overlay.locator('.ben-match-turn').count(), 0);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 830 });
      assert.ok(await overlay.evaluate(node => {
        const cards = [...node.querySelectorAll('.ben-match-stage-card')].map(card => card.getBoundingClientRect());
        return node.scrollWidth === node.clientWidth && cards[0].right < cards[1].left &&
          cards.every(card => card.left >= 0 && card.right <= innerWidth && card.bottom <= innerHeight);
      }));
    }
    await next.click();
    await vacant.first().click();
    await page.setViewportSize({ width: 320, height: 568 });
    await checkMatchViewport(match);
    assert.ok(await dock.evaluate(node => {
      const pitch = node.getBoundingClientRect();
      return [...node.querySelectorAll('#benMatchPreviewCard, #benMatchActions, #benMatchRobotSignal')].every(element => {
        const rect = element.getBoundingClientRect();
        return rect.left >= pitch.left && rect.right <= pitch.right && rect.bottom <= innerHeight;
      });
    }));
    if (process.env.BEN_BAL_MATCH_SCREENSHOTS) {
      await page.screenshot({ path: path.join(process.env.BEN_BAL_MATCH_SCREENSHOTS, 'ben-bal-v2.7.5-mobile.png') });
    }
    await robotPitch.click();
    await page.keyboard.press('Escape');
    await match.getByRole('button', { name: 'Leave Match', exact: true }).click();
    await dialog.getByText('11 / 11 assigned').waitFor();
    assert.deepEqual(lineup, savedLineup);
    await page.evaluate(({ template, slots, pairs }) => {
      const stats = Object.fromEntries(Object.keys(template.stats).map(key => [key, 0]));
      const cards = slots.map((slot, i) => ({ ...template, id: 'tie-fixture-' + i, stats,
        benBal: { ...pairs, naturalPosition: 'attack' } }));
      const lineup = Object.fromEntries(slots.map((slot, i) => [slot, cards[i].id]));
      const { prepareTeam, createMatch } = BenBalMatchEngine;
      const team = prepareTeam(lineup, new Map(cards.map(card => [card.id, card])));
      const match = createMatch(team, team, BenBalRobot.createPolicy(Math.random, team));
      BenBalMatch.open({ id: 'tie-fixture', view: match.view() }, {
        async submit(id, move) {
          match.submit(move.cardId, move.action ?? undefined);
          const result = match.view();
          match.advance();
          return { result, next: match.view() };
        }
      });
    }, { template: eligible[0], slots: formation.flatMap(row => row.slots), pairs: allocations.get(eligible[0].id) });
    await vacant.first().click();
    await match.getByRole('button', { name: 'Attack', exact: true }).click();
    await next.waitFor();
    assert.deepEqual(await overlay.locator('.ben-match-comparison-row > span').allTextContents(),
      ['Primary', 'Secondary', 'Total effective power']);
    assert.equal(await tracker.locator('li.draw').count(), 1);
    await overlay.getByText('Confrontation drawn').waitFor();
    await next.click();
    await page.keyboard.press('Escape');
    await match.getByRole('button', { name: 'Leave Match', exact: true }).click();
    await desktop.context.close();

    owned = owned.filter(card => card.id !== lineup.def1);
    const mobile = await open(390, 'new-device');
    const mobileDialog = mobile.page.getByRole('dialog', { name: 'BEN-BAL' });
    await mobileDialog.getByText('1 / 11 assigned').waitFor();
    assert.match(mobile.firstOpenStatus, /Cleared 1 saved slot/);
    assert.equal(await mobileDialog.getByRole('button', { name: 'DEF 1 · Empty slot' }).count(), 1);
    assert.ok(await mobileDialog.evaluate(node => node.scrollWidth === node.clientWidth));
    await checkCardLayout(mobileDialog.locator('#benBalCards .ben-bal-face'));
    if (process.env.BEN_BAL_SCREENSHOTS) {
      await captureCards(mobileDialog, path.join(process.env.BEN_BAL_SCREENSHOTS, 'ben-bal-v1.5-mobile.png'), 2);
    }
    await mobile.page.setViewportSize({ width: 360, height: 800 });
    await checkCardLayout(mobileDialog.locator('#benBalCards .ben-bal-face'));
    await mobile.page.setViewportSize({ width: 320, height: 800 });
    await checkCardLayout(mobileDialog.locator('#benBalCards .ben-bal-face'));
    await checkPitchLayout(mobileDialog);
    assert.ok(await mobileDialog.locator('.ben-bal-pitch-scroll').evaluate(node => node.scrollWidth > node.clientWidth));
    await mobileDialog.locator('[data-slot="def4"]').click();
    assert.equal(await mobileDialog.locator('[data-slot="def4"]').getAttribute('aria-pressed'), 'true');
    if (process.env.BEN_BAL_SCREENSHOTS) await mobile.page.screenshot({ path: path.join(process.env.BEN_BAL_SCREENSHOTS, 'ben-bal-mobile.png') });
    await mobile.context.close();
    console.log('Ben-Bal desktop and mobile browser checks passed.');
  } finally {
    await browser?.close();
    await new Promise(resolve => listener.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
