/* Same URL/scope as the old practice worker, so existing installations migrate. */
const CACHE='island-public-v2';
const root=new URL(self.registration.scope);
const offline=new URL('offline.html',root).href;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([offline,new URL('assets/pwa/island-icon-192.png',root).href]))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('island-public-')&&k!==CACHE)||k.startsWith('battle-practice-shell-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==root.origin||!url.pathname.startsWith(root.pathname))return;
 const relative=url.pathname.slice(root.pathname.length);
 // Only explicit public pages/assets are handled. API, credentials and mutations bypass caches.
 const navigation=request.mode==='navigate'&&['','index.html','login.html'].includes(relative);
 const asset=/^[^/]+\.(js|css)$/.test(relative)&&relative!=='practice-sw.js'||/^(assets|images)\/.+\.(png|jpg|jpeg|webp|svg|woff2?)$/i.test(relative);
 if(!navigation&&!asset)return;
 if(request.headers.has('Authorization')||request.headers.has('X-User-Id')||request.headers.has('X-Hall-Token'))return;
 event.respondWith((async()=>{
  try{
   const response=await fetch(request,{cache:'no-cache'});
   if(asset&&response.ok&&!response.redirected&&!response.headers.get('content-type')?.includes('text/html')){
    const copy=response.clone();event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.put(request,copy);const keys=await cache.keys();const runtime=keys.filter(k=>k.url!==offline&&!k.url.endsWith('/assets/pwa/island-icon-192.png'));await Promise.all(runtime.slice(0,Math.max(0,runtime.length-180)).map(k=>cache.delete(k)));})().catch(()=>{}));
   }
   return response;
  }catch{
   const cached=await caches.match(navigation?offline:request);return cached||new Response('Connect to the internet to load this file.',{status:503,headers:{'Content-Type':'text/plain'}});
  }
 })());
});
