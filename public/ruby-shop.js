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
 const pet=el('button',undefined,'ruby-pet');pet.hidden=true;pet.setAttribute('aria-label','Play with your companion');const petHome=document.getElementById('studioHome')||habitat;petHome.style.position='relative';petHome.append(pet);
 const shelf=el('div',undefined,'ruby-shelf');habitat.append(shelf);
 const profile=el('span',undefined,'ruby-profile');document.getElementById('currentUsername').after(profile);
 const emoji={'pet:fox':'🦊','pet:snail':'🐌','pet:dragon':'🐉','relic:rose':'🌹','relic:moon':'🌙','relic:crown':'👑'};

 pet.onclick=()=>{pet.classList.remove('ruby-bounce');void pet.offsetWidth;pet.classList.add('ruby-bounce');pet.title='Happy to see you!';};
 function paintHome(){
  if(!state)return;
  const id=state.equipped.pet;pet.hidden=!id;pet.textContent=emoji[id]||'◇';pet.title='Click to play - feeding is optional';
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
 async function act(action,itemId,extra={}){if(busy)return;if(itemId==='retry'&&typeof isSpinning!=='undefined'&&isSpinning){status.textContent='Wait for the wheel to finish before retrying.';return;}busy=true;render();try{const result=await call('/ruby-shop/'+action,{itemId,...extra,actionId:crypto.randomUUID()});await refresh();await updateBalance();if(itemId==='retry'){document.getElementById('spinResult').textContent=`Replacement reward: ${result.amount} Footy.`;}if(itemId==='retry')status.textContent=`Replacement wheel reward: ${result.amount} Footy. Balance: ${result.balance}.`;if(itemId==='food'){pet.click();status.textContent='Crunch! Your companion enjoyed the treat.';}if(itemId==='fuel'&&typeof loadGemConverter==='function')await loadGemConverter();}catch(e){status.textContent=e.message;}finally{busy=false;const message=status.textContent;render();status.textContent=message;}}
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
 // Roaming is local-only and pauses away from Home. No database writes per interaction.
 setInterval(()=>{if(pet.hidden||document.hidden||document.body.classList.contains('studio-ui')&&document.body.dataset.studioPage!=='home'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;pet.style.left=`${Math.round(Math.random()*Math.max(0,petHome.clientWidth-85))}px`;pet.style.top=`${Math.round(Math.random()*Math.max(0,petHome.clientHeight-85))}px`;pet.classList.toggle('ruby-peeking',Math.random()<.25);},6500);
 refresh().catch(()=>{shelf.textContent='Open the Ruby shop to load your collection.';});
})();
