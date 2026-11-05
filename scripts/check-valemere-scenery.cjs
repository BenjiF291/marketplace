const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('.ui-tools')]}));
(async()=>{
const server=http.createServer((req,res)=>{if(req.url==='/preview'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');}const p=path.join(process.cwd(),'public',decodeURIComponent(req.url.split('?')[0]));fs.readFile(p,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'application/octet-stream');res.end(b);});});await new Promise(r=>server.listen(4235,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4235/preview');

await page.evaluate(async()=>{document.body.style.margin='0';const host=document.createElement('div');host.style.cssText='position:fixed;inset:0';document.body.append(host);const {BrawlArena}=await import('/creature-brawl-arena.js?v=valemere1');window.arena=new BrawlArena(host);});
await page.waitForFunction(()=>arena.environment.floor.material.map?.image?.src&&arena.scene.background?.isTexture,null,{timeout:30000});await page.waitForTimeout(1000);fs.mkdirSync('output/valemere-arena',{recursive:true});await page.screenshot({path:'output/valemere-arena/environment.png'});assert.deepEqual(errors,[]);await page.evaluate(()=>arena.dispose());console.log('Textured arena scenery renders and disposes without browser errors.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
