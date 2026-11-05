# Creature Brawl — first playable slice

## Play locally

Run `npm start`, then open `http://localhost:3000/index.html` and sign in. Enter the existing Skystones arena and choose **Creature Brawl · tactical 3 vs 3**. The existing Skystones option remains available. There is also a Creature Brawl entry in the existing Battle panel. Refresh cached pages with Ctrl+F5 after updating.

Choose three owned instances, save the team, pick one of three openly labelled AI difficulties and an unlocked arena, inspect the opponent, then begin. The free first power is selected automatically on each activation. Hover or focus a valid target for an exact preview, then click it to attack immediately. Select another power to change the attack; self/team powers execute when their button is clicked. There is no confirmation step. Auto-battle uses the same legal-action scorer as the opponent; 1×/2× changes only presentation.

Practice supports three selectable loan creatures even on an account with zero animals. It never changes rating, Footy, tokens, grades or ladder progress. Loan IDs are match-local and are never inserted into ownership. Closing the arena leaves an unfinished match resumable. Explicit abandonment is one ranked loss; it gives no rewards.

## Files and boundaries

- `public/creature-brawl-catalog.js`: versioned, editable roster and balance data for all 17 existing creature designs. Exactly three initially unlocked moves per entry; base stats, classes, coefficients, durations and costs are explicit proposals for this game.
- `public/creature-brawl-engine.js`: deterministic UMD engine shared by Node and the browser; scheduler, legal targets, exact resolver/preview, statuses, timeline and AI. It contains no randomness, network, database, DOM or animation callbacks.
- `creature-brawl-service.js`: owned-instance reconciliation, grades, full-team opponent matching, AI advancement and reward settlement.
- `creature-brawl-routes.js`: existing bearer-session authentication, transactional match/action/upgrade APIs and ownership validation.
- `public/creature-brawl.js` / `.css`: lobby, team selection, preview, battle, inspection, targeting, animation, results, rematch and mobile layout. Arena entry is wired in `public/village.js`.
- `public/village-plots.js`: pauses its resident animation RAF while Creature Brawl is open and restarts it on exit. Its normal settlement behavior remains unchanged.

Implementation and verification did not touch live account data, payment integrations, deployment or git push. Normal gameplay saves through the existing Firestore connection.

## Ownership and grades

The authoritative inventories remain `stableAnimals[kind]` and `rubyItems['pet:'+kind]`. The server reconciles these quantities into persistent UUID instances under `users/{id}.creatureBrawl.instances`; repeated ownership produces separate selectable instances. Reducing ownership makes excess instances ineligible without destroying their stored grade. Named variants keep their actual art and identity but share the correct species token key: Aeri/Rill, Brakk/Brugar, Virex/Krynn, Saelis/Fenra, Kael/Tharos (Veyrin). No named creature is granted for joining Brawl. Unowned entries display ownership requirements and can be inspected.

Cosmetic recolours are not read by combat. Brawl Grade starts at 1. Each creature's feeding level now sets its grade cap: levels 1-23 allow grade 5; levels 24-50 allow grade 7; level 51+ allows grade 10. Town Hall no longer limits grades. Existing grades are preserved. Grade increases HP/ATK/DEF by 8% per grade above 1, linearly; speed and special power do not change. Costs for reaching grades 2-10 are 5, 10, 20, 40, 100, 200, 400, 800, 2000 species tokens. The server derives cost/cap and checks the expected old grade. Stable upgrades can select any owned copy, while Brawl shows the highest-grade copy per kind, breaking grade ties by feeding level. See [CREATURE-GROWTH.md](CREATURE-GROWTH.md).

## Combat rules

Each unit initially schedules at `1000/effectiveSpeed`. Lowest event time wins; exact ties use a team priority alternating by the account's match sequence, then slot, then persistent ID. Speed changes rescale remaining waiting time by old/new effective speed. Actor-duration speed expiry changes the actor's newly scheduled interval. Minimum speed is 30.

At activation: move clock, process Burn, check survival/victory, consume Stun if present, then grant AP only to a living, non-stunned actor. One legal action resolves atomically. Effects applied during that activation do not immediately lose a duration. Then actor-duration effects expire, the actor reschedules and the scheduler continues. The next-eight rail clones this process with known effects and no invented future attacks; it includes known skipped activations. Dead combatants leave the scheduler.

Both AP pools begin at 0; the first eligible activation receives the first point. Cap 5. Basic costs 0. Each knockout grants the eliminated side one AP. After 24 completed global activations, subsequent eligible starts grant two AP. At the 80-activation safety boundary an unfinished battle is a draw. Elimination from the resolving action is checked first. Both limits are catalog configuration.

