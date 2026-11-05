/* Persistent battle effects use distinct silhouettes, colour and duration badges. */
(() => {
 const defs={
  atkUp:['Attack up','buff','sword','Attack strength is increased.'],atkDown:['Attack down','debuff','sword','Attack strength is reduced.'],
  defUp:['Defence up','buff','armour','Defence is increased.'],defDown:['Defence down','debuff','armour','Defence is reduced.'],
  spdUp:['Speed up','buff','wing','Acts sooner on the turn timeline.'],spdDown:['Speed down','debuff','wing','Acts later on the turn timeline.'],
  burn:['Burn','debuff','fire','Loses 5% of maximum HP at the start of each affected activation.'],
  stun:['Stun','debuff','stars','Cannot act on the next activation.'],bind:['Bind','debuff','chain','Only the free basic attack can be used.'],
  taunt:['Taunt','buff','target','Opponents must target a taunting creature with single-target attacks.'],
  stunImmune:['Stun immunity','buff','immune','Temporarily protected against being stunned again.'],
  shield:['Shield','buff','shield','Absorbs incoming damage before HP.']
 };
 const art={
  sword:'<path class="effect-fill" d="m12 3 4-1 1 4-8 11-3-3Z"/><path d="m4 13 7 6m-5-3-3 4m-1 0 3 2"/><path class="effect-glint" d="m13 5-6 9"/>',
  armour:'<path class="effect-fill" d="m12 2 9 4-1 8c-1 4-5 7-8 9-3-2-7-5-8-9L3 6Z"/><path class="effect-glint" d="M12 5 6 8l1 6 5 5Z"/>',
  wing:'<path class="effect-fill" d="M4 19C3 10 12 3 22 3l-4 6-5 1 4 2-4 4-4-1 1 4-6 3Z"/><path class="effect-glint" d="M7 18 18 7"/><path d="M1 10h4M1 14h2"/>',
  fire:'<path class="effect-fill" d="M13 1c3 6-3 8-1 11 2-1 3-3 4-5 8 8 5 16-4 16S1 16 6 9c0 4 2 4 3 4-2-5 3-7 4-12Z"/><path class="effect-glint" d="M12 15c-5 4-1 7 2 5 2-2-1-3-2-5Z"/>',
  stars:'<path class="effect-fill" d="m12 4 3 5 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1Z"/><path d="M3 1v4M1 3h4M21 18v5M19 21h5"/>',
  chain:'<g transform="rotate(-38 12 12)"><rect class="effect-fill" x="3" y="4" width="8" height="13" rx="4"/><rect class="effect-fill" x="13" y="8" width="8" height="13" rx="4"/><path class="effect-glint" d="M8 12h8"/></g>',
  target:'<path class="effect-fill" d="m12 2 10 6v8l-10 7L2 16V8Z"/><circle cx="12" cy="12" r="6"/><circle class="effect-glint" cx="12" cy="12" r="2"/><path d="M12 3v4m0 10v4M3 12h4m10 0h4"/>',
  immune:'<path class="effect-fill" d="m12 2 9 4-1 9c-1 4-8 8-8 8S5 19 4 15L3 6Z"/><path class="effect-glint" d="m7 12 4 4 7-8"/>',
  shield:'<path class="effect-fill" d="m12 2 9 4-1 9c-1 4-8 8-8 8S5 19 4 15L3 6Z"/><path class="effect-glint" d="M12 5v14M6 8l6-3 6 3"/>'
 };
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 // Negative counterparts are fractured silhouettes, so colour is not the only cue.
 const brokenArt={
  sword:'<path class="effect-fill" d="m14 2 4-1 1 4-5 7-3-1 2-3-2-1Z"/><path class="effect-fill" d="m8 11 3 2-2 1 1 2-3 4-3-3Z"/><path d="m2 16 7 6m-5-3-3 3"/><path class="effect-glint" d="m15 4-2 3"/>',
  armour:'<path class="effect-fill" d="m11 2-8 4 1 8c1 3 3 5 5 7l1-6-3-3 5-3-3-3Z"/><path class="effect-fill" d="m15 3 8 4-1 8c-1 4-5 7-8 9l1-7-3-3 5-3-4-4Z"/><path class="effect-glint" d="M6 8v4m13-3-1 5"/>',
  wing:'<path class="effect-fill" d="M4 16C4 9 11 3 19 2l-4 6-4 1 2 2-3 2-3-1 1 4-4 3Z"/><path class="effect-fill" d="m14 14 4 1-3 4-4-1 1 4-6 2 1-4 4-2Z"/><path class="effect-glint" d="m7 12 7-6"/>'
 };
 function svg(key){const def=defs[key],broken=key.endsWith('Down');return '<svg class="cb-effect-art effect-'+def[2]+(broken?' effect-broken':'')+'" viewBox="0 0 32 32" aria-hidden="true"><g class="effect-symbol" transform="translate(4 3) scale(.96)" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(broken?brokenArt[def[2]]:art[def[2]])+'</g></svg>';}
 function description(key,value,unit){let text=defs[key][3];if(/^(atk|def|spd)(Up|Down)$/.test(key)&&value.magnitude)text+=' Strength: '+Math.round(value.magnitude*100)+'%.';if(key==='shield')text+=' '+(unit.shield||0)+' shield points remaining.';if(value.remaining)text+=' '+value.remaining+' affected creature activation'+(value.remaining===1?'':'s')+' remaining.';return text;}
 function detail(key,value,unit){const d=el('dialog','cb-inspect cb-battle-inspect cb-effect-detail'),hero=el('div','cb-effect-hero '+defs[key][1]);hero.innerHTML=svg(key);d.setAttribute('aria-label',defs[key][0]);const close=el('button','cb-button','Close');close.onclick=()=>d.close();d.append(hero,el('h2','',defs[key][0]),el('p','',unit.name||''),el('p','',description(key,value,unit)),close);document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();}
 function draw(row){const u=row.effectUnit;row.replaceChildren();if(u.hp<=0)return;const statuses={...u.statuses};if(u.shield>0)statuses.shield=u.shieldStatus||{};
  for(const key of Object.keys(defs)){const value=statuses[key];if(!value)continue;const b=el('button','cb-effect-icon cb-effect-'+defs[key][1]);b.type='button';b.dataset.status=key;b.innerHTML=svg(key);const info=defs[key][0]+'. '+description(key,value,u);b.title=info;b.setAttribute('aria-label',info);if(value.remaining)b.append(el('span','cb-effect-duration',String(value.remaining)));b.onclick=e=>{e.stopPropagation();detail(key,value,u);};row.append(b);}
 }
 function create(unit){const row=el('div','cb-statuses');row.setAttribute('role','group');row.setAttribute('aria-label',unit.name+' active effects');row.effectUnit=structuredClone(unit);draw(row);return row;}
 function apply(row,event,finalUnit){const u=row.effectUnit;if(!u)return;if(event.type==='status')u.statuses[event.status]={remaining:event.remaining,magnitude:event.magnitude};if(['expire','cleanse'].includes(event.type))delete u.statuses[event.status];if(event.type==='stunned')delete u.statuses.stun;if(event.shield!==undefined){u.shield=event.shield;if(event.type==='shield')u.shieldStatus=finalUnit.shieldStatus||{remaining:2};}if(event.type==='shieldExpired')u.shield=0;if(event.type==='defeat'){u.hp=0;u.statuses={};u.shield=0;}draw(row);}
 function guide(){const d=el('dialog','cb-inspect cb-battle-inspect cb-effect-guide');d.setAttribute('aria-label','Battle effect guide');d.append(el('h2','','Battle effects'),el('p','','Broken swords, armour and wings show reduced attack, defence and speed. Numbers show the remaining activations for that creature. Tap any battle icon for details.'));const grid=el('div','cb-effect-guide-grid');for(const key of Object.keys(defs)){const row=el('div','cb-effect-guide-item'),icon=el('span','cb-effect-icon cb-effect-'+defs[key][1]);icon.innerHTML=svg(key);row.append(icon,el('strong','',defs[key][0]),el('small','',defs[key][3]));grid.append(row);}const close=el('button','cb-button','Close');close.onclick=()=>d.close();d.append(grid,close);document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();const heading=d.querySelector('h2');heading.tabIndex=-1;heading.focus({preventScroll:true});d.scrollTop=0;}
 function powerEffects(move){
  const stack=el('span','cb-power-effect-stack'),seen=new Set();
  for(const effect of move.effects||[]){const key=effect.type==='status'?effect.status:['shield','heal','cleanse'].includes(effect.type)?effect.type:null;if(!key||seen.has(key))continue;seen.add(key);
   const badge=el('span','cb-power-effect');badge.dataset.effect=key;
   const label=defs[key]?.[0]||{heal:'Healing',cleanse:'Cleanse debuff'}[key];badge.title=label;badge.setAttribute('role','img');badge.setAttribute('aria-label',label);
   badge.innerHTML=defs[key]?svg(key):'<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'+(key==='heal'?'<path d="M12 6h8v6h6v8h-6v6h-8v-6H6v-8h6Z" fill="#6cb67b"/>':'<path d="m16 3 4 9 9 4-9 4-4 9-4-9-9-4 9-4Z" fill="#91d8bd"/><path d="M25 3v6m-3-3h6"/>')+'</svg>';
   stack.append(badge);
  }
  return stack;
 }
 window.CBStatusIcons={create,apply,guide,defs,powerEffects};
})();
