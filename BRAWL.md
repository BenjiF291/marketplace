# Brawl Skill Level

## Five placement games

Players do not receive a starting rating until five ranked games have been settled. The UI shows placement progress instead of a provisional number. New accounts use an internal matchmaking prior of 500; existing accounts use their previous level as a prior. Neither is an assigned starting rating. Bob adapts to the provisional estimate between placement games.

Each placement sample combines 80% decision performance and 20% result relative to the match level:

- Decision performance: `clamp(round((quality - 0.55) / 0.4 * 1000), 0, 1000)`.
- Result performance: `clamp(matchLevel + 150 * result, 0, 1000)`; result is +1 / 0 / -1 for win / draw / loss.
- Sample: `round(0.8 * decisionPerformance + 0.2 * resultPerformance)`.
- Starting rating: rounded average of the five samples, bounded to 0-1000.

If there are no informative choices, match level supplies the neutral decision performance. An abandoned ranked game counts as a placement loss with zero decision performance when the next ranked game starts. Training never counts. Retries cannot count a placement twice.

Profiles use `ratingVersion: 2`, `placementsCompleted`, and `placementTotal` in server-only `brawlProfiles/{userId}`. Existing accounts get five placements once under this revised system; trophies, inventory, and claimed trophy rewards are preserved. Skill boosters are disabled until placement completes. Base trophies still apply during placement.

## Reviewing decision quality

The assessment examines **your move, Bob's reply, and your following move**. All root placements are considered. To bound computation, it searches the eight strongest immediate replies, and then all your available follow-ups. Held cards are removed only when used. This lets a defensive placement, protected field, or a planned recapture score better than a greedy immediate capture.

Board ownership contributes 100 evaluation points per net card. Exposed edges are judged against the actual remaining enemy hand, rather than a fixed side score. Vulnerability is capped at 55 points per card, so one exposed card is not penalized four times. Terminal positions use the actual board score. This is a limited tactical search, not proof of perfect long-term play. In particular, a deeper plan or an opponent sacrifice outside the reply shortlist may be missed.

Regret is the score gap between a played placement and the best assessed placement. Differences up to 25 points count as equivalent. For informative positions, move quality is `exp(-max(0, regret - 25) / 200)`. Positions in which all choices are equivalent are excluded from the average. The displayed percentage is an **estimate of decision quality**, not win probability or capture percentage. The post-match review shows each move, an assessed alternative, and a possible reply/follow-up. It does not penalize a move merely because Bob happened to beat it afterward.

## Rating changes after placement

Result contribution remains +12 for a win, -12 for a loss, and 0 for a draw. Decision adjustment is `round(32 * (quality - expectedQuality))`, with `expectedQuality = 0.55 + 0.4 * skill/1000`. This adjustment can be negative. At skill 350, expected quality is 69%: 72% adds 1 point, while 98% adds 9. No informative choices means no decision adjustment. Final rating is clamped to 0-1000.

An abandoned post-placement ranked game costs 12 skill and 10 trophies when the next ranked game starts. Training has no effect on skill or rewards.

## Decks and Bob

**The deck with the higher printed total score always starts**; equal totals use a coin toss. The server determines this for ranked matches, ignoring any client-supplied starting-player choice. Saved matches retain their original starting order. New deck matching uses the side-strength rules below instead of matching only printed averages.

New matches use `adaptive-v3` with the same 3-5 second delay. At skill fraction
`r`, Bob's decision handicap is `310 + 200*r^3` (previously `190 + 220*r^3`).
The best-move probability and weighted sampling formula are unchanged. Old saved
matches keep their stored numeric or `adaptive-v2` policy for deterministic replay.

