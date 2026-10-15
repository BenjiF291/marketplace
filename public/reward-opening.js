/* A single click advances a single card. Rewards are settled before any reveal. */
(() => {
 let active;
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 function createCard(reward){const info=RewardCardArt.describe(reward),card=el('article','reward-pack-card');card.dataset.kind=reward.kind;card.style.setProperty('--depth',0);card.dataset.depth='0';
    const ornament=el('span','reward-card-ornament');ornament.setAttribute('aria-hidden','true');const amount=el('strong','reward-card-amount',String(info.amount)),picture=el('div','reward-card-picture');
    if(info.image&&info.imageFrame){const ns='http://www.w3.org/2000/svg',frame=info.imageFrame,svg=document.createElementNS(ns,'svg'),image=document.createElementNS(ns,'image');svg.setAttribute('viewBox',`${frame.x} ${frame.y} ${frame.width} ${frame.height}`);svg.setAttribute('preserveAspectRatio','xMidYMid meet');svg.setAttribute('role','img');svg.setAttribute('aria-label',info.name);image.setAttribute('href',info.image);image.setAttribute('width',frame.imageWidth);image.setAttribute('height',frame.imageHeight);image.onerror=()=>{picture.innerHTML=info.art;};svg.append(image);picture.append(svg);}
    else if(info.image){const image=el('img');image.loading='lazy';image.src=info.image;image.alt=info.name;image.onerror=()=>{picture.innerHTML=info.art;};if(window.CardCutouts)window.CardCutouts.attach(image);picture.append(image);}else picture.innerHTML=info.art;
    if(info.creature){card.dataset.rarity=info.rarity;const ribbon=el('span','reward-card-rarity-ribbon');ribbon.setAttribute('role','img');ribbon.setAttribute('aria-label',info.rarity==='unassigned'?'Rarity unassigned':info.rarity+' rarity');card.append(ribbon);}
    card.append(ornament,amount,picture,el('h3','reward-card-name',info.name));return card;}
 const defaultColors={base:'#75432b',accent:'#cf9859',trim:'#ffe1a0'};
 function applyPackColors(node,appearance={}){for(const [key,fallback] of Object.entries(defaultColors)){const value=appearance?.[key];node.style.setProperty('--wrapper-'+key,/^#[0-9a-f]{6}$/i.test(value||'')?value:fallback);}}
 function cover(name,appearance){const shell=el('div','pack-design-preview');applyPackColors(shell,appearance);shell.append(el('span','pack-design-kicker','ISLAND TREASURES'),el('span','pack-design-jewel','\u2726'),el('strong','pack-design-title',name||'Your pack'),el('span','pack-design-caption','COLLECT / DISCOVER / ENJOY'));return shell;}
 function decorateDaily(pack){
   pack.classList.add('reward-opening-pack-daily');
   const collage=el('span','reward-wrapper-collage');collage.setAttribute('aria-hidden','true');
   const animal=window.StableAnimals?.animals?.find(a=>!['snail','fox','dragon'].includes(a.id));
   const examples=[{kind:'card',id:'Genious_ben.png',amount:1},{kind:'boost',id:'skip',amount:1},{kind:'rubyItem',id:'compass:rare',label:'Compass',amount:1},{kind:'pack',id:'Discovery pack',amount:1},{kind:'amulet',id:'bronze',label:'Ruby amulet',gemKey:'bronze',amount:1},{kind:'animal',id:animal?.id||'fox',label:animal?.name||'Fox',rarity:animal?.rarity||'rare',amount:1},{kind:'footy',amount:12},{kind:'gem',id:'rare-bronze',amount:5},{kind:'gem',id:'bronze',amount:15}];
   examples.forEach((reward,i)=>{const slot=el('span','reward-wrapper-sample');slot.dataset.sample=String(i);slot.append(createCard(reward));collage.append(slot);});
   pack.querySelector('.reward-wrapper-face').append(collage);
   pack.querySelector('.reward-wrapper-brand').textContent='YOUR DAILY DISCOVERY';

 }
 function dailyCover(name){const pack=el('div','reward-opening-pack'),face=el('span','reward-wrapper-face');face.append(el('span','reward-wrapper-brand'),el('span','reward-wrapper-name',name),el('span','reward-wrapper-caption','A LITTLE WONDER INSIDE'));pack.append(face);decorateDaily(pack);return pack;}
 window.RewardOpening={card:createCard,cover,dailyCover,play(options){
  active?.close();const previous=document.activeElement,d=el('dialog','reward-opening');active=d;d.dataset.phase='ready';d.dataset.theme=['embers','aurora'].includes(options.theme)?options.theme:'standard';d.setAttribute('aria-label',options.name||'Open your pack');
  const timers=new Set(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let phase='ready',loading=false,busy=false,closed=false,completed=false,index=0,cards=[];
  const schedule=(fn,delay)=>{const timer=setTimeout(()=>{timers.delete(timer);if(!closed)fn();},delay);timers.add(timer);return timer;};
  const header=el('header','reward-opening-header');header.append(el('span','reward-opening-brand','ISLAND TREASURES'),el('h2','',options.name||'Your pack'));
  const controls=el('div','reward-opening-controls');const close=el('button','reward-opening-close','Close');close.type='button';close.onclick=event=>{event.stopPropagation();if(!loading)d.close();};controls.append(close);
  if(options.onDetails){const details=el('button','reward-opening-details','Pack details & odds');details.type='button';details.onclick=event=>{event.stopPropagation();if(!loading&&!busy)return options.onDetails();};controls.append(details);}
  if(options.onPreview){const preview=el('button','reward-opening-preview','All reward cards');preview.type='button';preview.onclick=event=>{event.stopPropagation();if(!loading&&!busy)return options.onPreview();};controls.append(preview);}
  const stage=el('div','reward-opening-stage'),halo=el('div','reward-opening-halo'),pack=el('button','reward-opening-pack');pack.type='button';pack.setAttribute('aria-label','Open '+(options.name||'pack'));
  pack.innerHTML='<span class="reward-wrapper-seam seam-top"></span><span class="reward-wrapper-face"><span class="reward-wrapper-brand">THE ISLAND COLLECTION</span><span class="reward-wrapper-emblem" aria-hidden="true"><svg viewBox="0 0 160 160"><path d="m80 9 56 33v70l-56 35-56-35V42Z" fill="#d9b46e"/><path d="m80 18 47 29v60l-47 30-47-30V47Z" fill="#244f47"/><path d="m43 100 37-54 38 54Z" fill="#9bb084"/><path d="m80 46 13 19-13-5-11 8Z" fill="#f5ddb0"/><path d="m44 111 72-1m-58 9h45" stroke="#d9b46e" stroke-width="3"/><path d="m80 28 3 7 8 2-8 3-3 7-3-7-8-3 8-2Z" fill="#f4dca0"/></svg></span><strong class="reward-wrapper-name"></strong><span class="reward-wrapper-caption">A LITTLE WONDER INSIDE</span></span><span class="reward-wrapper-seam seam-bottom"></span>';
  // Keep names as text, including admin-authored names.
  pack.querySelector('.reward-wrapper-name').textContent=options.name||'Discovery Pack';
  if(options.daily){decorateDaily(pack);
  }else{
   pack.classList.add('reward-opening-pack-designed');applyPackColors(pack,options.appearance);
   pack.querySelector('.reward-wrapper-face').append(cover(options.name,options.appearance));
  }
  const stack=el('div','reward-opening-stack');stack.hidden=true;stage.append(halo,pack,stack);
  const status=el('p','reward-opening-status','Tap the pack to open');status.setAttribute('role','status');status.setAttribute('aria-live','polite');const progress=el('p','reward-opening-progress');
  const advance=el('button','reward-opening-next','Open pack');advance.type='button';advance.onclick=event=>{event.stopPropagation();return step();};
  d.append(header,controls,stage,status,progress,advance);document.body.append(d);
  function present(result){
   const rewards=RewardCardArt.normalize(result);if(!rewards.length)throw Error('This pack has no reward cards.');
   cards=rewards.map((reward,i)=>{const card=createCard(reward);card.style.setProperty('--depth',i);card.dataset.depth=String(i);card.setAttribute('aria-hidden',String(i!==0));stack.append(card);return card;});
   phase='opening';d.dataset.phase=phase;status.textContent='Unsealing your treasures...';
   schedule(()=>{pack.hidden=true;pack.querySelector('.reward-wrapper-collage')?.remove();stack.hidden=false;phase='cards';d.dataset.phase=phase;showStatus();},reduced?0:650);
  }
  function showStatus(){status.textContent='Tap anywhere to reveal the next card';progress.textContent=`${index+1} / ${cards.length}`;advance.textContent=index===cards.length-1?'Collect & finish':'Next card';const card=cards[index];d.setAttribute('aria-label',`${options.name||'Your pack'}: ${card.querySelector('.reward-card-name').textContent}, card ${index+1} of ${cards.length}`);}
  async function open(){if(loading||phase!=='ready')return;loading=true;close.disabled=true;pack.disabled=true;advance.disabled=true;status.textContent='Opening your pack...';
   try{let result=options.result||await options.open();if(result.choices){if(!options.choose)throw Error('Choose a reward before continuing.');result=await options.choose(result.choices);if(!result){d.close();return;}}if(!closed)present(result);}
   catch(error){if(!closed){status.textContent=error.message+' Tap the pack to try again.';phase='ready';d.dataset.phase='ready';}}
   finally{loading=false;close.disabled=false;pack.disabled=false;advance.disabled=false;}
  }
  function step(){if(closed||loading||busy)return;if(phase==='ready')return open();if(phase!=='cards')return;
   busy=true;const card=cards[index];card.classList.add('reward-card-departing');let finished=false;
   // Promote the next opaque card immediately, beneath the departing one.
   index++;cards.slice(index).forEach((next,i)=>{next.dataset.depth=String(i);next.style.setProperty('--depth',i);next.setAttribute('aria-hidden',String(i!==0));});if(index<cards.length)showStatus();
   const finish=()=>{if(finished||closed)return;finished=true;card.remove();if(index===cards.length){completed=true;d.close();return;}busy=false;};
   card.addEventListener('animationend',event=>{if(event.target===card&&event.animationName==='reward-card-eject')finish();},{once:true});schedule(finish,reduced?0:320);
  }
  pack.onclick=event=>{event.stopPropagation();return step();};d.onclick=event=>{if(event.target.closest?.('.island-tools'))return;step();};
  d.addEventListener('keydown',event=>{if(event.target!==d||!['Enter',' '].includes(event.key))return;event.preventDefault();step();});
  d.addEventListener('cancel',event=>{if(loading||busy){event.preventDefault();return;}});
  d.addEventListener('close',()=>{closed=true;timers.forEach(clearTimeout);timers.clear();d.remove();if(active===d)active=null;options.onClose?.(completed);if(previous?.isConnected)previous.focus();},{once:true});
  d.showModal();pack.focus();if(options.result||options.autoStart)open();return d;
 }};
})();
