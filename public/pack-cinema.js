/* Presentation only: rewards are already settled by /open-pack. */
(() => {
 let active;
 window.playSpecialPackOpening=(result,theme)=>{
  if(!['embers','aurora'].includes(theme))return false;
  active?.close();
  const make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
  const d=make('dialog','pack-cinema');d.dataset.theme=theme;d.dataset.phase='arrival';d.setAttribute('aria-label',result.preview?'Pack effect preview':'Your pack opening');
  const sky=make('div','cinema-sky');sky.setAttribute('aria-hidden','true');
  sky.append(make('div','cinema-nebula'),make('div','cinema-ribbon ribbon-one'),make('div','cinema-ribbon ribbon-two'),make('div','cinema-horizon'));
  for(let i=0;i<36;i++){const p=make('i','cinema-particle');p.style.cssText=`--x:${(i*37)%100}%;--y:${(i*61)%100}%;--delay:${-(i%9)*.7}s;--duration:${3+i%5}s;--size:${2+i%4}px`;sky.append(p);}
  const header=make('header','cinema-heading');header.append(make('p','cinema-eyebrow',result.preview?'EFFECT PREVIEW • NO PACK USED':'THE RUBY CABINET'));
  const title=make('h2','',theme==='embers'?'Forged in fire':'Beyond the northern lights');
  const status=make('p','cinema-status','Something extraordinary is stirring…');status.setAttribute('role','status');header.append(title,status);
  const stage=make('div','cinema-stage');stage.setAttribute('aria-hidden','true');
  stage.append(make('div','cinema-ring ring-one'),make('div','cinema-ring ring-two'),make('div','cinema-rays'),make('div','cinema-shockwave'));
  const shell=make('div','cinema-pack');shell.style.setProperty('--pack-tint',result.packColor||'#6459b1');
  const top=make('div','cinema-pack-top');const face=make('div','cinema-pack-face');
  face.append(make('span','cinema-pack-brand','FOOTY'),make('span','cinema-sigil',theme==='embers'?'✦':'✧'),make('span','cinema-pack-label','A NEW DISCOVERY'));shell.append(top,face);stage.append(shell);
  const reward=make('div','cinema-reward');
  if(result.imageUrl&&!result.preview){const img=make('img','');img.src=result.imageUrl;img.alt=result.cardId||'Your new card';img.onerror=()=>{img.remove();reward.append(make('div','cinema-preview-card',result.cardId||'Your new card'));};reward.append(img);}
  else {const sample=make('div','cinema-preview-card');sample.append(make('span','','✦'),make('small','','YOUR NEXT'),make('strong','','DISCOVERY'));reward.append(sample);}
  stage.append(reward);
  const footer=make('footer','cinema-footer');const name=make('h3','cinema-card-name');const bonus=make('p','cinema-bonus');
  const action=make('button','cinema-action','Skip to reveal');action.type='button';footer.append(name,bonus,action);d.append(sky,header,stage,footer);document.body.append(d);
  const timers=[];let revealed=false,closed=false;const previous=document.activeElement;
  const schedule=(fn,ms)=>timers.push(setTimeout(()=>{if(!closed)fn();},ms));
  const stop=()=>{timers.forEach(clearTimeout);timers.length=0;};
  function reveal(){if(revealed||closed)return;stop();revealed=true;d.dataset.phase='reveal';stage.removeAttribute('aria-hidden');title.textContent=result.preview?'Make every opening an occasion':'Your new discovery';status.textContent=result.preview?'A preview of your equipped opening effect.':'Added to your collection';name.textContent=result.preview?'Your next discovery':result.cardId||'New card';bonus.textContent=[result.packBonus?`+${result.packBonus} Footy`:'',result.rubyBonus?`+${result.rubyBonus} Ruby`:''].filter(Boolean).join(' · ');action.textContent=result.preview?'Close preview':'Continue';}
  action.onclick=()=>revealed?d.close():reveal();
  d.addEventListener('cancel',event=>{event.preventDefault();if(revealed)d.close();else reveal();});
  d.addEventListener('close',()=>{closed=true;stop();d.remove();if(active===d)active=null;if(previous?.isConnected)previous.focus();},{once:true});
  active=d;d.showModal();action.focus();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)reveal();
  else {schedule(()=>{d.dataset.phase='charge';status.textContent=theme==='embers'?'The forge is awakening…':'The portal is aligning…';},900);schedule(()=>{d.dataset.phase='burst';status.textContent='Here it comes…';},3100);schedule(reveal,4200);}
  return true;
 };
})();
