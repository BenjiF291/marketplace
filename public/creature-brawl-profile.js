/* Compact owned-creature profile. Ability prose is revealed only on request. */
(() => {
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 const paths={hp:'M12 21C-5 10 5-1 12 7 19-1 29 10 12 21Z',atk:'m5 19 13-13 3-4-5 2L3 17m0-4 8 8m-6-2-3 3',specialPower:'m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',def:'m12 2 8 4v7c0 4-8 9-8 9s-8-5-8-9V6Zm0 3v14',spd:'M3 19C2 10 12 3 21 4l-8 9-3 7 1-9-5 7m8-8 5 1'};
 function icon(key){const n=el('span','cb-profile-stat-icon');n.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+paths[key]+'" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';return n;}
 const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 async function mergeStatBonuses(dialog,next){
  if(reducedMotion()||!dialog.isConnected)return;
  const flights=[];
  for(const row of dialog.querySelectorAll('.cb-profile-stat')){
   const gain=row.querySelector('.cb-profile-stat-gain'),number=row.querySelector('dd');if(!gain||!number)continue;
   const from=gain.getBoundingClientRect(),to=number.getBoundingClientRect();
   const flight=gain.animate([{transform:'translateX(0) scale(1)',opacity:1},{transform:'translateX(-10px) scale(1.18)',opacity:1,offset:.2},{transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(.7)`,opacity:1,offset:.9},{transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(.45)`,opacity:0}],{duration:460,easing:'cubic-bezier(.5,0,.8,.45)',fill:'forwards'});
   flights.push(flight.finished.catch(()=>{}).then(async()=>{
    if(!dialog.isConnected)return;
    number.textContent=String(next.stats[row.dataset.stat]);
    const impact=number.animate([{transform:'scale(1)',color:'#27712d',textShadow:'0 0 12px #a3ff65'},{transform:'scale(1.24)',color:'#27712d',offset:.35},{transform:'scale(1)',color:'#48351e',textShadow:'0 0 0 transparent'}],{duration:280,easing:'ease-out'});
    await impact.finished.catch(()=>{});
   }));
  }
  await Promise.all(flights);
 }
 function revealNextBonuses(dialog){
  if(reducedMotion())return;
  for(const gain of dialog.querySelectorAll('.cb-profile-stat-gain'))gain.animate([{opacity:0,transform:'translateX(18px) scale(.7)'},{opacity:1,transform:'translateX(0) scale(1)'}],{duration:260,easing:'ease-out'});
 }
 function open(u,options){const d=el('dialog','cb-inspect cb-creature-profile'+(options.readOnly?' cb-battle-inspect':''));d.setAttribute('aria-label',u.name+' creature profile');let selected=-1,busy=false,message='';
  function render(){d.replaceChildren();const header=el('header','cb-profile-header'),title=el('h2','',u.name),close=el('button','cb-profile-close','\u00d7');close.type='button';close.setAttribute('aria-label','Close creature profile');close.disabled=busy;close.onclick=()=>d.close();header.append(title,close);d.append(header);
   const layout=el('div','cb-profile-layout'),left=el('section','cb-profile-portrait-panel'),right=el('section','cb-profile-stats-panel'),ribbon=el('div','cb-profile-rarity',options.rarity||'Creature');ribbon.dataset.rarity=(options.rarity||'').toLowerCase();const picture=el('div','cb-profile-portrait');picture.append(options.art(u));left.append(ribbon,picture,el('p','cb-profile-kind',options.kindLabel));
   const identity=el('div','cb-profile-identity'),role=el('span','cb-profile-role');role.append(options.roleArt(u.role));const text=el('div');text.append(el('strong','',`GRADE ${u.grade||1}`),el('span','',u.role),el('small','',`Creature level ${u.growth?.level||u.level||1}`));identity.append(role,text);right.append(identity);
   const stats=el('dl','cb-profile-stats');for(const [key,label] of [['hp','Health'],['atk','Attack'],['specialPower','Special power'],['def','Defence'],['spd','Speed']]){const row=el('div','cb-profile-stat'),value=options.readOnly&&key==='hp'&&u.hp!==undefined?`${u.hp} / ${u.maxHP||u.stats.hp}`:key==='specialPower'?Number(u.stats[key]).toFixed(2)+'\u00d7':String(u.stats[key]),gain=options.owned&&u.nextStats?Math.max(0,u.nextStats[key]-u.stats[key]):0;row.dataset.stat=key;const words=el('div');words.append(el('dt','',label),el('dd','',value));row.append(icon(key),words);if(gain){const delta=el('strong','cb-profile-stat-gain','+'+gain);delta.title='Next grade: +'+gain+' '+label;delta.setAttribute('aria-label',delta.title);row.append(delta);}stats.append(row);}right.append(stats);
   const powers=el('nav','cb-profile-powers');powers.setAttribute('aria-label','Creature powers');u.moves.forEach((move,i)=>{const b=el('button','cb-profile-power');b.type='button';b.disabled=busy;b.setAttribute('aria-label','View '+move.name);b.setAttribute('aria-expanded',String(selected===i));b.setAttribute('aria-controls','cbProfilePowerDetails');b.append(options.powerArt(move),el('span','cb-profile-power-name',move.name),el('small','cb-profile-power-cost',move.cost?move.cost+' AP':'FREE'));if(window.CBStatusIcons)b.append(CBStatusIcons.powerEffects(move));b.onclick=()=>{selected=selected===i?-1:i;render();d.querySelectorAll('.cb-profile-power')[i].focus({preventScroll:true});d.querySelector('.cb-profile-power-details')?.scrollIntoView({block:'nearest'});};powers.append(b);});right.append(powers);
   const detail=el('section','cb-profile-power-details');detail.id='cbProfilePowerDetails';detail.hidden=selected<0;detail.setAttribute('aria-live','polite');if(selected>=0){const move=u.moves[selected];detail.append(el('h3','',move.name),el('p','',move.description),el('small','',`${move.cost} AP / ${{enemy:'One enemy',enemies:'All enemies',ally:'One ally',allies:'All allies',self:'Self'}[move.target]||move.target}`));}right.append(detail);
   if(options.owned){const g=u.growth||{},tokens=Number(options.tokens()[u.tokenKey||u.species])||0,cost=g.upgradeCost||0,bar=el('div','cb-profile-token-bar'),fill=el('span');fill.style.width=(cost?Math.min(100,100*tokens/cost):100)+'%';bar.append(fill,el('strong','',u.grade>=10?`${tokens} tokens / MAX GRADE`:`${tokens} / ${cost} tokens`));left.append(bar);
    const upgrade=el('button','cb-profile-upgrade',u.grade>=10?'Maximum grade':u.grade>=g.gradeCap?`Reach creature level ${g.nextGate}`:`Upgrade to grade ${u.grade+1}`);upgrade.type='button';upgrade.disabled=busy||u.grade>=10||u.grade>=g.gradeCap||tokens<cost;upgrade.onclick=async()=>{if(busy)return;busy=true;render();try{const result=await options.upgrade(u);await mergeStatBonuses(d,result.instance);Object.assign(u,result.instance);message='Upgraded to grade '+u.grade+'.';}catch(e){message=e.message;}finally{busy=false;render();if(message.startsWith('Upgraded to grade '))revealNextBonuses(d);}};left.append(upgrade);
    const actions=el('div','cb-profile-actions'),feed=el('button','','Feed creature');feed.type='button';feed.disabled=busy;feed.onclick=()=>options.feed(()=>render());const choose=el('button','',options.selected()?'Remove from team':'Add to team');choose.type='button';choose.disabled=busy;choose.onclick=()=>{d.close();options.select();};actions.append(feed,choose);left.append(actions);
   }else if(!options.readOnly)left.append(el('p','cb-profile-unowned','Collect this creature to train and upgrade it.'));
   if(options.readOnly&&window.CBStatusIcons){const effects=el('div','cb-profile-live-effects');effects.append(CBStatusIcons.create(u));left.append(effects);}
   if(message){const status=el('p','cb-profile-message',message);status.setAttribute('role','status');left.append(status);}layout.append(left,right);d.append(layout);
  }
  d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});d.addEventListener('close',()=>{d.remove();options.close?.();},{once:true});render();document.body.append(d);d.showModal();return d;
 }
 window.CreatureBrawlProfile={open};
})();
