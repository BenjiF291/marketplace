# Brawl team chooser

The owned-team chooser now uses an illustrated card gallery and pinned three-slot team rail, inspired by the supplied Rise of Berk reference. The artwork remains the game's existing creature posters. Padded alpha bounds from the reward-card renderer enlarge each illustration while preserving feet, wings and tails; no live 3D renderers are started for the gallery.

Cards show the creature name on a rarity ribbon, Brawl Grade, class emblem, copy number and the existing species-token upgrade progress. Rarity comes from the editable creature-book metadata; unassigned rarities keep a neutral banner. At the Town Hall grade cap the bar shows available tokens rather than suggesting an upgrade can currently be purchased. An information button opens the existing full stats/abilities dialog. Unowned species retain visible muted artwork and inspection access.

The chooser offers rarity/grade/name sorting, class filters, search and an owned-only toggle. These filters never reorder the chosen team. Selecting a card fills an empty slot; selecting it again removes it. A fourth selection retains the existing slot-replacement dialog. Clicking a selected rail card removes that slot. Save remains enabled only for exactly three owned instances and uses the existing authoritative team endpoint. Selection is frozen while saving. Existing Practice, progression and combat behavior are unchanged.

Desktop pins the team rail on the left and scrolls the gallery separately. Phones place three compact team cards and Save above the gallery. Short landscape scrolls the selected-card rail while keeping Save reachable. Search/filter state, gallery scroll and card focus survive selection rerenders. Creature art is decorative; select buttons describe their creature ribbon for screen readers. Optional rarity loading has a bounded timeout and falls back to neutral frames on failure.

Files: `public/creature-brawl.js`, `public/creature-brawl.css`, versioned references in `public/index.html`. No deployment or live-account writes were performed.

Validation:

- `node scripts/check-brawl-deck-ui.cjs`: local isolated account with a populated collection, real creature imagery, rarity metadata, selection/removal/replacement, inspection, filters, save/reopen persistence and four viewport sizes.
- `node scripts/check-velkris-game.cjs`: full-index ranked/Practice battles, team saving, navigation, resize/fullscreen and existing Stable/reward flows.
- 28 existing combat, route, presentation and portrait-lifecycle tests pass.

Evidence: `output/deck-ui/checks.json`, `output/deck-ui-check.txt`, `output/deck-ui-full-game-check.txt`, `output/deck-ui-regression-tests.txt`.

[Desktop](../output/deck-ui/selected-1366x768.png) | [Large desktop](../output/deck-ui/selected-1920x1080.png) | [Phone](../output/deck-ui/selected-390x844.png) | [Landscape](../output/deck-ui/selected-844x390.png)

Refresh the app to load the updated chooser assets.
