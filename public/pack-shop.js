/* Toolbar pack shop; all prices and odds come from the saved pack configuration. */
(()=>{
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 const button=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;};
 // Retry reads only; purchases retain their existing receipt-based recovery.
 const request=async(path,body,signal)=>{
  for(let attempt=0;;attempt++){
   const controller=new AbortController(),abort=()=>controller.abort();
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
   signal?.addEventListener('abort',abort,{once:true});
   const timeout=setTimeout(()=>controller.abort(),30000);
   try{
    const r=await fetch(API_URL+path,{headers:resourceHeaders(),signal:controller.signal,...(body?{method:'POST',body:JSON.stringify(body)}:{})});
    if(!r.ok){
     const message=await r.text();
     const error=Error(r.status===401?'Your session expired. Please sign in again.':r.status===404?'The pack shop is not available on this server yet.':/<\s*(?:!doctype|html|body|pre)\b/i.test(message)?'The game server returned an error. Please try again.':message||'Could not load the pack shop.');
     error.retryable=[408,429,502,503,504].includes(r.status);throw error;
    }
    return await r.json();
   }catch(error){
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    const transient=error.retryable||error instanceof TypeError||error.name==='AbortError';
    if(!body&&attempt===0&&transient)continue;
    if(error instanceof TypeError||error.name==='AbortError')throw Error('Could not reach the pack shop. Check your connection and tap Retry.');
    throw error;
   }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
  }
 };
 let shop,data,busy=false,timer,loadSequence=0,loading=false,loadController;
 function cover(pack){return pack.daily?window.RewardOpening.dailyCover(pack.name):window.RewardOpening.cover(pack.name,pack.appearance);}
 function price(pack){return pack.daily?'Free':`${CurrencyFormat.format(pack.price,pack.currency)} ${pack.currency==='footy'?'Footy':data.catalog.gem.find(g=>g.id===pack.currency)?.name||pack.currency}`;}
 function odds(pack){
  const d=el('dialog','pack-odds-dialog'),header=el('header','pack-shop-header');header.append(el('h2','','Card Pack Odds'),button('Close',()=>d.close()));
  const layout=el('div','pack-odds-layout'),side=el('aside','pack-odds-side'),art=el('div','pack-shop-art');art.append(cover(pack));side.append(art,el('strong','pack-odds-price',price(pack)));
  const main=el('section','pack-odds-main'),tabs=el('div','pack-odds-tabs'),strip=el('div','pack-odds-strip');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Reward card');strip.setAttribute('role','tabpanel');strip.id='packOddsPanel';
  function select(index){tabs.querySelectorAll('button').forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});const card=pack.cards[index];strip.setAttribute('aria-label',`Card ${index+1}: ${card.title}`);strip.replaceChildren();
   strip.scrollLeft=0;
   for(const option of [...card.options].sort((a,b)=>Number(b.kind==='brawlToken')-Number(a.kind==='brawlToken')||a.chance-b.chance)){const item=data.catalog[option.kind]?.find(i=>i.id===option.id),label=option.kind==='footy'?'Footy':item?.name||option.id;
    const tile=el('div','pack-odds-tile'),frame=el('div','pack-odds-card');frame.append(window.RewardOpening.card({...option,amount:option.min===option.max?option.min:`${option.min}–${option.max}`,label,rarity:item?.rarity,members:item?.members,gemKey:item?.gemKey,packName:option.kind==='pack'?item?.name:undefined,appearance:item?.appearance,packColor:item?.color}));
    tile.append(frame,el('strong','pack-odds-percent',`${CurrencyFormat.percent(option.chance)}`));strip.append(tile);
   }
  }
  pack.cards.forEach((card,i)=>{const tab=button(`Card ${i+1}`,()=>select(i));tab.setAttribute('role','tab');tab.setAttribute('aria-controls',strip.id);tab.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(i+1)%pack.cards.length;else if(e.key==='ArrowLeft')next=(i+pack.cards.length-1)%pack.cards.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=pack.cards.length-1;else return;e.preventDefault();select(next);tabs.querySelectorAll('button')[next].focus();};tabs.append(tab);});
  main.append(tabs,strip,el('p','pack-odds-note','Each card awards one of the shown rewards. Amounts within a shown range are equally likely. Collection-card odds exclude optional compasses and personal amulet bonuses.'));
  layout.append(side,main);d.append(header,layout);document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});select(Math.max(0,pack.cards.length-1));d.showModal();
 }
 async function buy(pack){if(busy)return;busy=true;const message=shop.querySelector('.pack-shop-status');message.textContent='Buying pack…';renderButtons();const key=`pack-shop-pending:${currentUserId}:${pack.id}`;let requestId=localStorage.getItem(key);if(!requestId){requestId=crypto.randomUUID();localStorage.setItem(key,requestId);}
  try{const receipt=await request('/pack-shop/buy',{packId:pack.id,price:pack.price,currency:pack.currency,requestId});localStorage.removeItem(key);message.textContent=pack.name+' added to your inventory.';shop.close();await openPack(receipt.itemId,null,{id:receipt.itemId,packId:receipt.packId,name:receipt.name,packColor:receipt.packColor});}
  catch(error){message.textContent=error.message;try{const fresh=await request('/pack-shop'),offer=fresh.packs.find(p=>p.id===pack.id);if(offer)Object.assign(pack,offer);data.serverNow=fresh.serverNow;data.loadedAt=Date.now();}catch{}}finally{busy=false;renderButtons();}
 }
 function renderButtons(){
  if(!shop?.open||!data)return;const now=Date.now()+data.serverNow-data.loadedAt;
  shop.querySelectorAll('.pack-shop-buy').forEach(b=>{const p=b._pack,left=Math.max(0,(p.nextAt||0)-now),minutes=Math.ceil(left/60000),countdown=`${Math.floor(minutes/60)}h ${minutes%60}m`,unavailable=p.daily&&!p.enabled;
   b.disabled=busy||unavailable||left>0;
   b.textContent=unavailable?'Unavailable':left?(p.daily?'Free - ':'Unlocks in ')+countdown:price(p);
   b.setAttribute('aria-label',unavailable?'Daily pack unavailable':left?`${p.name} ready in ${countdown}`:p.daily?'Claim free daily pack':`Buy and open ${p.name} for ${price(p)}`);
  });
 }

 async function open(){if(busy||loading&&shop?.open)return;const sequence=++loadSequence;clearInterval(timer);loadController?.abort();loadController=new AbortController();loading=true;if(!shop){shop=el('dialog','pack-shop-dialog');shop.setAttribute('aria-label','Pack shop');document.body.append(shop);shop.addEventListener('close',()=>{if(shop.open)return;clearInterval(timer);loadSequence++;loading=false;loadController?.abort();});shop.addEventListener('cancel',event=>{if(busy)event.preventDefault();});}
  shop.replaceChildren();const header=el('header','pack-shop-header');header.append(el('h2','','Pack shop'),button('Close',()=>{if(!busy)shop.close();}));const status=el('p','pack-shop-status','Loading packs…');status.setAttribute('role','status');shop.append(header,status);if(!shop.open)shop.showModal();
  try{const loaded=await request('/pack-shop',undefined,loadController.signal);await window.CardDisplayNames?.load();if(sequence!==loadSequence||!shop.open)return;data=loaded;data.loadedAt=Date.now();status.textContent='Choose a pack, or tap i to see every card’s chances.';const grid=el('div','pack-shop-grid');
   for(const pack of [data.daily,...data.packs]){const tile=el('article','pack-shop-tile'),art=el('div','pack-shop-art');art.append(cover(pack));const info=button('i',()=>odds(pack),'pack-shop-info');info.setAttribute('aria-label',`View ${pack.name} card chances`);const buyButton=button(price(pack),()=>{if(pack.daily){shop.close();window.FreePack.open();}else buy(pack);},'pack-shop-buy');buyButton._pack=pack;buyButton.setAttribute('aria-label',pack.daily?'Claim free daily pack':`Buy and open ${pack.name} for ${price(pack)}`);tile.append(art,info,el('h3','',pack.name),buyButton);grid.append(tile);}
   shop.append(grid);if(data.canEdit)shop.append(button('Edit daily pack',()=>window.FreePack.details()),el('p','pack-shop-admin-note','Set regular pack prices, purchase cooldowns and visibility in Admin → Pack Builder.'));renderButtons();clearInterval(timer);timer=setInterval(renderButtons,1000);
  }catch(error){if(sequence!==loadSequence||!shop.open)return;status.textContent=error.message;shop.append(button('Retry',open));}finally{if(sequence===loadSequence)loading=false;}
 }
 window.PackShop={open};
})();