Class ring: Protector → Cunning → Swift → Furious → Protector. Forward damage ×1.25, reverse ×0.8, same/opposite ×1.0. Every species can hit airborne or grounded opponents. Damage per hit is `round(ATK × power × class × (cost>0 ? specialPower : 1) × 100/(100+DEF×(1-ignoreDef)))`, minimum 1; attack buffs apply before it. Shields absorb before HP. Multi-hit coefficients round separately. Healing, shields and Burn never use class advantage.

Up/down statuses have separate strongest-magnitude slots and refresh to the greater remaining duration; their effective multiplier is `(1+up)*(1-down)`. Burn is two 5%-max-HP start ticks unless refreshed, respects shields, and does not stack. Shield keeps the greater remaining pool, capped at 40% max HP, with actor-duration expiry. Taunt redirects single-enemy attacks to the newest living taunter (stable-ID tie); it does not redirect support or AoE. Bind permits only the free basic. Stun skips an activation without AP, cannot be stacked, and grants one subsequent activation of immunity after recovery (including cleansing). Cleanse priority: Stun, Bind, Burn, DEF-down, ATK-down, SPD-down. There is no resurrection.

Targets are fixed from action-start state and resolved in slot order. Victory is checked after the entire action. The preview calls the same resolver on a clone. Invalid requests never spend AP.

The server state uses START_ACTIVATION, AWAITING_ACTION, RESOLVING and FINISHED. The client separately exposes PREVIEW, RESOLVING and ANIMATING presentation phases. No animation callback mutates authoritative HP. Double clicks are locally locked and transactionally rejected/replayed by action ID and revision.

## Persistence and API

Uses the existing `brawl-auth` session verifier. No client damage, stats, currencies, outcome or reward amounts are accepted.

| Endpoint | Purpose |
|---|---|
| GET `/api/brawl/state` | Catalog, eligible UUID instances, selected team, tokens/rating/cap, active match |
| POST `/api/brawl/team` | Save exactly three distinct owned IDs |
| POST `/api/brawl/matches` | Create ranked or Practice match; reuse the one active match |
| GET `/api/brawl/matches/:matchId` | Restore an account-owned match |
| POST `/api/brawl/matches/:matchId/actions` | Begin preview or resolve a legal action/auto action |
| POST `/api/brawl/matches/:matchId/abandon` | Atomic one-time ranked loss or unrewarded Practice exit |
| POST `/api/brawl/upgrades` | Grade upgrade from `instanceId` and `expectedGrade` |

Actions send `{expectedRevision, actionId, moveId, targetId}` (or `{command:'begin'}` / `{auto:true}`). Optional `eventCursor` limits returned events, never resolution. Action IDs are retained in the match; a duplicate returns the saved state and cannot pay again. Concurrent different actions at one revision serialize through Firestore and one receives 409. The browser retains a pending action across network failures and restores saved state before retrying.

`creatureBrawlMatches/{uuid}` stores owner, pinned catalog snapshot/version, six combatants and their moves/stats, scheduler times, AP, statuses, activation count, revision, ordered events and terminal receipt. Client catalog changes cannot alter existing combatants. Match records use a pinned catalog snapshot for reward numbers, too. A new incompatible resolver needs a new rules version and an old-version handler; unsupported versions currently reject rather than silently reinterpret a match. Transactions contain no animation waits. Terminal match state and account rewards commit together.

## Matchmaking and economy decisions

All five arena stages are playable (all are available in Practice). Ranked unlock ratings are 0/100/250/500/900. Three difficulty templates target 92%/100%/108% of full player-team average power. Power is `HP/10 + ATK + DEF/2 + SPD*0.7`; matching uses all three members, never just the weakest. Opponent stats are visible in preview, are openly scaled, and are tested within ±10% of team power. The AI receives no AP, formula, targeting or hidden-strength exceptions.

Ranked win +20 rating, loss −10 to floor 0, draw 0. The first ten wins per UTC server day each award 20 Footy. Creature tokens are obtained from packs only, not from matches. Later wins still award rating only. No entry fee, stamina or paid reset. This keeps the proposed economy at a hard maximum of 200 Footy/day. Existing trophy milestones award 50–200 Footy at early thresholds (`trophy-utils.js`); existing skill boosters add 10–15 Footy at later milestones (`brawl-skill.js`). The requested 20-per-win proposal is retained as an explicitly capped active-play source, not represented as an existing/reference-game earning rate. Species tokens are new, non-tradeable and Brawl-only. Arena completion counts distinct won stages, separately from rating unlocks.

## Assets and performance

The battle presentation now uses one shared 3D scene with six independent existing rigs, projected health/status overlays and foreground-allies/background-enemies staggered formations with a rear perspective camera. Existing portraits remain in selection and inspection/turn controls. See [shared arena implementation and clip limitations](CREATURE-BRAWL-ARENA.md) for the complete updated architecture, model/clip inventory, verification and before/after screenshots.

## Verification and known limits

Run focused tests:

```powershell
node --test --test-isolation=none creature-brawl-engine.test.js creature-brawl-routes.test.js
node scripts/simulate-creature-brawl.cjs
node scripts/check-creature-brawl.cjs
```

