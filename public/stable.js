/* Each owned creature has its own stall. Only the selected resident mounts a live model. */
(() => {
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 let dialog,sequence=0,onExit,selectedId;
 async function load(){
  const version=++sequence,content=dialog.querySelector('.stable-content');content.replaceChildren(el('p','stable-empty','Opening the stable…'));
  try{
   const response=await fetch(API_URL+'/stable',{headers:resourceHeaders()});if(!response.ok)throw Error(await response.text());const data=await response.json();if(version!==sequence||!dialog.open)return;
   // Also accept older cached API responses containing species totals.
   const residents=data.animals.flatMap(a=>a.instanceId?[a]:Array.from({length:a.count||1},(_,ordinal)=>({...a,count:1,ordinal,instanceId:a.id+':'+ordinal})));
   content.replaceChildren();
   const toolbar=el('div','stable-toolbar'),total=el('span','stable-total',`${residents.length} residents · ${new Set(residents.map(a=>a.id)).size} species`),search=el('input','stable-search'),sort=el('select','stable-sort');
   total.setAttribute('role','status');search.type='search';search.placeholder='Search name or species';search.setAttribute('aria-label','Search stable residents');sort.setAttribute('aria-label','Sort stable residents');
   for(const [value,label] of [['species','Sort: species'],['name','Sort: name'],['stall','Sort: stall number']]){const option=el('option','',label);option.value=value;sort.append(option);}toolbar.append(total,search,sort);
   const layout=el('div','stable-layout'),details=el('aside','stable-details'),stage=el('section','stable-stage'),roster=el('nav','stable-roster');roster.setAttribute('aria-label','Stable residents');layout.append(details,stage,roster);content.append(toolbar,layout);
   const footer=el('div','stable-footer'),previous=el('button','stable-arrow','‹'),position=el('span','stable-position'),next=el('button','stable-arrow','›');previous.type=next.type='button';previous.setAttribute('aria-label','Previous animal');next.setAttribute('aria-label','Next animal');position.setAttribute('aria-live','polite');footer.append(previous,position,next,el('span','stable-rotate-hint','Drag to look around · Every creature has a home'));content.append(footer);
   let visible=[];
   function render(){
    visible=residents.filter(a=>(a.name+' '+a.species+' '+(a.ordinal+1)).toLowerCase().includes(search.value.toLowerCase().trim())).sort((a,b)=>sort.value==='stall'?a.ordinal-b.ordinal||a.name.localeCompare(b.name):(sort.value==='name'?a.name.localeCompare(b.name):a.species.localeCompare(b.species))||a.ordinal-b.ordinal);
    if(!visible.some(a=>a.instanceId===selectedId))selectedId=visible[0]?.instanceId;
    const animal=visible.find(a=>a.instanceId===selectedId);details.replaceChildren();stage.replaceChildren();roster.replaceChildren();
    previous.disabled=next.disabled=visible.length<2;position.textContent=animal?`${visible.indexOf(animal)+1} / ${visible.length}`:'0 / 0';
    if(!animal){stage.append(el('p','stable-empty',residents.length?'No residents match your search.':'Your stable awaits its first resident. Collect creatures from packs to fill these stalls.'));return;}
    const label=`${animal.name} ? ${animal.species}`;
    const heading=el('div','stable-name-heading'),edit=el('button','stable-edit-name','Edit name');edit.type='button';edit.setAttribute('aria-label','Edit creature name');edit.onclick=()=>rename(animal,render);heading.append(el('h2','',animal.name),edit);
    details.append(el('span','stable-eyebrow','RESIDENT DOSSIER'),heading,el('p','stable-species',animal.species));

    const info=el('button','stable-info','Creature information');info.type='button';info.onclick=()=>window.CreatureBook?.openCreature(animal.id);details.append(info);if(animal.growth&&window.CreatureFeeding)details.append(CreatureFeeding.create(animal,data.foods,{tokens:data.tokens||{},onChange:r=>{if(r.foods)data.foods=r.foods;if(r.tokens)data.tokens=r.tokens;}}));
    stage.append(el('span','stable-stage-label','THE GREAT STABLE'),el('div','stable-lantern stable-lantern-left'),el('div','stable-lantern stable-lantern-right'));
    const stall=el('article','stable-animal'),host=el('span','companion-illustration companion-3d-art stable-model'),picture=el('img','fox-model-poster');host.setAttribute('aria-busy','true');host.dataset.species=animal.id;host.setAttribute('data-'+animal.id+'-3d','');host.dataset.viewYaw='0';host.setAttribute('aria-label',label+' rotatable 3D model');picture.src=animal.poster;picture.alt=animal.name;host.append(picture);
    let angle=0,drag;
    function turn(degrees){angle=((degrees%360)+360)%360;const yaw=angle*Math.PI/180;host.dataset.viewYaw=String(yaw);window.companion3D?.setYaw?.(host,yaw);}
    host.onpointerdown=e=>{if(e.button!==0)return;drag={x:e.clientX,angle};host.setPointerCapture?.(e.pointerId);};host.onpointermove=e=>{if(drag)turn(drag.angle+(e.clientX-drag.x)*.65);};host.onpointerup=host.onpointercancel=()=>{drag=null;};
    stall.append(host,el('h3','',animal.name),el('p','',animal.species));stage.append(stall);
    for(const resident of visible){const card=el('button','stable-resident'+(resident.instanceId===selectedId?' is-selected':'')),image=el('img');card.type='button';card.dataset.instanceId=resident.instanceId;card.setAttribute('aria-pressed',String(resident.instanceId===selectedId));card.setAttribute('aria-label',`${resident.name}, ${resident.species}`);image.src=resident.poster;image.alt='';image.loading='lazy';card.append(image,el('strong','',resident.name),el('small','',resident.species+(resident.growth?' / Lv '+resident.growth.level:'')));card.onclick=()=>{selectedId=resident.instanceId;render();};roster.append(card);}
   }
   search.oninput=render;sort.onchange=render;function step(direction){const index=visible.findIndex(a=>a.instanceId===selectedId);selectedId=visible[(index+direction+visible.length)%visible.length]?.instanceId;render();roster.querySelector('.is-selected')?.scrollIntoView({block:'nearest',inline:'nearest'});}previous.onclick=()=>step(-1);next.onclick=()=>step(1);render();
   if(!window.companion3D)import('./companion-3d.js?v=stable-stage3').catch(error=>console.warn('Stable 3D:',error));
  }catch(error){if(version!==sequence||!dialog.open)return;const retry=el('button','','Try again');retry.onclick=load;content.replaceChildren(el('p','stable-error',error.message),retry);}
 }
 function rename(animal,render){
  const modal=el('dialog','stable-name-dialog'),form=el('form'),title=el('h2','','Name your creature'),label=el('label','','Creature name'),input=el('input'),help=el('p','','Leave blank to restore its original name.'),status=el('p'),actions=el('div','stable-name-actions'),cancel=el('button','','Cancel'),save=el('button','','Save name');
  title.id='stableRenameTitle';modal.setAttribute('aria-labelledby',title.id);input.id='stableResidentName';label.htmlFor=input.id;input.value=animal.name;input.maxLength=32;input.autocomplete='off';status.setAttribute('role','status');cancel.type='button';save.type='submit';cancel.onclick=()=>modal.close();actions.append(cancel,save);form.append(title,label,input,help,status,actions);modal.append(form);document.body.append(modal);
  let saving=false;modal.addEventListener('cancel',e=>{if(saving)e.preventDefault();});modal.addEventListener('close',()=>modal.remove());
  form.onsubmit=async e=>{e.preventDefault();if(saving)return;saving=true;save.disabled=cancel.disabled=input.disabled=true;status.textContent='Saving...';try{const response=await fetch(API_URL+'/stable/name',{method:'POST',headers:resourceHeaders(),body:JSON.stringify({instanceId:animal.instanceId,name:input.value}),signal:AbortSignal.timeout(15000)});if(!response.ok){const text=await response.text();throw Error(response.status===404?'Creature naming is not loaded on this server. Restart the game server with the latest code, then try again.':/<(?:!doctype|html|head|body)\b/i.test(text)?'The server could not save this name. Please try again.':text||'Could not save this name. Please try again.');}const result=await response.json();animal.name=result.animal.name;modal.close();if(dialog.open)render();}catch(error){status.textContent=error.message;}finally{saving=false;save.disabled=cancel.disabled=input.disabled=false;}};
  modal.showModal();input.focus();input.select();
 }
 async function open(back){onExit=back;if(!dialog){dialog=el('dialog','stable-dialog');dialog.id='stableDialog';dialog.setAttribute('aria-labelledby','stableTitle');const header=el('header','stable-header'),titles=el('div'),title=el('h1','','The Stable');title.id='stableTitle';titles.append(el('span','stable-eyebrow','YOUR CREATURE SANCTUARY'),title);const exit=el('button','','Return to island');exit.type='button';exit.onclick=()=>dialog.close();header.append(el('span','stable-emblem','✦'),titles,exit);dialog.append(header,el('div','stable-content'));document.body.append(dialog);dialog.addEventListener('close',()=>{sequence++;dialog.querySelector('.stable-content').replaceChildren();onExit?.();});}if(!dialog.open)dialog.showModal();await load();
 }
 window.addEventListener('free-pack-claimed',()=>{if(dialog?.open)load();});window.Stable={open};
})();
