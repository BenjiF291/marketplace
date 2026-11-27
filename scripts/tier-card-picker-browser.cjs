const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const express = require('express');
const { chromium } = require(require.resolve('playwright', {
  paths: [path.resolve(__dirname, '../.ui-tools')]
}));
const { imageFilenames, registerCardData } = require('../card-data');

async function dragAcross(page, picker, first, last, modifier) {
  const start = await first.locator('img').boundingBox();
  const end = await last.locator('img').boundingBox();
  await page.mouse.move(start.x + 4, start.y + 4);
  if (modifier) await page.keyboard.down(modifier);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width - 4, end.y + end.height - 4, { steps: 5 });
  await picker.locator('.card-area-selection').waitFor();
  await page.mouse.up();
  if (modifier) await page.keyboard.up(modifier);
  await picker.locator('.card-area-selection').waitFor({ state: 'detached' });
}

const root = path.resolve(__dirname, '..');
const account = { id: 'tier-test-admin', username: 'Tier test admin', balance: 0, isAdmin: true };
const emma = 'Bronze_emma.png';
const lucas = 'bronze_lucas-van-ginkel_697afab46a47d8187f3c6eda8038fa0c1017029817a059c9d80431f0d8530dd0.png';
const tiers = new Map([
  ['bronze', { id: 'bronze', name: 'Bronze', order: 0, cards: [emma], packs: ['test-pack'] }],
  ['gold', { id: 'gold', name: 'Gold', order: 1, cards: [lucas], packs: [] }]
]);
const posts = [];
const packWrites = [];
const packs = [{ id: 'test-pack', name: 'Test pack', cardIds: [emma], color: '#445566',
  appearance: { base: '#445566', accent: '#123456', trim: '#fedcba' },
  shop: { enabled: true, price: 35, currency: 'bronze', cooldownMinutes: 75 },
  rewardCards: [{ options: [{ kind: 'footy', amount: 10, weight: 100 }] }] }];
let legacy = false;
let rejected;
const app = express();
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-User-Id');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());
app.use(express.static(path.join(root, 'public')));
registerCardData(app, root);
app.get('/users', (req, res) => res.json([account]));
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/packs', (req, res) => res.json(packs));
app.post('/packs', (req, res) => {
  packWrites.push(req.body);
  packs.push({ id: 'new-pack', ...req.body });
  res.status(201).json({ success: true, id: 'new-pack' });
});
app.put('/packs/:id', (req, res) => {
  packWrites.push(req.body);
  Object.assign(packs.find(pack => pack.id === req.params.id), req.body);
  res.json({ success: true });
});
app.get('/card-images', (req, res) => res.json(catalogue));
app.get('/ascend-tier-config', (req, res) => res.json([...tiers.values()]));
app.get('/admin/village', (req, res) => res.json({
  islandName: 'Tier test island',
  isAdmin: true,
  level: 1,
  maxLevel: 9,
  layout: require('../public/village-layout').profile({}),
  economy: require('../village-economy').profile({})
}));
app.use('/ascend-tier-assignment', (req, res, next) => {
  posts.push(req.body);
  if (legacy) {
    const { tierId, value } = req.body;
    if (typeof value !== 'string' || !value.trim() || value === rejected) return res.status(400).send('Invalid value');
    const tier = tiers.get(tierId);
    if (!tier) return res.status(404).send('Tier not found');
    tier.cards = [...new Set([...tier.cards, path.basename(value.trim())])];
    return res.json({ success: true, cards: tier.cards });
  }
  next();
});

let catalogue;
let unavailable;
let queue = Promise.resolve();
const db = {
  collection(name) {
    assert.equal(name, 'ascendTiers');
    return { doc: id => id };
  },
  runTransaction(fn) {
    const run = queue.then(() => fn({
      get: async id => ({ exists: tiers.has(id), data: () => tiers.get(id) }),
      update: (id, data) => Object.assign(tiers.get(id), data)
    }));
    queue = run.catch(() => {});
    return run;
  }
};
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const assignment = serverSource.slice(serverSource.indexOf("app.post('/ascend-tier-assignment'"),
  serverSource.indexOf('/* ------------------ PACKS ------------------ */'));
new Function('app', 'path', 'db', 'userIsAdmin', 'imageFilenames', '__dirname', assignment)(
  app, path, db, async id => id === account.id, async () => catalogue.filter(id => id !== unavailable), root
);
app.use((req, res) => res.json([]));