The browser script uses the existing `.ui-tools` Playwright install and local Edge. It opens the **real index.html**, registers the real new route handlers against isolated in-memory accounts, intercepts all account API requests, and never loads Firebase credentials. It verifies arena navigation, team selection and fourth-slot replacement prompt, opponent inspection, default basic selection, exact hover previews, immediate target clicks, double-click lock, ability icons and no-scroll desktop sizing at 1440?900, 1366?768 and 1280?720, six real GLB portraits, refresh resume, full ranked battle/results, 390px sizing, existing Skystones/marketplace return, and a full Practice battle on an empty account with no rewards. Outputs are under `output/creature-brawl-*`.

The initial draft's low ATK produced 98.6% draws. Final explicit roster ATK was increased in the data file (not via a hidden damage multiplier), and AI shields now score likely prevented damage. The final deterministic 289-match suite averages 38.0 activations with 0.7% draws. In its fixed Rill/Brugar-support lineup, Krynn leads at 16 wins/17 and Crystal Snail trails at 1/17. That is a useful outlier warning, not proof of balanced PvP or universal species rankings. Further balance testing should vary support composition and human play. This is a single-player vertical slice.

Repository-wide verification ran 448 tests: 443 passed; five existing failures also reproduce when their unchanged files run separately (`advancements.test.js`: recovery threshold; three `economy-routes.test.js` pack fixtures; `reward-card-art.test.js`: expects the old card-first order). All 22 focused Creature Brawl tests pass; the desktop/mobile browser smoke also passes. See the captured test output for details. Existing Skystones logic and these unrelated test expectations were left unchanged.

## Reference boundary

Only the high-level reference mechanics (3v3 turns, AP/basic attacks, four classes, visible turn order/status/preview and later auto-battle) are taken from the supplied sources. The precise scheduler, roster, moves, class-ring direction, formulas, Surge threshold, matchmaking and economy here are the user's/custom implementation specifications, not claims about hidden reference-game mechanics.

- https://ludia.helpshift.com/hc/en/11-dragons-rise-of-berk/faq/246-brawl-what-is-brawl-and-how-does-it-work/
- https://ludia.helpshift.com/hc/en/11-dragons-rise-of-berk/faq/247-brawl-what-are-action-points/
- https://ludia.helpshift.com/hc/en/11-dragons-rise-of-berk/faq/256-brawl-what-do-the-colored-circle-symbols-in-brawl-next-to-my-dragon-mean/
- https://dragonsriseofberk.com/release-notes/update-1-103/

Battle status HUD: distinct SVG badges replace raw effect names under creature health bars. Green frames mark buffs; red frames mark debuffs, with distinct silhouettes and up/down arrows. Duration counters use affected-creature activations. Tap or keyboard-focus a badge for its name, strength (stat modifiers only), duration and current shield amount. Settings includes an Effect guide. Shield damage, expiry, cleansing and defeat remove badges as their events play; authoritative state refreshes durations after each resolved turn.

Animation loading safety: the render loop skips actors until their AnimationMixer is initialized and their loading state has ended. Model factories publish geometry before the deferred rig/clip setup completes, so a model alone does not establish animation readiness. Frame deltas clamp to 0-50 ms, including wake-up timestamps. `scripts/check-brawl-movement.cjs` runs real Rill/Talren idle, approach and exact-return checks with reduced motion disabled.

Deck creature profiles now open from the portrait or info button. A parchment portrait panel shows kind, rarity, feeding level, grade, shared-species token progress, grade upgrade and team actions. The stat panel displays actual HP/ATK/special multiplier/DEF/SPD, with next-grade deltas supplied by the server for owned creatures. Three AP-labelled power buttons reveal one description at a time. Evasion is omitted because this engine does not implement that stat. Feeding opens a separate panel. Quick +/check buttons retain direct team selection without opening the profile. Browser validation: `scripts/check-brawl-creature-profile.cjs`.


Rarity balance update: class baselines now gain +0/+4/+8/+12/+16% HP, attack and defence for Common/Rare/Epic/Legendary/Unique, rounded before grade scaling. Speed and special-power multipliers stay class based. Rarity comes from the admin-managed creature book; unassigned creatures use Common stats. The server supplies adjusted base stats, current stats and next-grade previews consistently. Editing rarity changes the client catalog version; in-progress matches retain their saved units.

Arena opponent target rarities (three different creatures): arena 1 Common/Common/Common; arena 2 Common/Rare/Rare; arena 3 Rare/Epic/Epic; arena 4 Epic/Legendary/Legendary; arena 5 Legendary/Unique/Unique. Empty or undersized pools select the closest available rarity without repeating a creature. Opponent grades use the rounded average player grade. Difficulty modifies HP/attack/defence by 0.92/1/1.08; team-power normalization was removed so rarity differences remain meaningful.
