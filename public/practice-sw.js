const CACHE = 'battle-practice-shell-v2';
const FILES = ['index.html', 'style.css', 'app.js', 'ascend-utils.js', 'gem-colors.js', 'amulets.js', 'gem-workshop.js', 'dye-mode.js', 'practice-engine.js', 'practice-battle.js', 'practice-worker.js'];
const urls = FILES.map(file => new URL(file, self.registration.scope).href);
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(urls)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('battle-practice-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET')return;
  const url = new URL(event.request.url);
  const root = new URL(self.registration.scope);
  const isHome = url.origin === root.origin && url.pathname === root.pathname;
  const key = isHome ? new URL('index.html',root).href : url.href;
  if(!urls.includes(key))return;
  event.respondWith(fetch(event.request).then(response => {
    if(response.ok) { const copy=response.clone(); event.waitUntil(caches.open(CACHE).then(cache=>cache.put(key,copy))); }
    return response;
  }).catch(()=>caches.open(CACHE).then(cache=>cache.match(key))));
});
