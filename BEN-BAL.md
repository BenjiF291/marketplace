# BEN-BAL

In Marketplace, expand the bottom-left toolbar and select **BEN-BAL** next to **Pack shop**. Select a slot on the 4–3–3 pitch, then assign a card from your collection. Select an occupied slot to preview its effective stats or clear it. **Save team** saves the current lineup, including a partial lineup.

## Card data and releases

`data/ben-bal-allocations.json` stores six stat keys for each eligible Marketplace card ID. Legacy cards use their filename as the ID and packaged cards use the existing package ID. The packaging command uses a versioned SHA-256 ordering of the six stat keys to assign action pairs to new identities. It preserves all existing action pairs, including for retired identities, and adds an allocation only for cards with six numeric stats. Within each action, the higher value becomes Primary. Equal values keep the existing order.

The existing `/card-data` route and `window.CardData.getCardData` support an optional `mode=ben-bal` query. It returns the current stats and adds `benBal`, which contains the six assigned keys in value order within each action and the current natural position. An incomplete card keeps its null stats and returns `benBal: null`. Updating a card’s numeric stats can swap the order within an action and change its natural position. Packaging persists the corrected order.

The highest of Attack Primary, Dribble Primary and Defence Primary determines natural position. Ties resolve in that order. An out-of-position card loses 10 from all six effective values, with a floor of zero. Any card can play goalkeeper at full strength. The shared card model computes those values without changing the source stats.

The 16 original background images under `public/assets/ben-bal/` are unchanged copies of Card Creator’s background assets. The HTML card face displays the name and Overall on the left and the Attack, Dribble and Defence blocks on the right. Each block shows the two stat keys and their values. The natural-position block is highlighted.

Card Creator's **Add to Game** saves the previewed action pairs to a private sidecar keyed by the final card ID. Local Ben-Bal reads can use that sidecar as soon as the card is imported. Run the usual `npm run package:card-data` for a release. Packaging uses a saved sidecar allocation for a new ID and gives the existing allocation manifest priority for known IDs. Include both `data/card-statistics.json` and `data/ben-bal-allocations.json`, plus the catalogue assets, in the normal Render release. Restart a running local server after repackaging so it reads the updated manifests. The monthly export contains 269 allocations. The other 12 cards have intentional nulls.

## Team persistence

Authenticated `GET` and `PUT /ben-bal/team` use the Marketplace session and Firestore document `benBalTeams/{userId}`. A lineup stores a map of slot IDs to card IDs and a schema version. Each write validates the formation, distinct identities, complete card data and current inventory inside a transaction. Opening the team clears saved assignments for identities outside the player’s available inventory. The collection and validation use the same sold, player-owned items as Marketplace inventory and exclude items listed for sale. Multiple available copies of the same identity still occupy at most one slot.

## Play Against Robot

Fill all 11 slots, then select **Play Against Robot**. The setup endpoint checks the current draft against the signed-in player’s inventory and sends authoritative card data and the playable robot catalogue. You can play with unsaved edits. Setup reads inventory and does not write the team. **Play Again** uses the validated lineup from the same session and draws a new robot team from the cached pool.

Initiative alternates with the player going first. Attack counters Defence, Defence counters Attack, and Dribble counters itself. Compare effective Primary first, then Secondary when tied, then the sum of all six effective stats. If all three are tied, the round is drawn. Both cards are spent each round. The player with more wins after 11 rounds wins the match.

The robot builds a 4–3–3 from real catalogue cards. Its bounded search samples lineups and tries card replacements and position swaps. Inside the 95–105% effective-power band, it scores candidates on total power, the three action Primary sums, the spread of card power, and the number of out-of-position cards. If it misses the preferred band, it takes the closest candidate it found and checks the exact attainable minimum and maximum. Targets outside the catalogue’s attainable range get the closest extreme.

The Normal robot evaluates card-and-action pairs when it initiates. It estimates the chance of winning and the cost of spending a versatile card. It can save a stronger card when even its best counter looks unlikely to win and the score leaves room to concede. It gives winning the current round more weight in a late deficit or when a win can clinch the match. During a match it sees the public score and previously revealed rounds. A response receives the declared action and Overall of the current hidden card. The robot’s pre-match notes retain the lineup’s Overalls so it can update the remaining distribution as cards are revealed.

