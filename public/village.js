/* Admin-only island navigation. Unlock previews never modify the account. */
(() => {
 const buildings=[
  {id:'townhall',name:'Town hall',kind:'archive',x:630,y:400,level:0,route:'admin',secondary:'battle-manager',secondaryLabel:'Battle card editor',description:'Your admin workspace, grants, planned listings and game configuration.'},
  {id:'archive',name:'Card archive',kind:'archive',x:325,y:405,level:0,route:'inventory',description:'Your cards, packs, consumables and ascensions, all under one roof.'},
  {id:'market',name:'Marketplace',kind:'market',x:484,y:510,level:0,route:'marketplace',description:'Browse player listings and the daily pack, or open your selling stall.',secondary:'sell'},
  {id:'forge',name:'Gem forge',kind:'forge',x:807,y:260,level:0,route:'workshop',description:'Convert cards into gems and upgrade the forge. New roofs, crystals and a floating core appear as it grows.'},
  {id:'arena',name:'Brawl arena',kind:'arena',x:1050,y:360,level:0,route:'battle',description:'Challenge Bob, face other players, and climb the skill and trophy paths.'},
  {id:'wheel',name:'Fortune pavilion',kind:'wheel',x:475,y:295,level:0,route:'spin',description:'Visit the wheel when your next spin is ready.'},
  {id:'blacksmith',name:'Blacksmith',kind:'blacksmith',x:898,y:481,level:1,route:'amulets',description:'Forge amulets with gems, compare their powers, and manage your equipped slots.'},
  {id:'pets',name:'Companion lodge',kind:'pets',x:423,y:698,level:2,route:'home',target:'petJourneys',description:'Visit your companions, send them exploring, and collect their discoveries.'},
  {id:'cabinet',name:'Ruby emporium',kind:'cabinet',x:265,y:575,level:1,route:'ruby',description:'Adopt companions, buy food and useful items, and choose your pack-opening effects.'},
  {id:'dye',name:'Colour studio',kind:'dye',x:966,y:642,level:3,route:'workshop',target:'gemWorkshop',description:'Craft dyes and bring your colours into the club.'},
  {id:'compressor',name:'Crystal refinery',kind:'compressor',x:702,y:773,level:4,route:'workshop',target:'gemWorkshop',description:'Craft your compressor and combine gems into higher tiers.'},
  {id:'vault',name:'Footy vault',kind:'vault',x:649,y:579,level:0,route:'wallet',description:'Your balance, transfers and account history.'},
  {id:'vip',name:'Royal hall',kind:'vip',x:650,y:205,level:5,route:'vip',description:'Your VIP membership and its benefits.'}
 ];
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 const toggle=el('button','btn','Try village');toggle.id='villageModeToggle';toggle.hidden=true;toggle.type='button';document.getElementById('dyeHeaderControls').prepend(toggle);
 const back=el('button','village-return','← Village');back.hidden=true;back.type='button';document.body.append(back);
 let enabled=false,verified=false,data=null,simulation=null,d=null,viewport,world,inspector,levelSelect,notice,status,tiles=new Map(),selected=null,previousStudio=true,loading=false;
 let camera={x:0,y:0,scale:1},initialized=false,frame=0,gesture=null,moved=false;
 const pointers=new Map();const pref=`footy-village:${currentUserId}`;
 const level=()=>simulation===null?data.level:simulation;
 const unlocked=b=>level()>=b.level;
 const saved=(value)=>{try{localStorage.setItem(pref,value?'on':'off');}catch{}};
 function applyCamera(){frame=0;world.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;}
 function paintCamera(){if(!frame)frame=requestAnimationFrame(applyCamera);}
 function clamp(){const r=viewport.getBoundingClientRect();camera.x=Math.max(100-1440*camera.scale,Math.min(r.width-100,camera.x));camera.y=Math.max(100-1000*camera.scale,Math.min(r.height-100,camera.y));}
 function zoom(next,cx,cy){const r=viewport.getBoundingClientRect();cx??=r.width/2;cy??=r.height/2;next=Math.max(.4,Math.min(1.65,next));const ratio=next/camera.scale;camera.x=cx-(cx-camera.x)*ratio;camera.y=cy-(cy-camera.y)*ratio;camera.scale=next;clamp();paintCamera();}
 function reset(){const r=viewport.getBoundingClientRect();camera.scale=r.width<650?.73:Math.min(1.1,r.width/1340,r.height/870);camera.x=r.width/2-720*camera.scale;camera.y=r.height/2-470*camera.scale;initialized=true;paintCamera();}
 function focusBuilding(b){const r=viewport.getBoundingClientRect();camera.x=r.width/2-b.x*camera.scale;camera.y=r.height*.4-b.y*camera.scale;clamp();paintCamera();}
 function select(b,focus=false){selected=b;for(const [id,tile] of tiles)tile.classList.toggle('selected',id===b.id);inspector.replaceChildren();inspector.hidden=false;
  const dismiss=el('button','village-sheet-close','×');dismiss.setAttribute('aria-label','Close building details');dismiss.onclick=()=>{inspector.hidden=true;tiles.get(b.id)?.focus();};
  const info=el('div','village-building-info');info.append(el('small','',unlocked(b)?'READY TO VISIT':`UNLOCKS AT FORGE LEVEL ${b.level+1}`),el('h2','',b.name),el('p','',b.description));
  if(b.id==='forge')info.append(el('p','village-forge-note',`Level ${level()+1} · ${data.tiers[level()]?.name||'Bronze'} forge`));
  const enter=el('button','village-primary',unlocked(b)?'Enter building':'Visit the gem forge');enter.onclick=()=>enterBuilding(unlocked(b)?b:buildings.find(b=>b.id==='forge'));
  inspector.append(dismiss,info,enter);
  if(unlocked(b)&&b.secondary){const sell=el('button','village-secondary',b.secondaryLabel||'Sell an item');sell.onclick=()=>enterBuilding({...b,route:b.secondary});inspector.append(sell);}
 }
 function render(){if(!data||!world)return;const l=level();
  for(const b of buildings){const tile=tiles.get(b.id),open=unlocked(b);tile.innerHTML=VillageArt.building(b.kind,l,!open);const label=el('span','village-building-label',b.name);label.append(el('small','',b.id==='forge'?`Level ${l+1} · ${data.tiers[l]?.name||'Bronze'}`:open?'Enter':`Forge level ${b.level+1}`));tile.append(label);tile.classList.toggle('locked',!open);tile.setAttribute('aria-label',`${b.name}, ${open?'available':`locked until forge level ${b.level+1}`}`);}
  notice.textContent=simulation===null?'Your account progression':`Previewing forge level ${l+1} — no account changes`;
  status.textContent=`${buildings.filter(unlocked).length} / ${buildings.length} buildings open`;
  if(selected)select(selected);
 }
 function create(){
  d=el('dialog','village-map');d.id='villageMap';d.setAttribute('aria-label','Admin village preview');
  const toolbar=el('header','village-toolbar');const brand=el('div','village-brand');brand.append(el('small','','ADMIN PREVIEW'),el('h1','','Your island'));
  const exit=el('button','village-secondary','Exit village mode');exit.onclick=disable;toolbar.append(brand,exit);
  const tools=el('div','village-preview-tools');levelSelect=el('select');levelSelect.setAttribute('aria-label','Preview village progression');levelSelect.onchange=()=>{simulation=levelSelect.value==='account'?null:Number(levelSelect.value);render();};
  notice=el('span','village-preview-notice');notice.setAttribute('role','status');tools.append(levelSelect,notice);toolbar.append(tools);
  viewport=el('div','village-viewport');viewport.tabIndex=0;viewport.setAttribute('role','group');viewport.setAttribute('aria-label','Island map. Drag or swipe to explore, pinch to zoom. Arrow keys pan; plus and minus zoom.');
  world=el('div','village-world');world.innerHTML=VillageArt.terrain();viewport.append(world);
  for(const b of buildings){const tile=el('button','village-building');tile.type='button';tile.dataset.building=b.id;tile.style.left=b.x+'px';tile.style.top=b.y+'px';tile.style.zIndex=Math.round(b.y);tile.onclick=e=>{if(moved&&e.detail!==0){e.preventDefault();return;}select(b);};tile.onfocus=()=>{if(!pointers.size&&d.open&&document.activeElement===tile)focusBuilding(b);};world.append(tile);tiles.set(b.id,tile);}
  const caption=el('div','village-map-caption');caption.append(el('span','','THE COLLECTOR’S ISLE'),el('small','','Swipe to explore · Tap a building to enter'));world.append(caption);
  const controls=el('div','village-camera-controls');for(const [label,text,fn] of [['Zoom out','−',()=>zoom(camera.scale/1.2)],['Recenter map','⌖',reset],['Zoom in','+',()=>zoom(camera.scale*1.2)]]){const b=el('button','',text);b.setAttribute('aria-label',label);b.onclick=fn;controls.append(b);}
  const footer=el('footer','village-footer');status=el('span');const jump=el('select');jump.setAttribute('aria-label','Find a building');jump.append(new Option('Find a building…',''));buildings.forEach(b=>jump.append(new Option(b.name,b.id)));jump.onchange=()=>{const b=buildings.find(b=>b.id===jump.value);if(b){focusBuilding(b);select(b);}jump.value='';};footer.append(status,jump);
  inspector=el('section','village-inspector');inspector.hidden=true;inspector.setAttribute('aria-label','Selected building');
  d.append(viewport,toolbar,controls,footer,inspector);document.body.append(d);d.addEventListener('cancel',e=>{e.preventDefault();if(!inspector.hidden)inspector.hidden=true;else disable();});
  viewport.addEventListener('pointerdown',e=>{if(e.button>0)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;gesture={x:e.clientX,y:e.clientY,camX:camera.x,camY:camera.y};if(pointers.size===2){const [a,b]=[...pointers.values()];gesture={distance:Math.hypot(a.x-b.x,a.y-b.y),scale:camera.scale};}});
  viewport.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()],r=viewport.getBoundingClientRect();if(gesture.distance){moved=true;zoom(gesture.scale*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);}return;}if(gesture?.x!==undefined){const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.hypot(dx,dy)>7)moved=true;if(moved){viewport.setPointerCapture(e.pointerId);camera.x=gesture.camX+dx;camera.y=gesture.camY+dy;clamp();paintCamera();}}});
  const release=e=>{pointers.delete(e.pointerId);if(pointers.size===1){const p=[...pointers.values()][0];gesture={...p,camX:camera.x,camY:camera.y};}else gesture=null;};viewport.addEventListener('pointerup',release);viewport.addEventListener('pointercancel',release);
  viewport.addEventListener('wheel',e=>{e.preventDefault();const r=viewport.getBoundingClientRect();zoom(camera.scale*Math.exp(-e.deltaY*.001),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  viewport.addEventListener('keydown',e=>{if(e.target!==viewport)return;const move={ArrowLeft:[70,0],ArrowRight:[-70,0],ArrowUp:[0,70],ArrowDown:[0,-70]}[e.key];if(move){e.preventDefault();camera.x+=move[0];camera.y+=move[1];clamp();paintCamera();}if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(camera.scale*(e.key==='-'?1/1.2:1.2));}});
  new ResizeObserver(()=>{if(d.open){if(!initialized)reset();else{clamp();paintCamera();}}}).observe(viewport);
 }
 async function load(){const res=await fetch(API_URL+'/admin/village',{headers:resourceHeaders()});if(!res.ok)throw Error(await res.text());data=await res.json();verified=true;}
 function options(){levelSelect.replaceChildren(new Option('Use my account progression','account'));for(let i=0;i<=Math.max(5,data.maxLevel);i++)levelSelect.append(new Option(`Preview: forge ${i+1}${data.tiers[i]?' · '+data.tiers[i].name:''}`,String(i)));levelSelect.value=simulation===null?'account':String(simulation);}
 async function show(){if(loading)return;if(!enabled)previousStudio=footyStudio.enabled;loading=true;toggle.disabled=true;back.disabled=true;try{await load();if(!d)create();if(!enabled)previousStudio=footyStudio.enabled;enabled=true;saved(true);toggle.textContent='Village mode: on';toggle.setAttribute('aria-pressed','true');back.hidden=true;options();render();if(!d.open)d.showModal();if(!initialized)reset();viewport.focus({preventScroll:true});}catch(e){disable();alert(e.message);}finally{loading=false;toggle.disabled=false;back.disabled=false;}}
 function disable(){enabled=false;verified=false;saved(false);if(d?.open)d.close();back.hidden=true;toggle.textContent='Try village';toggle.setAttribute('aria-pressed','false');if(footyStudio.enabled!==previousStudio)footyStudio.setMode(previousStudio);}
 function enterBuilding(b){if(!verified||!enabled)return;d.close();inspector.hidden=true;selected=null;tiles.forEach(t=>t.classList.remove('selected'));back.hidden=false;if(!footyStudio.enabled)footyStudio.setMode(true);if(b.route==='ruby'){document.getElementById('rubyShopButton').click();return;}footyStudio.navigate(b.route);if(b.target){const target=document.getElementById(b.target);if(target){if(target.tagName==='DETAILS')target.open=true;target.scrollIntoView({behavior:'smooth',block:'start'});}}}
 toggle.onclick=()=>enabled?disable():show();back.onclick=show;
 let restored=false;function role(){const admin=typeof currentUserIsAdmin!=='undefined'&&currentUserIsAdmin===true;toggle.hidden=!admin;if(!admin){if(enabled)disable();return;}if(!restored){restored=true;try{if(localStorage.getItem(pref)==='on')show();}catch{}}}
 window.addEventListener('footy-role-changed',role);role();
})();
