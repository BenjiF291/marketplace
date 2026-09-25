(() => {
 let itemsOnly=false;
 let state=null,busy=false,journeyTables=null,journeyClockOffset=0;
 const extraCompanions=new Map();
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const call=async(path,body)=>{const res=await fetch(API_URL+path,{method:body?'POST':'GET',headers:resourceHeaders(),...(body?{body:JSON.stringify(body)}:{})});if(!res.ok)throw Error(await res.text());return res.json();};
 const dialog=el('dialog',undefined,'ruby-dialog');dialog.id='rubyShopDialog';
 const close=el('button','Close','btn');close.onclick=()=>dialog.close();
 const title=el('h2','The Ruby Cabinet');const status=el('p');status.setAttribute('role','status');
 const filter=el('select');filter.setAttribute('aria-label','Shop category');
 for(const [key,name] of [['all','Everything'],['pet','Companions'],['relic','Collectibles'],['opening','Pack effects'],['profile','Profile styles'],['supply','Utilities & food']]){const option=el('option',name);option.value=key;filter.append(option);}
 const list=el('div',undefined,'ruby-grid');dialog.append(close,title,status,filter,list);document.body.append(dialog);
 const trigger=el('button','Ruby shop','btn');trigger.id='rubyShopButton';trigger.onclick=()=>open();document.getElementById('dyeHeaderControls').prepend(trigger);
 const grantSelect=el('select');grantSelect.className='input-field';grantSelect.setAttribute('aria-label','Ruby shop item to grant');
 const grantQty=el('input');grantQty.className='input-field';grantQty.type='number';grantQty.min='1';grantQty.value='1';grantQty.setAttribute('aria-label','Ruby shop item quantity');
 const grantBtn=el('button','Grant Ruby shop item','btn btn-primary');
 document.getElementById('grantResourceStatus').before(el('label','Ruby shop items'),grantSelect,grantQty,grantBtn);
 grantBtn.onclick=async()=>{if(grantBtn.disabled)return;grantBtn.disabled=true;try{await call('/admin/grant-resource',{userId:document.getElementById('grantResourceUser').value,kind:'ruby-item',rubyItemId:grantSelect.value,quantity:Number(grantQty.value)});document.getElementById('grantResourceStatus').textContent='Ruby shop item granted.';}catch(e){document.getElementById('grantResourceStatus').textContent=e.message;}finally{grantBtn.disabled=false;}};
 const habitat=el('section',undefined,'ruby-habitat');habitat.id='rubyHabitat';
 (document.getElementById('studioHome')||document.querySelector('.user-section')).append(habitat);
 const stage=el('section',undefined,'companion-stage');stage.hidden=true;stage.dataset.perch='sun';
 const copy=el('div',undefined,'companion-copy');copy.append(el('p','A LITTLE COMPANY','companion-eyebrow'));
 const petName=el('h3');const petMessage=el('p','Click your companion for a little hello. Treats are just for fun.');petMessage.setAttribute('aria-live','polite');
 const perches=el('div',undefined,'companion-perches');perches.setAttribute('aria-label','Companion perches');
 const perchNames={sun:'Sunlit ledge',crystal:'Crystal hollow',cozy:'Cozy corner'};
 function setPerch(key){stage.dataset.perch=key;perches.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.perch===key)));}
 for(const [key,name] of Object.entries(perchNames)){const b=el('button',name);b.type='button';b.dataset.perch=key;b.onclick=()=>{setPerch(key);react('hello');};perches.append(b);}
 const nook=el('div',undefined,'companion-nook');
 const pet=el('button',undefined,'ruby-pet');pet.type='button';
 const ledge=el('div',undefined,'companion-ledge');ledge.setAttribute('aria-hidden','true');ledge.append(el('span','YOUR LITTLE SIDEKICK'));
 nook.append(pet,ledge);copy.append(petName,petMessage,perches);stage.append(copy,nook);const hero=document.querySelector('#studioHome .studio-hero');if(hero)hero.after(stage);else habitat.before(stage);setPerch('sun');
 let reactionTimer,peekTimer;
 function react(mood='hello'){
  clearTimeout(reactionTimer);clearTimeout(peekTimer);stage.classList.remove('is-peeking');
  stage.dataset.mood='';void pet.offsetWidth;stage.dataset.mood=mood;
  petMessage.textContent=mood==='snack'?'Crunch, crunch! That earned you a very happy wiggle.':['Oh, hello you!','A little head scratch? Yes please.','Your companion is delighted to see you.'][Math.floor(Math.random()*3)];
  reactionTimer=setTimeout(()=>{delete stage.dataset.mood;},2600);
 }
 function interact(id){const name=state.catalog.find(x=>x.id===id)?.name||'Companion';window.showPetInteraction(id,name,{feed:()=>act('use','food',{petId:id}),journey:()=>openJourneys()});}
 const explorer=window.createCompanionExplorer({stage,pet,copy,message:petMessage,react,onInteract:interact});
 pet.onclick=()=>{react();interact(pet.dataset.pet);};
 const observe=new IntersectionObserver(entries=>{stage.classList.toggle('is-visible',entries[0].isIntersecting&&!document.hidden);});observe.observe(stage);
 document.addEventListener('visibilitychange',()=>{stage.classList.toggle('is-paused',document.hidden);});
 const shelf=el('div',undefined,'ruby-shelf');habitat.append(shelf);
 const journeyPanel=el('details',undefined,'pet-journeys');journeyPanel.id='petJourneys';journeyPanel.append(el('summary','Companion journeys - explore for four hours'));
 const journeyStatus=el('p');journeyStatus.setAttribute('role','status');const journeyContent=el('div',undefined,'ruby-grid');journeyPanel.append(journeyStatus,journeyContent);habitat.before(journeyPanel);
 const journeyDialog=el('dialog',undefined,'ruby-dialog');const journeyClose=el('button','Close','btn');journeyClose.onclick=()=>journeyDialog.close();journeyDialog.append(journeyClose);document.body.append(journeyDialog);journeyDialog.addEventListener('close',()=>habitat.before(journeyPanel));
 const journeyButton=el('button','Companion journeys','btn');journeyButton.onclick=()=>openJourneys();filter.before(journeyButton);
 async function openJourneys(){dialog.close();if(document.body.classList.contains('studio-ui'))footyStudio.navigate('home');else{journeyDialog.append(journeyPanel);journeyDialog.showModal();}journeyPanel.open=true;await loadJourneyTables();journeyPanel.scrollIntoView({behavior:'smooth',block:'start'});}
 function lootRows(rows,table){
  rows.replaceChildren();if(table.perk)rows.append(el('p',table.perk));rows.append(el('p','One gem type, 1-5 gems, plus an independent bonus roll. All tiers can drop, even locked ones.'));
  for(const [title,entries] of [['Gem type',table.gems.map(g=>({name:g.gemName,percent:g.percent}))],['Number of gems',table.quantities.map(q=>({name:`${q.amount} gems`,percent:q.percent}))],['Bonus item',table.rewards]]){
   rows.append(el('h4',title));const t=el('table');const head=el('tr');head.append(el('th','Reward'),el('th','Chance'));t.append(head);
   for(const reward of entries){const row=el('tr');row.append(el('td',reward.name),el('td',`${Number(reward.percent.toFixed(4))}%`));t.append(row);}rows.append(t);
  }
 }
 journeyPanel.addEventListener('toggle',()=>{if(journeyPanel.open)loadJourneyTables();});
 async function loadJourneyTables(){try{if(!journeyTables)journeyTables=await call('/pet-journeys');renderJourneys();}catch(e){journeyContent.textContent=e.message;}}
 function renderJourneys(){
  if(!state||!journeyTables)return;journeyContent.replaceChildren();
  const ownedPets=state.catalog.filter(x=>x.kind==='pet'&&state.owned[x.id]>0);
  if(!ownedPets.length){journeyContent.textContent='Adopt a companion in the Ruby shop to start exploring.';return;}
  for(const animal of ownedPets){
   const tile=el('article',undefined,'ruby-tile');const portrait=el('div',undefined,'journey-portrait');portrait.innerHTML=companionArt(animal.id);tile.append(portrait,el('h3',animal.name),el('p',animal.description));
   const trip=(state.journeys||[]).find(j=>j.petId===animal.id&&j.status==='travelling');
   if(trip){
    const clock=el('p');clock.dataset.journeyEnd=trip.endsAt;tile.append(clock);
    const claim=el('button','Claim discoveries','btn btn-primary');claim.dataset.claimEnd=trip.endsAt;claim.onclick=()=>act('journey-claim',null,{petId:animal.id,journeyId:trip.id});tile.append(claim);
   }else{
    const food=el('select');food.setAttribute('aria-label',`Journey food for ${animal.name}`);
    for(const table of journeyTables){const o=el('option',`${table.name} - ${state.owned[table.id]||0} owned (${table.price} Rubies each)`);o.value=table.id;food.append(o);}
    const odds=el('details');odds.append(el('summary','Exact loot odds'));const rows=el('div',undefined,'journey-loot');rows.tabIndex=0;rows.setAttribute('aria-label','Scroll through journey rewards and odds');odds.append(rows);
    const send=el('button','Send on a 4-hour journey','btn btn-primary');send.onclick=()=>act('journey-start',null,{petId:animal.id,foodId:food.value});
    const paintOdds=()=>{rows.replaceChildren();const table=journeyTables.find(t=>t.id===food.value);send.disabled=busy||!(state.owned[food.value]>0);if(!table)return;
     lootRows(rows,table.petOdds?.[animal.id]||table);
    };food.onchange=paintOdds;paintOdds();tile.append(food,el('p','Consumes one serving. Each pet can take one journey at a time.'),odds,send);
   }
   journeyContent.append(tile);
  }updateJourneyClocks();
 }
 function updateJourneyClocks(){const now=Date.now()+journeyClockOffset;journeyContent.querySelectorAll('[data-journey-end]').forEach(n=>{const left=Math.max(0,Number(n.dataset.journeyEnd)-now),m=Math.ceil(left/60000);n.textContent=left?`Exploring - ${Math.floor(m/60)}h ${m%60}m remaining`:'Your companion is back! Claim its discoveries.';});journeyContent.querySelectorAll('[data-claim-end]').forEach(b=>b.disabled=busy||Number(b.dataset.claimEnd)>now);}
 setInterval(updateJourneyClocks,1000);
 function showJourneyDiscoveries(reward,petId){
  const previous=document.activeElement;
  const d=el('dialog',undefined,'ruby-dialog journey-discoveries');d.setAttribute('aria-labelledby','journeyDiscoveryTitle');
  const title=el('h2','Journey discoveries');title.id='journeyDiscoveryTitle';
  const portrait=el('div',undefined,'journey-discovery-pet');portrait.innerHTML=companionArt(petId);
  const animal=state?.catalog.find(item=>item.id===petId)?.name||'Your companion';
  const gems=el('div',undefined,'journey-discovery-gems');gems.append(gemIcon(reward.gemKey),el('strong',`+${reward.amount}`),el('span',reward.gemName));
  d.append(portrait,title,el('p',`${animal} brought these back for you!`),gems);
  if(reward.bonus&&reward.bonus.kind!=='none'){
   const bonus=el('div',undefined,'journey-discovery-bonus');
   bonus.append(el('span','RARE FIND'),el('strong',reward.bonus.name),el('p',reward.bonus.kind==='pack'?'1 pack added to your inventory':'1 amulet added to your amulet inventory'));d.append(bonus);
  }
  d.append(el('p','Rewards added to your account.','journey-discovery-saved'));
  const close=el('button','Lovely!','btn btn-primary');close.onclick=()=>d.close();d.append(close);
  d.addEventListener('close',()=>{d.remove();if(previous?.isConnected)previous.focus();},{once:true});document.body.append(d);d.showModal();close.focus();
 }
 function renderCompanions(ids){
  for(const [id,view] of extraCompanions){if(!ids.slice(1).includes(id)){view.stage.hidden=true;view.explorer.update(null);}}
  for(const id of ids.slice(1)){
   let view=extraCompanions.get(id);
   if(!view){const card=stage.cloneNode(true);card.dataset.explore='home';delete card.dataset.mood;card.classList.remove('is-peeking');card.querySelector('.companion-mode-controls')?.remove();
    const p=card.querySelector('.ruby-pet'),c=card.querySelector('.companion-copy'),m=c.querySelectorAll('p')[1];p.dataset.pet=id;p.innerHTML=companionArt(id);
    c.querySelector('h3').textContent=state.catalog.find(x=>x.id===id)?.name||id;
    card.querySelectorAll('[data-perch]').forEach(b=>b.onclick=()=>{card.dataset.perch=b.dataset.perch;card.querySelectorAll('[data-perch]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));});
    const reaction=()=>{card.dataset.mood='hello';setTimeout(()=>delete card.dataset.mood,2600);};p.onclick=()=>{reaction();interact(id);};p.setAttribute('aria-label',`Play with ${c.querySelector('h3').textContent}`);
    const ctrl=createCompanionExplorer({stage:card,pet:p,copy:c,message:m,react:reaction,onInteract:interact});view={stage:card,explorer:ctrl};extraCompanions.set(id,view);stage.after(card);
    new IntersectionObserver(entries=>card.classList.toggle('is-visible',entries[0].isIntersecting)).observe(card);
   }
   view.stage.hidden=false;view.explorer.update(id);
  }
 }

 const profile=el('span',undefined,'ruby-profile');document.getElementById('currentUsername').after(profile);
 const emoji={'pet:fox':'🦊','pet:snail':'🐌','pet:dragon':'🐉','relic:rose':'🌹','relic:moon':'🌙','relic:crown':'👑'};

 function paintHome(){
  if(!state)return;
  const equipped=state.equipped.pets|| (state.equipped.pet?[state.equipped.pet]:[]);
  const available=equipped.filter(id=>!(state.journeys||[]).some(j=>j.petId===id&&j.status==='travelling'));
  const id=available[0];stage.hidden=!id;explorer.update(id);renderCompanions(available);
  if(pet.dataset.pet!==(id||'')){pet.dataset.pet=id||'';pet.innerHTML=window.companionArt(id);stage.dataset.mood='';}
  petName.textContent=state.catalog.find(item=>item.id===id)?.name||'Your companion';
  pet.setAttribute('aria-label',`Play with ${petName.textContent}`);pet.title='Click for a head scratch';
  shelf.replaceChildren();
  const heading=el('h3','Your Ruby collection');shelf.append(heading);
  if(state.equipped.profile){const style=state.catalog.find(x=>x.id===state.equipped.profile);profile.textContent=style?.name||'';profile.dataset.style=state.equipped.profile;}
  else profile.textContent='';
  document.body.dataset.rubyProfile=(state.equipped.profile||'').split(':')[1]||'';
  document.body.dataset.rubyOpening=(state.equipped.opening||'').split(':')[1]||'';
  const relics=state.catalog.filter(x=>x.kind==='relic'&&state.owned[x.id]>0);
  for(const item of relics){const figure=el('figure');figure.append(el('span',emoji[item.id],'ruby-relic'),el('figcaption',item.name));shelf.append(figure);}
  if(!relics.length)shelf.append(el('p','Discover companions, relics and useful treasures in the Ruby shop.'));
  const shop=el('button','Visit Ruby shop','btn');shop.onclick=()=>open();shelf.append(shop);
  if(id){const feed=el('button',`Feed a treat (${state.owned.food||0})`,'btn');feed.disabled=!(state.owned.food>0);feed.onclick=()=>act('use','food');shelf.append(feed);const hint=el('small',`${state.treats} treats enjoyed. Your companion never needs feeding.`);shelf.append(hint);}
 }
 async function refresh(){state=await call('/ruby-shop');journeyClockOffset=(state.serverNow||Date.now())-Date.now();grantSelect.replaceChildren();for(const item of state.catalog){const option=el('option',item.name);option.value=item.id;grantSelect.append(option);}paintHome();render();renderJourneys();return state;}
 function render(){if(!state)return;status.textContent=`${state.rubies} Rubies • ${state.fuelArmed?'Fuel armed for next conversion':'Choose something special'}`;list.replaceChildren();
 for(const item of state.catalog.filter(x=>(!itemsOnly||state.owned[x.id]>0)&&(filter.value==='all'||x.kind===filter.value))){
  const tile=el('article',undefined,'ruby-tile');tile.append(el('div',emoji[item.id]||({'opening':'✦','profile':'♛','supply':'◇'}[item.kind]||'◆'),'ruby-art'),el('h3',item.name),el('p',item.description),el('strong',`${item.price} Rubies`),el('small',`Owned: ${state.owned[item.id]||0}`));
  if(item.kind==='pet'){const portrait=tile.querySelector('.ruby-art');portrait.classList.add('companion-portrait');portrait.innerHTML=window.companionArt(item.id);}
  if(item.kind==='opening'){const preview=el('button','Preview animation','btn');preview.onclick=()=>window.playSpecialPackOpening({preview:true},item.id.split(':')[1]);tile.append(preview);}
  const buy=el('button','Buy','btn btn-primary');buy.disabled=busy||state.rubies<item.price||(item.kind!=='supply'&&state.owned[item.id]>0);buy.onclick=()=>act('buy',item.id);if(!itemsOnly)tile.append(buy);
  if(item.id.startsWith('compass:')&&state.owned[item.id]>0){const use=el('button','Use on a pack','btn btn-primary');use.onclick=async()=>{use.disabled=true;try{const packs=(await call('/inventory')).filter(p=>p.itemType==='pack'&&!p.listedForSale);if(!packs.length){status.textContent='You have no packs to open.';return;}const packId=await choose('Choose a pack for '+item.name,packs.map(p=>({id:p.id,name:p.name})));if(packId){dialog.close();await openPack(packId,item.id,packs.find(p=>p.id===packId));}}catch(e){status.textContent=e.message;}finally{use.disabled=false;}};tile.append(use);}
  if(state.owned[item.id]>0&&item.kind!=='relic'&&!item.id.startsWith('compass:')&&!item.id.startsWith('food:')){
   const use=el('button',item.id==='retry'?'Replace latest spin':item.id==='recall'?'Recall from slot':item.id==='fuel'?'Arm next conversion':item.id==='food'?'Feed companion':'Equip','btn');use.disabled=busy;tile.append(use);
   let slot;
   if(item.id==='recall'){slot=el('select');slot.setAttribute('aria-label','Amulet slot to recall');state.slots.forEach((s,i)=>{if(s){const o=el('option',`Slot ${i+1}: ${s.name}`);o.value=i;slot.append(o);}});tile.append(slot);use.disabled=busy||!slot.options.length;}
   use.onclick=async()=>{if(item.id==='retry'&&!confirm('Replace your latest wheel reward? The new reward may be lower.'))return;await act('use',item.id,slot?{slot:Number(slot.value)}:{});};
   if(state.equipped[item.kind]===item.id||(item.kind==='pet'&&state.equipped.pets?.includes(item.id))){const off=el('button','Unequip','btn');off.onclick=()=>act('clear',item.id,{kind:item.kind});tile.append(off);}
  }
  if(item.id==='food'||item.id.startsWith('food:')){const odds=el('button','Journey loot odds','btn');odds.onclick=async()=>{odds.disabled=true;await loadJourneyTables();odds.disabled=false;const table=journeyTables?.find(t=>t.id===item.id);if(!table){status.textContent='Could not load journey odds. Please try again.';return;}const d=el('dialog',undefined,'ruby-dialog pet-journeys');const close=el('button','Close','btn');close.onclick=()=>d.close();const rows=el('div');const petPicker=el('select');petPicker.setAttribute('aria-label','Pet for loot odds');for(const animal of state.catalog.filter(x=>x.kind==='pet')){const o=el('option',animal.name);o.value=animal.id;petPicker.append(o);}petPicker.onchange=()=>lootRows(rows,table.petOdds?.[petPicker.value]||table);petPicker.onchange();d.append(close,el('h2',table.name),petPicker,el('p',`${table.price} Rubies per serving. One serving sends one pet on a four-hour journey.`),rows);d.addEventListener('close',()=>d.remove(),{once:true});document.body.append(d);d.showModal();};tile.append(odds);}
  list.append(tile);
 }}
 async function act(action,itemId,extra={}){if(busy)return;if(itemId==='retry'&&typeof isSpinning!=='undefined'&&isSpinning){status.textContent='Wait for the wheel to finish before retrying.';return;}busy=true;render();updateJourneyClocks();try{const result=await call('/ruby-shop/'+action,{itemId,...extra,actionId:crypto.randomUUID()});if(action==='journey-claim'&&result.reward)showJourneyDiscoveries(result.reward,extra.petId);await refresh();await updateBalance();if(result.reward){const r=result.reward;status.textContent=`Found ${r.amount} ${r.gemName}${r.bonus.kind!=='none'?' and '+r.bonus.name:''}!`;}if(itemId==='retry'){document.getElementById('spinResult').textContent=`Replacement reward: ${result.amount} Footy.`;}if(itemId==='retry')status.textContent=`Replacement wheel reward: ${result.amount} Footy. Balance: ${result.balance}.`;if(itemId==='food'){if(!extra.petId||extra.petId===pet.dataset.pet){explorer.home();react('snack');}else extraCompanions.get(extra.petId)?.explorer.home();status.textContent='Crunch! Your companion enjoyed the treat.';}if(itemId==='fuel'&&typeof loadGemConverter==='function')await loadGemConverter();return result;}catch(e){status.textContent=e.message;return {success:false,error:e.message};}finally{busy=false;const message=status.textContent;render();renderJourneys();status.textContent=message;journeyStatus.textContent=message;}}
 window.refreshRubyItems=refresh;
 window.openRubyItemInventory=()=>open(true);
 async function open(owned=false){itemsOnly=owned;title.textContent=owned?'Your items & consumables':'The Ruby Cabinet';filter.value=owned?'supply':'all';if(!dialog.open)dialog.showModal();status.textContent='Opening cabinet...';try{await refresh();}catch(e){status.textContent=e.message;}}
 filter.onchange=render;

 function choose(title,options,images=false){return new Promise(resolve=>{const d=el('dialog',undefined,'ruby-dialog');d.append(el('h2',title));const grid=el('div',undefined,'ruby-grid');d.append(grid);let selected;
 for(const o of options){const b=el('button',undefined,'btn ruby-choice');if(images){const img=el('img');img.src='/images/'+encodeURIComponent(o.id);img.alt=o.name;b.append(img);}b.append(el('span',o.name));b.onclick=()=>{selected=o.id;d.close();};grid.append(b);}
 const cancel=el('button','Close - choose later','btn');cancel.onclick=()=>d.close();d.append(cancel);d.addEventListener('close',()=>{d.remove();resolve(selected);},{once:true});document.body.append(d);d.showModal();});}
 window.chooseRubyPackCard=cards=>choose('Choose your card - the other cards are not awarded',cards.map(id=>({id,name:id.replace(/\.[^.]+$/,'')})),true);
 // A peek from behind the ledge, never a trip across the page or its controls.
 setInterval(()=>{
  if(stage.dataset.explore!=='home'||stage.hidden||document.hidden||!stage.classList.contains('is-visible')||stage.dataset.mood||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  stage.classList.add('is-peeking');clearTimeout(peekTimer);
  peekTimer=setTimeout(()=>stage.classList.remove('is-peeking'),2200);
 },18000);
 refresh().catch(()=>{shelf.textContent='Open the Ruby shop to load your collection.';});
})();
