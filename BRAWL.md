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

Bob's target average varies by up to 4% of the player's average, capped at one rating point in either direction. The available catalog determines how closely it can match. **The deck with the higher total score always starts**; equal totals use a coin toss. The server determines this for ranked matches, ignoring any client-supplied starting-player choice. Saved matches retain their original starting order.

Bob retains the versioned `adaptive-v2` policy and the 3-5 second thinking delay. For player skill fraction `r`, his decision handicap is `190 + 220*r^3`, and decision parameter `s = r - handicap/1000`. He takes the best scored move with probability `max(0, 0.15 + 0.8s)`; otherwise moves are sampled with weights `exp((value-bestValue)/(15+260*(1-s)^2))`. His move selection still uses the original one-reply search; the deeper assessment is used to review player decisions. These separate roles preserve existing saved replays and the previously tuned difficulty curve.

New matches store `assessmentVersion: 2`; older in-progress matches retain their old assessment and AI policy. There are no forced winners, adjusted card stats, or score manipulation.

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

Run `node brawl-balance.cjs 100` to reproduce the latest simulation: 100 games each at levels 100/300/600/900, with varied decks around average 50 and the stronger deck starting. Player wins were 75/84/81/74: **314 of 400 (78.5%)** overall. **282 of 400 (70.5%)** finished within three board cards; the mean absolute margin was 3.04 cards. The numeric decision policy models the player. Approximately 75% remains the target, not a promised human win rate; decks, placement estimates, and player decisions affect the outcome.

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