async function main() {
  catalogue = await imageFilenames(root);
  const listener = app.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const url = 'http://127.0.0.1:' + listener.address().port;
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined)
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true, serviceWorkers: 'block' });
    await context.addInitScript(account => {
      localStorage.setItem('userId', account.id);
      localStorage.setItem('username', account.username);
      localStorage.setItem('sessionToken', 'local-session');
      localStorage.setItem('footy-island-guide-v1:' + account.id, 'done');
    }, account);
    await context.route('**/*', route => new URL(route.request().url()).origin === url ? route.continue() : route.abort());
    await context.route('http://localhost:3000/**', async route => {
      const request = route.request();
      const source = new URL(request.url());
      await route.fulfill({ response: await context.request.fetch(url + source.pathname + source.search, {
        method: request.method(), headers: request.headers(), data: request.postData() ?? undefined
      }) });
    });
    const page = await context.newPage();
    const bronze = page.locator('.ascend-tier-card').filter({ hasText: 'Bronze' });
    const open = bronze.getByRole('button', { name: 'Add Card', exact: true });
    const picker = page.getByRole('dialog', { name: 'Add cards to Bronze' });
    const search = picker.getByRole('searchbox');
    const rows = picker.locator('.pack-card-option');
    const shown = rows.filter({ visible: true });
    const post = (data, user = account.id) => context.request.post(url + '/ascend-tier-assignment', {
      data, headers: { 'X-User-Id': user }
    });
    async function enterAdmin() {
      await page.goto(url + '/index.html');
      await page.locator('.village-viewport').waitFor({ state: 'visible' });
      await page.locator('.island-loading-screen').waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Admin tools', exact: true }).click();
      await page.locator('#adminSection summary').getByText('Ascend Tier Setup', { exact: true }).click();
      await open.waitFor();
    }
    await enterAdmin();
    assert.equal(await page.locator('#packCardPicker').count(), 0);
    const packPanel = page.locator('details').filter({ has: page.locator('#packEditorSelect') });
    await packPanel.locator('summary').click();
    const selectPackCards = packPanel.getByRole('button', { name: 'Select Cards' });
    const packPicker = page.getByRole('dialog', { name: 'Select cards for this pack' });
    const packRows = packPicker.locator('.pack-card-option');
    const poolCard = id => packRows.locator('input[value=' + JSON.stringify(id) + ']');
    const packCount = packPanel.locator('#packCardSelectionCount');
    await selectPackCards.click();
    await packRows.first().waitFor();
    assert.equal(await packRows.count(), catalogue.length);
    await packRows.first().locator('img').click();
    assert.equal(await packPicker.locator('input:checked').count(), 1);
    await packRows.first().locator('img').click();
    assert.equal(await packPicker.locator('input:checked').count(), 0);
    await dragAcross(page, packPicker, packRows.nth(0), packRows.nth(2));
    assert.equal(await packPicker.locator('input:checked').count(), 3);
    await dragAcross(page, packPicker, packRows.nth(4), packRows.nth(5), 'Control');
    assert.equal(await packPicker.locator('input:checked').count(), 5);
    await dragAcross(page, packPicker, packRows.nth(3), packRows.nth(4), 'Shift');
    assert.equal(await packPicker.locator('input:checked').count(), 6);
    await dragAcross(page, packPicker, packRows.nth(0), packRows.nth(1));
    assert.equal(await packPicker.locator('output').textContent(), '2 cards selected');
    const filteredSearch = packPicker.getByRole('searchbox');
    await filteredSearch.fill('Lucas van Ginkel');
    const lucasLabel = packRows.filter({ has: page.locator('input[value=' + JSON.stringify(lucas) + ']') });
    await dragAcross(page, packPicker, lucasLabel, lucasLabel);
    assert.equal(await packPicker.locator('input:checked').count(), 3);
    await packPicker.getByRole('button', { name: 'Clear Selection' }).click();
    await packPicker.getByRole('searchbox').fill('Lucas van Ginkel');
    await packPicker.getByRole('button', { name: 'Select All Visible' }).click();
    await packPicker.getByRole('searchbox').fill('Emma Huismans');
    await poolCard(emma).check();
    await packPicker.getByRole('button', { name: 'Add 2 Cards to Pack' }).click();
    await packPicker.waitFor({ state: 'hidden' });
    assert.equal(await packCount.textContent(), '2 cards selected');
    assert.equal(packWrites.length, 0);
    await selectPackCards.click();
    await packRows.first().waitFor();
    assert.ok(await poolCard(lucas).isChecked());
    await packPicker.getByRole('button', { name: 'Clear Selection' }).click();
    await packPicker.getByRole('button', { name: 'Cancel' }).click();
    assert.equal(await packCount.textContent(), '2 cards selected');
    await packPanel.locator('#packName').fill('New local pack');
    page.on('dialog', dialog => dialog.dismiss());
    const savedNew = page.waitForResponse(res => res.url().endsWith('/packs') && res.request().method() === 'POST');
    await packPanel.getByRole('button', { name: 'Save New Pack' }).click();
    await savedNew;
    await packPanel.locator('#packEditorSelect option[value="new-pack"]').waitFor({ state: 'attached' });
    await page.waitForFunction(() => document.querySelector('#packName').value === '');
    assert.deepEqual(packWrites[0].cardIds.toSorted(), [emma, lucas].toSorted());
    const originalPack = structuredClone(packs[0]);
    await packPanel.locator('#packEditorSelect').selectOption('test-pack');
    await selectPackCards.click();
    await packRows.first().waitFor();
    assert.ok(await poolCard(emma).isChecked());
    await packPicker.getByRole('button', { name: 'Clear Selection' }).click();
    await packPicker.getByRole('button', { name: 'Add 0 Cards to Pack' }).click();
    await packPicker.waitFor({ state: 'hidden' });
    assert.equal(await packCount.textContent(), '0 cards selected');
    assert.equal(packWrites.length, 1);
    const savedEdit = page.waitForResponse(res => res.url().endsWith('/packs/test-pack') && res.request().method() === 'PUT');
    await packPanel.getByRole('button', { name: 'Save Pack Changes' }).click();
    await savedEdit;
    const { id: originalId, ...originalSettings } = originalPack;
    assert.deepEqual(packWrites[1], { ...originalSettings, cardIds: [] });
    await open.click();
    await rows.first().waitFor();
    assert.equal(await rows.count(), catalogue.length);
    assert.equal(await shown.count(), catalogue.length);
    assert.ok(await picker.getByRole('button', { name: 'Add 0 Cards to Tier' }).isDisabled());
    const member = rows.filter({ hasText: 'Emma Huismans' }).filter({ hasText: 'Already in this tier' });
    assert.ok(await member.getByRole('checkbox').isDisabled());
    await search.fill('Lucas van Ginkel');
    assert.equal(await shown.count(), 1);
    const lucasRow = shown.first();
    const thumbnail = lucasRow.getByRole('img', { name: 'Lucas van Ginkel' });
    await thumbnail.evaluate(image => image.decode());
    await dragAcross(page, picker, lucasRow, lucasRow);
    assert.ok(await lucasRow.getByRole('checkbox').isChecked());
    assert.equal(await lucasRow.evaluate(row => getComputedStyle(row).borderTopColor), 'rgb(37, 132, 84)');
    await search.fill('Elena');
    await picker.getByRole('combobox', { name: 'Rarity' }).selectOption('Gold');
    const goldRows = await shown.count();
    assert.ok(goldRows > 0 && goldRows < catalogue.length);
    await picker.getByRole('button', { name: 'Select All Visible' }).click();
    assert.equal(await picker.locator('output').textContent(), (1 + goldRows) + ' cards selected');
    await picker.getByRole('button', { name: 'Clear Selection' }).click();
    assert.ok(await picker.getByRole('button', { name: 'Add 0 Cards to Tier' }).isDisabled());
    await picker.getByRole('button', { name: 'Select All Visible' }).click();
    await picker.getByRole('button', { name: 'Cancel' }).click();
    assert.equal(posts.length, 0);
    assert.deepEqual(tiers.get('bronze').cards, [emma]);

    await page.setViewportSize({ width: 320, height: 568 });
    await open.click();
    await rows.first().waitFor();
    assert.equal(await shown.count(), catalogue.length);
    assert.ok(await picker.evaluate(dialog => {
      const grid = dialog.querySelector('.pack-card-picker');
      grid.scrollTop = 100;
      const footer = dialog.querySelector('footer').getBoundingClientRect();
      return grid.scrollTop > 0 && footer.bottom <= innerHeight && dialog.scrollWidth === dialog.clientWidth;
    }));
    const mobileGrid = picker.locator('.pack-card-picker');
    const mobileBounds = await mobileGrid.boundingBox();
    await mobileGrid.evaluate(grid => { grid.scrollTop = 0; });
    const touch = await context.newCDPSession(page);
    const x = Math.round(mobileBounds.x + mobileBounds.width / 2);
    const y = Math.round(mobileBounds.y + mobileBounds.height - 20);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 8; step++) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 12 }] });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => document.querySelector('#adminCardPicker .pack-card-picker').scrollTop > 0);
    assert.equal(await picker.locator('.card-area-selection').count(), 0);
    assert.equal(await picker.locator('input:checked').count(), 0);
    await search.fill('Lucas van Ginkel');
    await shown.first().locator('img').tap();
    assert.ok(await shown.first().getByRole('checkbox').isChecked());
    await shown.first().locator('img').tap();
    assert.equal(await picker.locator('input:checked').count(), 0);
    await shown.first().getByRole('checkbox').check();
    await search.fill('Elena Verstappen');
    await shown.first().getByRole('checkbox').check();
    const additions = await rows.locator('input:checked').evaluateAll(inputs => inputs.map(input => input.value));
    assert.equal(additions.length, 2);
    await picker.getByRole('button', { name: 'Add 2 Cards to Tier' }).click();
    await picker.waitFor({ state: 'hidden' });
    assert.equal(posts.length, 1);
    assert.deepEqual(posts[0].values.sort(), additions.sort());
    assert.ok(await bronze.getByText('Cards (3)', { exact: true }).isVisible());
    assert.equal(await bronze.locator('[data-tier-card-status]').textContent(), '2 cards added to Bronze.');
    assert.deepEqual(tiers.get('gold').cards, [lucas]);
    assert.deepEqual(tiers.get('bronze').packs, ['test-pack']);

    await enterAdmin();
    assert.ok(await bronze.getByText('Cards (3)', { exact: true }).isVisible());
    await open.click();
    await search.fill('Lucas van Ginkel');
    await shown.first().waitFor();
    assert.ok(await shown.first().getByRole('checkbox').isDisabled());
    await picker.getByRole('button', { name: 'Cancel' }).press('Escape');
    await picker.waitFor({ state: 'hidden' });

    const payload = values => ({ tierId: 'bronze', type: 'card', action: 'add', values });
    const extra = catalogue.filter(id => !tiers.get('bronze').cards.includes(id)).slice(0, 2);
    unavailable = extra[1];
    assert.equal((await post(payload(extra), 'non-admin')).status(), 403);
    const [partial, retry] = await Promise.all([
      post(payload([lucas, ...extra, extra[0]])), post(payload([extra[0]]))
    ]);
    const [first, second] = await Promise.all([partial.json(), retry.json()]);
    assert.equal(first.success, false);
    assert.deepEqual(first.unavailable, [unavailable]);
    assert.equal([...first.added, ...second.added].filter(id => id === extra[0]).length, 1);
    assert.equal(tiers.get('bronze').cards.filter(id => id === extra[0]).length, 1);
    assert.ok(first.alreadyAssigned.includes(lucas));
    assert.equal((await post({ tierId: 'bronze', type: 'pack', action: 'remove', value: 'test-pack' })).status(), 200);
    assert.deepEqual(tiers.get('bronze').packs, []);
    assert.equal((await post(payload(['../' + emma]))).status(), 400);
    assert.equal((await post(payload(['C:\\images\\' + emma]))).status(), 400);
    assert.equal((await post({ tierId: 'bronze', type: 'card', action: 'add', value: emma })).status(), 200);

    legacy = true;
    const mixed = catalogue.filter(id => !tiers.get('bronze').cards.includes(id));
    const short = mixed.filter(id => !/[a-f0-9]{32}/i.test(id));
    const imported = mixed.filter(id => /[a-f0-9]{32}/i.test(id));
    const batches = [[short[0]], [...short.slice(1, 3), ...imported.slice(0, 3)],
      [...short.slice(3, 13), ...imported.slice(3, 16)]];
    const reproduction = await post(payload(batches[2]));
    assert.equal(reproduction.status(), 400);
    assert.equal(await reproduction.text(), 'Invalid value');
    const selectCards = async ids => {
      await open.click();
      await rows.first().waitFor();
      await rows.locator('input').evaluateAll((inputs, ids) => {
        for (const input of inputs) if (ids.includes(input.value)) input.click();
      }, ids);
    };
    for (const batch of batches) {
      await selectCards(batch);
      const before = tiers.get('bronze').cards.length;
      const start = posts.length;
      const action = batch.length === 1 ? 'Add 1 Card to Tier' : `Add ${batch.length} Cards to Tier`;
      await picker.getByRole('button', { name: action }).click();
      await picker.waitFor({ state: 'hidden' });
      assert.deepEqual(posts.slice(start)[0].values.toSorted(), batch.toSorted());
      assert.deepEqual(posts.slice(start + 1).map(entry => entry.value).toSorted(), batch.toSorted());
      assert.ok(await bronze.getByText(`Cards (${before + batch.length})`, { exact: true }).isVisible());
      assert.ok(batch.every(id => tiers.get('bronze').cards.filter(card => card === id).length === 1));
    }
    const remaining = short.slice(13, 15);
    rejected = remaining[1];
    await selectCards(remaining);
    await picker.getByRole('button', { name: 'Add 2 Cards to Tier' }).click();
    await picker.getByText(/server rejected the selected card identifier/).waitFor();
    assert.equal(await picker.locator('output').textContent(), '1 card selected');
    assert.ok(tiers.get('bronze').cards.includes(remaining[0]));
    assert.ok(!tiers.get('bronze').cards.includes(rejected));
    rejected = undefined;
    await picker.getByRole('button', { name: 'Add 1 Card to Tier' }).click();
    await picker.waitFor({ state: 'hidden' });
    await enterAdmin();
    assert.ok(await bronze.getByText(`Cards (${tiers.get('bronze').cards.length})`, { exact: true }).isVisible());
    assert.ok(remaining.every(id => tiers.get('bronze').cards.includes(id)));

    catalogue = Array.from({ length: 501 }, (_, index) => `Bronze_fixture-${index}.png`);
    await page.setViewportSize({ width: 1440, height: 900 });
    await packPanel.locator('summary').click();
    await selectPackCards.click();
    await packRows.first().waitFor();
    const grid = packPicker.locator('.pack-card-picker');
    const bounds = await grid.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + element.clientLeft, y: rect.top + element.clientTop,
        width: element.clientWidth, height: element.clientHeight };
    });
    await page.mouse.move(bounds.x + 3, bounds.y + 3);
    await page.mouse.down();
    const dragStarted = performance.now();
    await page.mouse.move(bounds.x + bounds.width - 3, bounds.y + bounds.height - 3, { steps: 10 });
    await packPicker.locator('.card-area-selection').waitFor();
    await packPicker.getByText('501 cards selected', { exact: true }).waitFor({ timeout: 20000 });
    console.log(`Selected 501 cards by edge-scrolling in ${((performance.now() - dragStarted) / 1000).toFixed(1)} seconds.`);
    const pagePosition = await page.evaluate(() => scrollY);
    await page.mouse.up();
    await packPicker.locator('.card-area-selection').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => scrollY), pagePosition);
    assert.ok(await packPicker.getByRole('button', { name: 'Select All Visible' }).isDisabled());
    await packPicker.getByRole('button', { name: 'Add 501 Cards to Pack' }).click();
    await packPicker.getByText('Choose up to 500 cards for a pack.', { exact: true }).waitFor();
    assert.equal(await packPicker.locator('output').textContent(), '501 cards selected');
    assert.equal(await packPicker.locator('input:checked').count(), 501);
    assert.equal(packWrites.length, 2);
    await poolCard(catalogue[0]).uncheck();
    await packPicker.getByRole('button', { name: 'Add 500 Cards to Pack' }).click();
    await packPicker.waitFor({ state: 'hidden' });
    assert.equal(await packCount.textContent(), '500 cards selected');
    assert.equal(packWrites.length, 2);
    console.log('Shared picker passed in Edge at 1440×900 and 320×568, including the 500-card pack limit.');
  } finally {
    await browser?.close();
    await new Promise(resolve => listener.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
