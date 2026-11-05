const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('.ui-tools')]}));
(async()=>{
 const root=path.resolve('public'),server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(data);});});
 await new Promise(r=>server.listen(4217,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4217/dragon-melee-study.html');await page.waitForFunction(()=>window.dragonMeleeStudy,null,{timeout:90000});
  const report=await page.evaluate(()=>dragonMeleeStudy.report);assert.equal(report.unnormalizedWeights,0);assert.ok(report.exactRecoveryMaxVertexError<1e-5);assert.ok(Object.values(report.poseOnlySupportingPawDrift).every(n=>n<1e-5));
  fs.mkdirSync('output/dragon-melee-study',{recursive:true});
  await page.selectOption('#view','side');await page.uncheck('#parent');
  for(const [name,value] of [['start',0],['anticipation',.4],['contact',.54],['follow',.65],['recovered',1]]){await page.evaluate(p=>dragonMeleeStudy.sample(p),value);await page.screenshot({path:`output/dragon-melee-study/${name}.png`});}
  await page.check('#parent');await page.selectOption('#view','arena');await page.evaluate(()=>dragonMeleeStudy.sample(.54));await page.screenshot({path:'output/dragon-melee-study/arena-contact.png'});
  await page.selectOption('#speed','.25');await page.click('#replay');await page.waitForTimeout(250);await page.click('#play');
  const stopped=await page.evaluate(()=>dragonMeleeStudy.progress);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>dragonMeleeStudy.progress),stopped);
  await page.locator('#timeline').fill('540');assert.ok(Math.abs(await page.evaluate(()=>dragonMeleeStudy.progress)-.54)<1e-6);
  await page.locator('#poses').fill('{}');await page.click('#apply');assert.match(await page.locator('#status').textContent(),/Duration/);await page.click('#restore');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);await page.screenshot({path:'output/dragon-melee-study/mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.deepEqual(errors,[]);fs.writeFileSync('output/dragon-melee-study/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
