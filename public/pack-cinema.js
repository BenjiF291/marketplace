/* Presentation only: rewards are already settled by /open-pack. */
(() => {
 let active;
 window.playSpecialPackOpening=(result,theme,flow)=>{
  if(!['embers','aurora'].includes(theme)){if(!flow)return false;theme='standard';}
  active?.close();
  const make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
  const d=make('dialog','pack-cinema');d.dataset.theme=theme;d.dataset.phase='arrival';d.setAttribute('aria-label',result.preview?'Pack effect preview':'Your pack opening');
  const sky=make('div','cinema-sky');sky.setAttribute('aria-hidden','true');
  sky.append(make('div','cinema-nebula'),make('div','cinema-ribbon ribbon-one'),make('div','cinema-ribbon ribbon-two'),make('div','cinema-horizon'));
  for(let i=0;i<36;i++){const p=make('i','cinema-particle');p.style.cssText=`--x:${(i*37)%100}%;--y:${(i*61)%100}%;--delay:${-(i%9)*.7}s;--duration:${3+i%5}s;--size:${2+i%4}px`;sky.append(p);}
  const stage=make('div','cinema-stage');stage.setAttribute('aria-hidden','true');
  const header=make('header','cinema-heading');header.append(make('h2','',result.packName||(result.preview?'Bronze Pack':'Pack')));
  stage.append(make('div','cinema-ring ring-one'),make('div','cinema-ring ring-two'),make('div','cinema-rays'),make('div','cinema-shockwave'));
  const shell=make(flow?'button':'div','cinema-pack');if(flow){shell.type='button';shell.setAttribute('aria-label','Open '+(result.packName||'pack'));}shell.style.setProperty('--pack-tint',result.packColor||'#6459b1');
  const top=make('div','cinema-pack-top');const face=make('div','cinema-pack-face');
  face.append(make('span','cinema-pack-brand','FOOTY'),make('span','cinema-sigil',theme==='embers'?'✦':'✧'));shell.append(top,face);stage.append(shell);
  const reward=make('div','cinema-reward');
  if(result.imageUrl&&!result.preview){const img=make('img','');img.src=result.imageUrl;img.alt=result.cardId||'Your new card';img.onerror=()=>{img.remove();reward.append(make('div','cinema-preview-card',result.cardId||'Your new card'));};reward.append(img);}
  else {const sample=make('div','cinema-preview-card');sample.append(make('span','','✦'));reward.append(sample);}
  stage.append(reward);
  const footer=make('footer','cinema-footer');const name=make('h3','cinema-card-name');const bonus=make('p','cinema-bonus');
  const action=make('button','cinema-action','Skip to reveal');action.type='button';footer.append(name,bonus,action);d.append(sky,header,stage,footer);document.body.append(d);
  const timers=[];let revealed=false,closed=false,choosing=false,started=!flow,loading=false,completed=false;const previous=document.activeElement;
  const schedule=(fn,ms)=>timers.push(setTimeout(()=>{if(!closed)fn();},ms));
  const stop=()=>{timers.forEach(clearTimeout);timers.length=0;};
  async function reveal(){if(revealed||closed||choosing)return;stop();if(result.choices){choosing=true;d.dataset.phase='choosing';try{const chosen=await flow.choose(result.choices);if(!chosen){completed=false;d.close();return;}result=chosen;}catch(e){name.textContent=e.message;action.textContent='Retry card choice';choosing=false;return;}choosing=false;}if(closed)return;reward.replaceChildren();if(result.imageUrl){const img=make('img','');img.src=result.imageUrl;img.alt=result.cardId||'Your card';reward.append(img);}else{const sample=make('div','cinema-preview-card');sample.append(make('span','','?'));reward.append(sample);}completed=true;revealed=true;d.dataset.phase='reveal';stage.removeAttribute('aria-hidden');name.textContent=result.preview?'':result.cardId||'New card';bonus.textContent=[result.packBonus?`+${result.packBonus} Footy`:'',result.rubyBonus?`+${result.rubyBonus} Ruby`:''].filter(Boolean).join(' · ');action.textContent=result.preview?'Close preview':'Continue';}
  action.onclick=()=>{if(loading||choosing)return;if(!started||revealed)d.close();else reveal();};
  d.addEventListener('cancel',event=>{event.preventDefault();if(loading||choosing)return;if(!started||revealed)d.close();else reveal();});
  d.addEventListener('close',()=>{closed=true;stop();flow?.onClose(completed);d.remove();if(active===d)active=null;if(previous?.isConnected)previous.focus();},{once:true});
  if(flow?.bulk){const halt=make('button','cinema-action','Stop opening');halt.onclick=()=>{if(loading||choosing)return;completed=false;d.close();};footer.append(halt);}
  active=d;d.showModal();action.focus();
  function animate(){action.textContent='Skip to reveal';if(matchMedia('(prefers-reduced-motion: reduce)').matches)reveal();else {d.dataset.phase='arrival';schedule(()=>{d.dataset.phase='charge';},flow&&theme==='standard'?100:900);schedule(()=>{d.dataset.phase='burst';},flow&&theme==='standard'?500:3100);schedule(reveal,flow&&theme==='standard'?900:4200);}}
  if(flow){d.dataset.phase='ready';stage.removeAttribute('aria-hidden');action.textContent='Cancel';shell.onclick=async()=>{if(started||loading)return;loading=true;action.disabled=true;name.textContent='Opening?';try{result=await flow.open();started=true;shell.disabled=true;name.textContent='';animate();}catch(e){name.textContent=e.message;}finally{loading=false;action.disabled=false;}};shell.focus();if(flow.autoStart)shell.click();}else animate();
  return true;
 };
})();
