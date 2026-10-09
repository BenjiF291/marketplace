# Island PWA

The website and installed app use the same public files and backend. Installation is optional; the normal URL remains available.

Deploy the complete `public/` directory, including `manifest.webmanifest`, `pwa.js`, `practice-sw.js`, `offline.html`, and `assets/pwa/`. Firebase hosting headers are included in `firebase.json`. HTTPS is required outside localhost.

On supported desktop/Android browsers, use Install island or the browser install menu. On iPhone/iPad, the install button explains Safari > Share > Add to Home Screen. Installation and OS integration should also be checked on physical iOS and Android devices after deployment.

The existing practice-sw.js URL is retained to migrate the previous worker. Online requests prefer fresh public files. Account/API requests and mutations are never cached or queued. Offline navigation shows a reconnect page; this release does not make the live economy available offline. Public asset cache is bounded to 180 runtime entries. Storage failures do not prevent online use.

Ordinary website deployments update the installed game's code too. Waiting worker updates activate on the next page launch. Login and signup check for updates and activate them before navigating into the game, with a five-second timeout. No update button or forced refresh during play. Android launcher icons update on the browser/OS schedule, separately from these game updates. Increment the island-public cache version if a later worker change requires clearing public assets.

Validation: `node --test pwa.test.js`. Local real-browser check in `.ui-tools/check-pwa.cjs` also checks registration, offline navigation and reconnection.
