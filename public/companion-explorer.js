/* Local companion play: no account writes or rewards for finding a hiding pet. */
window.createCompanionExplorer = ({stage,pet,copy,message,react}) => {
 const spots=[
  ['hero','#studioHome .studio-hero','the home banner'],
  ['daily','#dailyPackFeature','the daily pack'],
  ['collection','#rubyHabitat','your collection shelf'],
  ['market','#marketplaceSection','the marketplace'],
  ['inventory','#inventorySection','your inventory'],
  ['amulets','#amuletSection','the amulet shop'],
  ['workshop','#studioWorkshop','the workshop'],
  ['spin','#spinSection','the wheel'],
  ['vip','#vipSection','the VIP lounge'],
  ['wallet','.user-section','your wallet'],
  ['sell','.sell-section','the selling desk'],
  ['battle','#battleGameSection','the Brawl lobby']
 ];
 let mode='home',petId='',spot=null,timer=null,departTimer=null,peekTimer=null,frame=null,peekWanted=false;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const controls=make('div',null,'companion-mode-controls');controls.setAttribute('aria-label','Companion activities');copy.append(controls);
 const remote=make('div',null,'companion-remote');remote.hidden=true;document.body.append(remote);
 const notice=make('span','Companion is exploring');notice.setAttribute('role','status');
 const recall=make('button','Call back');recall.type='button';recall.onclick=()=>setMode('home');
 remote.append(notice,recall);
 const buttons={};for(const [key,label] of [['home','Call back / stay home'],['roam','Roam'],['hide','Play hide and seek']]){
  const button=make('button',label);button.type='button';button.dataset.companionMode=key;button.onclick=()=>setMode(key);controls.append(button);buttons[key]=button;
 }
 const peek=make('div',null,'companion-world-peek');peek.hidden=true;
 const find=make('button');find.type='button';find.setAttribute('aria-label','Found you! Play with your companion');peek.append(find);document.body.append(peek);
 function cancel(){peekWanted=false;clearTimeout(timer);clearTimeout(departTimer);clearTimeout(peekTimer);peek.hidden=true;peek.classList.remove('is-out');}
 function candidates(visibleOnly=false){return spots.filter(entry=>{
  const node=document.querySelector(entry[1]);if(!node)return false;
  if(!document.body.classList.contains('studio-ui')&&['hero','daily','collection','workshop'].includes(entry[0]))return false;
  if(!visibleOnly)return true;
  const r=node.getBoundingClientRect();return node.getClientRects().length&&r.width>100&&r.bottom>125&&r.top<innerHeight-180;
 });}
 function position(){
  if(!spot||mode==='home'||document.hidden||document.querySelector('dialog[open]')||document.body.classList.contains('dye-mode')){peek.hidden=true;return false;}
  const node=document.querySelector(spot[1]);if(!node||!node.getClientRects().length){peek.hidden=true;return false;}
  const r=node.getBoundingClientRect(),w=innerWidth<600?104:138,h=innerWidth<600?132:170;
  if(r.width<100||r.bottom<125||r.top>innerHeight-180){peek.hidden=true;return false;}
  const x=Math.max(8,Math.min(innerWidth-w-8,r.right-w*.58));
  const y=Math.max(100,Math.min(innerHeight-h-90,r.top+18));
  peek.style.left=x+'px';peek.style.top=y+'px';peek.dataset.spot=spot[0];return true;
 }
 function choose(visibleOnly){const pool=candidates(visibleOnly);if(!pool.length)return null;const fresh=pool.filter(s=>s!==spot);const choices=fresh.length?fresh:pool;return choices[Math.floor(Math.random()*choices.length)];}
 function cycle(){
  if(mode==='home'||!petId)return;
  if(mode==='roam')spot=choose(true);
  peekWanted=true;
  if(spot&&position()){peek.hidden=false;peek.classList.add('is-out');find.tabIndex=0;}
  peekTimer=setTimeout(()=>{peekWanted=false;peek.classList.remove('is-out');peek.hidden=true;find.tabIndex=-1;},reduced()?9000:6000);
  timer=setTimeout(cycle,mode==='hide'?10000:14000);
 }
 function setMode(next){
  if(!petId)return;mode=next;cancel();spot=null;
  stage.dataset.explore=mode;remote.hidden=mode==='home';
  Object.entries(buttons).forEach(([key,b])=>b.setAttribute('aria-pressed',String(key===mode)));
  if(mode==='home'){message.textContent='Back home. Your companion will stay right here.';react();return;}
  message.textContent=mode==='hide'?'No peeking! Your companion is hiding somewhere in your club. Explore the tabs and click it when you find it.':'Off exploring! Your companion will peek out near the pages you visit.';
  notice.textContent=mode==='hide'?'Hide and seek: find your companion':'Your companion is roaming';
  if(mode==='hide')spot=choose(false);
  departTimer=setTimeout(cycle,reduced()?100:1100);
 }
 find.onclick=()=>{
  const foundMode=mode;const at=spot?.[2]||'a corner';
  if(foundMode==='hide'){setMode('home');message.textContent=`Found you by ${at}! Play again whenever you like.`;notice.textContent='Found! Your companion is back home.';remote.hidden=false;timer=setTimeout(()=>{if(mode==='home')remote.hidden=true;},3500);}
  else {find.classList.remove('found');void find.offsetWidth;find.classList.add('found');notice.textContent=`Hello from ${at}!`;}
 };
 function refreshPosition(){if(frame)return;frame=requestAnimationFrame(()=>{frame=null;if(peekWanted&&position()){peek.hidden=false;peek.classList.add('is-out');find.tabIndex=0;}});}
 addEventListener('scroll',refreshPosition,{passive:true,capture:true});addEventListener('resize',refreshPosition,{passive:true});
 // Route changes hide old placements immediately. Hide-and-seek keeps its chosen spot.
 const routeChanged=()=>{peekWanted=false;peek.hidden=true;clearTimeout(timer);clearTimeout(departTimer);clearTimeout(peekTimer);if(mode!=='home'&&petId)timer=setTimeout(cycle,900);};
 new MutationObserver(routeChanged).observe(document.body,{attributes:true,attributeFilter:['data-studio-page','class']});
 document.querySelector('.main-grid')&&new MutationObserver(changes=>{if(changes.some(change=>change.target.parentElement===document.querySelector('.main-grid')))routeChanged();}).observe(document.querySelector('.main-grid'),{attributes:true,subtree:true,attributeFilter:['style']});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();}else if(mode!=='home')timer=setTimeout(cycle,1000);});
 return {update(id){if(id===petId)return;cancel();petId=id||'';find.innerHTML=window.companionArt(petId);mode='home';stage.dataset.explore='home';remote.hidden=true;Object.entries(buttons).forEach(([key,b])=>b.setAttribute('aria-pressed',String(key==='home')));},home(){if(mode!=='home')setMode('home');}};
};
