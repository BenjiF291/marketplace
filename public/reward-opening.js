/* A single click advances a single card. Rewards are settled before any reveal. */
(() => {
 let active;
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 function tokenHeads(picture,ids){
  const animals=ids.map(id=>window.StableAnimals?.animals.find(a=>a.id===id)).filter(Boolean).slice(0,3);if(!animals.length)return;
  picture.replaceChildren();picture.classList.add('reward-token-heads');
  // Head crops use the original creature posters, without loading 3D models.
  const heads={fox:[160,150,160],snail:[110,250,190],dragon:[175,160,120],rill:[310,170,150],brugar:[435,440,210],krynn:[575,335,170],fenra:[325,200,170],veyrin:[275,275,180],tharos:[275,275,180],talren:[275,245,185],'northern-talren':[230,245,185],'defender-talren':[240,245,185],'rill-species':[300,145,155],'brugar-species':[450,415,180],'krynn-species':[585,330,170],'fenra-species':[320,205,180],'defender-rill':[300,145,155],kanji:[250,335,160],trusk:[545,315,185],velkris:[375,440,185]};
  for(const animal of animals){const frame=RewardCardArt.describe({kind:'brawlToken',id:animal.id,amount:1}).imageFrame,box=heads[animal.id]||[frame.x+frame.width*.52,frame.y+frame.height*.28,Math.min(frame.width,frame.height)*.6],ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),image=document.createElementNS(ns,'image');const side=box[2]*1.3;svg.setAttribute('viewBox',`${box[0]-side/2} ${box[1]-side/2} ${side} ${side}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',animal.name);image.setAttribute('href',animal.poster);image.setAttribute('width',animal.companion?512:768);image.setAttribute('height',animal.companion?420:630);svg.append(image);picture.append(svg);}
 }
 function createCard(reward){const info=RewardCardArt.describe(reward),card=el('article','reward-pack-card');card.dataset.kind=reward.kind;card.style.setProperty('--depth',0);card.dataset.depth='0';
    const ornament=el('span','reward-card-ornament');ornament.setAttribute('aria-hidden','true');const amount=el('strong','reward-card-amount',typeof info.amount==='number'&&['footy','gem'].includes(reward.kind)?(reward.kind==='footy'&&Number.isInteger(CurrencyFormat.footy(info.amount))?String(CurrencyFormat.footy(info.amount)):CurrencyFormat.format(info.amount,reward.kind==='footy'?'footy':'gem')):String(info.amount)),picture=el('div','reward-card-picture');
    if(reward.kind==='pack'){picture.append(cover(reward.packName||info.name,reward.appearance||{base:reward.packColor,accent:reward.packColor}));}
    else if(info.image&&info.imageFrame){const ns='http://www.w3.org/2000/svg',frame=info.imageFrame,svg=document.createElementNS(ns,'svg'),image=document.createElementNS(ns,'image');svg.setAttribute('viewBox',`${frame.x} ${frame.y} ${frame.width} ${frame.height}`);svg.setAttribute('preserveAspectRatio','xMidYMid meet');svg.setAttribute('role','img');svg.setAttribute('aria-label',info.name);image.setAttribute('href',info.image);image.setAttribute('width',frame.imageWidth);image.setAttribute('height',frame.imageHeight);image.onerror=()=>{picture.innerHTML=info.art;};svg.append(image);picture.append(svg);}
    else if(info.image){const image=el('img');image.loading='lazy';image.src=info.image;image.alt=info.name;image.onerror=()=>{picture.innerHTML=info.art;};if(window.CardCutouts)window.CardCutouts.attach(image);picture.append(image);}else picture.innerHTML=info.art;
    if(info.creature){card.dataset.rarity=info.rarity;const ribbon=el('span','reward-card-rarity-ribbon');ribbon.setAttribute('role','img');ribbon.setAttribute('aria-label',info.rarity==='unassigned'?'Rarity unassigned':info.rarity+' rarity');card.append(ribbon);}
    if(reward.kind==='brawlToken'){
     const creature=window.CreatureBrawlCatalog?.creatures.find(c=>c.id===reward.id),animal=window.StableAnimals?.animals.find(a=>a.id===reward.id);
     card.dataset.role=creature?.role||'Swift';
     if(reward.id?.startsWith('rarity:'))tokenHeads(picture,reward.members||[]);
     const name=el('h3','reward-card-name',animal?.name||info.name.replace(/ Brawl tokens?$/i,'')),type=el('span','reward-token-type','BRAWL TOKENS'),bar=el('div','reward-token-bar',`+${info.amount} tokens`),badge=el('span','reward-token-role');
     const progress=reward.tokenProgress;
     if(progress?.owned===false){card.classList.add('reward-token-undiscovered');picture.setAttribute('aria-label','Undiscovered creature: '+(animal?.name||creature?.name||info.name));const hint=el('span','reward-token-discovery-hint','Not yet discovered');picture.append(hint);}
     if(progress&&Number.isFinite(progress.after)){
      const fill=el('span','reward-token-fill'),label=el('span','reward-token-balance',`${progress.after} tokens`);
      fill.style.setProperty('--token-before',`${Math.min(100,100*progress.before/(progress.target||progress.after||1))}%`);
      fill.style.width=`${Math.min(100,100*progress.after/(progress.target||progress.after||1))}%`;
      bar.textContent='';bar.append(fill,label);bar.setAttribute('role','meter');bar.setAttribute('aria-label',`${animal?.name||creature?.name||'Creature'} tokens: ${progress.before} to ${progress.after}, gained ${info.amount}`);bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax',String(Math.max(progress.target||0,progress.after)));bar.setAttribute('aria-valuenow',String(progress.after));
      type.textContent=`+${info.amount} BRAWL TOKENS`;
     }
     badge.title=creature?.role||'Brawl token';badge.setAttribute('aria-label',badge.title);
     const paths={Swift:'M9 22H42Q57 22 52 12Q47 5 41 14 M9 32H52 M9 42H36Q51 42 46 52Q41 59 35 50',Protector:'M32 10 51 18V32Q49 47 32 56Q15 47 13 32V18Z M23 32 30 39 43 25',Cunning:'M26 22 20 16Q10 10 8 22Q7 27 13 33L22 42Q31 49 37 40 M38 42 44 48Q54 54 56 42Q57 37 51 31L42 22Q33 15 27 24 M23 23 41 41',Furious:'M20 46 34 16 30 40 22 52 M32 49 46 14 42 40 34 54 M44 48 57 22 53 43 46 54'};
     const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 64 64');svg.setAttribute('aria-hidden','true');path.setAttribute('d',paths[card.dataset.role]);svg.append(path);badge.append(svg);
     card.append(name,picture,type,bar,badge);return card;
    }
    card.append(ornament,amount,picture,el('h3','reward-card-name',info.name));return card;}
 const defaultColors={base:'#75432b',accent:'#cf9859',trim:'#ffe1a0'};
 function applyPackColors(node,appearance={}){for(const [key,fallback] of Object.entries(defaultColors)){const value=appearance?.[key];node.style.setProperty('--wrapper-'+key,/^#[0-9a-f]{6}$/i.test(value||'')?value:fallback);}}
 function addSeals(pack){pack.append(el('span','pack-cover-seal pack-cover-top'),el('span','pack-cover-seal pack-cover-bottom'));}
 function cover(name,appearance){const shell=el('div','pack-design-preview');applyPackColors(shell,appearance);shell.append(el('span','pack-design-kicker','ISLAND TREASURES'),el('span','pack-design-jewel','\u2726'),el('strong','pack-design-title',name||'Your pack'),el('span','pack-design-caption','COLLECT / DISCOVER / ENJOY'));addSeals(shell);return shell;}
 function decorateDaily(pack){
   pack.classList.add('reward-opening-pack-daily');
   addSeals(pack);
   const face=pack.querySelector('.reward-wrapper-face');
   const name=face.querySelector('.reward-wrapper-name')?.textContent||'Daily Pack';
   const seal=el('img','reward-daily-seal');seal.src='assets/rewards/daily-sun-seal.svg';seal.alt='';seal.setAttribute('aria-hidden','true');
   face.replaceChildren(seal,el('strong','reward-wrapper-name',name));

 }
 function dailyCover(name){const pack=el('div','reward-opening-pack'),face=el('span','reward-wrapper-face');face.append(el('span','reward-wrapper-name',name));pack.append(face);decorateDaily(pack);return pack;}
 window.RewardOpening={card:createCard,cover,dailyCover,play(options){
  active?.close();const previous=document.activeElement,d=el('dialog','reward-opening');active=d;d.tabIndex=-1;d.dataset.daily=String(!!options.daily);d.dataset.admin=String(options.admin===true||(typeof currentUserIsAdmin!=='undefined'&&currentUserIsAdmin===true));d.dataset.phase='ready';const theme=options.theme??document.body.dataset.rubyOpening;d.dataset.theme=['embers','aurora','starfall','tempest','sakura'].includes(theme)?theme:'standard';d.setAttribute('aria-label',options.name||'Open your pack');
  const fragmentEffects=new Set();
  const timers=new Set(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let phase='ready',loading=false,busy=false,closed=false,completed=false,index=0,cards=[],effects=null;
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
  const cracks=document.createElementNS('http://www.w3.org/2000/svg','svg');cracks.classList.add('reward-pack-cracks');cracks.setAttribute('viewBox','0 0 100 140');cracks.setAttribute('preserveAspectRatio','none');cracks.setAttribute('aria-hidden','true');
  for(const line of ['M51 69 47 52 54 36 48 20 52 0 M51 69 56 88 48 106 54 122 49 140','M51 69 34 63 26 49 14 44 0 28 M51 69 68 77 76 94 90 100 100 116','M47 52 65 43 73 27 90 21 100 10 M48 106 31 112 21 127 0 134']){const path=document.createElementNS(cracks.namespaceURI,'path');path.setAttribute('d',line);path.setAttribute('pathLength','1');cracks.append(path);}pack.append(cracks);

  const bloom=el('span','reward-pack-light-bloom');bloom.setAttribute('aria-hidden','true');stage.append(bloom);

  const flash=el('span','reward-pack-burst-flash');flash.setAttribute('aria-hidden','true');stage.append(flash);
  const stack=el('div','reward-opening-stack');stack.hidden=true;stage.append(halo,pack,stack);
  const status=el('p','reward-opening-status','Tap the pack to open');status.setAttribute('role','status');status.setAttribute('aria-live','polite');const progress=el('p','reward-opening-progress');
  const advance=el('button','reward-opening-next','Open pack');advance.type='button';advance.hidden=true;advance.onclick=event=>{event.stopPropagation();return step();};
  d.append(header,controls,stage,status,progress,advance);document.body.append(d);
  const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  async function readyArt(container){
   const sources=new Set([...container.querySelectorAll('img,image')].map(n=>n.getAttribute('src')||n.getAttribute('href')).filter(Boolean));
   // Preload SVG image references too; hidden stacks otherwise defer their first paint.
   let timeout;
   try{await Promise.race([Promise.allSettled([...sources].map(src=>new Promise(resolve=>{
    const image=new Image();image.onload=()=>{if(image.decode)image.decode().catch(()=>{}).then(resolve);else resolve();};image.onerror=resolve;image.src=src;
   }))),new Promise(resolve=>{timeout=setTimeout(resolve,1800);})]);}finally{clearTimeout(timeout);}
  }
  function scatterWrapper(){
   const bounds=pack.getBoundingClientRect(),canvas=el('canvas','reward-pack-fragments');canvas.setAttribute('aria-hidden','true');
   const width=bounds.width*3,height=bounds.height*2.6,ratio=Math.min(devicePixelRatio||1,1.25);
   canvas.width=Math.ceil(width*ratio);canvas.height=Math.ceil(height*ratio);canvas.style.width=width+'px';canvas.style.height=height+'px';
   stage.append(canvas);const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();return;}
   ctx.setTransform(ratio,0,0,ratio,0,0);
   const face=pack.querySelector('.pack-design-preview')||pack.querySelector('.reward-wrapper-face'),style=getComputedStyle(face),daily=pack.classList.contains('reward-opening-pack-daily');
   const palette=[style.getPropertyValue('--wrapper-base').trim()||(daily?'#153d36':'#75432b'),style.getPropertyValue('--wrapper-accent').trim()||(daily?'#426f5d':'#cf9859'),style.getPropertyValue('--wrapper-trim').trim()||'#e5c380'];
   const particles=Array.from({length:1000},(_,i)=>{const x=(i%25+.5)/25,y=(Math.floor(i/25)+.5)/40,angle=Math.atan2((y-.5)*1.4,x-.5)+(Math.random()-.5)*.7,speed=180+Math.random()*420;return {x:width/2+(x-.5)*bounds.width,y:height/2+(y-.5)*bounds.height,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-90,size:2+Math.random()*4,angle:Math.random()*6.28,spin:(Math.random()-.5)*20,color:palette[y<.07||y>.93?2:Math.random()<.18?2:i%2]};});
   let frame=0,start,last=0,dead=false;
   const dispose=()=>{if(dead)return;dead=true;cancelAnimationFrame(frame);canvas.remove();fragmentEffects.delete(dispose);};fragmentEffects.add(dispose);
   function draw(now){if(dead||closed){dispose();return;}if(start===undefined)start=now;const t=(now-start)/1000;if(t>.75){dispose();return;}frame=requestAnimationFrame(draw);if(now-last<32)return;last=now;
    ctx.clearRect(0,0,width,height);ctx.globalAlpha=Math.min(1,(.75-t)/.28);
    for(const p of particles){ctx.save();ctx.translate(p.x+p.vx*t,p.y+p.vy*t+180*t*t);ctx.rotate(p.angle+p.spin*t);ctx.scale(Math.max(.15,Math.abs(Math.cos(p.angle+t*7))),1);ctx.fillStyle=p.color;ctx.beginPath();ctx.moveTo(-p.size,-p.size*.7);ctx.lineTo(p.size*.8,-p.size*.45);ctx.lineTo(p.size*.5,p.size);ctx.lineTo(-p.size*.6,p.size*.4);ctx.closePath();ctx.fill();ctx.restore();}
   }
   frame=requestAnimationFrame(draw);
  }
  async function present(result){
     const rewards=RewardCardArt.normalize(result);if(!rewards.length)throw Error('This pack has no reward cards.');
     if(!options.preview&&rewards.some(reward=>reward.kind==='brawlToken'))window.dispatchEvent(new Event('brawl-tokens-packed'));
   if(rewards.some(reward=>reward.kind==='card')) await window.CardDisplayNames?.load();
   if(closed)return;
   cards=rewards.map((reward,i)=>{const card=createCard(reward);card.style.setProperty('--depth',i);card.dataset.depth=String(i);card.setAttribute('aria-hidden',String(i!==0));stack.append(card);return card;});
   // Lay out the stack invisibly before the wrapper animation, rather than at the reveal.
   stack.style.visibility='hidden';stack.hidden=false;
   await readyArt(stack);await paint();if(closed)return;
   phase='opening';d.dataset.phase=phase;effects=window.PackEffects?.mount(d,d.dataset.theme);status.textContent='Light is breaking through the pack...';
   if(!reduced)schedule(()=>{
    d.dataset.burst='true';effects?.burst('open');
    scatterWrapper();
    pack.hidden=true;
   },1100);
   schedule(()=>{pack.hidden=true;fragmentEffects.forEach(dispose=>dispose());delete d.dataset.burst;stack.style.visibility='';stack.hidden=false;phase='cards';d.dataset.phase=phase;effects?.dispose();effects=null;showStatus();d.focus();},reduced?0:1850);
  }
  function showStatus(){advance.hidden=false;status.textContent='Tap anywhere to reveal the next card';progress.textContent=`${index+1} / ${cards.length}`;advance.textContent=index===cards.length-1?'Collect & finish':'Next card';const card=cards[index];d.setAttribute('aria-label',`${options.name||'Your pack'}: ${card.querySelector('.reward-card-name').textContent}, card ${index+1} of ${cards.length}`);}
  async function open(){if(loading||phase!=='ready')return;loading=true;close.disabled=true;pack.disabled=true;advance.disabled=true;status.textContent='Opening your pack...';
   try{let result=options.result||await options.open();if(result.choices){if(!options.choose)throw Error('Choose a reward before continuing.');result=await options.choose(result.choices);if(!result){d.close();return;}}if(!closed)await present(result);}
   catch(error){if(!closed){status.textContent=error.message+' Tap the pack to try again.';phase='ready';d.dataset.phase='ready';}}
   finally{loading=false;close.disabled=false;pack.disabled=false;advance.disabled=false;}
  }
  function step(){if(closed||loading||busy)return;if(phase==='ready')return open();if(phase!=='cards')return;
   busy=true;const card=cards[index],last=index===cards.length-1;card.classList.add('reward-card-departing');if(last)card.classList.add('reward-card-final');let finished=false;
   // Promote the next opaque card immediately, beneath the departing one.
   index++;cards.slice(index).forEach((next,i)=>{next.dataset.depth=String(i);next.style.setProperty('--depth',i);next.setAttribute('aria-hidden',String(i!==0));});if(index<cards.length)showStatus();
   const finish=()=>{if(finished||closed)return;finished=true;card.remove();if(index===cards.length){completed=true;d.close();return;}busy=false;};
   card.addEventListener('animationend',event=>{if(event.target===card&&event.animationName===(last?'reward-card-slingshot':'reward-card-eject'))finish();},{once:true});schedule(finish,reduced?0:last?720:320);
  }
  pack.onclick=event=>{event.stopPropagation();return step();};d.onclick=event=>{if(event.target.closest?.('.island-tools'))return;step();};
  d.addEventListener('keydown',event=>{if(event.target!==d||!['Enter',' '].includes(event.key))return;event.preventDefault();step();});
  d.addEventListener('cancel',event=>{if(loading||busy){event.preventDefault();return;}});
  d.addEventListener('close',()=>{closed=true;effects?.dispose();fragmentEffects.forEach(dispose=>dispose());timers.forEach(clearTimeout);timers.clear();d.remove();if(active===d)active=null;options.onClose?.(completed);if(previous?.isConnected)previous.focus();},{once:true});
  d.showModal();pack.focus();if(options.result||options.autoStart)paint().then(()=>{if(!closed)open();});return d;
 }};
})();
