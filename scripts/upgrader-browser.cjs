const assert = require('node:assert/strict');
const path = require('node:path');
const { once } = require('node:events');
const express = require('express');
const { chromium } = require(require.resolve('playwright', { paths: [path.resolve(__dirname, '../.ui-tools')] }));

async function verifyGallery(dialog, prefixes) {
  const artwork = await dialog.locator('.upgrader-tile img').evaluateAll(images => Promise.all(images.map(async image => {
    image.loading = 'eager';
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let transparent = 0;
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) transparent++;
      if (data[i] === 255) opaque++;
    }
    if (!transparent || !opaque) throw new Error('Expected transparent background and solid artwork: ' + image.src);
    return new URL(image.src).pathname;
  })));
  const tiers = ['bronze', 'silver', 'gold', 'platinum', 'lightning', 'ultra'];
  assert.deepEqual(artwork.sort(), prefixes.flatMap(prefix =>
    tiers.map(tier => '/assets/upgraders/' + prefix + '-' + tier + '.png')).sort());
}

async function main() {
  const app = express();
  app.use(express.json());
  let counts;
  let upgrade;
  let effectiveness;
  let favourites;
  let favouritePool;
  let savedRewards = [];
  const random = require('../random-card-rewards');
  const previewPools = random.definitions.map((entry, index) => ({ ...entry, count: index ? index : 0 }));
  const fixed = { id: 'Bronze_emma.png', name: 'Emma Huismans' };
  const rewardCatalog = { ...require('../public/upgrader-catalog').rewards, [random.kind]: previewPools, card: [fixed] };
  const baseStats = { pow: 60, ama: 70, size: 80, rang: 90, loy: 65, acu: 50 };
  const bonuses = { pow: 1, ama: 2, size: 3, rang: 4, loy: 5, acu: 1 };
  app.get('/', (req, res) => res.send(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/upgrader.css">
    <main class="container"><div id="dyeHeaderControls"></div><section id="upgraderInventory"></section><section id="supplies"></section><section id="upgraderAdmin"><div class="upgrader-holdings"></div></section><button onclick="openEditor()">Edit extra rewards</button></main>
    <script>const API_URL=location.origin;const resourceHeaders=()=>({'Content-Type':'application/json'});
    function loadInventory(){UpgraderWorkshop.refresh()}
    window.openRubyItemInventory=()=>UpgraderWorkshop.showPotions(document.querySelector('#supplies'));
    async function openEditor(){const cards=await fetch('/fixture/pack').then(res=>res.json());
      await FreePack.editRewards(cards,cards=>fetch('/fixture/pack',{method:'POST',headers:resourceHeaders(),body:JSON.stringify(cards)}));}</script>
    <script src="/ben-bal-card.js"></script><script src="/upgrader-catalog.js"></script><script src="/upgrader-workshop.js"></script>
    <script src="/currency-format.js"></script><script src="/card-display-names.js"></script><script src="/free-pack.js"></script><script src="/village-interiors.js"></script>
    <script>VillageInteriors.open({id:'archive',name:'Card Archive'},{});loadInventory()</script>`));
  app.get('/admin/free-pack', (req, res) => res.json({ catalog: {
    gem: [{ id: 'bronze', name: 'Ruby' }], [random.kind]: previewPools, card: [fixed]
  } }));
  app.get('/card-display-names', (req, res) => res.json([{ filename: fixed.id, name: fixed.name, id: fixed.id }]));
  app.get('/admin/pack-reward-presets', (req, res) => res.json({ presets: [] }));
  app.get('/fixture/pack', (req, res) => res.json(savedRewards));
  app.post('/fixture/pack', (req, res) => {
    savedRewards = require('../pack-builder').validate({ name: 'Test pack', rewardCards: req.body }, rewardCatalog).rewardCards;
    res.json(savedRewards);
  });
  app.get('/upgraders', (req, res) => {
    const card = { name: 'Emma Huismans', itemId: 'emma', imageUrl: '/images/Bronze_emma.png',
      level: upgrade?.level || 'normal', effectiveness };
    const cards = req.query.token === 'legendary:silver' ? [] : req.query.token === 'epic:bronze'
      ? [card, { ...card, itemId: 'emma-copy', effectiveness: 0 }] : [card];
    res.json({ counts, cards });
  });
  const favouriteCard = id => ({ name: 'Emma Huismans', itemId: id,
    imageUrl: '/images/Bronze_emma.png', level: 'normal', tier: 'Bronze', overall: 15,
    effectiveness: id === 'emma' ? 25 : 78 });
  const visualTiers = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Lightling', 'Ultra'];
  const favouriteCatalogue = ['emma', 'emma-copy'].map(favouriteCard).concat(
    visualTiers.flatMap(tier => Array.from({ length: 84 }, (_, i) => ({
      ...favouriteCard(tier + i), name: tier + ' Dragon ' + i, tier, overall: i,
      level: i === 83 ? 'legendary' : i === 82 ? 'epic' : 'normal'
    }))),
    { ...favouriteCard('rare'), name: 'Rare Gold Dragon', tier: 'Rare Gold', overall: 60 },
    { ...favouriteCard('special'), name: 'Special Dragon', tier: 'Mirror', overall: 99 }
  );
  app.get('/upgraders/favourites', (req, res) => res.json(req.query.select
    ? { slots: favourites, cards: favouritePool }
    : { slots: favourites.map(id => id ? favouriteCard(id) : null) }));
  app.post('/upgraders/favourites', (req, res) => {
    favourites[req.body.slot] = req.body.itemId;
    res.json({ slots: favourites });
  });
  app.post('/upgraders/potion', (req, res) => {
    assert.equal(req.body.token, 'card-xp:75');
    effectiveness = 75;
    counts[req.body.token]--;
    res.json({ counts, effectiveness });
  });
  app.get('/upgraders/admin', (req, res) => res.json(req.query.player
    ? { cards: [{ name: 'Emma Huismans', itemId: 'emma', effectiveness }] }
    : { players: [{ id: 'captain', name: 'Test Captain' }] }));
  app.post('/upgraders/admin', (req, res) => {
    assert.equal(req.body.player, 'captain');
    if (req.body.action === 'grant') counts[req.body.token] = (counts[req.body.token] || 0) + 1;
    else {
      assert.equal(req.body.itemId, 'emma');
      effectiveness = require('../public/upgrader-catalog').get(req.body.token).target;
    }
    res.json({ counts, effectiveness });
  });
  app.post('/upgraders/craft', (req, res) => {
    const recipe = require('../card-upgrades').recipe(req.body.level, req.body.tier, req.body.shards);
    for (const key of recipe.inputs) counts[key]--;
    counts[recipe.output] = 1;
    res.json({ counts, token: recipe.output });
  });
  app.post('/upgraders/apply', (req, res) => {
    assert.equal(req.body.token, 'epic:bronze');
    assert.equal(req.body.itemId, 'emma');
    counts[req.body.token]--;
    upgrade = { level: 'epic', baseStats, bonuses,
      effectiveStats: Object.fromEntries(Object.keys(baseStats).map(key => [key, Math.round(baseStats[key] * (1 + bonuses[key] / 100))])) };
    res.json({ counts, upgrade, card: { overall: 67 } });
  });
  app.use(express.static(path.resolve(__dirname, '../public')));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
      (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined) });
    for (const width of [1440, 768, 320]) {
      counts = { 'core:bronze': 1, 'shard:gold': 1, 'shard:ultra': 1, 'card-xp:75': 1, 'legendary:silver': 1 };
      upgrade = null;
      effectiveness = 0;
      favourites = [null, null, null];
      favouritePool = favouriteCatalogue;
      const page = await browser.newPage({ viewport: { width, height: width === 320 ? 568 : 900 }, reducedMotion: 'reduce' });
      await page.route('**/*', route => route.request().url().startsWith(url + '/') ? route.continue() : route.abort());
      await page.goto(url);
      const archive = page.getByRole('navigation', { name: 'Building stations' });
      assert.deepEqual(await archive.getByRole('button').allTextContents(),
        ['Collection', 'Favourite Cards', 'Open packs', 'Items & supplies', 'Upgrader Workshop']);
      const dialog = page.getByRole('dialog');
      const favouriteButton = archive.getByRole('button', { name: 'Favourite Cards' });
      await favouriteButton.click();
      const favouriteSlots = dialog.locator('.favourite-card-slot');
      await favouriteSlots.nth(2).waitFor();
      assert.equal(await favouriteSlots.count(), 3);
      await favouriteSlots.first().getByRole('button', { name: 'Equip card' }).click();
      const tierFilter = dialog.getByLabel('Filter by Tier');
      const favouriteSearch = dialog.getByRole('searchbox', { name: 'Search your cards' });
      const cardsGrid = dialog.locator('.favourite-picker-card');
      await dialog.getByText('508 cards', { exact: true }).waitFor();
      assert.equal(await cardsGrid.count(), 48);
      assert.equal(await dialog.getByRole('button', { name: /^(Previous|Next)$/ }).count(), 0);
      assert.match(await cardsGrid.first().textContent(), /Ultra Dragon 83.*legendary/);
      assert.match(await cardsGrid.nth(1).textContent(), /Ultra Dragon 82.*epic/);
      assert.equal(await cardsGrid.first().locator('img').getAttribute('src'), '/images/Bronze_emma.png');
      await favouriteSearch.fill('Special Dragon');
      await dialog.getByText('1 matching card').waitFor();
      assert.match(await cardsGrid.first().textContent(), /Special Dragon/);
      await favouriteSearch.clear();
      await dialog.getByText('508 cards', { exact: true }).waitFor();
      assert.equal(await dialog.locator('.favourite-picker-grid').evaluate(grid =>
        getComputedStyle(grid).gridTemplateColumns.split(' ').length), width === 320 ? 2 : width === 768 ? 3 : 5);
      assert.ok(await dialog.evaluate(el => el.scrollWidth === el.clientWidth && el.scrollHeight === el.clientHeight));
      const filterTop = (await tierFilter.boundingBox()).y;
      assert.ok(await dialog.locator('.favourite-picker-scroll').evaluate(scroller => {
        scroller.scrollTop = 100;
        return scroller.scrollTop > 0;
      }));
      assert.equal((await tierFilter.boundingBox()).y, filterTop);
      const scroller = dialog.locator('.favourite-picker-scroll');
      async function scrollThrough(total) {
        const count = await cardsGrid.count();
        for (let loaded = count; loaded < total; loaded = Math.min(loaded + 24, total)) {
          await scroller.evaluate(el => { el.scrollTop = el.scrollHeight; });
          await cardsGrid.nth(Math.min(loaded + 24, total) - 1).waitFor();
        }
        assert.equal(await cardsGrid.count(), total);
      }
      await scrollThrough(508);
      assert.match(await cardsGrid.last().textContent(), /Special Dragon/);
      for (const tier of visualTiers) {
        await tierFilter.selectOption(tier === 'Lightling' ? 'lightning' : tier.toLowerCase());
        assert.match(await cardsGrid.first().textContent(), new RegExp(tier === 'Gold' ? 'Rare Gold Dragon' : tier + ' Dragon 83'));
      }
      await tierFilter.selectOption('bronze');
      await dialog.getByText('86 cards', { exact: true }).waitFor();
      await scrollThrough(86);
      await tierFilter.selectOption('ultra');
      await favouriteSearch.fill('Emma');
      await dialog.getByText('No matching cards found.').waitFor();
      await dialog.getByRole('button', { name: 'Reset filters' }).click();
      await favouriteSearch.fill('Emma');
      await dialog.getByText('2 matching cards').waitFor();
      await cardsGrid.filter({ hasText: '25%' }).click();
      await dialog.getByText('Next upgrade: +6 total stat points').waitFor();
      assert.equal(await dialog.getByRole('progressbar').getAttribute('value'), '25');
      await favouriteSlots.nth(1).getByRole('button', { name: 'Equip card' }).click();
      await favouriteSearch.fill('Emma');
      assert.ok(await cardsGrid.filter({ hasText: 'Already Favourite' }).isDisabled());
      await cardsGrid.filter({ hasText: '78%' }).click();
      await favouriteSlots.nth(1).getByText('Upgrade Effectiveness 78%').waitFor();
      await dialog.getByRole('button', { name: 'Close' }).click();
      await page.reload();
      await favouriteButton.click();
      await favouriteSlots.nth(1).getByText('Upgrade Effectiveness 78%').waitFor();
      await favouriteSlots.first().getByRole('button', { name: 'Change' }).click();
      await favouriteSearch.fill('Emma');
      assert.ok(await cardsGrid.filter({ hasText: 'Current slot' }).isEnabled());
      await dialog.getByRole('button', { name: 'Back to Favourite Cards' }).click();
      await favouriteSlots.first().getByRole('button', { name: 'Remove' }).click();
      await favouriteSlots.first().getByText('Empty slot').waitFor();
      favouritePool = favouriteCatalogue.filter(card => card.tier === 'Bronze');
      await favouriteSlots.first().getByRole('button', { name: 'Equip card' }).click();
      await tierFilter.selectOption('ultra');
      await dialog.getByText('No cards found in this tier.').waitFor();
      await dialog.getByRole('button', { name: 'Back to Favourite Cards' }).click();
      favouritePool = [];
      await favouriteSlots.first().getByRole('button', { name: 'Equip card' }).click();
      await dialog.getByText("You don't own any cards yet.").waitFor();
      await dialog.getByRole('button', { name: 'Close' }).click();
      await archive.getByRole('button', { name: 'Upgrader Workshop' }).click();
      await dialog.getByRole('button', { name: 'Materials', exact: true }).click();
      assert.equal(await dialog.locator('.upgrader-tile').count(), 12);
      await verifyGallery(dialog, ['upgrade-shard', 'upgrader-core']);
      assert.equal(await dialog.getByText('Owned: 0', { exact: true }).count(), 9);
      await dialog.getByRole('button', { name: 'Crafting', exact: true }).click();
      await dialog.getByRole('button', { name: 'Legendary Crafting', exact: true }).click();
      await dialog.getByRole('group', { name: 'Core', exact: true }).getByRole('button', { name: /Bronze/ }).click();
      assert.equal(await dialog.locator('[data-missing="true"]').count(), 3);
      assert.equal(await dialog.locator('.upgrader-slot').count(), 6);
      assert.ok(await dialog.getByRole('button', { name: 'Forge Upgrader' }).isDisabled());
      await dialog.getByRole('button', { name: 'Epic Crafting', exact: true }).click();
      const shard1 = dialog.getByRole('group', { name: 'Shard 1' });
      const shard2 = dialog.getByRole('group', { name: 'Shard 2' });
      await shard1.getByRole('button', { name: /Gold/ }).click();
      assert.ok(await shard2.getByRole('button', { name: /Gold/ }).isDisabled());
      await shard2.getByRole('button', { name: /Ultra/ }).click();
      await dialog.getByRole('button', { name: 'Forge Upgrader' }).click();
      await dialog.getByText(/Epic Bronze Upgrader crafted/).waitFor();
      await dialog.getByRole('button', { name: 'Close' }).click();
      await archive.getByRole('button', { name: 'Items & supplies' }).click();
      await page.getByRole('button', { name: 'Use Potion' }).click();
      await dialog.getByRole('button', { name: 'Emma Huismans' }).click();
      await dialog.getByText(/0% → 75%/).waitFor();
      await dialog.getByRole('button', { name: 'Confirm Potion' }).click();
      await dialog.getByText('Upgrade Effectiveness is now 75%.').waitFor();
      await dialog.getByRole('button', { name: 'Close' }).click();
      await archive.getByRole('button', { name: 'Upgrader Workshop' }).click();
      await dialog.getByRole('button', { name: 'Upgrader Tokens', exact: true }).click();
      await verifyGallery(dialog, ['upgrader-epic', 'upgrader-legendary']);
      const tokens = dialog.locator('.upgrader-tile');
      await tokens.filter({ hasText: 'Legendary Silver Upgrader' }).getByRole('button', { name: 'Use Upgrader' }).click();
      await dialog.getByText('No eligible cards for this upgrader.').waitFor();
      await dialog.getByText('Requires an Epic Silver card.').waitFor();
      await dialog.getByRole('button', { name: 'Close' }).click();
      await archive.getByRole('button', { name: 'Upgrader Workshop' }).click();
      await dialog.getByRole('button', { name: 'Upgrader Tokens', exact: true }).click();
      await tokens.filter({ hasText: 'Epic Bronze Upgrader' }).getByRole('button', { name: 'Use Upgrader' }).click();
      const search = dialog.getByRole('searchbox', { name: 'Search eligible cards' });
      const copies = dialog.getByRole('button', { name: 'Emma Huismans', exact: true });
      await dialog.getByText('2 eligible cards', { exact: true }).waitFor();
      assert.match(await copies.nth(0).textContent(), /75%.*\+15 total stat points/);
      assert.match(await copies.nth(1).textContent(), /0%.*\+1 total stat points/);
      await search.fill('not owned');
      await dialog.getByText('No matching cards · 2 eligible cards').waitFor();
      assert.equal(await copies.count(), 0);
      await search.fill('emma');
      await copies.first().click();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      assert.equal(counts['epic:bronze'], 1);
      await copies.first().click();
      await dialog.getByRole('button', { name: 'Confirm Upgrade' }).click();
      await dialog.getByRole('heading', { name: 'Emma Huismans — Epic' }).waitFor();
      assert.equal(await dialog.locator('dt').count(), 6);
      assert.equal(await dialog.locator('.upgraded-card-badge').textContent(), 'EPIC');
      assert.ok(await dialog.evaluate(el => el.scrollWidth === el.clientWidth));
      assert.equal(await dialog.locator('.upgrader-reveal').evaluate(el => getComputedStyle(el).animationName), 'none');
      assert.equal(counts['epic:bronze'], 0);
      const legendary = await page.evaluate(() => {
        const stamp = BenBalCard.upgradeStamp('legendary');
        document.body.append(stamp);
        const result = { text: stamp.textContent, background: getComputedStyle(stamp).backgroundImage };
        stamp.remove();
        return result;
      });
      assert.equal(legendary.text, 'LEGENDARY');
      assert.match(legendary.background, /255, 224, 128/);
      await dialog.getByRole('button', { name: 'Close' }).click();
      await page.getByRole('button', { name: 'Card XP Potion Testing' }).click();
      await dialog.getByLabel('Player', { exact: true }).selectOption('captain');
      await dialog.getByLabel('Potion target').selectOption('card-xp:50');
      await dialog.getByRole('button', { name: 'Grant Potion' }).click();
      await dialog.getByText('Potion granted.').waitFor();
      assert.equal(counts['card-xp:50'], 1);
      await dialog.getByLabel('Owned card').selectOption('emma');
      await dialog.getByLabel('Potion target').selectOption('card-xp:100');
      await dialog.getByRole('button', { name: 'Set Effectiveness for Testing' }).click();
      await dialog.getByText('Testing effectiveness saved.').waitFor();
      assert.equal(effectiveness, 100);
      assert.equal(counts['card-xp:100'], undefined);
      await dialog.getByRole('button', { name: 'Close' }).click();
      assert.equal(await page.getByRole('button', { name: 'Reload Upgrader Inventory' }).count(), 0);
      if (width === 1440) {
        await page.getByRole('button', { name: 'Edit extra rewards' }).click();
        const editor = page.getByRole('dialog', { name: 'Edit pack rewards' });
        const entries = [...rewardCatalog.upgradeShard, ...rewardCatalog.upgradeCore, ...rewardCatalog.upgradeToken];
        for (const [index, entry] of entries.entries()) {
          if (index) await editor.getByRole('button', { name: 'Add reward option' }).click();
          const row = editor.locator('.free-pack-option').nth(index);
          await row.locator('select').first().selectOption(entry.kind);
          const items = row.locator('select').last();
          assert.equal(await items.locator('option').count(), rewardCatalog[entry.kind].length);
          await items.selectOption(entry.id);
          await row.locator('input[type=number]').nth(0).fill('1');
          await row.locator('input[type=number]').nth(1).fill('3');
          await row.locator('input[type=number]').nth(2).fill(index === 23 ? '8' : '4');
        }
        await editor.getByRole('button', { name: 'Apply rewards to builder' }).click();
        await editor.waitFor({ state: 'hidden' });
        assert.equal(savedRewards[0].options.length, 24);
        await page.reload();
        await page.getByRole('button', { name: 'Edit extra rewards' }).click();
        await editor.waitFor();
        const restored = await editor.locator('.free-pack-option').evaluateAll(rows =>
          rows.map(row => [...row.querySelectorAll('select, input[type=number]')].map(control => control.value)));
        assert.deepEqual(restored, entries.map((entry, index) =>
          [entry.kind, entry.id, '1', '3', index === 23 ? '8' : '4']));
        await editor.getByRole('button', { name: 'Add reward card', exact: true }).click();
        const card = editor.locator('fieldset').last();
        for (const [index, entry] of [...previewPools, { ...fixed, category: 'fixed' }].entries()) {
          if (index) await card.getByRole('button', { name: 'Add reward option' }).click();
          const row = card.locator('.free-pack-option').nth(index);
          await row.locator('select').first().selectOption(entry.category === 'fixed' ? 'card' : random.kind);
          if (!index) {
            assert.equal(await row.locator('optgroup').count(), 6);
            assert.equal(await row.locator('option[value="ultra:special"]').count(), 1);
            await row.getByText(/No eligible cards currently exist/).waitFor();
          }
          await row.locator('select').last().selectOption(entry.id);
          if (index === 1) await row.getByText(/1 eligible card/).waitFor();
          await row.locator('input[type=number]').nth(2).fill(index === 15 ? '25' : '5');
        }
        await editor.getByRole('button', { name: 'Apply rewards to builder' }).click();
        await editor.waitFor({ state: 'hidden' });
        assert.equal(savedRewards.length, 2);
        await page.reload();
        await page.getByRole('button', { name: 'Edit extra rewards' }).click();
        const mixed = editor.locator('fieldset').last().locator('.free-pack-option');
        await mixed.last().waitFor();
        assert.deepEqual(await mixed.locator('select:nth-child(1)').evaluateAll(selects => selects.map(select => select.value)),
          [...previewPools.flatMap(entry => [random.kind, entry.id]), 'card', fixed.id]);
      }
      await page.close();
      console.log('Upgrader Workshop passed at ' + width + 'px');
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
