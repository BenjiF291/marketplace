/* Stored creatures use lightweight posters; detailed animation stays in the book. */
(() => {
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 let dialog,sequence=0,onExit;
 async function load(){const version=++sequence,content=dialog.querySelector('.stable-content');content.replaceChildren(el('p','stable-empty','Opening the Stable...'));
  try{const response=await fetch(API_URL+'/stable',{headers:resourceHeaders()});if(!response.ok)throw Error(await response.text());const data=await response.json();if(version!==sequence||!dialog.open)return;
   content.replaceChildren();const total=el('p','stable-total',`${data.total} animal${data.total===1?'':'s'} in your Stable`);total.setAttribute('role','status');content.append(total);
   if(!data.animals.length){content.append(el('div','stable-empty','Your stalls are ready. Animals awarded from free packs will appear here. The snail, Ember Fox and Pocket Dragon stay in the Companion lodge.'));return;}
   const grid=el('div','stable-grid');for(const animal of data.animals){const card=el('article','stable-animal'),picture=el('img');picture.src=animal.poster;picture.alt=animal.name;picture.loading='lazy';const title=el('h3','',animal.name),species=el('p','',animal.name===animal.species?'':animal.species),count=el('span','stable-count',`x${animal.count}`),info=el('button','', 'Creature information');info.type='button';info.onclick=()=>CreatureBook.openCreature(animal.id);card.append(picture,count,title,species,info);grid.append(card);}content.append(grid);
  }catch(error){if(version!==sequence||!dialog.open)return;const retry=el('button','','Try again');retry.onclick=load;content.replaceChildren(el('p','stable-error',error.message),retry);}
 }
 async function open(back){onExit=back;if(!dialog){dialog=el('dialog','stable-dialog');dialog.id='stableDialog';dialog.setAttribute('aria-labelledby','stableTitle');const header=el('header','stable-header'),title=el('h1','','The Stable');title.id='stableTitle';const exit=el('button','','Return to island');exit.type='button';exit.onclick=()=>dialog.close();header.append(el('span','stable-emblem','\u2302'),title,exit);dialog.append(header,el('p','stable-intro','A quiet home for your collected creatures.'),el('div','stable-content'));document.body.append(dialog);dialog.addEventListener('close',()=>{sequence++;onExit?.();});}
  if(!dialog.open)dialog.showModal();await load();
 }
 window.addEventListener('free-pack-claimed',()=>{if(dialog?.open)load();});window.Stable={open};
})();
