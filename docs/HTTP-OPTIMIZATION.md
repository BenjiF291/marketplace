Render traffic optimizations
============================

- Standard compression middleware compresses eligible responses over 1 KB and respects existing encodings, content types and no-transform. Static files retain ETag and range support.
- Public images, fonts and models have a one-hour browser cache. HTML, JavaScript, CSS and the service worker revalidate, so code deployments remain discoverable. Asset replacements at the same URL may take one hour to refresh; change their URL when immediate refresh is required.
- The service worker reuses public artwork younger than one hour. It still checks code online and bypasses authenticated/API requests. Its existing offline fallback and entry limit remain.
- Dynamic responses have private, no-store headers. Player responses never enter shared CDN caches. CORS varies by Origin.
- Simultaneous identical GETs share one request, with separate readable response bodies. Keys include all headers and request options. Explicit abort signals bypass sharing. Writes invalidate the sharing generation and are never retried or merged. No completed response cache is introduced.
- Card Brawl polls every 2 seconds during play and 5 seconds during preparation, stops in hidden tabs and refreshes immediately on return. Existing request overlap protection remains.
- Daily pack background checks run every five minutes instead of every minute. Local countdowns, open/focus refreshes and reward/equipment-triggered refreshes remain.
- Creature Brawl sends its catalog once per page session; a matching catalogVersion omits it from later state responses. Older clients and mismatched versions still receive the full catalog. Advance the catalog VERSION when changing its content.

Deployment: deploy package.json, package-lock.json, backend and public files together. Restart the Node server. Existing service workers update automatically at startup/login. No Render dashboard settings are required.

Verification: node --test --test-isolation=none http-optimization.test.js session-network.test.js creature-brawl-routes.test.js pwa.test.js free-pack-ui.test.js

Limits: no production traffic measurements or Render deployment performed. Models/textures were not recompressed or changed; that requires visual quality checks and an asset pipeline. WebSockets and battle delta protocols were not introduced. Actual savings depend on usage and upstream hosting compression/cache behavior.
