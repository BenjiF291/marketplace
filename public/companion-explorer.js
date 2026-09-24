/* Local companion play: no account writes or rewards for finding a hiding pet. */
window.createCompanionExplorer = ({stage,pet,copy,message,react}) => {
 const anchors=[
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
  ['battle','#battleGameSection','the Brawl lobby'],
  ['launch','#studioHome .studio-launch','a home shortcut'],
  ['market-card','#items > li','a marketplace listing'],
  ['inventory-card','#inventoryItems > li','an inventory card'],
  ['charm','#amuletShop .amulet-tile','an amulet'],
  ['owned-charm','#amuletOwned .amulet-tile','your charms'],
  ['home-note','#studioHome .studio-bottom-note','the amulet banner'],
  ['market-title','#marketplaceSection > h2','the marketplace heading'],
  ['inventory-title','#inventorySection > h2','the inventory heading'],
  ['spin-title','#spinSection > h2','the wheel heading'],
  ['vip-title','#vipSection > h2','the VIP heading'],
  ['gem-machine','#gemMachine','the gem machine'],
  ['wallet-transfer','.transfer-section','the transfer desk'],
  ['history','#historySection','your history'],
  ['skill','.brawl-skill-panel','your skill summary'],
  ['relic','#rubyHabitat figure','a relic']
 ];
 let mode='home',petId='',spot=null,timer=null,departTimer=null,peekTimer=null,frame=null,peekWanted=false,retreatTimer=null,attachment=null;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const controls=make('div',null,'companion-mode-controls');controls.setAttribute('aria-label','Companion activities');copy.append(controls);
 const buttons={};for(const [key,label] of [['home','Call back / stay home'],['roam','Roam'],['hide','Play hide and seek']]){
  const button=make('button',label);button.type='button';button.dataset.companionMode=key;button.onclick=()=>setMode(key);controls.append(button);buttons[key]=button;
 }
 const peek=make('div',null,'companion-world-peek');peek.hidden=true;
 const find=make('button');find.type='button';find.setAttribute('aria-label','Found you! Play with your companion');peek.append(find);document.body.append(peek);
 function finishRetreat(){peek.hidden=true;peek.classList.remove('is-out','is-leaving');attachment=null;}
 function retreat(){
  peekWanted=false;find.tabIndex=-1;clearTimeout(retreatTimer);
  if(peek.hidden||reduced()){finishRetreat();return;}
  peek.style.setProperty('--peek-exit-start',getComputedStyle(find).transform);
  peek.classList.remove('is-out');peek.classList.add('is-leaving');
  retreatTimer=setTimeout(finishRetreat,700);
 }
 function cancel(animate=false){peekWanted=false;clearTimeout(timer);clearTimeout(departTimer);clearTimeout(peekTimer);clearTimeout(retreatTimer);if(animate)retreat();else finishRetreat();}
 const recent=[];
 const edges=['top-left','top-right','left','right','bottom'];
 function nodeFor(entry){return document.querySelectorAll(entry.selector)[entry.index]||null;}
 function spots(){return anchors.flatMap(([id,selector,label])=>Array.from(document.querySelectorAll(selector)).slice(0,12).flatMap((node,index)=>{
  if(node.closest('details:not([open])'))return [];
  if(!document.body.classList.contains('studio-ui')&&node.closest('.studio-only'))return [];
  return edges.map(edge=>({id:`${id}:${index}:${edge}`,selector,index,label,edge}));
 }));}
 function placement(entry){
  const node=nodeFor(entry);if(!node||!node.getClientRects().length)return null;
  const r=node.getBoundingClientRect(),small=innerWidth<600;
  const horizontal=entry.edge.startsWith('top')||entry.edge==='bottom';
  const w=horizontal?(small?120:160):(small?65:90),h=horizontal?(small?72:96):(small?124:160);
  if(r.width<60||r.height<16)return null;
  let x,y;
  switch(entry.edge){
   case 'top-left':x=r.left+Math.min(r.width*.22,r.width-w);y=r.top-h;break;
   case 'top-right':x=r.right-w-Math.min(12,r.width*.05);y=r.top-h;break;
   case 'bottom':x=r.left+(r.width-w)/2;y=r.bottom;break;
   case 'left':x=r.left-w;y=r.top+Math.min(30,r.height*.2);break;
   case 'right':x=r.right;y=r.top+Math.min(30,r.height*.2);break;
  }
  // Never pin to viewport edges: no room beside this object means no peek here.
  if(x<10||x+w>innerWidth-10||y<90||y+h>innerHeight-85)return null;
  const occupied=document.elementsFromPoint(x+w/2,y+h/2).some(element=>!peek.contains(element)&&element.closest('button,input,select,a,textarea,[role="button"]'));
  if(occupied)return null;
  return {x,y,w,h};
 }
 function candidates(visibleOnly=false){const all=spots();return visibleOnly?all.filter(entry=>placement(entry)):all;}
 function position(){
  // Once visible, follow the original object even beyond the viewport margins.
  // Scrolling must not re-run eligibility, switch edges, or restart the entrance.
  if(attachment&&!peek.hidden){
   const {node,rect,box}=attachment;
   if(!node.isConnected||!node.getClientRects().length){if(!peek.classList.contains('is-leaving'))retreat();return false;}
   const current=node.getBoundingClientRect();
   peek.style.left=(box.x+current.left-rect.left)+'px';peek.style.top=(box.y+current.top-rect.top)+'px';
   return true;
  }
  if(!spot||mode==='home'||document.hidden||document.querySelector('dialog[open]')||document.body.classList.contains('dye-mode')){peek.hidden=true;return false;}
  let box=placement(spot);
  if(!box&&mode==='hide'){for(const edge of edges){const alternative={...spot,edge,id:`${spot.selector}:${spot.index}:${edge}`};const fit=placement(alternative);if(fit){spot=alternative;box=fit;break;}}}
  if(!box){peek.hidden=true;return false;}
  peek.style.left=box.x+'px';peek.style.top=box.y+'px';peek.style.width=box.w+'px';peek.style.height=box.h+'px';
  peek.dataset.spot=spot.id;peek.dataset.edge=spot.edge;const node=nodeFor(spot);attachment={node,rect:node.getBoundingClientRect(),box};return true;
 }
 function choose(visibleOnly){const pool=candidates(visibleOnly);if(!pool.length)return null;const fresh=pool.filter(s=>!recent.includes(s.id));const choices=fresh.length?fresh:pool;const next=choices[Math.floor(Math.random()*choices.length)];recent.push(next.id);if(recent.length>10)recent.shift();return next;}
 function cycle(){
  if(mode==='home'||!petId)return;
  if(mode==='roam')spot=choose(true);
  else if(!spot||!nodeFor(spot))spot=choose(false);
  peekWanted=true;
  if(spot&&position()){peek.hidden=false;peek.classList.add('is-out');find.tabIndex=0;}
  peekTimer=setTimeout(retreat,reduced()?9000:6000);
  timer=setTimeout(cycle,mode==='hide'?10000:14000);
 }
 function setMode(next){
  if(!petId)return;mode=next;cancel(true);spot=null;
  stage.dataset.explore=mode;
  Object.entries(buttons).forEach(([key,b])=>b.setAttribute('aria-pressed',String(key===mode)));
  if(mode==='home'){message.textContent='Back home. Your companion will stay right here.';react();return;}
  message.textContent=mode==='hide'?'No peeking! Your companion is hiding somewhere in your club. Explore the tabs and click it when you find it.':'Off exploring! Your companion will peek out near the pages you visit.';
  if(mode==='hide')spot=choose(false);
  departTimer=setTimeout(cycle,reduced()?100:1100);
 }
 find.onclick=()=>{
  const foundMode=mode;const at=spot?.label||'a corner';
  if(foundMode==='hide'){setMode('home');message.textContent=`Found you by ${at}! Play again whenever you like.`;}
  else {find.classList.remove('found');void find.offsetWidth;find.classList.add('found');message.textContent=`Hello from ${at}!`;}
 };
 function refreshPosition(){if(frame)return;frame=requestAnimationFrame(()=>{frame=null;if(!peek.hidden){position();}else if(peekWanted&&position()){peek.hidden=false;peek.classList.add('is-out');find.tabIndex=0;}});}
 addEventListener('scroll',refreshPosition,{passive:true,capture:true});addEventListener('resize',refreshPosition,{passive:true});
 // Leave gracefully on a route change; hide-and-seek keeps its chosen object.
 const routeChanged=()=>{retreat();clearTimeout(timer);clearTimeout(departTimer);clearTimeout(peekTimer);if(mode!=='home'&&petId)timer=setTimeout(cycle,900);};
 new MutationObserver(routeChanged).observe(document.body,{attributes:true,attributeFilter:['data-studio-page','class']});
 document.querySelector('.main-grid')&&new MutationObserver(changes=>{if(changes.some(change=>change.target.parentElement===document.querySelector('.main-grid')))routeChanged();}).observe(document.querySelector('.main-grid'),{attributes:true,subtree:true,attributeFilter:['style']});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();}else if(mode!=='home')timer=setTimeout(cycle,1000);});
 return {update(id){if(id===petId)return;cancel();petId=id||'';find.innerHTML=window.companionArt(petId);mode='home';stage.dataset.explore='home';Object.entries(buttons).forEach(([key,b])=>b.setAttribute('aria-pressed',String(key==='home')));},home(){if(mode!=='home')setMode('home');}};
};
