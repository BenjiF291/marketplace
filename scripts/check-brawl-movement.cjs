const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(require.resolve('playwright',{paths:[path.resolve('.ui-tools')]}));
(async()=>{
const server=http.createServer((req,res)=>{if(req.url==='/preview'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');}const p=path.join(process.cwd(),'public',decodeURIComponent(req.url.split('?')[0]));fs.readFile(p,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'application/octet-stream');res.end(b);});});await new Promise(r=>server.listen(4236,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4236/preview');

await page.evaluate(async()=>{document.body.style.margin='0';const host=document.createElement('div');host.style.cssText='position:fixed;inset:0';document.body.append(host);const {BrawlArena}=await import('/creature-brawl-arena.js?v=valemere1');window.arena=new BrawlArena(host);});

const catalog=require('../public/creature-brawl-catalog');const kinds=['rill-species','talren'];const units=kinds.map((kind,i)=>{const c=catalog.creatures.find(c=>c.id===kind);return {...c,id:'unit'+i,kind,team:i,slot:1,stats:c.base,hp:c.base.hp,maxHP:c.base.hp,grade:1};});
await page.evaluate(async units=>{await arena.sync(units,'unit0');},units);
const before=await page.evaluate(()=>{const a=arena.actors.get('unit0');return {time:arena.time,mixer:a.mixer.time,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};});await page.waitForTimeout(1000);const after=await page.evaluate(()=>({time:arena.time,mixer:arena.actors.get('unit0').mixer.time}));console.log(JSON.stringify({before,after,errors}));assert.ok(after.time>before.time);assert.ok(after.mixer>before.mixer);
const movement=await page.evaluate(async()=>{const a=arena.actors.get('unit0'),home=a.motion.position.clone();let distance=0;const timer=setInterval(()=>distance=Math.max(distance,a.motion.position.distanceTo(home)),20);try{await arena.begin({source:'unit0',moveId:a.unit?.moves?.[0]?.id||'basic',targets:['unit1']},1);await arena.recover(1);}finally{clearInterval(timer);}return {distance,returned:a.motion.position.distanceTo(home),time:arena.time};});console.log(JSON.stringify(movement));assert.ok(movement.distance>.1);assert.ok(movement.returned<.01);assert.deepEqual(errors,[]);await page.evaluate(()=>arena.dispose());console.log('Idle mixer, rendered frames, melee advance and exact retreat passed with actual Rill and Talren.');

}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
