# Ruby Cabinet

The header Ruby shop opens the shop in both UI styles. Home shows owned relics and the selected companion; profile styles decorate the Current User panel. Three companions (100/150/250 Rubies) roam on Home, react to clicks, and optionally enjoy 2-Ruby treats. No hunger, decay, or gameplay penalties. Local movement makes no server requests and respects reduced motion. Relics cost 150/250/400, pack reveal effects 100, and profile styles 60/120. Permanent items may be equipped/unequipped; collectibles stay on the shelf.

## Consumables

- Recall: 40 Rubies, removes one equipped amulet immediately, returns it to inventory, consumes one token.
- Fuel: 15 Rubies. Arm in the shop, then the next successful conversion consumes one fuel. Saves half the Footy cost after amulet discounts, capped at 100 Footy.
- Wheel retry: 20 Rubies. Replaces the last spin payout (can be lower), preserving that spin's VIP multiplier and amulet bonus. Must be within seven hours of that spin. Once per Amsterdam date; does not change cooldown or spin count. Players must have enough balance to cover a worse replacement. Spins made before this deployment are not eligible.

## Compass prices and eligibility

| Compass | Rubies | Highest eligible tier |
|---|---:|---|
| Common | 12 | Silver |
| Uncommon | 25 | Rare Gold |
| Rare | 45 | Lightning |
| Ultra Rare | 80 | Ultra |
| Mythical | 140 | All configured special tiers |
| Legendary | 220 | All packs, including unclassified packs |

Choose a compass when opening an inventory pack. The server draws up to three distinct cards from its contents and saves the choices on the pack while consuming one compass. Pick one card. The other cards are not awarded. Closing/reopening resumes the same choices. Packs with a pending choice cannot be listed for sale. Small packs offer only the number of unique cards they contain. Lower compasses also cover lower tiers. Existing configured tier ordering and pack assignments determine eligibility; known trophy packs use their matching tier.

## Persistence and deployment

Ruby shop purchases and uses are authenticated, transactional, and deduplicated by action ID. Utility rewards and consumption are server controlled. Ruby shop items can also be granted from the existing admin grant hub. New account fields use empty defaults; no account migration is needed. `rubyActions` receipts are server-only under existing default-deny rules.

Deploy backend and frontend together. No new Firestore composite indexes or rule changes. Converter base costs are now one tier sell price per card, replacing the previous 1.5x multiplier. Pack-opening, VIP, and amulet rewards remain compatible.

## Companion presentation upgrade

Companions now use layered local SVG illustrations instead of emoji. Desktop art is 350px wide, mobile art 285px. A prominent nook beneath the Home hero offers Sunlit Ledge, Crystal Hollow, and Cozy Corner perches. Breathing, blinking, ears/feelers, tails, shells, and wings animate separately. Idle peeks hide behind the foreground ledge; clicking produces a hop with hearts, and feeding adds a nibble reaction. Animations pause offscreen and respect reduced motion. Prices, ownership, and feeding costs are unchanged, and animation never writes to Firestore.

## Roaming and hide-and-seek

Companions start at home. The three home controls are Call back / stay home, Roam, and Play hide and seek. Leaving plays a full dive below the ledge. Roam picks an available corner on the current page; hide-and-seek picks and keeps one of twelve named spots until the player clicks the pet. Spots cover the home banner, daily pack, collection shelf, market, inventory, amulets, workshop, wheel, VIP, wallet, selling desk, and Brawl lobby. Some hiding spots require scrolling. A persistent Call back control returns the pet from any tab. Finding a pet gives a local celebration, not currency. Feeding recalls it before the eating reaction.

Peeks are intermittent, clipped to show only part of the creature, responsive to scrolling/resizing, paused in background tabs, and suppressed during dialogs/dye mode. Reduced motion removes travel animation. Mode and hide-and-seek rounds are local to the page, reset on reload, and add no Firestore reads or writes.

### Object-based hiding spots

The floating call-back bar has been removed. Recall is available only at the companion's home. The explorer now uses 27 anchor families, including individual listing cards, inventory cards, amulets, relics, headings and banners. Each anchor offers five possible edges, with up to twelve objects per family: well over twelve possible positions, depending on loaded content and screen space. Positions must fit beside the actual object without snapping to the screen edge, and avoid the centre of interactive controls. Roaming avoids its last ten chosen positions. Hide-and-seek keeps its chosen object, but can use a different edge when screen space changes.

Visible peeks stay attached to their original object and edge for the entire appearance, including while scrolling out of view or back. Scroll does not reroll the location or restart the animation. At the end of a peek, the companion retreats behind its object for 650ms before its layer is removed. Reduced-motion mode skips travel animation.

## Multiple companions and journeys

