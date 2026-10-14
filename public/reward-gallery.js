/* Admin inspection uses the exact same card renderer as real openings. */
(() => {
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 const button=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;};let gallery;
 window.RewardGallery={open(catalog){
  gallery?.close();const previous=document.activeElement,groups=RewardCardArt.samples(catalog),all=groups.flatMap(g=>g.rewards),d=el('dialog','reward-gallery');gallery=d;d.setAttribute('aria-labelledby','rewardGalleryTitle');
  const header=el('header','reward-gallery-header'),title=el('h2','','All reward cards');title.id='rewardGalleryTitle';header.append(title,button('Close',()=>d.close()));
  const intro=el('p','reward-gallery-intro',`${all.length} cards. Grouped by category, then A-Z. One example amount per reward. Previews do not award items.`),nav=el('nav','reward-gallery-nav');nav.setAttribute('aria-label','Reward categories');
  const search=el('input','reward-gallery-search');search.type='search';search.placeholder='Find a reward...';search.setAttribute('aria-label','Find a reward card');
  const content=el('div','reward-gallery-content');d.append(header,intro,search,nav,content);const sections=[];
  function inspect(index){const viewer=el('dialog','reward-card-inspector');viewer.setAttribute('aria-label','Reward card preview');let at=index;const frame=el('div','reward-gallery-full-frame'),name=el('h2'),counter=el('p'),controls=el('div','reward-inspector-controls');
   const prev=button('Previous',()=>show(at-1),'reward-inspector-prev'),next=button('Next',()=>show(at+1),'reward-inspector-next');controls.append(prev,button('Back to gallery',()=>viewer.close()),next);viewer.append(name,counter,frame,controls);
   function show(value){at=value;const reward=all[at];frame.replaceChildren(window.RewardOpening.card(reward));name.textContent=RewardCardArt.describe(reward).name;counter.textContent=`${at+1} / ${all.length}`;prev.disabled=at===0;next.disabled=at===all.length-1;}
   viewer.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'&&at>0){event.preventDefault();show(at-1);}if(event.key==='ArrowRight'&&at<all.length-1){event.preventDefault();show(at+1);}});viewer.addEventListener('close',()=>{viewer.remove();search.focus();},{once:true});document.body.append(viewer);show(index);viewer.showModal();
  }
  let offset=0;
  for(const group of groups){const section=el('section','reward-gallery-section'),heading=el('h3','',`${group.title} (${group.rewards.length})`),grid=el('div','reward-gallery-grid'),items=[];
   nav.append(button(group.title,()=>section.scrollIntoView({block:'start',behavior:'instant'})));section.append(heading,grid);content.append(section);
   group.rewards.forEach((reward,i)=>{const index=offset+i,tile=el('div','reward-gallery-tile'),frame=el('div','reward-gallery-card-frame');frame.append(window.RewardOpening.card(reward));const inspectButton=button('View full size',()=>inspect(index));inspectButton.setAttribute('aria-label','Preview '+RewardCardArt.describe(reward).name+' full size');tile.append(frame,inspectButton);grid.append(tile);items.push({tile,name:RewardCardArt.describe(reward).name.toLowerCase()});});offset+=group.rewards.length;sections.push({section,items});
  }
  const empty=el('p','reward-gallery-empty','No matching reward cards.');empty.hidden=true;content.append(empty);
  search.oninput=()=>{let found=0;const query=search.value.trim().toLowerCase();for(const {section,items} of sections){let count=0;for(const item of items){item.tile.hidden=!item.name.includes(query);if(!item.tile.hidden)count++;}section.hidden=count===0;found+=count;}empty.hidden=found>0;};
  d.addEventListener('close',()=>{d.remove();if(gallery===d)gallery=null;if(previous?.isConnected)previous.focus();},{once:true});document.body.append(d);d.showModal();search.focus();return d;
 }};
})();
