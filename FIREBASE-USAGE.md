# Firestore usage optimizations

- Balance, wheel, VIP, and admin account detail refreshes use `/users?userId=...`: one account document instead of the entire users collection. Directory pickers retain the full list. Startup reuses the balance already loaded with that list.
- Marketplace viewer pricing reads the admin accounts and the viewer document, rather than every account. VIP and equipped amulet data remain fresh.
- PvP match polling reads the match once unless its clock has expired. An overdue match still goes through the existing transactional timeout settlement and prize handling.
- Timed Bob battle polling writes only when the server advances a move; idle polls still read and authenticate, but do not rewrite the board.

These are per-operation reductions, not measured production billing savings. For example, with 100 accounts, a balance refresh goes from 100 document reads to one. Normal PvP polling goes from two match reads to one (excluding timer recovery and other requests).

The marketplace still scans item documents to retain compatibility with older listings whose `sold` field is absent. Filtering strictly on `sold == false` would hide those listings. A future migration can normalize those records before narrowing this query. Tier/catalog reads and background recovery scans also remain potential follow-up work.

Deploy backend and frontend for all savings to take effect. No Firestore rule changes, data migrations, or new composite indexes are required. Purchases, reward claims, and account balances retain fresh transactional checks.
