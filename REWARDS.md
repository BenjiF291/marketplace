# Rewards and progression

## VIP and wheel

- VIP gives a 20% chance of exactly one extra matching gem per successful converter
  use, regardless of whether one, two, or three cards are used.
- The roll is server-side and fixed across transaction retries. Consumed cards
  cannot be submitted again for another payout.
- VIP and full-batch amulet bonuses stack, and the conversion result identifies both.
- The wheel cooldown is seven hours from the last successful spin. Existing timers
  use the shorter cooldown immediately. VIP still doubles the base wheel reward;
  amulet bonuses are added afterward.

## Amulet variety

The shop now has five amulets per tier, with curated roles, combinations, and
loadout conditions. This replaces the old seven-per-tier catalog. See
[AMULETS.md](AMULETS.md) for the full current catalog and retirement behavior.
The strongest active bonus per family applies; duplicate effects do not add.
Slot prices and the five-day removal lock are unchanged. Trophy-road exclusives
are retained. Conditional rewards are checked against current account state.

## Trophy road

There are 24 milestones. Original rewards and their claim IDs remain unchanged.
Existing players can claim newly inserted milestones below their peak, once each.
Packs, amulets, currencies, dyes, and the claim marker are granted in one transaction.

| Trophies | Footy | Other rewards |
| --- | --- | --- |
| 25 | 50 | — |
| 50 | 60 | 3 Ruby, 5 Ruby dyes |
| 75 | 100 | 5 Ruby |
| 100 | 100 | Trailblazer Chime |
| 150 | 150 | 5 Garnet |
| 200 | 125 | Ruby Victory Pack |
| 250 | 200 | 5 Moonstone |
| 350 | 200 | 5 Moonstone, 10 Moonstone dyes |
| 400 | 300 | 5 Opal |
| 500 | 250 | Chromatic Compass |
| 600 | 400 | 5 Citrine |
| 750 | 350 | Moonstone Victory Pack |
| 850 | 500 | 5 Emerald |
| 1,000 | 500 | 10 Citrine, 15 Citrine dyes |
| 1,150 | 650 | 5 Sapphire |
| 1,250 | 600 | Citrine Victory Pack |
| 1,500 | 800 | 5 Amethyst |
| 1,750 | 800 | Champion's Laurel |
| 2,000 | 1,000 | 5 Diamond |
| 2,250 | 1,000 | Sapphire Victory Pack |
| 2,500 | 1,200 | 15 Amethyst, 20 Amethyst dyes |
| 3,000 | 1,500 | 10 Diamond, Eternal Furnace |
| 4,000 | 2,000 | 15 Diamond, Diamond Victory Pack |
| 5,000 | 2,500 | 25 Diamond, two Diamond Victory Packs |

Victory packs contain one randomly selected normal card from their matching
configured gem tier. Their pack definitions are created when claimed. If that
tier has no configured cards, claiming fails without consuming the reward.

Deploy frontend and backend together. These changes use existing server-managed
account, item, and pack fields; no new Firestore rules are required.
