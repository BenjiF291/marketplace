'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { once } = require('node:events');
const { chromium } = require(require.resolve('playwright', { paths: [path.resolve(__dirname, '../.ui-tools')] }));
const { slots } = require('../public/ben-bal-match-engine');
const { readAllocations, createBenBalReader } = require('../ben-bal-allocations');
const { createCardReader } = require('../card-data');
const { leagues } = require('../ben-bal-leagues');

async function main() {
  const root = path.resolve(__dirname, '..');
  const publicDir = path.join(root, 'public');
  const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  const team = html.match(/<svg\b[^>]*class="ben-bal-field-lines"[\s\S]*?<\/svg>/);
  const match = html.slice(html.indexOf('<dialog id="benBalMatch"'), html.indexOf('</dialog>', html.indexOf('<dialog id="benMatchOverlay"')) + 9);
  assert.ok(team && match.length);
  const allocations = await readAllocations(root);
  const read = createBenBalReader(root, createCardReader(root));
  const cards = (await Promise.all([...allocations.keys()].slice(0, 24).map(read))).filter(card => card?.benBal);
  assert.ok(cards.length >= 11);
  const app = express();
  app.use(express.json());
  const admin = html.match(/<details id="benBalAdmin"[\s\S]*?<\/details>/);
  const packs = [{ id: 'fixture-pack', name: 'Existing Marketplace Pack' }];
  let config = {};
  app.get('/ben-bal/admin/leagues', (req, res) => res.json({ leagues, packs, config }));
  app.put('/ben-bal/admin/leagues', (req, res) => { config = req.body; res.json({ config }); });
  app.get('/fixture', (req, res) => res.send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="/ben-bal-face.css"><link rel="stylesheet" href="/ben-bal.css">
    <link rel="stylesheet" href="/ben-bal-match.css">
    <div id="benBal" hidden>${team[0]}</div><button id="benBalPlay">Play</button>
    ${match}
    ${admin[0]}
    <script>const API_URL = location.origin;
      const resourceHeaders = () => ({'Content-Type': 'application/json'});</script>
    <script src="/ben-bal-card.js"></script><script src="/ben-bal-match-engine.js"></script>
    <script src="/ben-bal-match.js"></script><script src="/ben-bal-admin.js"></script>`));
  app.use(express.static(publicDir));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
      (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined) });
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 850 }, reducedMotion: 'reduce' });
      await context.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
      const page = await context.newPage();
      await page.goto(base + '/fixture');
      const panel = page.locator('#benBalAdmin');
      await panel.locator('summary').click();
      const bronze = panel.getByRole('group', { name: 'Bronze' });
      await bronze.getByLabel('Reward pack').selectOption('fixture-pack');
      await bronze.getByLabel('Minimum Overall').fill('12');
      await bronze.getByLabel('Maximum Overall').fill('30');
      await panel.getByRole('button', { name: 'Save League Settings' }).click();
      await panel.getByText('League settings saved.').waitFor();
      assert.equal(Object.keys(config).length, 6);
      assert.deepEqual(config.Bronze, { packId: 'fixture-pack', range: { min: 12, max: 30 } });
      await page.reload();
      if (!await panel.evaluate(element => element.open)) await panel.locator('summary').click();
      await bronze.waitFor();
      assert.equal(await bronze.getByLabel('Reward pack').inputValue(), 'fixture-pack');
      for (const [winner, score, count, awarded] of [
        ['player', { player: 6, robot: 5, draw: 0 }, 2, true],
        ['robot', { player: 4, robot: 7, draw: 0 }, 2, false],
        ['draw', { player: 5, robot: 5, draw: 1 }, 3, false]
      ]) {
        await page.evaluate(({ cards, slots, winner, score, count, awarded }) => {
          const lineup = slots.map(({ slot, role }, index) => BenBalMatchEngine.prepareCard(cards[index], slot, role));
          const active = { phase: 'player-initiation', round: 11, player: lineup, robotPitch: lineup.map(entry =>
            ({ slot: entry.slot, overall: entry.card.overall, revealed: null })), rounds: [], score: { player: 0, robot: 0, draw: 0 } };
          const completed = { ...active, phase: 'complete', winner, score, player: lineup.map(entry => ({ ...entry, used: true })),
            robotPitch: lineup.map(entry => ({ slot: entry.slot, overall: entry.card.overall, revealed: entry })) };
          const result = { ...active, phase: 'result', score, result: {
            winner, player: lineup[0], robot: lineup[1], playerAction: 'attack', robotAction: 'defence',
            comparisons: [{ stage: 'primary', player: 60, robot: 55 }]
          } };
          const setup = { id: 'fixture', league: 'Silver', view: active };
          let attempts = 0;
          BenBalMatch.open(setup, { start: async () => setup, showLeagues() { window.testReturnedToLeagues = true; }, async submit() {
            if (awarded && ++attempts === 1) throw Error('Could not confirm this round. Try the same move again.');
            return { result, next: completed, reward: { league: 'Silver', count, awarded,
              pack: winner === 'draw' ? null : { name: 'Silver Fixture Pack' } } };
          } });
        }, { cards, slots, winner, score, count, awarded });
        await page.locator('#benMatchPlayerField button').first().click();
        const attack = page.locator('button[data-action="attack"]');
        await attack.click();
        if (awarded) {
          await page.locator('#benMatchRoundError').waitFor();
          assert.equal(await page.locator('#benMatchEarned').isVisible(), false);
          assert.equal(await page.locator('#benMatchSummary').isVisible(), false);
          await attack.click();
        }
        await page.locator('#benMatchNext').click();
        const final = page.locator('#benMatchSummary');
        assert.equal(await final.locator('h2').textContent(), { player: 'VICTORY!', robot: 'DEFEAT', draw: 'DRAW' }[winner]);
        assert.equal(await page.locator('#benMatchFinalPlayer').textContent(), String(score.player));
        assert.equal(await page.locator('#benMatchFinalRobot').textContent(), String(score.robot));
        assert.equal(await page.locator('#benMatchEarned').isVisible(), awarded);
        assert.equal(await page.locator('#benMatchLeague').textContent(), 'Silver League');
        assert.match(await page.locator('#benMatchProgress').textContent(), new RegExp(count + ' / 3 Silver'));
        if (awarded) assert.equal(await page.locator('#benMatchPackName').textContent(), 'Silver Fixture Pack earned!');
        if (winner === 'draw') assert.match(await page.locator('#benMatchProgress').textContent(), /not configured/);
        assert.equal(await page.locator('#benMatchPacks .is-earned').count(), count);
        assert.equal(await page.locator('#benMatchHistory').count(), 0);
        assert.ok(await final.evaluate(el => el.getBoundingClientRect().width <= innerWidth));
        await page.locator('#benMatchViewPitch').click();
        assert.equal(await page.locator('#benMatchPlayerField button:enabled').count(), 11);
        await page.locator('#benMatchTheirPitch').click();
        assert.equal(await page.locator('#benMatchRobotField button:enabled').count(), 11);
        assert.equal(await page.locator('#benMatchRobotField .is-used, #benMatchRobotField .ben-match-mystery').count(), 0);
        assert.equal(await page.locator('#benMatchActions').isVisible(), false);
        await page.locator('#benMatchRobotField button').first().click();
        assert.equal(await page.locator('#benMatchInspect .ben-bal-stat strong').count(), 6);
        await page.locator('#benMatchInspectClose').click();
        await page.locator('#benMatchBackResults').click();
        assert.equal(await page.locator('#benMatchPacks .is-earned').count(), count);
        if (winner === 'draw') {
          await page.locator('#benMatchChooseLeague').click();
          assert.ok(await page.evaluate(() => window.testReturnedToLeagues));
        } else {
          await page.locator('#benMatchReplay').click();
          await page.locator('#benMatchYourPitch').waitFor();
          assert.equal(await page.locator('#benMatchLeague').textContent(), 'Silver League');
          await page.evaluate(() => document.getElementById('benBalMatch').close());
        }
      }
      await context.close();
      console.log('Ben-Bal results and pitch passed at ' + width + 'px');
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
