/* Local room animation only: no network requests or saved movement. */
(() => {
 const pets=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)');let last=0,scale=Math.min(.95,(innerHeight-20)/960,(innerWidth-12)/480),dragging=0;
 const people=new Map();let fitRoom=null,manualZoom=false;
 window.addEventListener('resize',()=>{if(!manualZoom){scale=Math.min(.95,(innerHeight-20)/960,(innerWidth-12)/480);fitRoom?.();}});
 const goal=(s,x,y,activity)=>{s.goal={x,y,activity};s.mode='walk';};
 function attach(id,node,person,i){
  let s=pets.get(id);if(!s){s={x:[48,68,50][i],y:[37,51,68][i],mode:'idle',until:performance.now()+2000+i*1600,index:i};pets.set(id,s);}
  s.node=node;s.person=person;s.index=i;node.dataset.kind=id.split(':')[1];
  node.querySelectorAll('.companion-body > ellipse[cy="211"]').forEach((paw,n)=>paw.classList.add(n?'care-paw-right':'care-paw-left'));
  const prop=document.createElement('span');prop.className='care-action-prop';prop.setAttribute('aria-hidden','true');node.append(prop);s.prop=prop;
  let caretaker=people.get(id);if(!caretaker){caretaker={x:[22,42,26][i],y:[44,60,76][i]};people.set(id,caretaker);}
  person.style.setProperty('left',caretaker.x+'%','important');person.style.setProperty('top',caretaker.y+'%','important');
  draggable(node,s);draggable(person,caretaker);

 }
 function draggable(node,state){
  let drag=null,suppress=false;
  node.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation();suppress=false;}},true);
  node.onpointerdown=e=>{if(e.button!==0)return;const rect=node.parentElement.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:state.x,startY:state.y,rect,moved:false};state.dragging=true;dragging++;node.setPointerCapture(e.pointerId);};
  node.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<6)return;drag.moved=true;node.classList.add('care-being-moved');
   state.x=Math.max(19,Math.min(79,drag.startX+dx/drag.rect.width*100));state.y=Math.max(29,Math.min(82,drag.startY+dy/drag.rect.height*100));
   node.style.setProperty('left',state.x+'%','important');node.style.setProperty('top',state.y+'%','important');node.style.zIndex=String(Math.round(state.y));
  };
  const finish=()=>{if(!drag)return;suppress=drag.moved;drag=null;state.dragging=false;dragging=Math.max(0,dragging-1);state.goal=null;state.mode='idle';state.until=performance.now()+12000;node.classList.remove('care-being-moved');};
  node.onpointerup=finish;node.onpointercancel=finish;node.onlostpointercapture=finish;
  node.onkeydown=e=>{const d={ArrowLeft:[-3,0],ArrowRight:[3,0],ArrowUp:[0,-3],ArrowDown:[0,3]}[e.key];if(!d)return;e.preventDefault();state.x=Math.max(19,Math.min(79,state.x+d[0]));state.y=Math.max(29,Math.min(82,state.y+d[1]));state.goal=null;state.mode='idle';state.until=performance.now()+12000;node.style.setProperty('left',state.x+'%','important');node.style.setProperty('top',state.y+'%','important');};
 }
 function interact(id,action){let s=pets.get(id);if(!s)return;s.request=action;goal(s,action==='eat'?78:36+s.index*12,action==='eat'?69:49+s.index*8,action);}
 function tick(now){requestAnimationFrame(tick);const dt=Math.min(.05,(now-last)/1000||0);last=now;if(document.hidden)return;
  for(const s of pets.values()){
   if(!s.node?.isConnected||!s.node.closest('dialog')?.open)continue;
   if(s.dragging||s.node.classList.contains('care-drop-target')||s.node.matches(':hover,:focus-visible'))continue;
   if(s.mode==='walk'&&s.goal){const dx=s.goal.x-s.x,dy=(s.goal.y-s.y)*2,d=Math.hypot(dx,dy),step=(s.node.dataset.kind==='snail'?7:13)*dt;
    if(d<step||reduced.matches){s.x=s.goal.x;s.y=s.goal.y;s.mode=s.goal.activity;s.until=now+({rest:7000,eat:6500,play:7000,drink:4000,idle:2200}[s.mode]||2200);s.goal=null;}
    else{s.x+=dx/d*step;s.y+=dy/d*step/2;s.node.style.setProperty('--facing',dx<0?'-1':'1');}
   }else if(now>s.until){s.request=null;const occupied=[...pets.values()].some(o=>o!==s&&o.node?.isConnected&&(o.mode==='rest'||o.goal?.activity==='rest'));const choice=Math.random(),bowlBusy=[...pets.values()].some(o=>o!==s&&o.node?.isConnected&&(['drink','eat'].includes(o.mode)||['drink','eat'].includes(o.goal?.activity))); if(choice<.22&&!occupied)goal(s,77,17,'rest');else if(choice<.4&&!bowlBusy)goal(s,80,75,'drink');else goal(s,28+Math.random()*40,30+Math.random()*49,'idle');}
   s.node.dataset.activity=s.mode;s.node.style.left=s.x+'%';s.node.style.top=s.y+'%';s.node.style.zIndex=String(Math.round(s.y));const label=s.mode==='rest'?'z z z':s.mode==='eat'?'\u2665':s.mode==='drink'?'. . .':'';if(s.prop.textContent!==label)s.prop.textContent=label;
   if(s.mode==='play')s.prop.classList.add('care-ball');else s.prop.classList.remove('care-ball');
  }
 }
 requestAnimationFrame(tick);
 function zoom(view,scene){const controls=document.createElement('div');controls.className='care-zoom';const fit=()=>{scene.style.setProperty('width',(480*scale)+'px','important');scene.style.setProperty('min-width',(480*scale)+'px','important');scene.style.setProperty('height',(960*scale)+'px','important');scene.style.setProperty('--pet-size',(130*scale)+'px');scene.style.setProperty('--person-size',(86*scale)+'px');};for(const [label,delta] of [['-',-.1],['+',.1]]){const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label',delta<0?'Zoom out pet room':'Zoom in pet room');b.onclick=()=>{manualZoom=true;scale=Math.max(.3,Math.min(1.1,scale+delta));fit();};controls.append(b);}view.before(controls);fitRoom=fit;fit();}
 window.PetCareRoom={attach,interact,zoom,get dragging(){return dragging>0;}};
})();
