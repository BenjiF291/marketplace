/* Building presentation reuses live controls: no duplicate inventories or actions. */
(() => {
 const scenes={archive:[1,'THE CARD ARCHIVE','Browse your collection'],market:[2,'THE TRADING QUARTER','Find something worth bringing home'],forge:[3,'THE GEM FORGE','Load the furnace. Shape your next gem.'],arena:[4,'THE SKYSTONES ARENA','Choose your challenge'],wheel:[5,'THE FORTUNE PAVILION','A little luck awaits'],blacksmith:[6,'THE AMULET SMITHY','Craft your advantage'],pets:[7,'THE COMPANION LODGE','Rest, play, and prepare for adventure'],cabinet:[8,'THE RUBY EMPORIUM','Curiosities, companions and supplies'],dye:[9,'THE COLOUR STUDIO','Make the island your own'],compressor:[10,'THE CRYSTAL REFINERY','Transform your gathered gems'],vault:[11,'THE FOOTY VAULT','Your treasury and ledger'],vip:[12,'THE ROYAL HALL','A place for your membership'],townhall:[0,'THE TOWN HALL','Community workshop']};
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 let root,art,title,sub,tabs,active=null,options,controlsHome,controlBox,forgeHomes=[];
 function restoreForge(){for(const [node,marker] of forgeHomes)marker.replaceWith(node);forgeHomes=[];}
 function build(){
  root=el('section','village-interior-chrome');root.hidden=true;
  art=el('div','village-interior-art');art.setAttribute('aria-hidden','true');
  const bar=el('nav','village-interior-bar');bar.setAttribute('aria-label','Building navigation');
  const back=el('button','village-secondary','Return to island');back.onclick=()=>options.back();
  const exit=el('button','village-secondary','Exit village mode');exit.onclick=()=>options.exit();
  controlBox=el('div','village-interior-controls');bar.append(back,controlBox);
  const heading=el('div','village-interior-heading');title=el('h1');title.tabIndex=-1;sub=el('p');heading.append(title,sub);
  tabs=el('nav','village-stations');tabs.setAttribute('aria-label','Building stations');
  root.append(art,bar,heading,tabs);document.querySelector('.container').before(root);
 }
 function station(label,fn,selected=false){const b=el('button','',label);b.setAttribute('aria-pressed',String(selected));b.onclick=fn;tabs.append(b);}
 function focusTool(id){const tool=document.getElementById(id);if(tool){if(tool.tagName==='DETAILS')tool.open=true;tool.scrollIntoView({behavior:'smooth',block:'start'});}}
 function open(b,handlers){
  if(!root)build();restoreForge();active=b;options=handlers;root.hidden=false;
  document.body.classList.add('village-interior');document.body.dataset.villageBuilding=b.id;
  const [cell,label,copy]=scenes[b.id]||scenes.townhall;
  art.innerHTML=`<svg viewBox="${cell%4*256} ${Math.floor(cell/4)*256} 256 256" preserveAspectRatio="xMidYMid slice"><image href="assets/village/interiors-painted.png" width="1024" height="1024"/></svg>`;
  title.textContent=b.route==='sell'?'Your market stall':b.name;sub.textContent=copy;
  root.dataset.place=label;tabs.replaceChildren();
  if(b.id==='market'){station('Browse stalls',()=>handlers.enter({...b,route:'marketplace'}),b.route==='marketplace');station('Your selling counter',()=>handlers.enter({...b,route:'sell'}),b.route==='sell');}
  else if(b.id==='forge'){station('Conversion chamber',()=>focusTool('gemMachine'),true);station('Gems & upgrades',()=>focusTool('gemBalances'));station('How it works',()=>focusTool('villageForgeGuide'));}
  else if(b.id==='blacksmith'){const choose=key=>{document.body.dataset.villageStation=key;tabs.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.station===key)));};for(const [key,label] of [['shop','Forge amulets'],['equip','Equipment slots'],['owned','Your amulets']]){station(label,()=>choose(key),key==='shop');tabs.lastChild.dataset.station=key;}choose('shop');}
  else if(b.id==='archive'){station('Collection',()=>focusTool('inventorySection'),true);station('Open packs',()=>document.getElementById('inventoryOpenAll').click());station('Items & supplies',()=>window.openRubyItemInventory());}
  else if(b.id==='cabinet'){station('Browse goods',()=>document.getElementById('rubyShopButton').click(),true);station('Owned supplies',()=>window.openRubyItemInventory());}
  else if(b.id==='pets'){station('Companions',()=>focusTool('rubyHabitat'),true);station('Journey board',()=>focusTool('petJourneys'));station('Food & supplies',()=>document.getElementById('rubyShopButton').click());}
  else station(label,()=>document.querySelector('.main-grid').scrollIntoView({behavior:'smooth'}),true);
  const controls=document.getElementById('dyeHeaderControls');if(!controlsHome){controlsHome=document.createComment('Building controls home');controls.before(controlsHome);}controlBox.append(controls);
  if(b.id==='forge'){const converter=document.getElementById('gemConverter');converter.open=true;let anchor=converter.querySelector('summary');for(const node of [document.getElementById('gemMachine'),converter.querySelector('label[for=gemRecipe]'),...['gemRecipe','gemCards','gemQuote','gemStart','gemStatus'].map(id=>document.getElementById(id))]){const marker=document.createComment('Forge control home');node.before(marker);forgeHomes.push([node,marker]);anchor.after(node);anchor=node;}}
  if(['dye','compressor'].includes(b.id))document.getElementById('gemWorkshop').open=true;
  window.scrollTo({top:0,behavior:'instant'});title.focus({preventScroll:true});
 }
 function close(){if(!active)return;restoreForge();active=null;root.hidden=true;document.body.classList.remove('village-interior');delete document.body.dataset.villageBuilding;const controls=document.getElementById('dyeHeaderControls');if(controlsHome?.isConnected)controlsHome.replaceWith(controls);controlsHome=null;}
 // Shared workshop controls get their own stations without cloning event handlers.
 const workshop=document.getElementById('gemWorkshop');if(workshop){let dyes=false;for(const child of [...workshop.children]){if(child.tagName==='SUMMARY'||child.id==='gemWorkshopStatus')continue;if(child.tagName==='H3'&&child.textContent==='Gem dyes')dyes=true;child.classList.add(dyes?'village-dye-tool':'village-compressor-tool');}}
 const converter=document.getElementById('gemConverter');if(converter){const guide=el('details','village-forge-guide');guide.id='villageForgeGuide';guide.append(el('summary','','How the forge works'));for(const p of converter.querySelectorAll(':scope>p:not([id])')){p.classList.add('village-forge-instruction');guide.append(el('p','',p.textContent));}converter.append(guide);}
 const amulets=document.getElementById('amuletSection');if(amulets){let group=null;for(const node of amulets.children){if(node.tagName==='H3')group=node.textContent.includes('equipped')?'equip':node.textContent.includes('inventory')?'owned':'shop';if(group&&node.id!=='amuletStatus')node.dataset.villageStation=group;}}
 window.VillageInteriors={open,close,get active(){return active;}};
})();
