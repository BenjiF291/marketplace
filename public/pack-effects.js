/* Decorative, bounded canvas effects. No rewards or purchase logic lives here. */
(()=>{
 const themes={embers:{name:'Ember Burst',colors:['#ffd777','#ff762e','#ffdcad']},aurora:{name:'Crystal Aurora',colors:['#7effce','#8abfff','#e1a2ff']},starfall:{name:'Starfall',colors:['#fff3be','#9dcaff','#d0b4ff']},tempest:{name:'Stormcaller',colors:['#9beaff','#b9adff','#ffffff']},sakura:{name:'Sakura Festival',colors:['#ffb4d5','#ffe3ef','#ffd98c']}};
 function mount(host,theme){
  if(!themes[theme])return null;
  const canvas=document.createElement('canvas');canvas.className='pack-effects-canvas';canvas.setAttribute('aria-hidden','true');host.prepend(canvas);
  const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();return null;}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),palette=themes[theme].colors;
  let width=0,height=0,frame=0,last=0,time=0,dead=false,particles=[],rings=[],bolts=[],nextAmbient=0,nextCelebration=3,preview=false;
  const mobile=innerWidth<650,limit=mobile?120:240;
  function resize(){const bounds=host.getBoundingClientRect();width=bounds.width;height=bounds.height;const ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);if(reduced.matches)paint(0);}
  function particle(x,y,vx,vy,life,size,color,shape='spark'){if(particles.length>=limit)particles.shift();particles.push({x,y,vx,vy,life,max:life,size,color,shape,rotation:Math.random()*6.28,spin:(Math.random()-.5)*3});}
  function firework(x,y,count=38){const color=palette[Math.floor(Math.random()*palette.length)];for(let i=0;i<count;i++){const angle=i/count*Math.PI*2,speed=75+Math.random()*170;particle(x,y,Math.cos(angle)*speed,Math.sin(angle)*speed,1.3+Math.random()*.6,1.5+Math.random()*2,color,theme==='starfall'?'star':'spark');}rings.push({x,y,r:5,life:.8,max:.8,color,bloom:true});}
  function lightning(x,y){const points=[[x-65,y-110]];for(let i=1;i<9;i++)points.push([x+(Math.random()-.5)*90,y-110+i*28]);bolts.push({points,life:.55,max:.55});}
  function burst(kind='card'){
   if(dead||reduced.matches||!width)return;
   const stage=host.querySelector('.reward-opening-stage')?.getBoundingClientRect(),bounds=host.getBoundingClientRect(),cx=stage?stage.left-bounds.left+stage.width/2:width/2,cy=stage?stage.top-bounds.top+stage.height*.45:height*.45;
   if(theme==='tempest'){lightning(cx-width*.23,cy);lightning(cx+width*.23,cy);}
   else if(theme==='sakura'){for(let i=0;i<(mobile?35:65);i++)particle(cx,cy,(Math.random()-.5)*430,-120-Math.random()*220,2+Math.random(),5+Math.random()*5,palette[i%3],'petal');}
   else if(theme==='aurora'){for(let i=0;i<(mobile?30:55);i++){const a=i/55*Math.PI*2;particle(cx+Math.cos(a)*90,cy+Math.sin(a)*90,Math.cos(a)*85,Math.sin(a)*85-25,1.7,4+Math.random()*3,palette[i%3],'crystal');}rings.push({x:cx,y:cy,r:80,life:1.3,max:1.3,color:palette[0]});}
   else {firework(cx-width*.23,cy-40,mobile?26:42);firework(cx+width*.23,cy+15,mobile?26:42);}
   if(kind==='open')rings.push({x:cx,y:cy,r:30,life:1.2,max:1.2,color:palette[1]});
  }
  function ambient(dt){if(time<nextAmbient)return;nextAmbient=time+.12;
   if(theme==='embers')particle(Math.random()*width,height*.9, (Math.random()-.5)*30,-40-Math.random()*70,3,1+Math.random()*3,palette[Math.floor(Math.random()*3)]);
   if(theme==='sakura')particle(Math.random()*width,-15,20+Math.random()*35,25+Math.random()*35,8,4+Math.random()*5,palette[Math.floor(Math.random()*2)],'petal');
   if(theme==='starfall'){const x=Math.random()*width;particle(x,-10,-130,170,2,2,palette[Math.floor(Math.random()*3)],'comet');}
   if(theme==='aurora')particle(Math.random()*width,height*.8,(Math.random()-.5)*20,-25,4,2+Math.random()*3,palette[Math.floor(Math.random()*3)],'crystal');
   if(theme==='tempest')particle(Math.random()*width,0,-30,160,4,1,palette[0],'rain');
   if(time>=nextCelebration&&host.dataset.phase==='cards'){nextCelebration=time+3.8;if(['embers','starfall'].includes(theme))firework(width*(Math.random()<.5?.23:.77),height*(.25+Math.random()*.3),mobile?22:36);else if(preview)burst();}
  }
  function sky(){
   if(theme==='aurora'){
    for(let j=0;j<3;j++){ctx.beginPath();for(let x=-30;x<=width+30;x+=15){const y=height*(.24+j*.065)+Math.sin(x/width*6+time*.32+j)*height*.075;if(x===-30)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.strokeStyle=palette[j];for(const [band,alpha] of [[110,.025],[76,.04],[48,.055],[26,.09],[10,.14],[2,.5]]){ctx.globalAlpha=alpha;ctx.lineWidth=band*(mobile?.65:1);ctx.stroke();}}
   }else if(theme==='tempest'){
    const g=ctx.createRadialGradient(width/2,height*.35,10,width/2,height*.35,width*.6);g.addColorStop(0,'#826ce22b');g.addColorStop(1,'#182f6c00');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
   }
   // Sparse constellations and drifting crystal glints remain legible in reduced motion.
   for(let i=0;i<22;i++){const x=((i*137+53)%997)/997*width,y=((i*73+31)%479)/479*height*.85;ctx.globalAlpha=.25+.2*Math.sin(time*.8+i);ctx.fillStyle=palette[i%3];ctx.fillRect(x,y,2,2);}
   ctx.globalAlpha=1;
  }
  function paint(dt){ctx.clearRect(0,0,width,height);sky();ctx.globalCompositeOperation=theme==='sakura'?'source-over':'lighter';
   for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(!['rain','comet','crystal'].includes(p.shape))p.vy+=45*dt;p.rotation+=p.spin*dt;ctx.save();ctx.translate(p.x,p.y);if(['petal','crystal','star'].includes(p.shape))ctx.rotate(p.rotation);ctx.globalAlpha=Math.min(1,p.life/.4)*Math.min(1,(p.max-p.life)/.12);ctx.strokeStyle=ctx.fillStyle=p.color;ctx.lineWidth=p.size;
    if(p.shape==='petal'){ctx.beginPath();ctx.ellipse(0,0,p.size*.5,p.size,0,0,Math.PI*2);ctx.fill();}
    else if(p.shape==='crystal'){ctx.beginPath();ctx.moveTo(0,-p.size);ctx.lineTo(p.size*.5,0);ctx.lineTo(0,p.size);ctx.lineTo(-p.size*.5,0);ctx.closePath();ctx.fill();}
    else if(p.shape==='star'){ctx.fillRect(-p.size*2,-.6,p.size*4,1.2);ctx.fillRect(-.6,-p.size*2,1.2,p.size*4);}
    else {ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-p.vx*(p.shape==='comet'?.15:.035),-p.vy*(p.shape==='comet'?.15:.035));ctx.stroke();}ctx.restore();
   }
   for(const r of rings){r.life-=dt;r.r+=180*dt;if(r.bloom){const glow=ctx.createRadialGradient(r.x,r.y,0,r.x,r.y,r.r*1.5);glow.addColorStop(0,r.color+'66');glow.addColorStop(.25,r.color+'22');glow.addColorStop(1,r.color+'00');ctx.globalAlpha=Math.max(0,r.life/r.max)*.5;ctx.fillStyle=glow;ctx.fillRect(r.x-r.r*1.5,r.y-r.r*1.5,r.r*3,r.r*3);}ctx.globalAlpha=Math.max(0,r.life/r.max)*.6;ctx.strokeStyle=r.color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(r.x,r.y,r.r,r.r*.6,0,0,Math.PI*2);ctx.stroke();}
   for(const b of bolts){b.life-=dt;ctx.globalAlpha=Math.max(0,b.life/b.max)*.65;for(const [w,c] of [[7,'#8d9dff'],[2,'#e5ffff']]){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();b.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}}
   particles=particles.filter(p=>p.life>0);rings=rings.filter(r=>r.life>0).slice(-8);bolts=bolts.filter(b=>b.life>0).slice(-4);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
  function tick(now){if(dead)return;frame=requestAnimationFrame(tick);if(now-last<32)return;const dt=Math.min(.05,(now-(last||now))/1000);last=now;time+=dt;ambient(dt);paint(dt);}
  function resume(){cancelAnimationFrame(frame);last=0;if(!dead&&!document.hidden&&!reduced.matches)frame=requestAnimationFrame(tick);else if(!dead)paint(0);}
  const observer=new ResizeObserver(resize);observer.observe(host);document.addEventListener('visibilitychange',resume);reduced.addEventListener?.('change',resume);resize();resume();
  return {burst,setPreview(value){preview=value;},dispose(){dead=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',resume);reduced.removeEventListener?.('change',resume);particles=[];rings=[];bolts=[];canvas.remove();}};
 }
 window.PackEffects={themes,mount};
})();
