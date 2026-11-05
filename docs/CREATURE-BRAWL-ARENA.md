# Creature Brawl shared arena

Run `npm start`, refresh the app, then enter **Arena -> Creature Brawl**. This is a local presentation upgrade; no deployment, push or live-account test writes were performed.

## What changed

Combat uses one Three.js scene, camera, renderer/canvas and render loop, with six independent rig instances created through the existing asset factories. These factories construct fresh skeletons and clone their skinned geometry/materials from cached immutable GLB sources; they do not clone a live skeleton unsafely. Same-species downloads are deduplicated by the existing source promises. No creature anatomy or model assets were edited.

The battlefield is a fixed layer (`inset: 0`, `100dvh`) with a viewport-sized shared canvas. Normal navigation is hidden and background scrolling is locked only during combat, then restored on exit/results. The header, right turn rail and compact bottom-left ability/AP cluster are separate overlays. The optional Fullscreen API button is user-triggered; leaving browser fullscreen does not submit an action, abandon the match or leave the battle layer.

The restrained 22-degree perspective camera is physically behind the player team at approximately 24 degrees elevation. Our creatures occupy the lower foreground with +Z-authored rigs rotated to face -Z; enemies occupy the upper background facing +Z. Screen-space foot-anchor guidelines are converted to actual world-space ground positions through camera/plane intersections. Desktop allies are near (25%,66%), (50%,78%), (76%,68%), with enemies near (27%,35%), (50%,29%), (73%,35%). Portrait and short landscape adjust the stagger to reserve controls and keep the six silhouettes readable. This replaces the old left-versus-right composition.

Visible skinned bounds, including tails and wings, drive scaling and viewport fitting. Per-asset portrait scale/width compression keeps large quadrupeds readable without making small animals giant. Head/socket projection keeps HUD text upright, with safe-edge clamping and label separation. A1-A3 and E1-E3 identify teams without relying on color. Ability tips work on hover, keyboard focus and touch hold. Melee movement and recoil now run along arena depth; projectiles use the configured source and target head sockets. Exact formation position and orientation are restored after recovery.

Abilities use a compact translucent bottom-left cluster: current portrait/name, five shared AP pips immediately above a horizontal row of three icon-led powers, selected styling and disabled explanations. Auto, speed, graphics, settings and optional fullscreen sit at the top right. Opponent AP remains secondary near the top. Return saves the active match; explicit Abandon remains behind its existing confirmation in Settings. HUD input cannot click through to the battlefield.

The full viewport, HUD and six actors fit at 1920x1080, 1366x768, 844x390 and 390x844 without page scrolling. Portrait keeps allies below enemies and a compact right-hand turn rail. Short landscape uses smaller models and suppresses secondary class text to preserve targeting space. The environment remains procedural set dressing, and the previously documented missing authored combat clips remain unchanged visual limitations.

The free basic attack remains selected each turn. Clicking a valid target commits immediately, and self/team abilities execute on clicking their power, preserving the owner's previous interaction request. Hover/focus an area power previews all affected targets before committing. Abandon still requires its existing confirmation. Combat rules, classes, roster stats, AP, AI, ownership, progression, rewards and API authority are unchanged.

## Files

- `public/creature-brawl-arena.js`: shared scene, independent mixers, floor placement, projected HUD, raycasting, actions/effects, quality, resize, visibility and disposal.
- `public/creature-brawl-presentation.js`: inspected per-asset URLs, bounds, native facing, readable heights, head/socket anchors, clip inventory and fallback policy. No gameplay stats.
- `public/creature-brawl-event-queue.js`: ordered, duplicate-safe, cancellable presentation consumer with timeout/reconcile path.
- `public/creature-brawl.js` / `.css`: shared-stage integration, anchored HUD, compact inspection sheet, turn portraits and icon controls.
- `public/companion-3d.js`: pauses hidden companion portraits while Brawl is open; existing settlement pause integration remains.
- `public/index.html`: loads the presentation queue and refreshed UI assets.
- `scripts/inspect-brawl-models.cjs`, `scripts/check-brawl-presentation.cjs`, `scripts/check-creature-brawl.cjs`, `creature-brawl-presentation.test.js` and updated `companion-lifecycle.test.js`: asset inventory and focused verification.

## Actual assets and clips

The inventory below was obtained by constructing **all 20 actual rigs** locally and enumerating their generated `AnimationClip` objects, skinned bounds, bones and position tracks. Full machine-readable details are in `output/creature-brawl-model-inventory.json`.

| Creature / asset kind | Existing GLB | Actual available clips |
|---|---|---|
| fox | `fox-meshy-source.glb` | `idle` (4.8 s), `walk` (0.9 s), `run` (0.58 s) |
| snail | `snail-meshy-source.glb` | `idle` (4.8 s), `crawl` (2 s), `fast_crawl` (1.2 s) |
| dragon | `dragon-meshy-source.glb` | `idle` (4.8 s), `walk` (1 s), `run` (0.68 s), `fly` (0.8 s) |
| rill | `aeri-source.glb` | `idle` (8 s) |
| rill-species | `rill-species-source.glb` | `idle` (8 s) |
| brugar | `brakk-source.glb` | `idle` (8 s) |
| brugar-species | `brugar-species-source.glb` | `idle` (8 s) |
| krynn | `virex-source.glb` | `idle` (8 s) |
| krynn-species | `krynn-species-source.glb` | `idle` (8 s) |
| fenra | `saelis-source.glb` | `idle` (8 s) |
| fenra-species | `fenra-species-source.glb` | `idle` (8 s) |
| veyrin | `kael-source.glb` | `idle` (8 s) |
| tharos | `tharos-source.glb` | `idle` (8 s) |
| talren | `talren-source.glb` | `idle` (8 s) |
| northern-talren | `northern-talren-source.glb` | `idle` (8 s) |
| defender-talren | `defender-talren-source.glb` | `idle` (8 s) |
| defender-rill | `defender-rill-source.glb` | `idle` (8 s) |
| kanji | `kanji-source.glb` | `idle` (8 s); see [Kanji integration](KANJI.md) |
| trusk | `trusk-source.glb` | `idle` (8 s); see [Trusk integration](TRUSK.md) |
| velkris | `velkris-source.glb` | `idle` (8 s); see [Velkris integration](VELKRIS.md) |

