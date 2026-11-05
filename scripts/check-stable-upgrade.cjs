const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('.ui-tools')]}));
(async()=>{
const server=http.createServer((req,res)=>{if(req.url==='/preview'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');}const p=path.join(process.cwd(),'public',decodeURIComponent(req.url.split('?')[0]));fs.readFile(p,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'application/octet-stream');res.end(b);});});await new Promise(r=>server.listen(4194,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4194/preview');
await page.evaluate(()=>{document.body.innerHTML='';window.API_URL='/api';window.resourceHeaders=()=>({});window.CreatureBook={openCreature:()=>{}};});
const animals=require('../public/stable-animals');const names={};await page.route('**/api/stable/name',route=>{const body=route.request().postDataJSON();names[body.instanceId]=body.name;return route.fulfill({json:{animal:{name:body.name||'Rill'}}});});await page.route('**/api/stable',route=>route.fulfill({json:{total:7,animals:animals.residents({stableAnimals:{'rill-species':3,kanji:1,trusk:1,velkris:1,'defender-rill':1}})}}));await page.addStyleTag({url:'http://127.0.0.1:4194/stable.css'});await page.addScriptTag({url:'http://127.0.0.1:4194/stable.js'});await page.evaluate(()=>Stable.open());await page.locator('.stable-resident').last().waitFor();assert.equal(await page.locator('.stable-resident').count(),7);
await page.locator('[data-instance-id=\"rill-species:2\"]').click();assert.equal(await page.locator('.stable-details h2').textContent(),'Rill');assert.equal(await page.locator('.stable-resident-number').count(),0);assert.equal(await page.locator('.stable-details h3').count(),0);await page.locator('.stable-rotation').fill('180');await page.locator('.stable-rotation').dispatchEvent('input');assert.equal(await page.locator('.stable-model').getAttribute('data-view-yaw'),String(Math.PI));
await page.waitForFunction(()=>document.querySelector('.stable-model')?.dataset.modelReady==='true');await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>{const host=document.querySelector('.stable-model');return companion3D.entries.get(host).dais.root.userData.approvedRillRoost;}),true);fs.mkdirSync('output/stable-upgrade',{recursive:true});await page.screenshot({path:'output/stable-upgrade/desktop.png'});
await page.getByRole('searchbox').fill('rill');assert.equal(await page.locator('.stable-resident').count(),4);await page.getByRole('searchbox').fill('zzzz');assert.match(await page.locator('.stable-empty').textContent(),/No residents/);await page.getByRole('searchbox').fill('');
await page.waitForFunction(()=>document.querySelector('.stable-model')?.dataset.modelReady==='true');
for(const [width,height] of [[390,844],[375,667],[320,568],[844,390],[568,320]]){await page.setViewportSize({width,height});await page.screenshot({path:`output/stable-upgrade/${width}.png`,fullPage:true});const overflow=await page.locator('.stable-dialog').evaluate(e=>e.scrollWidth>e.clientWidth+1);assert.equal(overflow,false,`overflow at ${width}`);const fit=await page.locator('.stable-dialog').evaluate(e=>({overflow:e.scrollHeight>e.clientHeight+1,bottom:e.getBoundingClientRect().bottom}));assert.equal(fit.overflow,false,`vertical overflow at ${width}x${height}`);assert.ok(fit.bottom<=height+1);for(const selector of ['.stable-header','.stable-toolbar','.stable-stage','.stable-roster','.stable-details','.stable-footer','.stable-turn-controls']){const box=await page.locator(selector).boundingBox();assert.ok(box.y>=-1&&box.y+box.height<=height+1,`${selector} outside ${width}x${height}`);}}
await page.setViewportSize({width:1366,height:900});await page.getByRole('button',{name:'Edit creature name',exact:true}).click();await page.getByRole('textbox',{name:'Creature name',exact:true}).fill('Willow');await page.getByRole('button',{name:'Save name',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.stable-details h2').textContent==='Willow');assert.equal(Object.values(names)[0],'Willow');await page.getByRole('button',{name:'Edit creature name',exact:true}).click();await page.getByRole('textbox',{name:'Creature name',exact:true}).fill('');await page.getByRole('button',{name:'Save name',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.stable-details h2').textContent==='Rill');
const themeCoverage=await page.evaluate(async()=>{const {platformThemes}=await import('./stable-platform-themes.js?v=1');return {missing:[],names:Object.values(platformThemes).map(t=>t.name),types:[...new Set(Object.values(platformThemes).map(t=>t.type))],keys:Object.keys(platformThemes)};});
for(const animal of animals.animals)assert.ok(themeCoverage.keys.includes(animal.id),'platform theme for '+animal.id);
assert.equal(new Set(themeCoverage.names).size,animals.animals.length);assert.ok(themeCoverage.types.length>=8);
for(const species of ['kanji','trusk','velkris']){
 await page.locator('.stable-resident').filter({has:page.locator('small',{hasText:new RegExp('^'+species+'$','i')})}).first().click();
 await page.waitForFunction(()=>document.querySelector('.stable-model')?.dataset.modelReady==='true',null,{timeout:60000});
 assert.equal(await page.evaluate(()=>{const host=document.querySelector('.stable-model'),entry=companion3D.entries.get(host);return !!entry.dais&&entry.dais.root.children.length>10&&entry.dais.root.children[0].geometry.parameters.radiusTop===1.65&&entry.dais.bounds.max.y===2.85;}),true);
 await page.screenshot({path:`output/stable-upgrade/${species}-platform.png`});
}
await page.addStyleTag({url:'http://127.0.0.1:4194/reward-opening.css'});
await page.addScriptTag({url:'http://127.0.0.1:4194/currency-format.js'});
await page.addScriptTag({url:'http://127.0.0.1:4194/stable-animals.js'});
await page.addScriptTag({url:'http://127.0.0.1:4194/creature-brawl-catalog.js'});
await page.addScriptTag({url:'http://127.0.0.1:4194/reward-card-art.js'});
await page.addScriptTag({url:'http://127.0.0.1:4194/reward-opening.js'});
await page.evaluate(()=>RewardOpening.play({name:'Token check',result:{rewards:[{kind:'brawlToken',id:'rill-species',amount:3,tokenProgress:{before:4,after:7,target:10}}]}}));
await page.waitForFunction(()=>document.querySelector('.reward-opening')?.dataset.phase==='cards');
assert.equal(await page.locator('.reward-token-balance').textContent(),'7 tokens');
assert.equal(await page.locator('.reward-card-name').textContent(),'Rill');
assert.match(await page.locator('.reward-card-picture image').getAttribute('href'),/rill-species/);
await page.waitForTimeout(1000);await page.screenshot({path:'output/stable-upgrade/packed-rill-tokens.png'});
assert.deepEqual(errors,[]);console.log('Stable browser checks passed: individual duplicates, search, rotation, desktop/mobile layout.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
