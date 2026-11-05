const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function worker(){const handlers={};vm.runInNewContext(fs.readFileSync('public/practice-sw.js','utf8'),{URL,Response,self:{registration:{scope:'https://island.test/'},addEventListener:(name,fn)=>handlers[name]=fn},caches:{},fetch:()=>Promise.reject(Error('offline'))});return handlers;}

test('install prompt can be dismissed persistently while installation remains available from profile',async()=>{
 const storage=new Map();
 function boot(){const events={},body={append(n){n.parentElement=this;}},nodes=[];
  const context={navigator:{userAgent:'Chrome',serviceWorker:{register:async()=>null}},matchMedia:()=>({matches:false}),MutationObserver:class{observe(){}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},location:{pathname:'/index.html'},setTimeout,clearTimeout,console,
   document:{body,head:{append(){}},querySelector:()=>null,createElement:tag=>{const node={tag,children:[],setAttribute(){},append(...n){this.children.push(...n);}};nodes.push(node);return node;}},window:{isSecureContext:true,addEventListener:(name,fn)=>events[name]=fn}};
  vm.runInNewContext(fs.readFileSync('public/pwa.js','utf8'),context);return {events,nodes,api:context.window.IslandPWA};
 }
 let prompts=0;const first=boot(),controls=first.nodes.find(n=>n.className==='pwa-controls');
 first.events.beforeinstallprompt({preventDefault(){},prompt:async()=>prompts++,userChoice:Promise.resolve({outcome:'accepted'})});
 assert.equal(controls.hidden,false);controls.children[1].onclick();assert.equal(controls.hidden,true);
 assert.equal(prompts,0);await first.api.install();assert.equal(prompts,1);
 const second=boot(),newControls=second.nodes.find(n=>n.className==='pwa-controls');
 second.events.beforeinstallprompt({preventDefault(){},prompt:async()=>prompts++,userChoice:Promise.resolve({outcome:'accepted'})});
 assert.equal(newControls.hidden,true);await second.api.install();assert.equal(prompts,2);
 second.events.appinstalled();assert.equal(second.api.isInstalled(),true);assert.equal(newControls.hidden,true);
});
test('PWA worker leaves authenticated requests, APIs, writes and other origins alone',()=>{const handler=worker().fetch;for(const [url,method,headers] of [['https://island.test/admin/village','GET',{}],['https://island.test/village/action','POST',{}],['https://backend.test/items','GET',{}],['https://island.test/app.js','GET',{'X-User-Id':'player'}],['https://island.test/app.js','GET',{Authorization:'token'}]]){handler({request:new Request(url,{method,headers}),respondWith:()=>assert.fail('Private or mutation request intercepted')});}});

test('worker reuses fresh public artwork, refreshes expired artwork, and always checks code',async()=>{
 const handlers={};let calls=0;
 const fresh=()=>new Response('image',{headers:{date:new Date().toUTCString()}});
 let cached=fresh();
 const context={URL,Response,self:{registration:{scope:'https://island.test/'},addEventListener:(name,fn)=>handlers[name]=fn},
  caches:{match:async()=>cached,open:async()=>({put:async()=>{},keys:async()=>[],delete:async()=>{}})},
  fetch:async()=>{calls++;return new Response('network',{headers:{'content-type':'text/plain'}});}};
 vm.runInNewContext(fs.readFileSync('public/practice-sw.js','utf8'),context);
 async function get(path){let result;const waits=[];handlers.fetch({request:new Request('https://island.test/'+path),respondWith:p=>result=p,waitUntil:p=>waits.push(p)});const response=await result;await Promise.all(waits);return response.text();}
 assert.equal(await get('assets/example.png'),'image');assert.equal(calls,0);
 cached=new Response('old',{headers:{date:new Date(Date.now()-7200000).toUTCString()}});
 assert.equal(await get('assets/example.png'),'network');assert.equal(calls,1);
 cached=fresh();assert.equal(await get('app.js'),'network');assert.equal(calls,2);
});
test('PWA manifest references real correctly-sized PNG icons and preserves browser entry point',()=>{const manifest=JSON.parse(fs.readFileSync('public/manifest.webmanifest','utf8'));assert.equal(manifest.start_url,'./index.html');assert.equal(manifest.display,'standalone');for(const icon of manifest.icons){const png=fs.readFileSync('public/'+icon.src);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`,icon.sizes);}for(const page of ['index.html','login.html']){const html=fs.readFileSync('public/'+page,'utf8');assert.ok(html.includes('manifest.webmanifest'));assert.ok(/src="pwa\.js(?:\?[^"]*)?"/.test(html));}});
test('login inline scripts parse and login/signup await the automatic PWA update',()=>{const html=fs.readFileSync('public/login.html','utf8');for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);assert.equal((html.match(/await window\.IslandPWA\?\.prepareForLogin\(\)/g)||[]).length,2);assert.ok(!fs.readFileSync('public/pwa.js','utf8').includes('Update ready - reload'));});

test('Android and iPhone entry pages agree on Kael icons and include a separate maskable asset',()=>{
 const manifest=JSON.parse(fs.readFileSync('public/manifest.webmanifest','utf8'));
 assert.equal(manifest.id,'./');assert.equal(manifest.scope,'./');
 assert.ok(manifest.icons.some(i=>i.purpose==='maskable'&&i.sizes==='512x512'));
 assert.ok(manifest.icons.some(i=>i.purpose==='any'&&i.sizes==='192x192'));
 assert.ok(manifest.icons.every(i=>i.src.includes('kael-v2-')));
 for(const page of ['index.html','login.html']){
  const html=fs.readFileSync('public/'+page,'utf8');
  assert.match(html,/<link rel="apple-touch-icon" sizes="180x180" href="assets\/pwa\/kael-v2-180.png">/);
  assert.match(html,/<link rel="icon" type="image\/png" sizes="192x192" href="assets\/pwa\/kael-v2-192.png">/);
 }
});