All 20 use their real `idle` clip in battle, with independent mixers and phases. Translation tracks belong to bones (breathing/gait); no formation-root translation clip was found. The transform hierarchy is formation anchor -> controlled action group -> facing group -> normalized existing model rig. Controlled approach/return never combines with extracted root travel. Bounds are measured from skinned content; native proportions stay intact.

The source factories still provide the clips in the table above. Brawl now adds 60 species/move-specific skeletal clips, 20 travel cycles and 20 hit reactions at runtime through `creature-brawl-attacks.js`; see [attack choreography](CREATURE-BRAWL-ATTACKS.md). The event consumer seeks each strike to its contact marker before revealing authoritative effects, then completes recovery and returns to formation. These are new keyframed bone animations on the existing skins, separate from the original GLBs. Defeat fade and victory rings remain presentation effects; dedicated death/celebration clips are not part of this change.

## Authority, ordering and recovery

One accepted API action supplies the authoritative ordered event batch. The old displayed HP is retained until each corresponding damage/heal event's visible impact. Multi-hit damage creates separate impacts; AoE follows engine ordering. Absorbed shield damage is labelled separately. Status apply/cleanse/expiry is driven by real events. Actors and mixers survive turns; model loads are not repeated per action. Formation positions reset exactly after recovery. Results wait for visible impact/defeat/recovery completion.

The queue deduplicates stable per-match sequence IDs, serializes batches, cancels on exit and has a bounded timeout/finally reconciliation path. Existing action IDs/revision checks remain authoritative. Resume snaps to current server state instead of replaying history. Hidden documents stop rendering and skip stale presentation, then show the saved state on return. Reduced motion removes lunges and idle movement while preserving ordered feedback. The low graphics option caps DPR at 1 and disables shadow maps; normal DPR is capped at 1.5 with 1024px shadows and small bounded effects. WebGL loss presents retry graphics and leaves API state intact. Loading has a 15-second timeout with disposal and labelled target/retry fallback. Disposal stops mixers/RAF and removes observers/listeners/actor-owned resources without disposing cached source textures.

## Checks and screenshots

```powershell
node --test --test-isolation=none --test-force-exit creature-brawl-engine.test.js creature-brawl-routes.test.js creature-brawl-presentation.test.js
node scripts/inspect-brawl-models.cjs
node scripts/check-brawl-presentation.cjs
node scripts/check-creature-brawl.cjs
```

The 25 focused engine/server/queue tests pass. Including companion lifecycle/pause and settlement navigation checks, all 32 focused tests pass. Queue tests cover repeated events, interrupted batches and animation timeout recovery/unlocking. The real-index browser smoke checks team selection, one viewport canvas, six independent actors, compact bottom-left controls, optional browser fullscreen entry/exit without a match revision change, immediate-target duplicate lock, default basic, preview, full ranked and large-creature unowned Practice battles, Auto/2x, all four requested viewport sizes, saved-turn resume, active-battle exit/reentry/disposal, and Skystones/marketplace return. The separate normal-motion scene test uses the real engine's melee, burn projectile, shield, heal, multi-hit, AoE and KO events; checks HP stays unchanged until impact, exact slot restoration, no leaked effects, duplicate-fox independent skeletons, real skinned-mesh raycasts, perspective/elevation and world-facing checks, depth-oriented melee travel, reduced motion, low graphics, hidden-tab pause/resume, context-loss/restoration event handling and disposal. Test accounts are in-memory; no Firebase credentials are loaded.

- [Previous side-on arena](../output/creature-brawl-before-rear-camera.png)
- [1920x1080](../output/creature-brawl-rear-1920x1080.png)
- [1366x768](../output/creature-brawl-rear-1366x768.png)
- [844x390 landscape](../output/creature-brawl-rear-844x390.png)
- [390x844 portrait](../output/creature-brawl-rear-390x844.png)
- [Tharos/Fenra/Brugar desktop](../output/creature-brawl-rear-large-1366x768.png)
- [Tharos/Fenra/Brugar portrait](../output/creature-brawl-rear-large-390x844.png)
- [Tharos/Fenra/Brugar landscape](../output/creature-brawl-rear-large-844x390.png)

Visual checks confirm inward facing, visible tails/wings, grounded contact, small target readability and distinct same-species actors. Environment art and missing authored combat clips remain the stated visual limitations. Earlier repository-wide verification found five unrelated existing test failures, described in `CREATURE-BRAWL.md`; this upgrade does not change those rules or expectations.

Reference: the [official Brawl guide](https://ludia.helpshift.com/hc/en/11-dragons-rise-of-berk/faq/246-brawl-what-is-brawl-and-how-does-it-work/?contact=1) supports the broad health/status/preview and right-hand turn-rail structure. No branded reference artwork or hidden gameplay rules were imported.
