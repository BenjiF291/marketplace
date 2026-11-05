/* Building-scoped boost picker. The server owns inventory and timer changes. */
(() => {
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
 const supported=new Set(['wheel','farmhouse','vault','timebank','pets','petstation','blacksmith','market','jobs']);
 const supports=id=>supported.has(id)||/^mine:\d+$/.test(id);
 const matches=(target,building)=>building==='jobs'?['farmhouse','vault','timebank'].includes(target.building)||target.building?.startsWith('mine:'):target.building===building;
 const duration=ms=>{const seconds=Math.max(0,Math.ceil(ms/1000)),h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return `${h}h ${m}m ${s}s`;};
 const minutes=n=>Number.isInteger(n)?String(n):String(Math.round(n*100)/100);
 let dialog,building,name,data,receivedAt=0,tickId,version=0,busy=false,pending=null,token='skip',quantity=1,selected='',nodes;
 const pendingKey=()=>`time-skip-pending:${currentUserId}`;
 const remaining=t=>Math.max(0,t.remaining-(Date.now()-receivedAt));
 const timers=()=>data?.targets.filter(t=>matches(t,building)&&remaining(t)>0)||[];
 async function request(path,body){const response=await fetch(API_URL+path,{signal:AbortSignal.timeout(15000),headers:resourceHeaders(),...(body?{method:'POST',body:JSON.stringify(body)}:{})});if(!response.ok){const text=await response.text();const error=Error(response.status===404?'Time skip is unavailable on this server. Update and restart the game server.':text||'Could not reach the game server.');error.status=response.status;throw error;}return response.json();}
 function setData(value){data=value;receivedAt=Date.now();if(!data.inventory[token]&&data.inventory[token==='skip'?'leap':'skip'])token=token==='skip'?'leap':'skip';}
 function readPending(){try{const p=JSON.parse(localStorage.getItem(pendingKey())||'null');return p?.action==='time-use'&&typeof p.actionId==='string'?p:null;}catch{return null;}}
 async function load(){const id=++version;nodes.message.textContent='Loading your timers...';try{const value=await request('/village/time-skips');if(id!==version||!dialog.open)return;setData(value);nodes.message.textContent='';paint();}catch(error){if(id!==version||!dialog.open)return;nodes.message.textContent=error.message;nodes.refresh.hidden=false;}}
 function selectBoost(value){if(busy||pending)return;token=value;quantity=1;paint();}
 function paint(){
  if(!dialog?.open||!data)return;
  const available=timers(),previous=nodes.target.value||selected;
  if(nodes.target.options.length!==available.length||available.some((t,i)=>nodes.target.options[i]?.value!==t.id)){
   nodes.target.replaceChildren(...available.map(t=>new Option(t.name,t.id)));
  }
  selected=available.some(t=>t.id===previous)?previous:available[0]?.id||'';nodes.target.value=selected;
  const target=available.find(t=>t.id===selected),left=target?remaining(target):0,perBoost=(data.boostMinutes?.[token]||(token==='skip'?20:60))*60000;
  const owned=Math.max(0,Math.floor(Number(data.inventory[token])||0)),maximum=target?Math.min(owned,Math.ceil(left/perBoost)):0;
  quantity=maximum?Math.min(maximum,Math.max(1,Math.floor(Number(quantity)||1))):0;
  const reduction=Math.min(left,quantity*perBoost),after=Math.max(0,left-reduction),locked=busy||!!pending;
  nodes.target.disabled=locked||!available.length;nodes.target.hidden=!available.length;
  nodes.empty.hidden=!!available.length;nodes.empty.textContent='No active timers in '+name+'. Start a task or wait for a cooldown to begin.';
  nodes.clock.textContent=target?duration(left):'All ready';
  for(const type of ['skip','leap']){
   const card=nodes.cards[type];card.button.setAttribute('aria-pressed',String(token===type));card.button.disabled=locked||!Number(data.inventory[type]);
   card.minutes.textContent=minutes(data.boostMinutes?.[type]||(type==='skip'?20:60))+' min';card.owned.textContent=String(data.inventory[type]||0)+' owned';
  }
  nodes.range.max=nodes.count.max=String(Math.max(1,maximum));nodes.range.value=nodes.count.value=String(quantity);
  nodes.range.disabled=nodes.count.disabled=locked||!maximum;nodes.minus.disabled=locked||quantity<=1;nodes.plus.disabled=locked||quantity>=maximum;nodes.finish.disabled=locked||!maximum;
  nodes.summary.textContent=target?`Time removed: ${duration(reduction)}`:'Choose a timer to speed up';nodes.after.textContent=target?(after?'After use: '+duration(after):'Ready after use'):'Your boosts stay in your inventory.';
  nodes.fill.style.width=(left?reduction/left*100:0)+'%';
  nodes.note.textContent=target&&quantity*perBoost>left?'The last boost finishes this timer. Its unused minutes are lost.':'Rewards are collected at the usual building.';
  nodes.use.disabled=busy||(!pending&&!maximum);
  nodes.use.textContent=busy?'Applying...':pending?'Retry previous use':`Use ${quantity||0} ${token==='skip'?(quantity===1?'Skip':'Skips'):(quantity===1?'Leap':'Leaps')}`;
  nodes.refresh.disabled=busy;nodes.close.disabled=busy;
 }
 async function use(){
  if(busy)return;
  if(!pending){paint();if(!quantity||!selected)return;pending={action:'time-use',target:selected,token,count:quantity,actionId:crypto.randomUUID()};try{localStorage.setItem(pendingKey(),JSON.stringify(pending));}catch{}}
  busy=true;version++;paint();nodes.message.textContent='Applying your time boost...';
  try{
   const result=await request('/village/action',pending),used=result.boostUse,oldTarget=pending.target;
   try{localStorage.removeItem(pendingKey());}catch{}pending=null;
   const bank=result.economy.timeBank;setData({serverNow:result.economy.serverNow,inventory:bank.inventory,boostMinutes:bank.boostMinutes,targets:bank.targets});
   nodes.message.textContent=result.replayed?'Previous use confirmed. Your inventory and timers are up to date.':`Used ${used?.count||0} ${used?.token==='leap'?'Time Leap':'Time Skip'}${used?.count===1?'':'s'}.`;
   window.dispatchEvent(new CustomEvent('village-state-changed',{detail:result}));
   window.dispatchEvent(new CustomEvent('time-skips-used',{detail:{target:oldTarget}}));
   if(oldTarget==='daily-pack'||oldTarget.startsWith('pack/'))window.dispatchEvent(new Event('pack-timers-changed'));
   if(/^(journey|play|feed)\//.test(oldTarget))window.dispatchEvent(new Event('pet-care-changed'));
  }catch(error){if(error.status>=400&&error.status<500){try{localStorage.removeItem(pendingKey());}catch{}pending=null;nodes.message.textContent=error.message;}else nodes.message.textContent=error.message+' Retry to confirm this same use safely.';}
  finally{busy=false;paint();}
 }
 function build(){
  dialog=el('dialog','time-skip-dialog');dialog.setAttribute('aria-labelledby','timeSkipTitle');
  const header=el('header','time-skip-header'),titles=el('div'),title=el('h1','','Time skip');title.id='timeSkipTitle';
  const subtitle=el('p'),close=el('button','time-skip-close','\u00d7');close.type='button';close.setAttribute('aria-label','Close Time skip');close.onclick=()=>dialog.close();titles.append(title,subtitle);header.append(titles,close);
  const panel=el('section','time-skip-panel'),target=el('select','time-skip-target');target.setAttribute('aria-label','Building timer');target.onchange=()=>{quantity=1;selected=target.value;paint();};
  const clock=el('strong','time-skip-clock','Loading...'),empty=el('p','time-skip-empty'),cardsWrap=el('div','time-skip-cards'),cards={};
  for(const type of ['skip','leap']){
   const button=el('button','time-skip-card');button.type='button';button.dataset.boost=type;button.onclick=()=>selectBoost(type);button.setAttribute('aria-pressed','false');
   const icon=el('span','time-skip-art');icon.innerHTML='<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M25 13h50v8H25Zm0 66h50v8H25Z" fill="#d6b265" stroke="#705436" stroke-width="2"/><path d="M31 21q0 17 14 29-14 12-14 29h38q0-17-14-29 14-12 14-29Z" fill="#a3d3c151" stroke="#e2c78d" stroke-width="3"/><path d="m36 30 14 17 14-17m-28 42 14-17 14 17" fill="'+(type==='skip'?'#e2bc68':'#a58fce')+'"/><path d="M50 49v18" stroke="#f8e2a1" stroke-width="2"/></svg>';
   const minutes=el('strong','time-skip-minutes'),owned=el('small','time-skip-owned');button.append(icon,el('span','',type==='skip'?'Time Skip':'Time Leap'),minutes,owned);cardsWrap.append(button);cards[type]={button,minutes,owned};
  }
  const controls=el('div','time-skip-quantity'),label=el('label','','How many?'),count=el('input');count.id='timeSkipCount';count.type='number';count.min='1';count.step='1';count.inputMode='numeric';label.htmlFor=count.id;
  const minus=el('button','','\u2212'),plus=el('button','','+'),range=el('input');minus.type=plus.type='button';minus.setAttribute('aria-label','Use one fewer boost');plus.setAttribute('aria-label','Use one more boost');range.type='range';range.min='1';range.step='1';range.setAttribute('aria-label','Number of time boosts');
  count.onchange=range.oninput=event=>{quantity=Number(event.target.value);paint();};minus.onclick=()=>{quantity--;paint();};plus.onclick=()=>{quantity++;paint();};
  controls.append(label,minus,count,plus);const finish=el('button','time-skip-finish','Enough to finish');finish.type='button';finish.onclick=()=>{const t=timers().find(t=>t.id===selected);if(t)quantity=Math.ceil(remaining(t)/((data.boostMinutes?.[token]||(token==='skip'?20:60))*60000));paint();};
  const summary=el('strong','time-skip-summary'),track=el('div','time-skip-track'),fill=el('span'),after=el('p','time-skip-after'),note=el('p','time-skip-note'),message=el('p','time-skip-message');track.setAttribute('aria-hidden','true');track.append(fill);message.setAttribute('role','status');
  const useButton=el('button','time-skip-use','Use'),refresh=el('button','time-skip-refresh','Refresh timers');useButton.type=refresh.type='button';useButton.onclick=use;refresh.onclick=()=>load();
  panel.append(target,clock,empty,cardsWrap,controls,range,finish,summary,track,after,note,useButton,message,refresh);dialog.append(header,panel);document.body.append(dialog);
  nodes={subtitle,target,clock,empty,cards,count,range,minus,plus,finish,summary,fill,after,note,message,use:useButton,refresh,close};
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>{version++;clearInterval(tickId);});
 }
 async function open(options){
  if(!supports(options.building)||busy)return;if(!dialog)build();
  building=options.building;name=options.name||'This building';version++;data=null;selected='';quantity=1;pending=readPending();nodes.subtitle.textContent=name;
  nodes.target.replaceChildren();nodes.clock.textContent='Loading...';nodes.empty.hidden=true;nodes.message.textContent='';nodes.summary.textContent='';nodes.after.textContent='';nodes.fill.style.width='0';
  dialog.querySelectorAll('button,input,select').forEach(n=>n.disabled=n!==nodes.close&&n!==nodes.refresh);
  if(!dialog.open)dialog.showModal();clearInterval(tickId);tickId=setInterval(()=>{if(!document.hidden)paint();},1000);
  await load();if(pending){nodes.message.textContent='An earlier boost use needs confirmation. Retry previous use safely before choosing another.';paint();}
 }
 window.TimeSkips={open,supports};
})();
