const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const { once } = require('node:events');
const { chromium } = require(require.resolve('playwright', { paths: [path.resolve('.ui-tools')] }));
const { objectives, themes, icons, categories } = require('../event-manager');
const { tiers, definitions } = require('../public/upgrader-catalog');

async function main() {
  const app = express();
  app.use(express.json());
  app.get('/', (req, res) => res.send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="/events.css"><button onclick="FishyEvents.admin()">Event Manager</button>
    <button onclick="FishyEvents.player()">Events</button><script>const API_URL=location.origin; const currentUserId='fixture';
    const resourceHeaders=()=>({'Content-Type':'application/json'});</script><script src="/upgrader-catalog.js"></script><script src="/events.js"></script>`));
  app.get('/admin/events/catalogue', (req, res) => res.json({ objectives, themes, icons, categories, tiers, materials: definitions,
    packs: [{ id: 'gold', name: 'Gold Victory Pack' }], cards: [], random: [] }));
  app.get('/admin/events', (req, res) => res.json({ now: Date.now(), events: [] }));
  let activation;
  app.post('/admin/events', (req, res) => { activation = req.body; res.json({ id: 'fixture' }); });
  app.get('/events', (req, res) => res.json({ now: Date.now(), events: [
    { ...activation, id: 'fixture', start: Date.now() - 60000, end: Date.now() + 600000, status: 'active',
      player: { progress: { 0: 4 }, earned: { gold: { label: 'Gold Victory Pack', amount: 4 } }, rewarded: 4 } }
  ] }));
  app.use(express.static(path.resolve('public')));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
    for (const width of [1440, 768, 320]) {
      const page = await browser.newPage({ viewport: { width, height: width < 400 ? 568 : 900 } });
      const url = 'http://127.0.0.1:' + server.address().port;
      await page.route('**/*', r => r.request().url().startsWith(url + '/') ? r.continue() : r.abort());
      await page.goto(url);
      await page.getByRole('button', { name: 'Event Manager' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: '+ Create Event' }).click();
      await dialog.getByRole('button', { name: 'Use Ben-Bal Bonanza template' }).click();
      for (let index = 0; index < 3; index++) await dialog.getByRole('button', { name: 'Next step' }).click();
      await dialog.getByLabel('Reward', { exact: true }).selectOption('gold');
      await dialog.getByRole('button', { name: 'Previous step' }).click();
      assert.equal(await dialog.getByLabel('Target').inputValue(), '1');
      await dialog.getByRole('button', { name: 'Next step' }).click();
      assert.equal(await dialog.getByLabel('Reward', { exact: true }).inputValue(), 'gold');
      await dialog.getByRole('button', { name: 'Next step' }).click();
      await dialog.getByRole('button', { name: 'Activate now' }).click();
      await dialog.getByRole('heading', { name: 'Active Events' }).waitFor();
      assert.equal(activation.schedule.duration, 86400000);
      assert.equal(activation.objectives[0].mode, 'repeat');
      assert.equal(activation.objectives[0].rewards[0].id, 'gold');
      await dialog.getByRole('button', { name: 'Close' }).click();
      await page.getByRole('button', { name: 'Events' }).click();
      await dialog.getByText('Gold Victory Pack ×4', { exact: false }).waitFor();
      assert.equal(await dialog.getByRole('button', { name: /Claim/ }).count(), 0);
      assert.ok(await dialog.evaluate(node => {
        const bounds = node.getBoundingClientRect();
        return bounds.left >= 0 && bounds.top >= 0 && bounds.right <= innerWidth &&
          bounds.bottom <= innerHeight && node.scrollWidth === node.clientWidth;
      }));
      await page.close();
      console.log('Events wizard and player progress passed at ' + width + 'px');
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
