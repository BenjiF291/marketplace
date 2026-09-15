# Brawl Skill Level

Ranked Brawl starts at 300 Skill Level, bounded to integer levels 0–1000. Progress lives in the server-only `brawlProfiles/{userId}` document. Existing trophy balances and trophy-path rewards remain intact. Training remains local and awards neither skill nor rewards.

Bob uses the existing randomized deck builder with an equal average-strength target. Available catalog cards determine how closely it can match. New matches store the versioned `adaptive-v2` decision policy with the player's current skill. His cards receive no stat bonuses. His 3-5 second thinking delay remains. Saved matches retain their original policy so offline continuation and server replay agree.

The existing one-reply search ranks placements for either side. For player skill fraction `r`, the decision handicap is `190 + 220*r^3` points, and Bob's decision parameter is `s = r - handicap/1000`. Bob chooses the best scored move with probability `max(0, 0.15 + 0.8s)`; otherwise he samples moves with weights `exp((value - bestValue) / (15 + 260(1-s)^2))`. The decision parameter can be negative at beginner levels to allow more mistakes; account Skill Level remains bounded to 0-1000. Bob still improves continuously across the entire skill range. This is a tactical heuristic, not a full-game perfect solver. There is no forced winner, score manipulation, or card-stat handicap.

The server replays the stored initial state, seeded Bob moves, and submitted player placements. Each informative player decision scores `max(0, 1 - regret/300)`, where regret is the difference from the best scored placement (board ownership contributes 100 evaluation points per card). Equivalent/forced decisions are excluded. Average decision quality is compared with `0.55 + 0.4 * currentSkill/1000`.

Skill change is `12 * result + round(32 * (quality - expectedQuality))`, clamped at the final level. Result is +1 / 0 / -1 for win / draw / loss. No informative decisions means a neutral decision contribution. This lets poor decisions reduce skill even in a win. Abandoning a ranked match forfeits it when starting another: -12 skill and -10 trophies. Training does not forfeit an existing ranked match until the next ranked match starts.

## Current-level boosters

Only the strongest eligible booster applies; these bonuses replace each other, never stack. They are derived on demand, disappear immediately below their threshold, and return on climbing back. No booster modifies cards, Bob, or the skill calculation.

| Skill | Booster | Footy per ranked win | Extra win trophies |
| --- | --- | --- | --- |
| 150 | Contender | 10 | 5% |
| 300 | Challenger | 20 | 8% |
| 450 | Tactician | 30 | 12% |
| 600 | Strategist | 45 | 16% |
| 800 | Master | 60 | 20% |
| 1000 | Champion | 80 | 25% |

Base ranked rewards: +25 trophies for a win, -10 for a loss, zero for a draw. Bonus trophies round to the nearest integer. The booster active immediately before settlement applies to that battle's reward; the updated level determines eligibility thereafter. Transactions save skill, rewards, and a repeatable result together, preventing duplicate payouts on retries. Old in-progress difficulty-based matches retain their original trophy settlement and do not alter skill.

## Security and rollout

Deploy the backend, frontend, and `firestore.rules` together. Account documents must no longer allow direct client reads/writes because they hold credentials. The app uses backend APIs for these documents. Login/signup now issue random 30-day bearer sessions; only hashed tokens are stored. Ranked progression endpoints verify both token and account. Existing users must log in again once. Local Training still works without a token.

The browser saves ongoing matches for offline continuation. A connection is needed to start ranked matches and settle results. Replays validate legal moves and rewards; they cannot prove a human played without outside assistance.

## Validation and tuning

Run `node --test practice-engine.test.js trophy-utils.test.js trophy-routes.test.js brawl-skill.test.js brawl-auth.test.js`.

Run `node brawl-balance.cjs 300` to reproduce the tuning simulation. It uses 300 matches at each player level 100/300/600/900, alternating first turn, with equal starter decks and the original numeric decision policy representing the player at their level. New-policy player wins were 228/210/232/206 respectively: **876 of 1200 (73%)** overall. **947 of 1200 (79%)** finished within three board cards; average absolute margin was 2.56 cards. Bob won the remaining games. This targets approximately 75% wins without guaranteeing outcomes; human decisions and different decks will change actual win rates.

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
