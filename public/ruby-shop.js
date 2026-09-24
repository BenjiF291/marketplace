(() => {
 let state=null,busy=false;
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
 const explorer=window.createCompanionExplorer({stage,pet,copy,message:petMessage,react});
 pet.onclick=()=>react();
 const observe=new IntersectionObserver(entries=>{stage.classList.toggle('is-visible',entries[0].isIntersecting&&!document.hidden);});observe.observe(stage);
 document.addEventListener('visibilitychange',()=>{stage.classList.toggle('is-paused',document.hidden);});
 const shelf=el('div',undefined,'ruby-shelf');habitat.append(shelf);
 const profile=el('span',undefined,'ruby-profile');document.getElementById('currentUsername').after(profile);
 const emoji={'pet:fox':'🦊','pet:snail':'🐌','pet:dragon':'🐉','relic:rose':'🌹','relic:moon':'🌙','relic:crown':'👑'};

 function paintHome(){
  if(!state)return;
  const id=state.equipped.pet;stage.hidden=!id;explorer.update(id);
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
 async function refresh(){state=await call('/ruby-shop');grantSelect.replaceChildren();for(const item of state.catalog){const option=el('option',item.name);option.value=item.id;grantSelect.append(option);}paintHome();render();return state;}
 function render(){if(!state)return;status.textContent=`${state.rubies} Rubies • ${state.fuelArmed?'Fuel armed for next conversion':'Choose something special'}`;list.replaceChildren();
 for(const item of state.catalog.filter(x=>filter.value==='all'||x.kind===filter.value)){
  const tile=el('article',undefined,'ruby-tile');tile.append(el('div',emoji[item.id]||({'opening':'✦','profile':'♛','supply':'◇'}[item.kind]||'◆'),'ruby-art'),el('h3',item.name),el('p',item.description),el('strong',`${item.price} Rubies`),el('small',`Owned: ${state.owned[item.id]||0}`));
  if(item.kind==='pet'){const portrait=tile.querySelector('.ruby-art');portrait.classList.add('companion-portrait');portrait.innerHTML=window.companionArt(item.id);}
  const buy=el('button','Buy','btn btn-primary');buy.disabled=busy||state.rubies<item.price||(item.kind!=='supply'&&state.owned[item.id]>0);buy.onclick=()=>act('buy',item.id);tile.append(buy);
  if(state.owned[item.id]>0&&item.kind!=='relic'&&!item.id.startsWith('compass:')){
   const use=el('button',item.id==='retry'?'Replace latest spin':item.id==='recall'?'Recall from slot':item.id==='fuel'?'Arm next conversion':item.id==='food'?'Feed companion':'Equip','btn');use.disabled=busy;tile.append(use);
   let slot;
   if(item.id==='recall'){slot=el('select');slot.setAttribute('aria-label','Amulet slot to recall');state.slots.forEach((s,i)=>{if(s){const o=el('option',`Slot ${i+1}: ${s.name}`);o.value=i;slot.append(o);}});tile.append(slot);use.disabled=busy||!slot.options.length;}
   use.onclick=async()=>{if(item.id==='retry'&&!confirm('Replace your latest wheel reward? The new reward may be lower.'))return;await act('use',item.id,slot?{slot:Number(slot.value)}:{});};
   if(state.equipped[item.kind]===item.id){const off=el('button','Unequip','btn');off.onclick=()=>act('clear',item.id,{kind:item.kind});tile.append(off);}
  }
  list.append(tile);
 }}
 async function act(action,itemId,extra={}){if(busy)return;if(itemId==='retry'&&typeof isSpinning!=='undefined'&&isSpinning){status.textContent='Wait for the wheel to finish before retrying.';return;}busy=true;render();try{const result=await call('/ruby-shop/'+action,{itemId,...extra,actionId:crypto.randomUUID()});await refresh();await updateBalance();if(itemId==='retry'){document.getElementById('spinResult').textContent=`Replacement reward: ${result.amount} Footy.`;}if(itemId==='retry')status.textContent=`Replacement wheel reward: ${result.amount} Footy. Balance: ${result.balance}.`;if(itemId==='food'){explorer.home();react('snack');status.textContent='Crunch! Your companion enjoyed the treat.';}if(itemId==='fuel'&&typeof loadGemConverter==='function')await loadGemConverter();}catch(e){status.textContent=e.message;}finally{busy=false;const message=status.textContent;render();status.textContent=message;}}
 async function open(){if(!dialog.open)dialog.showModal();status.textContent='Opening cabinet...';try{await refresh();}catch(e){status.textContent=e.message;}}
 filter.onchange=render;
 window.pickRubyCompass=async()=>{
  try{await refresh();}catch{return null;}
  const owned=state.catalog.filter(x=>x.id.startsWith('compass:')&&state.owned[x.id]>0);if(!owned.length)return null;
  return choose('Use a pack compass?', [{id:null,name:'Open normally'},...owned.map(x=>({id:x.id,name:`${x.name} (${state.owned[x.id]}) - ${x.description}`}))]);
 };
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
