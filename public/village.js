/* Public island navigation. Admin unlock previews never modify accounts. */
(() => {
 const buildings=[
  {id:'timebank',name:'Time Bank',kind:'timebank',level:3,route:'timebank',description:'Create time boosts with up to ten villagers.'},
  {id:'jobs',name:'Central job station',kind:'jobs',level:0,route:'jobs',description:'Assign and recall workers across your island.'},
  {id:'petstation',name:'Pet station',kind:'petstation',level:2,route:'petstation',description:'Care for your pets with a household of villagers.'},
  {id:'farmhouse',name:'Farmhouse',kind:'farmhouse',level:1,route:'farmhouse',description:'Gather ingredients and cook pet meals.'},
  {id:'townhall',name:'Town hall',kind:'townhall',x:620,y:377,level:0,route:'hall',secondary:'admin',secondaryLabel:'Admin tools',description:'Our shared community centre. Display your collectibles, earn personal Town Hall XP, and play Skystones at the table.'},
  {id:'archive',name:'Card archive',kind:'archive',x:380,y:356,level:0,route:'inventory',description:'Your cards, packs, consumables and ascensions, all under one roof.'},
  {id:'market',name:'Marketplace',kind:'market',x:488,y:469,level:0,route:'marketplace',description:'Browse player listings and the daily pack, or open your selling stall.',secondary:'sell'},
  {id:'forge',name:'Gem forge',kind:'forge',x:745,y:268,level:0,route:'workshop',description:'Convert cards into gems and upgrade the forge. Its copper workshop grows into a crystal forge and then a diamond foundry.'},
  {id:'arena',name:'Skystones arena',kind:'arena',x:920,y:350,level:0,route:'battle',description:'Challenge Bob, face other players, and climb the skill and trophy paths.'},
  {id:'wheel',name:'Fortune pavilion',kind:'wheel',x:514,y:224,level:0,route:'spin',description:'Visit the wheel when your next spin is ready.'},
  {id:'blacksmith',name:'Blacksmith',kind:'blacksmith',x:905,y:470,level:1,route:'amulets',description:'Forge amulets with gems, compare their powers, and manage your equipped slots.'},
  {id:'pets',name:'Companion lodge',kind:'pets',x:477,y:625,level:2,route:'home',target:'petJourneys',description:'Visit your companions, send them exploring, and collect their discoveries.'},
  {id:'cabinet',name:'Ruby emporium',kind:'cabinet',x:290,y:495,level:1,route:'ruby',description:'Adopt companions, buy food and useful items, and choose your pack-opening effects.'},
  {id:'dye',name:'Colour studio',kind:'dye',x:1031,y:599,level:3,route:'workshop',target:'gemWorkshop',description:'Craft dyes and bring your colours into the club.'},
  {id:'compressor',name:'Crystal refinery',kind:'compressor',x:701,y:742,level:4,route:'workshop',target:'gemWorkshop',description:'Upgrade your refinery to unlock higher gem tiers.'},
  {id:'vault',name:'Footy vault',kind:'vault',x:621,y:572,level:0,route:'wallet',description:'Your balance, transfers and account history.'},
  {id:'vip',name:'Royal hall',kind:'vip',x:811,y:604,level:5,route:'vip',description:'Your VIP membership and its benefits.'}
 ];
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 const toggle=el('button','btn','Try village');toggle.id='villageModeToggle';toggle.hidden=true;toggle.type='button';document.getElementById('dyeHeaderControls').prepend(toggle);
 const back=el('button','village-return','← Village');back.hidden=true;back.type='button';document.body.append(back);
 let enabled=false,verified=false,data=null,simulation=null,d=null,viewport,world,inspector,levelSelect,notice,status,tiles=new Map(),selected=null,previousStudio=true,loading=false;
 let jump,entering=false,plotEditor;

 let camera={x:0,y:0,scale:1},initialized=false,frame=0,gesture=null,moved=false,suppressUntil=0,travelEpoch=0,travelRestore=null;
 const pointers=new Map();const pref=`footy-village:${currentUserId}`;
 const level=()=>simulation===null?data.level:simulation;
 const unlocked=b=>level()>=b.level;
 const saved=(value)=>{try{localStorage.setItem(pref,value?'on':'off');}catch{}};
 function applyCamera(){frame=0;if(!Number.isFinite(camera.x)||!Number.isFinite(camera.y)||!Number.isFinite(camera.scale)||camera.scale<=0){camera={x:0,y:0,scale:1};initialized=false;}world.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;viewport.style.backgroundPosition=`${camera.x}px ${camera.y}px`;viewport.style.backgroundSize=`${600*camera.scale}px ${600*camera.scale}px`;}
 function paintCamera(){if(!frame)frame=requestAnimationFrame(applyCamera);}
 function clamp(){const r=viewport.getBoundingClientRect(),s=camera.scale;
  // Keep the viewport centre inside a bounded region around the island.
  camera.x=Math.max(r.width/2-1170*s,Math.min(r.width/2-270*s,camera.x));
  camera.y=Math.max(r.height/2-810*s,Math.min(r.height/2-190*s,camera.y));
 }
 function zoom(next,cx,cy){const r=viewport.getBoundingClientRect();cx??=r.width/2;cy??=r.height/2;next=Math.max(.4,Math.min(2.4,next));const ratio=next/camera.scale;camera.x=cx-(cx-camera.x)*ratio;camera.y=cy-(cy-camera.y)*ratio;camera.scale=next;clamp();paintCamera();}
 function reset(){const r=viewport.getBoundingClientRect();camera.scale=r.width<650?.73:Math.min(1.1,r.width/1340,r.height/870);camera.x=r.width/2-720*camera.scale;camera.y=r.height/2-470*camera.scale;initialized=true;clamp();paintCamera();}
 function focusBuilding(b){const r=viewport.getBoundingClientRect();camera.x=r.width/2-b.x*camera.scale;camera.y=r.height*.4-b.y*camera.scale;clamp();paintCamera();}
 function select(b){if(travelling)return;if(plotEditor?.select(b)){inspector.hidden=true;return;}selected=b;for(const [id,tile] of tiles)tile.classList.toggle('selected',id===b.id);inspector.replaceChildren();inspector.hidden=false;
  const enter=el('button','village-entrance',b.name);enter.setAttribute('aria-label',`Enter ${b.name}`);enter.onclick=()=>travel(b);inspector.append(enter);
 }
 let travelling=false,guideShown=false,lastBuilding=null;
 const doorScale=()=>matchMedia('(pointer:coarse)').matches?Math.min(2.4,Math.max(camera.scale,camera.scale*1.65)):Math.max(camera.scale,3.2);
 function clearGesture(){const ids=[...pointers.keys()];pointers.clear();for(const id of ids){try{if(viewport?.hasPointerCapture(id))viewport.releasePointerCapture(id);}catch{}}suppressUntil=0;gesture=null;moved=false;if(frame){cancelAnimationFrame(frame);frame=0;}}
 const guideKey=`footy-island-guide-v1:${currentUserId}`;
 function guide(force=false){if(!force){if(guideShown)return;try{if(localStorage.getItem(guideKey)==='done')return;}catch{}}guideShown=true;
  const box=el('dialog','island-guide');box.setAttribute('aria-label','Welcome to your island');
  box.append(el('small','','A PLACE OF YOUR OWN'),el('h2','','This is your island'),el('p','','Swipe or drag to explore. Tap a building, then its name to step inside. Pinch or scroll to zoom. Use the house icon to drag buildings onto the grass grid. New buildings wait in the illustrated tray. Use the question mark to learn about any building.'),el('p','','The Town Hall is a shared meeting place: meet other players, decorate together and play Skystones at the table.'),el('p','','Your Town Hall level is yours alone. Earn XP by playing ? opening packs, trading, crafting and battling all help. As your Town Hall levels up, new buildings become available in your building tray.'));
  const done=el('button','village-entrance','Explore my island');const finish=()=>{try{localStorage.setItem(guideKey,'done');}catch{}box.close();};done.onclick=finish;box.append(done);box.addEventListener('cancel',e=>{e.preventDefault();finish();});box.addEventListener('close',()=>box.remove(),{once:true});document.body.append(box);box.showModal();
 }
 async function zoomOut(b){if(!b||matchMedia('(prefers-reduced-motion: reduce)').matches)return;travelling=true;const epoch=++travelEpoch;clearGesture();jump.disabled=true;const target={...camera},r=viewport.getBoundingClientRect(),scale=doorScale(),from={x:r.width/2-b.x*scale,y:r.height/2-(b.y-25)*scale,scale};travelRestore=target;camera=from;applyCamera();d.classList.add('village-returning');
  try{const start=performance.now();await new Promise(resolve=>{const step=now=>{if(epoch!==travelEpoch){resolve();return;}const t=Math.min(1,(now-start)/650),ease=1-Math.pow(1-t,3);camera={x:from.x+(target.x-from.x)*ease,y:from.y+(target.y-from.y)*ease,scale:from.scale+(target.scale-from.scale)*ease};applyCamera();if(t<1)requestAnimationFrame(step);else resolve();};requestAnimationFrame(step);});}finally{if(epoch!==travelEpoch)return;travelRestore=null;camera=target;clamp();applyCamera();d.classList.remove('village-returning');jump.disabled=false;travelling=false;}
 }
 async function travel(b){if(travelling||!unlocked(b))return;travelling=true;const epoch=++travelEpoch;clearGesture();const previous={...camera};travelRestore=previous;inspector.hidden=true;d.classList.add('village-travelling');
  try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches){const start=performance.now(),r=viewport.getBoundingClientRect(),scale=doorScale(),door={x:b.x,y:b.y-25};await new Promise(resolve=>{const step=now=>{if(epoch!==travelEpoch){resolve();return;}const t=Math.min(1,(now-start)/650),ease=1-Math.pow(1-t,3);camera={x:previous.x+(r.width/2-door.x*scale-previous.x)*ease,y:previous.y+(r.height/2-door.y*scale-previous.y)*ease,scale:previous.scale+(scale-previous.scale)*ease};applyCamera();if(t<1)requestAnimationFrame(step);else resolve();};requestAnimationFrame(step);});}
   if(epoch===travelEpoch)await enterBuilding(b);
  }finally{if(epoch!==travelEpoch)return;travelRestore=null;camera=previous;applyCamera();d.classList.remove('village-travelling');travelling=false;}
 }
 function render(){if(!data||!world)return;updateStats(data);const l=level();
  for(const b of buildings){const tile=tiles.get(b.id),open=unlocked(b);const appeared=tile.hidden&&open;tile.hidden=!open;tile.classList.toggle('village-appearing',appeared);if(!open){tile.replaceChildren();continue;}tile.innerHTML=VillageArt.building(b.kind,b.id==='forge'?data.forgeLevel||0:b.id==='compressor'?data.refineryLevel||0:l,!open);tile.classList.toggle('locked',!open);tile.setAttribute('aria-label',`${b.name}, ${open?'available':`locked until Town Hall level ${b.level+1}`}`);}
  notice.textContent=simulation===null?'Your Town Hall progression':`Previewing Town Hall level ${l+1} — no account changes`;
  status.textContent=`${buildings.filter(unlocked).length} / ${buildings.length} buildings open`;
  jump.replaceChildren(new Option('Find a building...',''));buildings.filter(b=>unlocked(b)&&data.layout?.positions[b.id]!==undefined).forEach(b=>jump.append(new Option(b.name,b.id)));
  plotEditor?.paint();
  if(selected){if(unlocked(selected))select(selected);else{selected=null;inspector.hidden=true;}}
 }
 function create(){
  d=el('dialog','village-map');d.id='villageMap';d.setAttribute('aria-label','Your island');
  const toolbar=el('header','village-toolbar');const brand=el('div','village-brand');brand.append(el('small','','WELCOME HOME'),el('h1','','Your island'));
  const stats=el('div','village-resource-bar');stats.id='villageResourceBar';stats.setAttribute('aria-label','Island resources');toolbar.append(stats);const profileButton=el('button','village-secondary','Profile');profileButton.onclick=()=>PlayerProfile.open();toolbar.append(profileButton);const admin=el('button','village-secondary','Admin tools');admin.hidden=!data.isAdmin;admin.onclick=()=>enterBuilding({...buildings.find(b=>b.id==='townhall'),route:'admin',name:'Admin tools'});toolbar.append(admin);
  const tools=el('div','village-preview-tools');levelSelect=el('select');levelSelect.setAttribute('aria-label','Preview village progression');levelSelect.onchange=()=>{simulation=levelSelect.value==='account'?null:Number(levelSelect.value);render();};
  notice=el('span','village-preview-notice');notice.setAttribute('role','status');tools.append(levelSelect,notice);
  viewport=el('div','village-viewport');viewport.tabIndex=0;viewport.setAttribute('role','group');viewport.setAttribute('aria-label','Island map. Drag or swipe to explore, pinch to zoom. Arrow keys pan; plus and minus zoom.');
  world=el('div','village-world');world.innerHTML=VillageArt.terrain();viewport.append(world);IslandMinigames.mount(world);
  for(const b of buildings){const tile=el('button','village-building');tile.type='button';tile.dataset.building=b.id;tile.style.left=b.x+'px';tile.style.top=b.y+'px';tile.style.zIndex=Math.round(b.y);tile.onclick=e=>{if(!unlocked(b))return;if(performance.now()<suppressUntil&&e.detail!==0){e.preventDefault();return;}select(b);};world.append(tile);tiles.set(b.id,tile);}
  const caption=el('div','village-map-caption');caption.append(el('span','','THE COLLECTOR’S ISLE'),el('small','','Swipe to explore · Tap a building to enter'));
  const controls=el('div','village-camera-controls');for(const [label,text,fn] of [['Zoom out','−',()=>zoom(camera.scale/1.2)],['Recenter map','⌖',reset],['Zoom in','+',()=>zoom(camera.scale*1.2)]]){const b=el('button','',text);b.setAttribute('aria-label',label);b.onclick=fn;controls.append(b);}
  const footer=el('footer','village-footer');status=el('span');jump=el('select');jump.setAttribute('aria-label','Find a building');jump.append(new Option('Find a building…',''));buildings.forEach(b=>jump.append(new Option(b.name,b.id)));jump.onchange=()=>{const b=buildings.find(b=>b.id===jump.value);if(b){focusBuilding(b);select(b);}jump.value='';};footer.append(jump);
  inspector=el('section','village-inspector');inspector.hidden=true;inspector.setAttribute('aria-label','Selected building');
  d.append(viewport,toolbar,footer,inspector);document.body.append(d);d.addEventListener('cancel',e=>{e.preventDefault();if(!inspector.hidden)inspector.hidden=true;});
  viewport.addEventListener('click',e=>{if(performance.now()<suppressUntil&&e.detail!==0){e.preventDefault();e.stopImmediatePropagation();}},true);
  viewport.addEventListener('pointerdown',e=>{if(e.button>0||travelling)return;if(e.isPrimary)clearGesture();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;gesture={x:e.clientX,y:e.clientY,camX:camera.x,camY:camera.y};if(pointers.size===2){const [a,b]=[...pointers.values()];gesture={distance:Math.hypot(a.x-b.x,a.y-b.y),scale:camera.scale};}});
  viewport.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()],r=viewport.getBoundingClientRect();if(gesture.distance){moved=true;suppressUntil=performance.now()+400;zoom(gesture.scale*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);}return;}if(gesture?.x!==undefined){const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.hypot(dx,dy)>7)moved=true;if(moved){suppressUntil=performance.now()+400;viewport.setPointerCapture(e.pointerId);camera.x=gesture.camX+dx;camera.y=gesture.camY+dy;clamp();paintCamera();}}});
  const release=e=>{pointers.delete(e.pointerId);if(pointers.size===1){const p=[...pointers.values()][0];gesture={...p,camX:camera.x,camY:camera.y};}else gesture=null;};window.addEventListener('pointerup',release,true);window.addEventListener('pointercancel',()=>clearGesture(),true);viewport.addEventListener('lostpointercapture',release);
  const recover=()=>{clearGesture();if(travelRestore){camera=travelRestore;travelRestore=null;clamp();applyCamera();}travelEpoch++;travelling=false;d.classList.remove('village-travelling','village-returning');jump.disabled=false;};
  window.addEventListener('blur',recover);window.addEventListener('pageshow',recover);window.addEventListener('pagehide',recover);document.addEventListener('visibilitychange',recover);
  viewport.addEventListener('wheel',e=>{e.preventDefault();if(travelling)return;const r=viewport.getBoundingClientRect();zoom(camera.scale*Math.exp(-e.deltaY*.001),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  viewport.addEventListener('keydown',e=>{if(e.target!==viewport)return;const move={ArrowLeft:[70,0],ArrowRight:[-70,0],ArrowUp:[0,70],ArrowDown:[0,-70]}[e.key];if(move){e.preventDefault();camera.x+=move[0];camera.y+=move[1];clamp();paintCamera();}if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(camera.scale*(e.key==='-'?1/1.2:1.2));}});
  plotEditor=VillagePlots({world,toolbar,buildings,tiles,getData:()=>data,changed:render,pan:(dx,dy)=>{camera.x+=dx;camera.y+=dy;clamp();applyCamera();}});
  new ResizeObserver(()=>{if(d.open&&!travelling){if(!initialized)reset();else{clamp();paintCamera();}}}).observe(viewport);
 }

 let loadingDialog,startupReady=false;
 function showLoading(){
  if(!loadingDialog){loadingDialog=document.createElement('dialog');loadingDialog.className='island-loading-screen';loadingDialog.setAttribute('aria-label','Preparing your island');loadingDialog.append(IslandLoading.content());loadingDialog.addEventListener('cancel',e=>e.preventDefault());document.body.append(loadingDialog);}
  IslandLoading.reset();if(!loadingDialog.open)loadingDialog.showModal();
 }

 async function nameIsland(){
  if(data.islandName)return;
  const box=el('dialog','island-naming');box.setAttribute('aria-labelledby','islandNamingTitle');
  const form=el('form'),title=el('h1','','What is your island called?');title.id='islandNamingTitle';
  const intro=el('p','','Give your little corner of the world a name. It will appear on your welcome poster.'),label=el('label','','Island name'),input=el('input');input.required=true;input.minLength=2;input.maxLength=32;input.placeholder='Willow Bay';input.autocomplete='off';label.append(input);
  const status=el('p');status.setAttribute('role','status');const submit=el('button','village-primary','Make it home');submit.type='submit';form.append(title,intro,label,status,submit);box.append(form);document.body.append(box);box.addEventListener('cancel',e=>e.preventDefault());box.showModal();input.focus();
  await new Promise(resolve=>{form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{const response=await fetch(API_URL+'/village/name',{method:'POST',headers:resourceHeaders(),body:JSON.stringify({name:input.value})});if(!response.ok)throw Error(await response.text());const result=await response.json();data.islandName=result.islandName;IslandLoading.title(result.islandName);box.close();box.remove();resolve();}catch(error){status.textContent=error.message;}finally{submit.disabled=false;}};});
 }
 async function readyArtwork(){
  const urls=new Set(['assets/village/island-painted.png']);
  for(const n of world.querySelectorAll('image,img')){const url=n.getAttribute('href')||n.getAttribute('src');if(url)urls.add(url);}
  let completed=0;await Promise.all([...urls].map(url=>new Promise(resolve=>{const img=new Image();img.onload=()=>{if(img.decode)img.decode().catch(()=>{}).then(resolve);else resolve();};img.onerror=resolve;img.src=url;}).then(()=>{IslandLoading.progress(25+65*++completed/urls.size,'Preparing the village...');})));
  if(document.fonts)await document.fonts.ready;
 }
 let islandPreload=null;
 function preload(){if(!islandPreload)islandPreload=load().then(()=>true,()=>false);return islandPreload;}
 async function load(){const res=await fetch(API_URL+'/admin/village',{headers:resourceHeaders()});if(!res.ok)throw Error(await res.text());data=await res.json();IslandLoading.title(data.islandName);verified=true;}
 function options(){levelSelect.hidden=!data.isAdmin;if(!data.isAdmin)simulation=null;levelSelect.replaceChildren(new Option('Use your Town Hall progression','account'));for(let i=0;i<=9;i++)levelSelect.append(new Option(`Preview: Town Hall ${i+1}`,String(i)));levelSelect.value=simulation===null?'account':String(simulation);}
 async function show(){if(loading)return;loading=true;toggle.disabled=true;back.disabled=true;let refresh;const startup=!startupReady;
  try{if(startup)showLoading();const ready=islandPreload;islandPreload=null;
   if(data){refresh=ready||load().then(()=>true,()=>false);}else if(!ready||!await ready)await load();
   IslandLoading.progress(25,'Unpacking your island...');clearGesture();window.VillageInteriors.close();document.getElementById('rubyShopDialog')?.close();if(!d)create();enabled=true;document.getElementById('islandLoading').hidden=true;saved(true);back.hidden=true;options();render();
   d.classList.remove('village-travelling','village-returning');if(!d.open)d.showModal();if(startup){loadingDialog.close();loadingDialog.showModal();await readyArtwork();}d.scrollTop=0;d.scrollLeft=0;viewport.scrollTop=0;viewport.scrollLeft=0;
   // Let mobile layout settle after restoring the full-screen dialog.
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   if(!initialized)reset();else{clamp();applyCamera();}IslandLoading.progress(95,'Finding your way home...');await zoomOut(lastBuilding);lastBuilding=null;IslandLoading.progress(100,'Your island is ready');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));loadingDialog?.close();startupReady=true;await nameIsland();viewport.focus({preventScroll:true});guide();
   if(refresh)refresh.then(ok=>{if(ok&&d.open&&!travelling&&!plotEditor?.editing){options();render();}});
  }catch(e){if(startup){if(d?.open)d.close();const panel=document.getElementById('islandLoading');panel.hidden=false;panel.classList.add('island-load-error');panel.querySelector('.island-load-error-panel p').textContent=e.message;}else{if(d&&!d.open)d.showModal();if(notice)notice.textContent=e.message;}
  }finally{loadingDialog?.close();loading=false;travelling=false;d?.classList.remove('village-travelling','village-returning');if(jump)jump.disabled=false;toggle.disabled=false;back.disabled=false;}
 }
 async function enterBuilding(b){if(!verified||!enabled||!unlocked(b))return;entering=true;
  try{lastBuilding=b;d.close();inspector.hidden=true;selected=null;tiles.forEach(t=>t.classList.remove('selected'));back.hidden=true;
   if(!footyStudio.enabled)footyStudio.setMode(true);
   if(['petstation','farmhouse','jobs','timebank'].includes(b.route)){VillageInteriors.close();await window.VillageCare.open(b.route,show);return;}
   if((b.id==='market'&&b.route==='marketplace'&&!b.marketStall)||b.id==='cabinet'){VillageInteriors.close();await MarketStreet.open({onExit:show,onCards:()=>enterBuilding({...buildings.find(n=>n.id==='market'),marketStall:true})});return;}
   if(b.route==='hall'){VillageInteriors.close();back.hidden=true;await window.openTownHall(show);return;}
   footyStudio.navigate(b.route==='ruby'?'home':b.route);
   VillageInteriors.open(b,{back:b.id==='market'?()=>enterBuilding({...buildings.find(n=>n.id==='market'),marketStall:false}):show,enter:enterBuilding});
   if(b.route==='ruby')document.getElementById('rubyShopButton').click();
   if(b.id==='vault')window.VillageCare.addVaultButton();
   if(b.target){const target=document.getElementById(b.target);if(target?.tagName==='DETAILS')target.open=true;}
  }finally{entering=false;}
 }
 window.addEventListener('footy-studio-navigate',e=>{if(entering||!enabled)return;const current=VillageInteriors.active;if(current&&(e.detail===current.route||current.route==='ruby'&&e.detail==='home'))return;const route=e.detail;const next=buildings.find(b=>b.route===route&&unlocked(b))||(route==='sell'?{...buildings.find(b=>b.id==='market'),route}:null)||(['admin','battle-manager'].includes(route)&&data.isAdmin?{...buildings.find(b=>b.id==='townhall'),route,name:'Admin tools'}:null);queueMicrotask(()=>{if(next)enterBuilding(next);else show();});});
 function updateStats(state){
  const bar=document.getElementById('villageResourceBar');if(!bar)return;const staff=state.economy?.workforce;
  const icons={villagers:'<circle cx="12" cy="8" r="4" fill="#d9b18b"/><path d="M4 23v-5a8 8 0 0 1 16 0v5" fill="#47796a"/><path d="M8 6q4-6 8 0" fill="#705038"/>',footy:'<circle cx="12" cy="12" r="10" fill="#e7bb58" stroke="#997332" stroke-width="2"/><path d="M9 18V6h8v3h-5v3h4v3h-4v3z" fill="#765027"/>',rubies:'<path d="M6 3h12l5 7-11 13L1 10z" fill="#bd354b" stroke="#842c43"/><path d="M6 3l6 7 6-7M1 10h22M12 10v13" fill="none" stroke="#ffb0a8" stroke-width="1.5"/>'};
  const counters=el('div','village-resource-counters');
  for(const [key,value,label] of [['villagers',`${staff?.available.length||0}/${staff?.total??state.layout?.villagers??0}`,'Villagers available'],['footy',Number(state.balance||0).toLocaleString(),'Footy'],['rubies',Number(state.layout?.rubies||0).toLocaleString(),'Rubies']]){const counter=el('div','village-resource-counter');counter.title=label;counter.setAttribute('aria-label',`${label}: ${value}`);const icon=el('span','village-resource-icon');icon.innerHTML=`<svg viewBox="0 0 24 26" aria-hidden="true">${icons[key]}</svg>`;counter.append(icon,el('strong','',value));counters.append(counter);}
  bar.replaceChildren(counters);
  const p=state.progress;if(p){const xp=el('div','village-island-xp'),label=el('div','village-xp-label');label.append(el('span','',`Town Hall ${p.level}`),el('span','',p.next===null?'MAX LEVEL':`${p.progress} / ${p.required} XP`));const meter=el('progress');meter.max=p.required||1;meter.value=p.next===null?1:p.progress;meter.setAttribute('aria-label','Town Hall experience');xp.title=p.unlock;xp.append(label,meter);bar.append(xp);}
 }

 window.addEventListener('village-state-changed',e=>{if(!data)return;Object.assign(data,e.detail);plotEditor?.paint();updateStats(data);});
 window.Island={show,preload,updateStats,guide:()=>guide(true),enter:id=>{const b=buildings.find(b=>b.id===id);if(b&&unlocked(b))enterBuilding(b);else show();}};
 back.onclick=show;
 document.getElementById('islandRetry').onclick=show;
 document.getElementById('islandLogin').onclick=()=>logout();
 show();
})();