Bob's deck now prefers 4-5 cards from the player's complete available battle
inventory and 1-2 unowned catalogue cards. If there are no safe, legal outsiders,
it falls back to more owned cards. It never invents cards or changes their stats.
Matching uses actual sides: descending sides weighted 35/30/20/15%, plus 0.65 for
a special. Bob's target total power is `min(playerPower, .85*playerPower +
.15*inventoryPower) * random(.98, 1.02)`. Inventory power means the average card
power times six. This gives good deck selection an advantage without giving weak
decks an unrestricted catalogue opponent. Total power is capped at
`playerPower*1.03 + .1`; outsiders are individually capped at 1.05 times the
strongest selected card's estimated power. This is a heuristic, not a complete
measure of directional synergy or abilities.

All decks allow at most one special card, including Mirror. Ranked start, online
setup, Ready, and saved-deck creation enforce the rule on the server; Training and
pickers enforce it locally. Bob obeys the same limit. Existing saved decks with
multiple specials must be edited before use. Higher printed total score still
starts; equal totals use a coin toss. Skill ratings and boosters are unchanged.

## Current-level boosters

Only the strongest eligible booster applies. Bonuses replace one another, disappear below their threshold, and return when the player climbs back. No booster modifies cards, Bob, or the skill calculation.

| Skill | Booster | Footy per ranked win | Rubies per ranked win | Extra win trophies |
| --- | --- | --- | --- | --- |
| 150 | Contender | 0 | 0 | 5% |
| 300 | Challenger | 0 | 0 | 8% |
| 450 | Tactician | 0 | 0 | 12% |
| 600 | Strategist | 10 | 0 | 16% |
| 800 | Master | 10 | 1 | 20% |
| 1000 | Champion | 15 | 1 | 25% |

Base ranked rewards: +25 trophies for a win, -10 for a loss, zero for a draw. Bonus trophies round to the nearest integer. Eligibility immediately before settlement applies to that battle's reward; the updated level controls eligibility afterward. Placement games grant no milestone bonuses, including the fifth game. Transactions save rating, placements, Footy, Rubies, trophies, and the result together to prevent repeated payouts. The existing trophy path and its one-time claimable rewards are unchanged.

## Security and rollout

Deploy the backend, frontend, and `firestore.rules` together. Account documents must no longer allow direct client reads/writes because they hold credentials. The app uses backend APIs for these documents. Login/signup now issue random 30-day bearer sessions; only hashed tokens are stored. Ranked progression endpoints verify both token and account. Existing users must log in again once. Local Training still works without a token.

The browser saves ongoing matches for offline continuation. A connection is needed to start ranked matches and settle results. Replays validate legal moves and rewards; they cannot prove a human played without outside assistance.

## Validation and tuning

Run `node --test` for the repository suite. Tactical regression cases cover defence beating immediate capture and retaining a card for a winning recapture. Placement tests cover five-game assignment, migration, forfeits, repeat requests, bounds, and automatic starting order. UI tests cover starting Bob's turn and placement result formatting.

Run `node brawl-balance.cjs 100` for realistic 0-10 side values and 100 games per
scenario at Skill Level 535. With a synthetic inventory and the numeric decision
policy modeling the player, the pre-Mirror tuning produced:

| Selected deck | Wins | Draws | Games within 3 cards |
| --- | --- | --- | --- |
| Weak | 67/100 | 16/100 | 67/100 |
| Balanced | 66/100 | 5/100 | 79/100 |
| Strong | 81/100 | 0/100 | 60/100 |

The earlier calibration used invalid side values above 10 and is superseded.
These are synthetic checks, not measured human win rates or guarantees. Real
results depend on card distributions, abilities, play quality and rating accuracy.
The target remains roughly 60% or better for weaker decks and higher for good
selections, with meaningful chances for Bob to win.

## Normal deployment workflow

Continue using `git add`, `git commit`, and `git push` for the Render service if auto-deploy is enabled. The server also serves the frontend from `public`. This repository has no GitHub workflow that publishes Firebase rules, so pushing alone does not update those rules.

From the project folder, with Firebase CLI installed and logged in, publish rules using:

```powershell
firebase deploy --only firestore:rules --project fishy-20779
```

If players use the Firebase Hosting site (`fishy-20779.web.app`), publish that frontend too:

```powershell
firebase deploy --only "hosting,firestore:rules" --project fishy-20779
```

These are deployment instructions, not actions performed by the coding agent.


## Special cards

Combat uses the same engine for Bob, Training, ranked replay and online battles.
Powers are inferred from the linked card image (including existing `Low_` and
`Genious_` filenames), with the tier/name as fallback.

- Fighter: every enemy card beaten on placement is captured and marked to break.
  It still occupies its cell during the opponent's next move, then disappears,
  even if recaptured. Either player can subsequently use the empty cell. Removal
  does not award a permanent score point. No next opponent turn means no removal.
- Mini: ignores all losing comparisons on its own placement. It can still capture
  weaker neighbors. Later attacks resolve normally.
- Low Pointer: when beaten, each victor loses one on all four sides (minimum 0).
  This works on placement and when defending. Comparisons resolve before penalties;
  defeating multiple Low Pointers stacks their penalties.
- Genius / Genious: wins tied comparisons on attack and defence. Two Geniuses tie.
- Mirror: choose one of the ten powers below in the admin Battle card editor.

Online matches retain a separate played-card ledger so broken cards cannot return
into the hand or be played twice, and matches still end after all deck cards are used.
Deploy frontend and backend together for these combat changes.


## Random starter and Mirror powers

New games choose a real catalogue card at random within the nearest average-score
band (closest distance plus max(1, 10% of the decks' average)). The fallback is the
available deck cards if no catalogue is loaded. Its name and teeth are preserved;
it is a neutral starter without special powers, even if its artwork tier is special.
Online games use the actual selected decks' average rather than the maximum limit.

The admin card viewer has a Mirror power selector for each Mirror card. Assignments
are saved to the battle card. New-card creation also accepts a power. The optional
family-name field is available on all cards; Family ties checks it and the card's
name, case-insensitively. Existing ranked matches keep their snapshotted card data.

| # | Power | Rules |
| --- | --- | --- |
| 1 | Family ties | +1 on every side for each orthogonally adjacent Liesker/Heeren, either owner. Recalculates as neighbors change; bonuses do not compound. |
| 2 | Spoils of victory | After placement comparisons, copies the four sides of the defeated card with the highest total teeth. Ties use top/bottom/left/right comparison order. Does not copy its ability or printed score. |
| 3 | Focused strike | Choose top/right/bottom/left. Keeps that side's teeth; other sides become 0. Attacks only the chosen side but can lose defending its other zero edges. Choice lasts while on board. |
| 4 | Long reach | Placement comparisons are two cells away, without wrapping rows. Immediate neighbors neither attack nor defend against it on placement. It defends normally afterward. |
| 5 | Extra allowance | Adds exactly 15 to the online six-card score budget, never 15 to the average. No extra slots; special limit remains one. Bob modes have no fixed deck-score budget to increase. |
| 6 | Replacement | May use an empty cell or replace any occupied card, including the starter. Removed cards do not return to hands. Normal placement comparisons follow. |
| 7 | Reversal | Reverses non-draw comparisons on attack and defence. Two Reversals cancel. Ties follow ordinary/Genius rules. |
| 8 | Impatience | Once per player per match, place this card from hand after the opponent has spent 15 seconds on their turn. Their turn and clock continue. Bob uses it automatically against a slow player. |
| 9 | Mimic | On placement, choose an existing board special's ability. Copies the ability, not teeth; copied ability persists even if source leaves. Can copy another Mimic only if it already copied a concrete ability. With no eligible source it behaves as an ordinary card. Deck-budget and hand-interrupt effects cannot apply retroactively after placement. |
| 10 | Raw talent | No triggered ability. Its configured teeth and score define its strength. |

The AI enumerates Focused strike and Mimic choices, as well as occupied Replacement
spaces. Ranked replays include choices and validate them. Client data cannot enable
interrupt timing or grant an extra deck budget.

Ranked matches with Impatience in either hand use server-stored turn state and a
server-checked 15-second boundary, accessed through the authenticated turn endpoint.
They require a connection while playing and resume from server state. Other ranked
matches retain local play and authoritative replay on settlement. Training uses the
same turn state locally. Online PvP uses its existing transaction and clock system.

Placement, captures, removals and stat/ability changes animate in both interfaces.
Reduced-motion preference disables motion. Special badges and card tooltips identify
powers. Deploy frontend and backend together; no new Firestore rules are needed for
these fields, which are handled through the existing server-only battle collections.
