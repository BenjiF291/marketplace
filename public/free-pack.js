(() => {
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 const pendingKey=()=>`free-pack-pending:${currentUserId}`;
 let dialog,state,receipt,clock;
 async function request(url,method='GET',body){const response=await fetch(API_URL+url,{method,headers:resourceHeaders(),...(body?{body:JSON.stringify(body)}:{})});if(!response.ok)throw Error(await response.text());return response.json();}
 function button(text,fn){const b=el('button','free-pack-button',text);b.type='button';b.onclick=fn;return b;}
 function remaining(){if(state?.canEdit)return 0;return Math.max(0,(state?.nextAt||0)-(Date.now()+(state?.offset||0)));}
 function tick(){const status=dialog?.querySelector('.free-pack-countdown'),left=remaining(),hours=Math.floor(left/3600000),minutes=Math.floor(left%3600000/60000),seconds=Math.floor(left%60000/1000);if(status)status.textContent=state?.canEdit?'Admin testing: unlimited free packs.':left?`Next pack in ${hours}h ${minutes}m ${seconds}s`:'Your free pack is ready.';const claim=dialog?.querySelector('.free-pack-claim');if(claim&&!claim.dataset.busy)claim.disabled=!state?.config.enabled||left>0;const launch=document.getElementById('freePackLauncher');if(launch){launch.dataset.ready=String(!!state?.config.enabled&&!left);launch.title=left?`Daily pack: ${hours}h ${minutes}m remaining`:'Free daily pack ready';}}
 function reveal(result){receipt=result;dialog?.close();return window.RewardOpening.play({name:result.name,result});}
 function startOpening(){dialog?.close();return window.RewardOpening.play({name:state.config.name,open:claimRewards,onDetails:details,onPreview:state.canEdit?previewCards:null});}
 async function open(){try{const data=await load();if(data.canClaim&&data.config.enabled)startOpening();else await details();}catch{await details();}}
 async function load(){const data=await request('/free-pack');state={...data,offset:data.serverNow-Date.now()};if(dialog?.open){dialog.querySelector('h2').textContent=data.config.name;dialog.querySelector('.free-pack-edit').hidden=!data.canEdit;dialog.querySelector('.free-pack-preview').hidden=!data.canEdit;dialog.querySelector('.free-pack-description').textContent=`Five reward cards, free every ${data.config.cooldownHours} hours.`;renderOdds();if(!data.config.enabled)dialog.querySelector('.free-pack-message').textContent='This pack is currently paused.';const pending=localStorage.getItem(pendingKey());if(data.lastClaim&&data.lastClaim.requestId===pending){localStorage.removeItem(pendingKey());reveal(data.lastClaim);}}
  tick();return data;
 }
 function renderOdds(){const box=dialog.querySelector('.free-pack-odds');box.replaceChildren();box.append(el('summary','','View reward chances'));state.config.cards.forEach((card,i)=>{const section=el('section');section.append(el('h3','',`Card ${i+1}: ${card.title}`));card.options.forEach(o=>section.append(el('p','',`${o.chance}% - ${o.min===o.max?o.min:o.min+'-'+o.max} ${o.kind==='footy'?'Footy':(window.StableAnimals?.animals.find(a=>a.id===o.id)?.name)||({bronze:'Rubies','rare-bronze':'Garnet',skip:'Skip',leap:'Leap'})[o.id]||o.id}`)));box.append(section);});}
 async function claimRewards(){let requestId=localStorage.getItem(pendingKey());if(!requestId){requestId=crypto.randomUUID();localStorage.setItem(pendingKey(),requestId);}
  const result=await request('/free-pack/claim','POST',{requestId});localStorage.removeItem(pendingKey());state.nextAt=result.nextAt;receipt=result;tick();window.dispatchEvent(new Event('free-pack-claimed'));loadUsers();loadInventory();load().catch(()=>{});return result;
 }
 function claim(){return startOpening();}
 async function details(){receipt=null;if(!dialog){dialog=el('dialog','free-pack-dialog');dialog.setAttribute('aria-label','Free daily pack');const header=el('header');header.append(el('h2','','Daily pack'),button('Close',()=>dialog.close()));const edit=button('Edit pack',editPack);edit.classList.add('free-pack-edit');edit.hidden=true;const preview=button('Preview all reward cards',previewCards);preview.classList.add('free-pack-preview');preview.hidden=true;const claimButton=button('Claim free pack',claim);claimButton.classList.add('free-pack-claim');claimButton.disabled=true;
   dialog.append(header,el('p','free-pack-description'),el('p','free-pack-countdown'),el('p','free-pack-message'),claimButton,edit,preview,el('div','free-pack-rewards'),el('details','free-pack-odds'));dialog.querySelector('.free-pack-message').setAttribute('role','status');document.body.append(dialog);dialog.addEventListener('close',()=>clearInterval(clock));}
  dialog.querySelector('.free-pack-rewards').replaceChildren();dialog.querySelector('.free-pack-claim').hidden=false;dialog.querySelector('.free-pack-message').textContent='Loading...';if(!dialog.open)dialog.showModal();clearInterval(clock);clock=setInterval(tick,1000);
  try{const data=await load();dialog.querySelector('.free-pack-message').textContent=data.config.enabled?'':'This pack is currently paused.';if(data.lastClaim&&!data.canClaim&&!receipt){const area=dialog.querySelector('.free-pack-rewards');area.append(button('View your last five rewards',()=>reveal(data.lastClaim)));}}catch(error){dialog.querySelector('.free-pack-message').textContent=error.message;}
 }
 async function previewCards(){try{const {catalog}=await request('/admin/free-pack');window.RewardGallery.open(catalog);}catch(error){await details();dialog.querySelector('.free-pack-message').textContent=error.message;}}
 async function editPack(){const message=dialog.querySelector('.free-pack-message');message.textContent='Loading editor...';try{const {config,catalog}=await request('/admin/free-pack');message.textContent='';editor(config,catalog);}catch(error){message.textContent=error.message;}}
 function editor(config,catalog){
  const box=el('dialog','free-pack-editor');box.setAttribute('aria-label','Edit daily pack');const form=el('form');form.append(el('h2','','Daily pack editor'),el('p','','Each card draws one reward. Its chances must total 100%. Amount ranges include both endpoints. Changes apply to future claims.'));
  const input=(value,type='text')=>{const n=el('input');n.type=type;n.value=value;if(type==='number'){n.min='0';n.step='any';}return n;};
  const field=(label,control)=>{const l=el('label','',label);l.append(control);return l;};
  const name=input(config.name),cooldown=input(config.cooldownHours,'number'),enabled=input('','checkbox');enabled.checked=config.enabled;
  form.append(field('Pack name',name),field('Hours between claims',cooldown),field('Pack enabled',enabled));
  const kinds={animal:'Animal',gem:'Gem currency',footy:'Footy',boost:'Time boost',rubyItem:'Shop item',amulet:'Amulet',pack:'Collection pack',card:'Collection card'};
  const readCards=[];
  config.cards.forEach((card,i)=>{const section=el('fieldset');section.append(el('legend','',`Reward card ${i+1}`));const title=input(card.title);section.append(field('Card title',title));const rows=el('div','free-pack-option-list'),total=el('p','free-pack-total');const entries=[];
   const sum=()=>{total.textContent=`Total chance: ${entries.reduce((n,r)=>n+Number(r.chance.value),0)}%`;};
   function add(option={kind:'gem',id:'bronze',min:1,max:1,chance:0}){const row=el('div','free-pack-option');const kind=el('select');Object.entries(kinds).forEach(([id,label])=>kind.append(new Option(label,id)));kind.value=option.kind;const id=el('select'),min=input(option.min,'number'),max=input(option.max,'number'),chance=input(option.chance,'number');
    function items(selected){id.replaceChildren();(catalog[kind.value]||[{id:'',name:'Footy'}]).forEach(entry=>id.append(new Option(entry.name,entry.id)));if(selected)id.value=selected;id.disabled=kind.value==='footy';}items(option.id);kind.onchange=()=>items();chance.oninput=sum;
    const entry={row,kind,id,min,max,chance};entries.push(entry);const remove=button('Remove',()=>{entries.splice(entries.indexOf(entry),1);row.remove();sum();});row.append(field('Reward type',kind),field('Item',id),field('Minimum',min),field('Maximum',max),field('Chance %',chance),remove);rows.append(row);sum();
   }
   card.options.forEach(add);section.append(rows,button('Add reward option',()=>add()),total);form.append(section);
   readCards.push(()=>({title:title.value,options:entries.map(r=>({kind:r.kind.value,id:r.id.value,min:Number(r.min.value),max:Number(r.max.value),chance:Number(r.chance.value)}))}));
  });
  const status=el('p');status.setAttribute('role','status');const save=el('button','free-pack-button','Save pack');save.type='submit';form.append(status,button('Cancel',()=>box.close()),save);box.append(form);document.body.append(box);box.addEventListener('close',()=>box.remove(),{once:true});box.showModal();
  form.onsubmit=async event=>{event.preventDefault();save.disabled=true;status.textContent='Saving?';try{await request('/admin/free-pack','PUT',{name:name.value,cooldownHours:Number(cooldown.value),enabled:enabled.checked,cards:readCards.map(read=>read())});box.close();await load();}catch(error){status.textContent=error.message;}finally{save.disabled=false;}};
 }
 window.FreePack={open};window.addEventListener('island-ready',()=>load().catch(()=>{}));window.addEventListener('focus',()=>load().catch(()=>{}));
 setInterval(()=>{if(!document.hidden)load().catch(()=>{});},60000);
})();
