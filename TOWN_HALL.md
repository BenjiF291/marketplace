# Town Hall: private progression, shared community room

Still an admin-only preview. Frontend and backend must deploy together. No deployment has been performed. The room, table, chat and decorations are shared. Every account has its OWN Town Hall level and village building unlocks, derived only from server-owned `townHallXP`. Previous shared test levels are ignored; accounts without personal XP start at level 1. The map's simulated level dropdown changes appearance only.

## XP and upgrades

Cumulative thresholds for levels 1-10: **0, 100, 300, 650, 1150, 1850, 2850, 4200, 6000, 8500**. Level 2 unlocks Blacksmith/Ruby emporium, 3 companions, 4 dyes, 5 refinery, 6 Royal hall. Levels 7-10 are prestige levels for now. XP never exceeds 8500. The room shows current progress and the next unlock. Upgrades happen automatically, with a golden level-up celebration; reduced-motion preferences disable motion. Returning to the island refreshes its unlocked buildings.

Gameplay XP, up to 100 per UTC day:

| Activity | XP |
|---|---:|
| Wheel spin | 5 |
| Pack actually opened | 12 |
| Pet journey claimed | 15 |
| Completed ranked Skystones win / draw / loss | 20 / 12 / 8 |

Training and forfeits do not grant XP. During the private preview only admin accounts accrue gameplay XP. Rewards are included in the same transactions as the existing game rewards, with their existing cooldown and retry protections. No separate Firebase reads/writes are added to those reward transactions for XP.

Projects, up to 100 XP per UTC day, separate from gameplay:

| Project | Consumed resources | XP |
|---|---|---:|
| Restore stonework | 5 Rubies | 20 |
| Stained-glass windows | 2 Citrine | 45 |
| Provision builders | 3 Crystal Crunch | 15 |

Projects use explicit contribution buttons, server-defined prices, transactions and persistent action receipts. Retrying one action cannot charge or reward twice. Max-level accounts cannot spend resources on projects. The first display of each different owned collectible grants 30 personal XP once. Removing and replacing it never grants more XP. This bonus is separate from daily limits.

## Collectible displays

The existing Ruby Rose, Crimson Moon and Ancient Geode Crown can be displayed. New Ruby-shop collectibles: Archivist Books (60 Rubies), Fern Planter (75), Community Pennant (100), Skystones Trophy (300), Obsidian Dragon (500). No freely placed test decorations remain visible.

A display is a loan: the account retains ownership and its personal collectible. A single owned type can occupy only one shared shelf for that contributor. Other owners can display their own copy. Placement verifies ownership from the user document within the room transaction. Contributors' names appear below displays. The owner can remove or replace their display; admins retain moderation access. Room revisions prevent concurrent edits from silently overwriting one another.

## Character creator and art

Twelve saved appearance settings: skin, hair colour, eye colour, clothing colour, trim, trousers, six hairstyles, three outfits, four headwear choices, three cape lengths, four accessories and three beard choices. Every value is allowlisted server-side. Layered SVG characters preserve direct customisation and support walking, blinking and seated poses.

The painted room keeps the established walkable floor, long table, eight seats and eight wall displays. The original multiplayer/game invitation flow is reused. Room and collectible art load from local PNG files only. Art prompts and asset paths: `public/assets/village/TOWN-HALL-ART.md`.

Presence/chat remain in server memory on one backend process. Walking/polling do not read Firestore per tick. Progress and ownership refresh when joining or opening projects/displays; decorators/projects write only explicit changes. Default-deny Firestore rules cover new `townHallActions` receipts. No new index is needed. User accounts remain server-only.

## Verification

`node --test` covers progression thresholds/caps, project costs and retries, independent levels, missing ownership, display duplication, one-time showcase XP, authorisation and existing game regressions. `TOWN_HALL_CHECK_ONLY=1 node scripts/check-studio.cjs` uses two local fixture sessions to check character persistence, shared owned decorations, private level-up celebration, chat, seats and the Skystones handoff. Browser fixtures do not mutate live accounts.
