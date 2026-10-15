/* One active 3D portrait on a stable display plinth; neighboring stalls use posters. */
(() => {
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 let dialog,sequence=0,onExit,selected=0;
 async function load(){const version=++sequence,content=dialog.querySelector('.stable-content');content.replaceChildren(el('p','stable-empty','Opening the Stable...'));
  try{const response=await fetch(API_URL+'/stable',{headers:resourceHeaders()});if(!response.ok)throw Error(await response.text());const data=await response.json();if(version!==sequence||!dialog.open)return;
   content.replaceChildren();const total=el('p','stable-total',`${data.total} animal${data.total===1?'':'s'} in your Stable`);total.setAttribute('role','status');content.append(total);
   if(!data.animals.length){content.append(el('div','stable-empty','Your stalls are ready. Animals awarded from free packs will appear here. The snail, Ember Fox and Pocket Dragon stay in the Companion lodge.'));return;}
   selected=Math.min(selected,data.animals.length-1);
   const carousel=el('div','stable-carousel'),previous=el('button','stable-arrow stable-previous','\u2039'),next=el('button','stable-arrow stable-next','\u203a'),stage=el('div','stable-stage'),position=el('p','stable-position');previous.type=next.type='button';previous.setAttribute('aria-label','Previous animal');next.setAttribute('aria-label','Next animal');position.setAttribute('aria-live','polite');
   function render(){stage.replaceChildren();const animal=data.animals[selected];
    for(const offset of [-1,0,1]){const index=(selected+offset+data.animals.length)%data.animals.length;if(offset&&data.animals.length===1)continue;const entry=data.animals[index],stall=el('article',offset?'stable-neighbor stable-neighbor-'+(offset<0?'left':'right'):'stable-animal'),plinth=el('div','stable-platform');
     const picture=el('img');picture.src=entry.poster;picture.alt=entry.name;picture.className='fox-model-poster';
     if(offset){stall.append(picture,plinth,el('span','',entry.name));stage.append(stall);continue;}
     const host=el('span','companion-illustration companion-3d-art stable-model');host.dataset.species=animal.id;host.setAttribute('data-'+animal.id+'-3d','');host.dataset.viewYaw='0';host.setAttribute('aria-label',animal.name+' rotatable 3D model');host.append(picture);
     const rotation=el('input','stable-rotation');rotation.type='range';rotation.min='0';rotation.max='360';rotation.step='1';rotation.value='0';rotation.setAttribute('aria-label','Rotate '+animal.name);
     function turn(degrees){degrees=((degrees%360)+360)%360;rotation.value=String(Math.round(degrees));host.dataset.viewYaw=String(degrees*Math.PI/180);window.companion3D?.setYaw?.(host,degrees*Math.PI/180);}
     rotation.oninput=()=>turn(Number(rotation.value));let drag;
     host.onpointerdown=e=>{if(e.button!==0)return;drag={x:e.clientX,angle:Number(rotation.value)};host.setPointerCapture?.(e.pointerId);};host.onpointermove=e=>{if(drag)turn(drag.angle+(e.clientX-drag.x)*.65);};host.onpointerup=host.onpointercancel=()=>{drag=null;};
     const controls=el('div','stable-turn-controls'),left=el('button','','Rotate left'),right=el('button','','Rotate right');left.type=right.type='button';left.onclick=()=>turn(Number(rotation.value)-30);right.onclick=()=>turn(Number(rotation.value)+30);controls.append(left,rotation,right);
     const info=el('button','','Creature information');info.type='button';info.onclick=()=>CreatureBook.openCreature(animal.id);
     stall.append(host,plinth,el('span','stable-count','x'+animal.count),el('h3','',animal.name),el('p','',animal.name===animal.species?'':animal.species),info,controls);stage.append(stall);
    }
    position.textContent=(selected+1)+' / '+data.animals.length;previous.disabled=next.disabled=data.animals.length<2;
   }
   previous.onclick=()=>{selected=(selected-1+data.animals.length)%data.animals.length;render();};next.onclick=()=>{selected=(selected+1)%data.animals.length;render();};carousel.append(previous,stage,next);content.append(carousel,position,el('p','stable-rotate-hint','Drag the creature, use the slider, or tap Rotate to see every side.'));render();
   if(!window.companion3D)import('./companion-3d.js?v=stable-rotate2').catch(error=>console.warn('Stable 3D:',error));

  }catch(error){if(version!==sequence||!dialog.open)return;const retry=el('button','','Try again');retry.onclick=load;content.replaceChildren(el('p','stable-error',error.message),retry);}
 }
 async function open(back){onExit=back;if(!dialog){dialog=el('dialog','stable-dialog');dialog.id='stableDialog';dialog.setAttribute('aria-labelledby','stableTitle');const header=el('header','stable-header'),title=el('h1','','The Stable');title.id='stableTitle';const exit=el('button','','Return to island');exit.type='button';exit.onclick=()=>dialog.close();header.append(el('span','stable-emblem','\u2302'),title,exit);dialog.append(header,el('p','stable-intro','A quiet home for your collected creatures.'),el('div','stable-content'));document.body.append(dialog);dialog.addEventListener('close',()=>{sequence++;dialog.querySelector('.stable-content').replaceChildren();onExit?.();});}
  if(!dialog.open)dialog.showModal();await load();
 }
 window.addEventListener('free-pack-claimed',()=>{if(dialog?.open)load();});window.Stable={open};
})();
