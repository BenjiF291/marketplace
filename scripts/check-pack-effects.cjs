/* Isolated local visual fixture: no accounts, purchases, or API requests. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('.ui-tools')]}));
(async()=>{
 const root=path.resolve('public'),out='output/pack-effects';fs.mkdirSync(out,{recursive:true});
 const html=`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/reward-opening.css"><style>body{margin:0;background:#284a3b url('/assets/village/brawl-arena-v1.png') center/cover fixed;height:100vh}</style>${['stable-animals','currency-format','reward-card-art','pack-effects','reward-opening','pack-cinema'].map(f=>'<script src="/'+f+'.js"></script>').join('')}`;
 const server=http.createServer((req,res)=>{if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(html);}const file=path.resolve(root,'.'+req.url.split('?')[0]);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(data);});});
 await new Promise(r=>server.listen(4198,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);window.effectFrames=new Set();window.requestAnimationFrame=fn=>{const id=request(t=>{effectFrames.delete(id);fn(t);});effectFrames.add(id);return id;};window.cancelAnimationFrame=id=>{effectFrames.delete(id);cancel(id);};});
  await page.goto('http://127.0.0.1:4198/fixture');
  for(const theme of ['embers','aurora','starfall','tempest','sakura']){
   await page.evaluate(theme=>playSpecialPackOpening({preview:true},theme),theme);
   await page.waitForSelector('.reward-opening[data-phase=cards]');await page.waitForTimeout(120);
   assert.equal(await page.locator('.reward-opening').getAttribute('data-theme'),theme);
   assert.equal(await page.locator('canvas').count(),1);
   const painted=await page.locator('canvas').evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0));assert.ok(painted);
   await page.screenshot({path:out+'/'+theme+'-desktop.png'});
   await page.locator('.reward-opening-next').click();await page.waitForTimeout(350);assert.equal(await page.locator('.reward-opening-progress').textContent(),'2 / 3');
   await page.setViewportSize({width:390,height:844});await page.waitForTimeout(140);await page.screenshot({path:out+'/'+theme+'-mobile.png'});
   await page.locator('.reward-opening-close').click();await page.waitForTimeout(100);assert.equal(await page.locator('canvas').count(),0);assert.equal(await page.evaluate(()=>effectFrames.size),0);
   await page.setViewportSize({width:1440,height:900});
  }
  // Equipped effects apply to direct/daily openings without an explicit theme.
  await page.evaluate(()=>{document.body.dataset.rubyOpening='sakura';RewardOpening.play({daily:true,name:'Daily discovery',result:{rewards:[{kind:'gem',id:'bronze',amount:5}]}});});await page.waitForSelector('.reward-opening[data-phase=cards]');assert.equal(await page.locator('.reward-opening').getAttribute('data-theme'),'sakura');await page.locator('.reward-opening-close').click();
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>playSpecialPackOpening({preview:true},'aurora'));await page.waitForSelector('.reward-opening[data-phase=cards]');assert.equal(await page.evaluate(()=>effectFrames.size),0);await page.screenshot({path:out+'/reduced-motion.png'});await page.locator('.reward-opening-close').click();
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/checks.json',JSON.stringify({themes:5,errors,checks:['shared preview/real renderer','desktop/mobile','card advance','canvas pixels','cleanup/no surviving animation frames','equipped daily pack','reduced motion']},null,2));console.log('All five pack effects passed desktop/mobile, equipped daily, reduced-motion and cleanup checks.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
