# Individual creature growth

Each owned kind/ordinal has permanent `{level,hunger}` in the account's `creatureGrowth` map. Duplicate residents have separate bars and levels. New creatures start at level 1 with an empty bar. Existing names, food inventory, ownership and Brawl grades remain intact. No backfill/reset job is needed. Feeding does not change Brawl stats directly: creature level unlocks access to token-funded grades.

Food is consumed from the existing `rubyItems` inventory:

| Food | Nutrition |
|---|---:|
| Regular meal (`food`) | 10 |
| Explorer Trail Mix (`food:trail`) | 25 |
| Starlight Feast (`food:feast`) | 60 |

A full bar automatically levels the individual up; surplus carries forward and can produce multiple levels. Required nutrition is `ceil(30 * 1.06^(level-1) / 5) * 5`: 30 at level 1, 55 at level 10, 115 at level 24, 555 at level 51. Progress does not decay. The current ceiling is creature level 100; further feeding at the ceiling is rejected without consuming food.

Grade caps are 5 at level 1, 7 at level 24 and 10 at level 51. Grade costs, by destination grade 2-10, are `[5,10,20,40,100,200,400,800,2000]` species tokens. Current HP/ATK/DEF scaling remains unchanged. Existing higher grades are not removed, but further upgrades require the appropriate feeding level. Tokens are separate for every creature variant (Kael/Tharos, Rill/Aeri, Brugar/Brakk, Krynn/Virex and Fenra/Saelis). Duplicate residents of the same variant share its tokens; levels and hunger stay individual. Legacy family balances stay with the base variant, with Veyrin moved once to Kael; no balances are duplicated.

`GET /stable` supplies growth, foods and tokens. `POST /stable/feed` authenticates the account, validates ownership, food and quantities (1-100), rejects active Brawl matches, and writes food/growth together in a transaction. Durable per-account `creatureFeedActions` receipts make retries exactly-once, including concurrent requests and reloads. The browser preserves pending feeding requests until confirmed; a retry does not charge twice. The Brawl upgrade route accepts either the owned instance UUID or its stable growth key. The stable and owned Brawl creature inspector share feeding/upgrade controls; companion station meals also fill the same companion growth bar while preserving existing happiness/cooldowns.

## Reference and balancing choices

Rise of Berk's official feeding guide describes three feedings per early level and increasing resource costs: https://ludia.helpshift.com/hc/en/11-dragons-rise-of-berk/faq/136-how-do-i-level-up-my-dragons/

Its official Brawl guide confirms both tokens and creature level are needed: https://ludia.helpshift.com/hc/en/11-dragons-rise-of-berk/faq/249-brawl-how-do-i-manage-and-upgrade-my-dragon-in-brawl/

The April 2025 update gives Rookie destination-grade costs 100/200/400/800/2000 for grades 6-10: https://dragonsriseofberk.com/release-notes/update-1-95/

These inform this game's curve; this is not a claim that all current Rise of Berk rarities use that same table. The first five levels, nutrition values, 6% requirement growth, level ceiling and requested 24/51 gates are this game's balancing choices. No training timers, fish currency or new food types were added.