Select a card directly on **Your Pitch**. Use the pitch buttons or swipe horizontally to switch between the two 4–3–3 formations. The robot’s unrevealed cards show only Overall, and all used cards remain faded in their original slots. The arena reveals the two cards and highlights the comparisons in order. The eleven-round tracker uses both symbols and colour for wins and draws.

## Results and Daily Packs

The server validates the owned lineup at kickoff and both sides' match state is stored in `benBalMatches/{matchId}`. Only the current public view is sent to the browser. The server replays accepted moves with the existing match engine, a private random seed, and the same robot policy. An identical round retry returns its original round and reward receipt. A conflicting move is rejected. Completing round eleven settles the match automatically.

A Firestore transaction saves the final move and receipt, increments `benBalDailyRewards/{uid}/days/{YYYY-MM-DD}`, and creates one owned pack in `items` for an eligible victory. The server chooses the day in Europe/Amsterdam. The first three wins that day award a pack. Draws, defeats, and extra wins still show progress. The finished pitch is read-only, and both lineups are revealed. Play Again uses the same lineup and starts a new server match.

The granted item always uses the reserved reference `ben-bal-daily-pack`. Configure a valid pack definition at that ID or set `BEN_BAL_DAILY_PACK_ID` on the server to an existing valid definition. That reference also applies to packs players already earned. Until then, attempting to open one leaves the item in the inventory. The normal pack configuration defines all contents and probabilities.

The accompanying Firestore rules reserve direct database access for the backend Admin SDK. Server validation derives match scores and prevents duplicate grants. Those protections do not replace authorization on HTTP routes.

## Leagues and daily pack rewards

Bronze, Silver, Gold, Platinum, Lightning and Ultra use one team builder. Teams save independently under `benBalTeams/{userId}/leagues/{league}`. Kickoff resolves the existing Marketplace tier document, checks card metadata (including the historical Lightling spelling), ownership and formation, and builds a robot team within the same eligibility rules. Both teams may use one Special card within the league's configured Overall range. A blank range disables Special cards.

Bronze, Silver and Gold also accept Rare Bronze, Rare Silver and Rare Gold respectively. Matching Rare cards can fill any number of formation slots for either team. Their existing stats feed the same robot balancing calculation.

Use **Ben-Bal League Rewards** in Marketplace Admin to link an existing pack and optionally set the Overall range for each league. Settings persist in `benBalSettings/leagues`. The server verifies the Marketplace session and Admin role. Matches remain playable without a configured reward, and the counter advances only when the server grants a pack.

The round-eleven transaction records the result, the inventory item and the counter at `benBalDailyRewards/{userId}/days/{Amsterdam date}--{league}`. Each league grants at most three packs per day. Retries return the original match receipt. Earned items retain their Marketplace pack ID. Changing the league mapping affects future grants, while editing the underlying pack definition follows the existing Marketplace rules.

Reward routes use the existing Marketplace session and user role. Clients access accounts, inventories and progression through the backend API.

V3.0 teams and global reward counters remain in place. They are not attributed to individual leagues. Completed legacy match receipts remain replayable, and previously earned Daily Packs keep their original definition lookup. Unfinished legacy matches must restart in a league before earning a reward.

## Local verification

- Run `node --test --test-isolation=none ben-bal-rewards.test.js ben-bal-match.test.js ben-bal.test.js card-statistics.test.js`.
- Run `node scripts/ben-bal-simulate.cjs` to benchmark Normal against seeded random, greedy, and conservative player policies. The optional argument sets the number of lineups per policy.
- Run `node scripts/ben-bal-browser.cjs` with the project’s Playwright tooling in `.ui-tools`. The browser test defaults to Edge on Windows. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use another Chromium binary. The test uses a local Express fixture and blocks external browser requests.

- Run `node scripts/ben-bal-results-browser.cjs` for victory, defeat, draw, reward progress, and pitch inspection at desktop and mobile widths.
