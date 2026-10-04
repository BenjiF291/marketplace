/* Local room animation only: no network requests or saved movement. */
(() => {
 const pets=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)');let last=0,scale=innerWidth<600?.6:.75;
 const goal=(s,x,y,activity)=>{s.goal={x,y,activity};s.mode='walk';};
 function attach(id,node,person,i){
  let s=pets.get(id);if(!s){s={x:[48,68,50][i],y:[37,51,68][i],mode:'idle',until:performance.now()+2000+i*1600,index:i};pets.set(id,s);}
  s.node=node;s.person=person;s.index=i;node.dataset.kind=id.split(':')[1];
  node.querySelectorAll('.companion-body > ellipse[cy="211"]').forEach((paw,n)=>paw.classList.add(n?'care-paw-right':'care-paw-left'));
  const prop=document.createElement('span');prop.className='care-action-prop';prop.setAttribute('aria-hidden','true');node.append(prop);s.prop=prop;
  person.style.setProperty('left',([22,42,26][i])+'%','important');person.style.setProperty('top',([44,60,76][i])+'%','important');
 }
 function interact(id,action){let s=pets.get(id);if(!s)return;s.request=action;goal(s,action==='eat'?78:36+s.index*12,action==='eat'?69:49+s.index*8,action);}
 function tick(now){requestAnimationFrame(tick);const dt=Math.min(.05,(now-last)/1000||0);last=now;if(document.hidden)return;
  for(const s of pets.values()){
   if(!s.node?.isConnected||!s.node.closest('dialog')?.open)continue;
   if(s.node.classList.contains('care-drop-target')||s.node.matches(':hover,:focus-visible'))continue;
   if(s.mode==='walk'&&s.goal){const dx=s.goal.x-s.x,dy=(s.goal.y-s.y)*2,d=Math.hypot(dx,dy),step=(s.node.dataset.kind==='snail'?7:13)*dt;
    if(d<step||reduced.matches){s.x=s.goal.x;s.y=s.goal.y;s.mode=s.goal.activity;s.until=now+({rest:7000,eat:6500,play:7000,drink:4000,idle:2200}[s.mode]||2200);s.goal=null;}
    else{s.x+=dx/d*step;s.y+=dy/d*step/2;s.node.style.setProperty('--facing',dx<0?'-1':'1');}
   }else if(now>s.until){s.request=null;const occupied=[...pets.values()].some(o=>o!==s&&o.node?.isConnected&&(o.mode==='rest'||o.goal?.activity==='rest'));const choice=Math.random(),bowlBusy=[...pets.values()].some(o=>o!==s&&o.node?.isConnected&&(['drink','eat'].includes(o.mode)||['drink','eat'].includes(o.goal?.activity))); if(choice<.22&&!occupied)goal(s,77,17,'rest');else if(choice<.4&&!bowlBusy)goal(s,80,75,'drink');else goal(s,28+Math.random()*40,30+Math.random()*49,'idle');}
   s.node.dataset.activity=s.mode;s.node.style.left=s.x+'%';s.node.style.top=s.y+'%';s.node.style.zIndex=String(Math.round(s.y));const label=s.mode==='rest'?'z z z':s.mode==='eat'?'\u2665':s.mode==='drink'?'. . .':'';if(s.prop.textContent!==label)s.prop.textContent=label;
   if(s.mode==='play')s.prop.classList.add('care-ball');else s.prop.classList.remove('care-ball');
  }
 }
 requestAnimationFrame(tick);
 function zoom(view,scene){const controls=document.createElement('div');controls.className='care-zoom';const fit=()=>{scene.style.setProperty('width',(480*scale)+'px','important');scene.style.setProperty('min-width',(480*scale)+'px','important');scene.style.setProperty('height',(960*scale)+'px','important');scene.style.setProperty('--pet-size',(130*scale)+'px');scene.style.setProperty('--person-size',(86*scale)+'px');};for(const [label,delta] of [['-',-.1],['+',.1]]){const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label',delta<0?'Zoom out pet room':'Zoom in pet room');b.onclick=()=>{scale=Math.max(.5,Math.min(1.1,scale+delta));fit();};controls.append(b);}view.before(controls);fit();}
 window.PetCareRoom={attach,interact,zoom};
})();
