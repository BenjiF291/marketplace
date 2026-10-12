# Valemere first release

Enter through the existing stone arch above the waterfall at the top-right of Fishy's main island. A physical hit target overlays that exact arch; it does not replace the island artwork. Return through Valemere's southeast portal or its visible Return portal control. Main-island camera state remains in the existing island renderer.

## Playable loop

Claim Aeri at the Rescue Station, build the first roost, assign her, gather supplies, build the arena, train to level 2, invite Lysa and activate their partnership. Explore the woodland, invite Mira and build her lab to research Trail panniers. Starting supplies cover the basic sequence. Gathering is free, repeatable and yields timber, stone or provisions, so a shortage does not force a purchase. Notes come from expeditions. Nothing spends Footy, rubies, cards or existing pet food.

Kael/Elara, Virex/Corvin, Brakk/Garrin and Saelis/Neriah become rescuable after 1, 2, 3 and 4 collected explorations. All five creatures are unique. Each rider requires their own rescued creature trained to level 2. Mira never has a mount. Kael, Virex and Brakk use ground dens; Aeri and Saelis use roosts. Saelis rests between glides. Stored creatures do not work; busy creatures cannot move. Finish and collect a job to free its creature. There is intentionally no destructive cancellation in this version.

Rescues are deterministic station operations. A full stable leaves a rescue safely pending until space is made. Storage expansion and habitat assignment provide the resolution. Training, gathering, bonding and exploration each occupy one active creature. Research occupies Mira. All four laboratory effects are applied by the server, with no repeat purchase.

Four destinations have deterministic previews, level/movement requirements and partnership specialties. Rewards for a specialist are 25% higher; Virex scouts the outpost 20% faster. Town Hall XP is awarded through the existing grant pathway for first rescues, buildings/habitats, bonds, research and the first visit of each pair to each destination. Repeat gathering, training and repeat visits never farm XP.

The Academy's optional Skystones entry returns through Fishy's normal island/arena routing into the existing game. No replacement cards, stats, matches or combat system were added.

## Save and network model

Authenticated GET `/valemere` and POST `/valemere/action` use the existing login-session authentication and `users/{id}` account transaction. State lives in `user.valemere`. A missing field is initialized once; null or unknown-version saves are rejected without replacement. Firestore rules and credentials are unchanged.

Each mutation carries an expected revision and request ID. Concurrent tabs cannot both spend the same revision. The latest 64 request receipts allow exact duplicate retries; older requests still cannot replay because their revision is stale. Job claims require the server-owned job ID and completion timestamp. First-time XP milestones are retained permanently, not in the bounded receipt history. Costs and rewards come from server configuration, never client-submitted amounts. Malformed/unauthorized actions do not write state.

Finished jobs remain claimable after closing the browser. Countdowns use server clock offset and run locally. Movement and camera changes make no API calls. There are no subscriptions or periodic account polls: load on entry, explicit refresh and action responses provide snapshots. Leaving stops countdown work and pauses animations. Failed saves keep the same pending request for safe retry. This is online-authoritative gameplay, not offline action queuing; disconnected players can inspect an already-loaded scene, and reconnect to save or collect.

## Files to change

- `public/valemere-config.js`: shared balance, all unique creatures/riders, starting resources, level cap, prices, durations, destinations, research, scene coordinates and finite milestone XP.
- `valemere.js`: server-owned state transitions and validation.
- `valemere-routes.js`: existing authentication/Firestore integration.
- `public/valemere.js` and `public/valemere.css`: scene, touch/keyboard camera, contextual actions and local timers/animation lifecycle.
- `public/valemere-art.js`: original articulated creature SVGs, den/portal artwork and individual silhouette clips for the generated building sheet. Replacing artwork does not change gameplay.
- `public/assets/valemere/island.png`, `buildings.png`: original artwork generated with the built-in imagegen tool. The building sheet has an opaque background; the renderer isolates its six silhouettes with local SVG clipping. Creature art is stylized vector work, not a commercial-quality skeletal animation set.
- `public/assets/valemere/prompts.md`: generation prompts and provenance.
- `public/village.js`: one portal hit target on the painted hilltop arch.

## Development and checks

Run `node --test --experimental-test-isolation=none valemere.test.js` for progression/authority tests, or the same command with `*.test.js` for the repository suite.

Local acceleration requires **all three**: `NODE_ENV=development`, `VALEMERE_DEV_TOOLS=1`, and the authenticated account's `isAdmin === true`. Only then does the interface show `DEV: finish timers`; the server rejects that action otherwise. Do not set these environment flags in production. This completes timers, not claims, so collection still exercises the normal validated reward path.

Verification performed: all 270 repository tests pass, including eight Valemere tests covering all five partnerships, research, authority and persistence. Browser checks complete the starter loop using real frontend files and the real route module with an in-memory database, including the physical portal, return navigation, refresh persistence and retry after a committed response is lost. Desktop and 390px phone screenshots were inspected; this is not a physical iPhone/Safari performance test. No Firebase deployment or production account mutation was performed.

Initial scope: fixed habitat spots, five unique creatures, solo expeditions, four one-time researches, one recent completion report. No breeding, trading, multiplayer Valemere presence, offline reward sync or campaign. Future content should preserve stable IDs and migrate explicit state versions rather than reinitializing saves.
