/* Public island navigation. Admin unlock previews never modify accounts. */
(() => {
 const buildings=[
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
  {id:'compressor',name:'Crystal refinery',kind:'compressor',x:701,y:742,level:4,route:'workshop',target:'gemWorkshop',description:'Craft your compressor and combine gems into higher tiers.'},
  {id:'vault',name:'Footy vault',kind:'vault',x:621,y:572,level:0,route:'wallet',description:'Your balance, transfers and account history.'},
  {id:'vip',name:'Royal hall',kind:'vip',x:811,y:604,level:5,route:'vip',description:'Your VIP membership and its benefits.'}
 ];
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 const toggle=el('button','btn','Try village');toggle.id='villageModeToggle';toggle.hidden=true;toggle.type='button';document.getElementById('dyeHeaderControls').prepend(toggle);
 const back=el('button','village-return','← Village');back.hidden=true;back.type='button';document.body.append(back);
 let enabled=false,verified=false,data=null,simulation=null,d=null,viewport,world,inspector,levelSelect,notice,status,tiles=new Map(),selected=null,previousStudio=true,loading=false;
 let jump,entering=false;
 let camera={x:0,y:0,scale:1},initialized=false,frame=0,gesture=null,moved=false;
 const pointers=new Map();const pref=`footy-village:${currentUserId}`;
 const level=()=>simulation===null?data.level:simulation;
 const unlocked=b=>level()>=b.level;
 const saved=(value)=>{try{localStorage.setItem(pref,value?'on':'off');}catch{}};
 function applyCamera(){frame=0;world.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;viewport.style.backgroundPosition=`${camera.x}px ${camera.y}px`;viewport.style.backgroundSize=`${600*camera.scale}px ${600*camera.scale}px`;}
 function paintCamera(){if(!frame)frame=requestAnimationFrame(applyCamera);}
 function clamp(){const r=viewport.getBoundingClientRect(),s=camera.scale;
  // Keep the viewport centre inside a bounded region around the island.
  camera.x=Math.max(r.width/2-1170*s,Math.min(r.width/2-270*s,camera.x));
  camera.y=Math.max(r.height/2-810*s,Math.min(r.height/2-190*s,camera.y));
 }
 function zoom(next,cx,cy){const r=viewport.getBoundingClientRect();cx??=r.width/2;cy??=r.height/2;next=Math.max(.4,Math.min(2.4,next));const ratio=next/camera.scale;camera.x=cx-(cx-camera.x)*ratio;camera.y=cy-(cy-camera.y)*ratio;camera.scale=next;clamp();paintCamera();}
 function reset(){const r=viewport.getBoundingClientRect();camera.scale=r.width<650?.73:Math.min(1.1,r.width/1340,r.height/870);camera.x=r.width/2-720*camera.scale;camera.y=r.height/2-470*camera.scale;initialized=true;clamp();paintCamera();}
 function focusBuilding(b){const r=viewport.getBoundingClientRect();camera.x=r.width/2-b.x*camera.scale;camera.y=r.height*.4-b.y*camera.scale;clamp();paintCamera();}
 function select(b,focus=false){selected=b;for(const [id,tile] of tiles)tile.classList.toggle('selected',id===b.id);inspector.replaceChildren();inspector.hidden=false;
  const dismiss=el('button','village-sheet-close','×');dismiss.setAttribute('aria-label','Close building details');dismiss.onclick=()=>{inspector.hidden=true;tiles.get(b.id)?.focus();};
  const info=el('div','village-building-info');info.append(el('small','',unlocked(b)?'READY TO VISIT':`UNLOCKS AT TOWN HALL LEVEL ${b.level+1}`),el('h2','',b.name),el('p','',b.description));
  if(b.id==='forge')info.append(el('p','village-forge-note',`Level ${(data.forgeLevel||0)+1} - ${data.tiers[data.forgeLevel||0]?.name||'Bronze'} forge`));
  const enter=el('button','village-primary',unlocked(b)?'Enter building':'Visit the Town Hall');enter.onclick=()=>enterBuilding(unlocked(b)?b:buildings.find(b=>b.id==='townhall'));
  inspector.append(dismiss,info,enter);
  if(unlocked(b)&&b.secondary&&(b.secondary!=='admin'||data.isAdmin)){const sell=el('button','village-secondary',b.secondaryLabel||'Sell an item');sell.onclick=()=>enterBuilding({...b,route:b.secondary});inspector.append(sell);}
 }
 function render(){if(!data||!world)return;const l=level();
  for(const b of buildings){const tile=tiles.get(b.id),open=unlocked(b);const appeared=tile.hidden&&open;tile.hidden=!open;tile.classList.toggle('village-appearing',appeared);if(!open){tile.replaceChildren();continue;}tile.innerHTML=VillageArt.building(b.kind,b.id==='forge'?data.forgeLevel||0:l,!open);const label=el('span','village-building-label',b.name);label.append(el('small','',b.id==='forge'?`Level ${(data.forgeLevel||0)+1} - ${data.tiers[data.forgeLevel||0]?.name||'Bronze'}`:open?'Enter':`Town Hall ${b.level+1}`));tile.append(label);tile.classList.toggle('locked',!open);tile.setAttribute('aria-label',`${b.name}, ${open?'available':`locked until Town Hall level ${b.level+1}`}`);}
  notice.textContent=simulation===null?'Your Town Hall progression':`Previewing Town Hall level ${l+1} — no account changes`;
  status.textContent=`${buildings.filter(unlocked).length} / ${buildings.length} buildings open`;
  jump.replaceChildren(new Option('Find a building...',''));buildings.filter(unlocked).forEach(b=>jump.append(new Option(b.name,b.id)));
  if(selected){if(unlocked(selected))select(selected);else{selected=null;inspector.hidden=true;}}
 }
 function create(){
  d=el('dialog','village-map');d.id='villageMap';d.setAttribute('aria-label','Your island');
  const toolbar=el('header','village-toolbar');const brand=el('div','village-brand');brand.append(el('small','','WELCOME HOME'),el('h1','','Your island'));
  const exit=el('button','village-secondary','Log out');exit.onclick=()=>logout();toolbar.append(brand,exit);
  const tools=el('div','village-preview-tools');levelSelect=el('select');levelSelect.setAttribute('aria-label','Preview village progression');levelSelect.onchange=()=>{simulation=levelSelect.value==='account'?null:Number(levelSelect.value);render();};
  notice=el('span','village-preview-notice');notice.setAttribute('role','status');tools.append(levelSelect,notice);toolbar.append(tools);
  viewport=el('div','village-viewport');viewport.tabIndex=0;viewport.setAttribute('role','group');viewport.setAttribute('aria-label','Island map. Drag or swipe to explore, pinch to zoom. Arrow keys pan; plus and minus zoom.');
  world=el('div','village-world');world.innerHTML=VillageArt.terrain();viewport.append(world);
  for(const b of buildings){const tile=el('button','village-building');tile.type='button';tile.dataset.building=b.id;tile.style.left=b.x+'px';tile.style.top=b.y+'px';tile.style.zIndex=Math.round(b.y);tile.onclick=e=>{if(!unlocked(b))return;if(moved&&e.detail!==0){e.preventDefault();return;}select(b);};tile.onfocus=()=>{if(!pointers.size&&d.open&&document.activeElement===tile)focusBuilding(b);};world.append(tile);tiles.set(b.id,tile);}
  const caption=el('div','village-map-caption');caption.append(el('span','','THE COLLECTOR’S ISLE'),el('small','','Swipe to explore · Tap a building to enter'));world.append(caption);
  const controls=el('div','village-camera-controls');for(const [label,text,fn] of [['Zoom out','−',()=>zoom(camera.scale/1.2)],['Recenter map','⌖',reset],['Zoom in','+',()=>zoom(camera.scale*1.2)]]){const b=el('button','',text);b.setAttribute('aria-label',label);b.onclick=fn;controls.append(b);}
  const footer=el('footer','village-footer');status=el('span');jump=el('select');jump.setAttribute('aria-label','Find a building');jump.append(new Option('Find a building…',''));buildings.forEach(b=>jump.append(new Option(b.name,b.id)));jump.onchange=()=>{const b=buildings.find(b=>b.id===jump.value);if(b){focusBuilding(b);select(b);}jump.value='';};footer.append(status,jump);
  inspector=el('section','village-inspector');inspector.hidden=true;inspector.setAttribute('aria-label','Selected building');
  d.append(viewport,toolbar,controls,footer,inspector);document.body.append(d);d.addEventListener('cancel',e=>{e.preventDefault();if(!inspector.hidden)inspector.hidden=true;});
  viewport.addEventListener('pointerdown',e=>{if(e.button>0)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;gesture={x:e.clientX,y:e.clientY,camX:camera.x,camY:camera.y};if(pointers.size===2){const [a,b]=[...pointers.values()];gesture={distance:Math.hypot(a.x-b.x,a.y-b.y),scale:camera.scale};}});
  viewport.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()],r=viewport.getBoundingClientRect();if(gesture.distance){moved=true;zoom(gesture.scale*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);}return;}if(gesture?.x!==undefined){const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.hypot(dx,dy)>7)moved=true;if(moved){viewport.setPointerCapture(e.pointerId);camera.x=gesture.camX+dx;camera.y=gesture.camY+dy;clamp();paintCamera();}}});
  const release=e=>{pointers.delete(e.pointerId);if(pointers.size===1){const p=[...pointers.values()][0];gesture={...p,camX:camera.x,camY:camera.y};}else gesture=null;};viewport.addEventListener('pointerup',release);viewport.addEventListener('pointercancel',release);
  viewport.addEventListener('wheel',e=>{e.preventDefault();const r=viewport.getBoundingClientRect();zoom(camera.scale*Math.exp(-e.deltaY*.001),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  viewport.addEventListener('keydown',e=>{if(e.target!==viewport)return;const move={ArrowLeft:[70,0],ArrowRight:[-70,0],ArrowUp:[0,70],ArrowDown:[0,-70]}[e.key];if(move){e.preventDefault();camera.x+=move[0];camera.y+=move[1];clamp();paintCamera();}if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(camera.scale*(e.key==='-'?1/1.2:1.2));}});
  new ResizeObserver(()=>{if(d.open){if(!initialized)reset();else{clamp();paintCamera();}}}).observe(viewport);
 }
 async function load(){const res=await fetch(API_URL+'/admin/village',{headers:resourceHeaders()});if(!res.ok)throw Error(await res.text());data=await res.json();verified=true;}
 function options(){levelSelect.hidden=!data.isAdmin;if(!data.isAdmin)simulation=null;levelSelect.replaceChildren(new Option('Use your Town Hall progression','account'));for(let i=0;i<=9;i++)levelSelect.append(new Option(`Preview: Town Hall ${i+1}`,String(i)));levelSelect.value=simulation===null?'account':String(simulation);}
 async function show(){if(loading)return;if(!enabled)previousStudio=footyStudio.enabled;loading=true;toggle.disabled=true;back.disabled=true;try{await load();window.VillageInteriors.close();document.getElementById('rubyShopDialog')?.close();if(!d)create();if(!enabled)previousStudio=footyStudio.enabled;enabled=true;document.getElementById('islandLoading').hidden=true;saved(true);toggle.textContent='Village mode: on';toggle.setAttribute('aria-pressed','true');back.hidden=true;options();render();if(!d.open)d.showModal();if(!initialized)reset();viewport.focus({preventScroll:true});}catch(e){const panel=document.getElementById('islandLoading');panel.hidden=false;panel.querySelector('p').textContent=e.message;}finally{loading=false;toggle.disabled=false;back.disabled=false;}}
 function enterBuilding(b){if(!verified||!enabled||!unlocked(b))return;entering=true;
  try{d.close();inspector.hidden=true;selected=null;tiles.forEach(t=>t.classList.remove('selected'));back.hidden=true;
   if(!footyStudio.enabled)footyStudio.setMode(true);
   if(b.route==='hall'){VillageInteriors.close();back.hidden=false;window.openTownHall(show);return;}
   footyStudio.navigate(b.route==='ruby'?'home':b.route);
   VillageInteriors.open(b,{back:show,enter:enterBuilding});
   if(b.route==='ruby')document.getElementById('rubyShopButton').click();
   if(b.target){const target=document.getElementById(b.target);if(target?.tagName==='DETAILS')target.open=true;}
  }finally{entering=false;}
 }
 window.addEventListener('footy-studio-navigate',e=>{if(entering||!enabled)return;const current=VillageInteriors.active;if(current&&(e.detail===current.route||current.route==='ruby'&&e.detail==='home'))return;const route=e.detail;const next=buildings.find(b=>b.route===route&&unlocked(b))||(route==='sell'?{...buildings.find(b=>b.id==='market'),route}:null)||(['admin','battle-manager'].includes(route)&&data.isAdmin?{...buildings[0],route,name:'Admin tools'}:null);queueMicrotask(()=>{if(next)enterBuilding(next);else show();});});
 window.Island={show,enter:id=>{const b=buildings.find(b=>b.id===id);if(b&&unlocked(b))enterBuilding(b);else show();}};
 back.onclick=show;
 document.getElementById('islandRetry').onclick=show;
 document.getElementById('islandLogin').onclick=()=>logout();
 show();
})();
