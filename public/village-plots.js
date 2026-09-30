/* Plot editor and residents reuse the island camera and existing building routes. */
(() => {
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text)n.textContent=text;return n;};
 window.VillagePlots=function({world,toolbar,buildings,tiles,getData,changed}){
  let draft=null,chosen=null,saving=false,residentSignature='',baseRevision=0;const plots=new Map(),houses=new Map();
  const layer=el('div','village-land-plots');world.prepend(layer);
  const residents=el('div','village-residents');world.append(residents);
  const panel=el('section','village-planning');panel.hidden=true;panel.setAttribute('aria-label','Arrange your village');toolbar.parentNode.append(panel);
  const select=el('select');select.setAttribute('aria-label','Building to place');const hint=el('p');hint.setAttribute('role','status');
  const edit=el('button','village-secondary','Arrange village');toolbar.append(edit);
  const save=el('button','village-primary','Save layout'),cancel=el('button','village-secondary','Cancel'),remove=el('button','village-secondary','Remove house');
  panel.append(select,save,cancel,remove,hint);
  const layout=()=>getData().layout||VillageLayout.profile({});
  const positions=()=>draft||layout().positions;
  function message(text){hint.textContent=text;}
  function choose(id){chosen=id;select.value=id;remove.hidden=!VillageLayout.house(id||'');message(id==='new-house'?'Choose an empty plot. Each house welcomes three villagers.':'Choose a plot to move here. Occupied buildings swap places.');}
  select.onchange=()=>choose(select.value);
  function options(){select.replaceChildren(new Option('Choose a building',''));for(const b of buildings.filter(b=>b.level<=getData().level))select.append(new Option(b.name,b.id));for(const id of Object.keys(positions()).filter(VillageLayout.house))select.append(new Option('Villager house '+(Number(id.split(':')[1])+1),id));select.append(new Option('Build villager house (+3 residents)','new-house'));select.value=chosen||'';}
  function place(plot){if(!draft||saving)return;const occupied=Object.keys(draft).find(id=>draft[id]===plot);if(!chosen){if(occupied&&(!Object.hasOwn(VillageLayout.LEVELS,occupied)||VillageLayout.LEVELS[occupied]<=getData().level))choose(occupied);else message('Choose a building or a new house first.');return;}
   if(occupied&&Object.hasOwn(VillageLayout.LEVELS,occupied)&&VillageLayout.LEVELS[occupied]>getData().level){message('This plot is reserved for a future Town Hall unlock.');return;}
   if(chosen==='new-house'){if(occupied){message('Houses need an empty plot.');return;}const id=Array.from({length:11},(_,i)=>'house:'+i).find(id=>!(id in draft));if(!id){message('All eleven house plots are in use.');return;}draft[id]=plot;chosen=id;}
   else if(chosen in draft){const old=draft[chosen];draft[chosen]=plot;if(occupied&&occupied!==chosen)draft[occupied]=old;}
   options();choose(chosen);paint();
  }
  for(const p of VillageLayout.PLOTS){const button=el('button','village-land-plot');button.type='button';button.style.left=p.x+'px';button.style.top=p.y+'px';button.setAttribute('aria-label','Land plot '+(p.id+1));button.onclick=()=>place(p.id);layer.append(button);plots.set(p.id,button);}
  edit.onclick=()=>{draft={...layout().positions};baseRevision=layout().revision;chosen=null;panel.hidden=false;edit.hidden=true;world.classList.add('village-arranging');options();choose(null);paint();};
  function finish(){draft=null;chosen=null;panel.hidden=true;edit.hidden=false;world.classList.remove('village-arranging');paint();}
  cancel.onclick=()=>{if(!saving)finish();};remove.onclick=()=>{if(saving||!VillageLayout.house(chosen||''))return;delete draft[chosen];chosen=null;options();choose(null);paint();};
  save.onclick=async()=>{if(saving)return;saving=true;save.disabled=cancel.disabled=select.disabled=remove.disabled=true;message('Saving your village...');try{const response=await fetch(API_URL+'/village/layout',{method:'POST',headers:resourceHeaders(),body:JSON.stringify({positions:draft,revision:baseRevision})});if(!response.ok)throw Error(await response.text());getData().layout=await response.json();finish();changed();}catch(e){message(e.message+' Your preview is still here; cancel and reopen to reload if needed.');}finally{saving=false;save.disabled=cancel.disabled=select.disabled=remove.disabled=false;}};
  function residentArt(i){return HallArt.avatar(HallWorld.character({coat:HallWorld.COATS[i%5],hair:HallWorld.HAIR[i%4],skin:HallWorld.SKINS[i%4],style:HallWorld.STYLES[i%6]}));}
  function paintResidents(){const homes=Object.keys(positions()).filter(VillageLayout.house).sort(),signature=JSON.stringify(homes.map(id=>[id,positions()[id]]));if(signature===residentSignature)return;residentSignature=signature;residents.replaceChildren();
   homes.forEach((id,houseIndex)=>{const plot=VillageLayout.PLOTS[positions()[id]];for(let j=0;j<3;j++){const i=Number(id.split(':')[1])*3+j,n=el('button','island-villager');n.type='button';n.style.left=(plot.x-46+j*38)+'px';n.style.top=(plot.y+28)+'px';n.style.zIndex=Math.round(plot.y+40);n.style.setProperty('--walk',`${j%2?-45:48}px`);n.style.setProperty('--duration',`${9+j*3+houseIndex%4}s`);n.style.animationDelay=`-${i%7}s`;n.innerHTML=residentArt(i);const name=['Rowan','Pip','Wren','Fern','Ash','Milo','Ivy','Otis','Luna'][i%9]+' '+(Math.floor(i/9)+1);n.setAttribute('aria-label','Talk to '+name);n.onclick=e=>{e.stopPropagation();world.querySelector('.villager-greeting')?.remove();const bubble=el('div','villager-greeting',name+': '+['Lovely day on our island!','I saved you a seat in the Town Hall.','What shall we build next?','Those gems at the forge really sparkle.','A good home and good neighbours.'][Math.floor(Math.random()*5)]);bubble.style.left=plot.x+'px';bubble.style.top=(plot.y-80)+'px';world.append(bubble);setTimeout(()=>bubble.remove(),4000);};residents.append(n);}});
  }
  function paint(){const pos=positions();for(const b of buildings){const p=VillageLayout.PLOTS[pos[b.id]];if(p){b.x=p.x;b.y=p.y;const tile=tiles.get(b.id);tile.style.left=p.x+'px';tile.style.top=p.y+'px';tile.style.zIndex=Math.round(p.y);}}
   for(const [id,node] of houses)if(!(id in pos)){node.remove();houses.delete(id);}
   for(const id of Object.keys(pos).filter(VillageLayout.house)){let node=houses.get(id);if(!node){node=el('button','village-building village-house');node.innerHTML=VillageArt.house();node.type='button';node.setAttribute('aria-label','Villager house, three residents');node.onclick=()=>{if(draft){if(chosen&&chosen!==id)place(draft[id]);else choose(id);return;}world.querySelector('.villager-greeting')?.remove();const note=el('div','villager-greeting','Three villagers call this house home. Tap a resident to say hello.');const p=VillageLayout.PLOTS[positions()[id]];note.style.left=p.x+'px';note.style.top=(p.y-90)+'px';world.append(note);setTimeout(()=>note.remove(),4000);};world.append(node);houses.set(id,node);}const p=VillageLayout.PLOTS[pos[id]];node.style.left=p.x+'px';node.style.top=p.y+'px';node.style.zIndex=Math.round(p.y);}
   for(const [id,node] of plots){const occupant=Object.keys(pos).find(key=>pos[key]===id);node.disabled=!draft||saving;node.classList.toggle('reserved',!!occupant&&Object.hasOwn(VillageLayout.LEVELS,occupant)&&VillageLayout.LEVELS[occupant]>getData().level);node.classList.toggle('occupied',!!occupant);node.setAttribute('aria-label','Land plot '+(id+1)+(occupant?', '+(buildings.find(b=>b.id===occupant)?.name||'Villager house'):', empty'));}
   paintResidents();
  }
  return {paint,select:b=>{if(!draft)return false;if(chosen&&chosen!==b.id)place(draft[b.id]);else choose(b.id);return true;},get editing(){return !!draft;}};
 };
})();