All three owned pets can now be equipped together. Equipping another pet preserves the others; Unequip removes just that pet. Legacy single-pet equipment is read automatically. Each pet has its own home, roaming and hide-and-seek controls. Roaming reserves objects and checks visible pet rectangles, including departing pets, to prevent shared spots and overlapping arrivals. Clicking a pet opens head scratches, fetch, dance and nap interactions. These interactions and countdowns are local and make no database writes. Feeding Crystal Crunch for fun still consumes one serving and does not award loot.

Open **Companion journeys** at Home or from the Ruby shop (also accessible in Classic UI). Each owned pet can take one journey at a time; all three may travel simultaneously. Starting consumes one food and takes exactly four hours of server time, continuing while logged out. Travelling pets leave the home/roaming display until their rewards are claimed. Claiming returns them to their equipped homes. There is no automatic repeat or cancellation/refund.

Every journey awards 1–5 gems of one random tier, including configured special tiers and tiers the converter has not unlocked. Owning these gems does not unlock conversion, but their balance is visible in the gem wallet. Quantity, gem tier and rare bonus are independent draws. The bonus is added to the gems, not substituted for them.

| Food | Ruby price | Chances of 1 / 2 / 3 / 4 / 5 gems | Rare bonus chance |
|---|---:|---|---:|
| Crystal Crunch | 2 | 45% / 30% / 15% / 8% / 2% | 0.1% |
| Explorer Trail Mix | 8 | 20% / 30% / 25% / 18% / 7% | 0.4% |
| Starlight Feast | 20 | 8% / 17% / 30% / 28% / 17% | 1% |

Gem-tier weights use `decay ^ rank` across configured tiers in ascending order; decay is 0.62 / 0.80 / 0.94 respectively. Better food gives higher tiers more weight. Probabilities are normalized to one million integer outcomes, with at least one outcome for every configured tier. The UI displays the resulting exact percentages, not rounded estimates or qualitative rarity labels.

Rare bonuses are non-exclusive amulets from rank 4 (Gold in the standard ordering) upward, and nonempty packs assigned to those tiers. Trophy-exclusive amulets are excluded. The bonus probability is split approximately equally across eligible items, with exact per-item percentages shown. If no bonus items are configured, the bonus roll is always empty. Use **Journey loot odds** on any food in the shop, even before owning a pet, or **Exact loot odds** beside each pet's selected food. Amulet rewards include their gem tier in the name.

`pet-journeys.js` owns the tables and reward rules. Authenticated `/pet-journeys` exposes probabilities. Start and claim use `/ruby-shop/journey-start` and `/ruby-shop/journey-claim` with existing transactional action receipts. Rewards are drawn with server cryptographic randomness and stored at departure, hidden from the pending-journey response. Retries cannot reroll, consume food twice, or claim twice; stale journey IDs are rejected. Pack rewards mint an owned, openable pack and a contents snapshot in the claim transaction. Amulets enter the existing inventory.

No scheduled job, polling request, Firestore rule change, or new index is needed. Journey state lives in the server-only user document. Loot configuration is cached for one minute per server process; only packs referenced by eligible tiers are read. Ship the backend and frontend together, including the new `pet-journeys.js` and `public/pet-interactions.js` files. No new login or manual account migration is required.

### Pet advantages

- Ember Fox (100 Rubies): standard food odds; the affordable way to add another simultaneous journey.
- Crystal Snail (150 Rubies), Crystal Collector: a 25% chance to increase the food's gem quantity by one, capped at five. This is folded into the displayed quantity distribution.
- Pocket Dragon (250 Rubies), Treasure Hunter: the same quantity benefit as the snail, plus gem-tier decay increased by 0.04 (capped at 0.98) and double each rare bonus item's probability. Total bonus chances are 0.2%, 0.8%, and 2% for the three foods.

All pets still consume one food, take four hours, and return 1–5 gems. The journey panel displays the selected pet's adjusted odds; food previews have a pet selector for comparing exact percentages before purchase. The server applies perks from the owned pet ID, never from client-provided multipliers. Journeys already underway retain their stored rewards; existing owned pets automatically benefit on their next departure. The food table above gives the Fox/base probabilities.

## Cinematic pack effects

Ember Burst and Aurora Reveal now run full-screen, roughly five-second opening sequences. Ember uses a glowing forge, sparks, charging pack and torn seal; Aurora uses drifting light curtains, orbiting rings and a rotating pack. Both end with a lit card reveal and the actual awarded bonuses. Preview animation in the Ruby shop is free and does not open a pack or equip the effect.

`public/pack-cinema.js` and `public/pack-cinema.css` handle presentation only, after the existing server opening/compass selection has settled. Skip to reveal (or Escape) reveals immediately; Continue closes the scene. Reduced motion reveals immediately with a static backdrop. Dialog focus, timers and replaced scenes are cleaned up. Standard unequipped openings retain their existing animation. Include both new assets when deploying the frontend; existing purchases automatically use the upgraded effect.
