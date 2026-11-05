const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('.ui-tools')]}));
(async()=>{
const server=http.createServer((req,res)=>{if(req.url==='/preview'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');}const p=path.join(process.cwd(),'public',decodeURIComponent(req.url.split('?')[0]));fs.readFile(p,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'application/octet-stream');res.end(b);});});await new Promise(r=>server.listen(4227,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4227/preview');
await page.evaluate(()=>{document.body.innerHTML='';window.API_URL='/api';window.resourceHeaders=()=>({});window.CreatureBook={openCreature:()=>{}};});
const animals=require('../public/stable-animals');await page.route('**/api/stable',route=>route.fulfill({json:{total:2,animals:animals.residents({stableAnimals:{krynn:1,'krynn-species':1}})}}));
await page.addStyleTag({url:'http://127.0.0.1:4227/stable.css'});await page.addScriptTag({url:'http://127.0.0.1:4227/stable.js'});await page.evaluate(()=>Stable.open());await page.locator('.stable-resident').last().waitFor();assert.equal(await page.locator('.stable-resident').count(),2);
fs.mkdirSync('output/krynn-platforms',{recursive:true});
for(const kind of ['krynn','krynn-species']){
 await page.setViewportSize({width:1366,height:900});await page.locator(`.stable-resident[data-instance-id="${kind}:0"]`).click();await page.waitForFunction(()=>document.querySelector('.stable-model')?.dataset.modelReady==='true',null,{timeout:60000});
 const result=await page.evaluate(()=>{const host=document.querySelector('.stable-model'),entry=companion3D.entries.get(host);return {theme:entry.dais.root.userData.krynnPlatform,radius:entry.dais.root.children[0].geometry.parameters.radiusTop,scale:entry.model.root.scale.toArray()};});
 assert.equal(result.theme,'rootbound-woodland');assert.equal(result.radius,1.65);assert.equal(result.scale[0],result.scale[1]);
 await page.screenshot({path:`output/krynn-platforms/${kind}-desktop.png`});await page.setViewportSize({width:390,height:844});await page.screenshot({path:`output/krynn-platforms/${kind}-mobile.png`});assert.equal(await page.locator('.stable-dialog').evaluate(e=>e.scrollHeight>e.clientHeight+1||e.scrollWidth>e.clientWidth+1),false);
}
assert.deepEqual(errors,[]);console.log('Krynn and Virex woodland platforms passed, fixed size, uniform creature scale, mobile fit and no rendering errors.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
