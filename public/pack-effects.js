/* Decorative, bounded canvas effects. No rewards or purchase logic lives here. */
(()=>{
 const themes={embers:{name:'Ember Burst',colors:['#ffd777','#ff762e','#ffdcad']},aurora:{name:'Crystal Aurora',colors:['#7effce','#8abfff','#e1a2ff']},starfall:{name:'Starfall',colors:['#fff3be','#9dcaff','#d0b4ff']},tempest:{name:'Stormcaller',colors:['#9beaff','#b9adff','#ffffff']},sakura:{name:'Sakura Festival',colors:['#ffb4d5','#ffe3ef','#ffd98c']}};
 function mount(host,theme){
  if(!themes[theme])return null;
  const canvas=document.createElement('canvas');canvas.className='pack-effects-canvas';canvas.setAttribute('aria-hidden','true');host.prepend(canvas);
  const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();return null;}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),palette=themes[theme].colors;
  let width=0,height=0,frame=0,last=0,time=0,dead=false,particles=[],rings=[],bolts=[],nextAmbient=0;
  const mobile=innerWidth<650,limit=mobile?120:240;
  // Reuse soft light sprites instead of computing blur filters for every particle.
  const sprites=new Map();
  for(const color of palette){const sprite=document.createElement('canvas');sprite.width=sprite.height=48;const c=sprite.getContext('2d');if(!c)continue;const g=c.createRadialGradient(24,24,0,24,24,24);g.addColorStop(0,'#fffceb');g.addColorStop(.12,color);g.addColorStop(.35,color+'88');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(0,0,48,48);sprites.set(color,sprite);}
  function glow(x,y,size,color,alpha=1){const sprite=sprites.get(color);if(!sprite)return;ctx.save();ctx.globalAlpha*=alpha;ctx.drawImage(sprite,x-size,y-size,size*2,size*2);ctx.restore();}
  function center(){const stage=host.querySelector('.reward-opening-stage')?.getBoundingClientRect(),bounds=host.getBoundingClientRect();return {x:stage?stage.left-bounds.left+stage.width/2:width/2,y:stage?stage.top-bounds.top+stage.height*.45:height*.45};}

  function resize(){const bounds=host.getBoundingClientRect();width=bounds.width;height=bounds.height;const ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);if(reduced.matches)paint(0);}
  function particle(x,y,vx,vy,life,size,color,shape='spark'){if(particles.length>=limit)particles.shift();particles.push({x,y,vx,vy,life,max:life,size,color,shape,rotation:Math.random()*6.28,spin:(Math.random()-.5)*3});}
  function firework(x,y,count=38){const color=palette[Math.floor(Math.random()*palette.length)];for(let i=0;i<count;i++){const angle=i/count*Math.PI*2,speed=75+Math.random()*170;particle(x,y,Math.cos(angle)*speed,Math.sin(angle)*speed,1.3+Math.random()*.6,1.5+Math.random()*2,color,theme==='starfall'?'star':'spark');}rings.push({x,y,r:5,life:.8,max:.8,color,bloom:true});}
  function lightning(x,y){const points=[[x-45,y-140]];for(let i=1;i<12;i++)points.push([x+(Math.random()-.5)*65,y-140+i*24]);const branches=[];for(const i of [3,6,8]){const [bx,by]=points[i],sign=i%2?1:-1;branches.push([[bx,by],[bx+sign*22,by+12],[bx+sign*16,by+28],[bx+sign*48,by+44]]);}bolts.push({points,branches,life:.65,max:.65});bolts=bolts.slice(-4);}
  function burst(kind='open'){
   if(dead||reduced.matches||!width||host.dataset.phase!=='opening')return;
   const stage=host.querySelector('.reward-opening-stage')?.getBoundingClientRect(),bounds=host.getBoundingClientRect(),cx=stage?stage.left-bounds.left+stage.width/2:width/2,cy=stage?stage.top-bounds.top+stage.height*.45:height*.45;
   if(theme==='tempest'){lightning(cx-width*.23,cy);lightning(cx+width*.23,cy);}
   else if(theme==='sakura'){for(let i=0;i<(mobile?35:65);i++)particle(cx,cy,(Math.random()-.5)*430,-120-Math.random()*220,2+Math.random(),5+Math.random()*5,palette[i%3],'petal');}
   else if(theme==='aurora'){for(let i=0;i<(mobile?30:55);i++){const a=i/(mobile?30:55)*Math.PI*2;particle(cx+Math.cos(a)*90,cy+Math.sin(a)*90,Math.cos(a)*85,Math.sin(a)*85-25,1.7,4+Math.random()*3,palette[i%3],'crystal');}rings.push({x:cx,y:cy,r:80,life:1.3,max:1.3,color:palette[0]});}
   else {firework(cx-width*.23,cy-40,mobile?26:42);firework(cx+width*.23,cy+15,mobile?26:42);}
   if(kind==='open'){for(let j=0;j<3;j++)rings.push({x:cx,y:cy,r:18+j*17,life:1.1+j*.12,max:1.1+j*.12,color:palette[j],bloom:j===0});}
   else rings.push({x:cx,y:cy,r:16,life:.65,max:.65,color:palette[0],bloom:true});
  }
  function ambient(dt){if(time<nextAmbient)return;nextAmbient=time+.12;
   if(host.dataset.phase==='opening'){const c=center();for(let i=0;i<2;i++){const angle=time*5+i*Math.PI,r=70+25*Math.sin(time*3);particle(c.x+Math.cos(angle)*r,c.y+Math.sin(angle)*r*.8,-Math.cos(angle)*65,-Math.sin(angle)*65,.65,2,palette[i%3],'spark');}}
   if(theme==='embers')particle(Math.random()*width,height*.9, (Math.random()-.5)*30,-40-Math.random()*70,3,1+Math.random()*3,palette[Math.floor(Math.random()*3)]);
   if(theme==='sakura')particle(Math.random()*width,-15,20+Math.random()*35,25+Math.random()*35,8,4+Math.random()*5,palette[Math.floor(Math.random()*2)],'petal');
   if(theme==='starfall'){const x=Math.random()*width;particle(x,-10,-130,170,2,2,palette[Math.floor(Math.random()*3)],'comet');}
   if(theme==='aurora')particle(Math.random()*width,height*.8,(Math.random()-.5)*20,-25,4,2+Math.random()*3,palette[Math.floor(Math.random()*3)],'crystal');
   if(theme==='tempest')particle(Math.random()*width,0,-30,160,4,1,palette[0],'rain');
  }
  function sky(){
   if(theme==='aurora'){
    for(let j=0;j<3;j++){ctx.beginPath();for(let x=-30;x<=width+30;x+=15){const y=height*(.24+j*.065)+Math.sin(x/width*6+time*.32+j)*height*.075;if(x===-30)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.strokeStyle=palette[j];for(const [band,alpha] of [[110,.025],[76,.04],[48,.055],[26,.09],[10,.14],[2,.5]]){ctx.globalAlpha=alpha;ctx.lineWidth=band*(mobile?.65:1);ctx.stroke();}}
   }else if(theme==='tempest'){
    const g=ctx.createRadialGradient(width/2,height*.35,10,width/2,height*.35,width*.6);g.addColorStop(0,'#826ce22b');g.addColorStop(1,'#182f6c00');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
   }
   // Sparse constellations and drifting crystal glints remain legible in reduced motion.
   for(let i=0;i<22;i++){const x=((i*137+53)%997)/997*width,y=((i*73+31)%479)/479*height*.85;ctx.globalAlpha=.25+.2*Math.sin(time*.8+i);ctx.fillStyle=palette[i%3];glow(x,y,3+(i%3),palette[i%3],.7);if(i%5===0){ctx.fillRect(x-3,y-.4,6,.8);ctx.fillRect(x-.4,y-3,.8,6);}}
   ctx.globalAlpha=1;
  }
  function paint(dt){ctx.clearRect(0,0,width,height);sky();ctx.globalCompositeOperation=theme==='sakura'?'source-over':'lighter';
   for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(!['rain','comet','crystal'].includes(p.shape))p.vy+=45*dt;p.rotation+=p.spin*dt;ctx.save();ctx.translate(p.x,p.y);if(['petal','crystal','star'].includes(p.shape))ctx.rotate(p.rotation);ctx.globalAlpha=Math.min(1,p.life/.4)*Math.min(1,(p.max-p.life)/.12);ctx.strokeStyle=ctx.fillStyle=p.color;ctx.lineWidth=p.size;
    if(p.shape==='petal'){ctx.scale(Math.max(.25,Math.abs(Math.cos(time*2+p.rotation))),1);const g=ctx.createLinearGradient(-p.size,0,p.size,p.size);g.addColorStop(0,'#fff2f7');g.addColorStop(.45,p.color);g.addColorStop(1,'#c9679a');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,-p.size);ctx.bezierCurveTo(p.size*1.3,-p.size*.3,p.size*.6,p.size*.8,0,p.size);ctx.bezierCurveTo(-p.size*.8,p.size*.3,-p.size*.8,-p.size*.8,0,-p.size);ctx.fill();ctx.strokeStyle='#fff0f588';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(0,-p.size*.7);ctx.quadraticCurveTo(-p.size*.2,0,0,p.size*.8);ctx.stroke();}
    else if(p.shape==='crystal'){glow(0,0,p.size*3,p.color,.55);ctx.beginPath();ctx.moveTo(0,-p.size*1.5);ctx.lineTo(p.size*.7,0);ctx.lineTo(0,p.size*1.5);ctx.lineTo(-p.size*.7,0);ctx.closePath();ctx.fill();ctx.fillStyle='#ffffffaa';ctx.beginPath();ctx.moveTo(0,-p.size*1.5);ctx.lineTo(p.size*.7,0);ctx.lineTo(0,p.size*.4);ctx.closePath();ctx.fill();ctx.strokeStyle='#efffffaa';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(0,-p.size*1.5);ctx.lineTo(0,p.size*1.5);ctx.stroke();}
    else if(p.shape==='star'){glow(0,0,p.size*4,p.color,.7);ctx.beginPath();ctx.moveTo(0,-p.size*2);ctx.lineTo(p.size*.35,-p.size*.35);ctx.lineTo(p.size*2,0);ctx.lineTo(p.size*.35,p.size*.35);ctx.lineTo(0,p.size*2);ctx.lineTo(-p.size*.35,p.size*.35);ctx.lineTo(-p.size*2,0);ctx.lineTo(-p.size*.35,-p.size*.35);ctx.closePath();ctx.fill();}
    else {const tail=p.shape==='comet'?.25:.045,tx=-p.vx*tail,ty=-p.vy*tail;if(Math.abs(tx)+Math.abs(ty)>0){const g=ctx.createLinearGradient(0,0,tx,ty);g.addColorStop(0,p.color);g.addColorStop(1,p.color+'00');ctx.strokeStyle=g;}ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(tx,ty);ctx.stroke();if(p.shape!=='rain')glow(0,0,p.size*(p.shape==='comet'?6:3.5),p.color,.8);}ctx.restore();
   }
   for(const r of rings){r.life-=dt;r.r+=180*dt;if(r.bloom){const glow=ctx.createRadialGradient(r.x,r.y,0,r.x,r.y,r.r*1.5);glow.addColorStop(0,r.color+'66');glow.addColorStop(.25,r.color+'22');glow.addColorStop(1,r.color+'00');ctx.globalAlpha=Math.max(0,r.life/r.max)*.5;ctx.fillStyle=glow;ctx.fillRect(r.x-r.r*1.5,r.y-r.r*1.5,r.r*3,r.r*3);}ctx.globalAlpha=Math.max(0,r.life/r.max)*.6;ctx.strokeStyle=r.color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(r.x,r.y,r.r,r.r*.6,0,0,Math.PI*2);ctx.stroke();}
   for(const b of bolts){b.life-=dt;ctx.globalAlpha=Math.max(0,b.life/b.max)*.65;for(const [w,c] of [[16,'#777dff22'],[7,'#a0cfff66'],[2,'#f1ffff']]){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();b.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();for(const branch of b.branches||[]){ctx.lineWidth=w*.55;ctx.beginPath();branch.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}}}
   particles=particles.filter(p=>p.life>0);rings=rings.filter(r=>r.life>0).slice(-8);bolts=bolts.filter(b=>b.life>0).slice(-4);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }
  function tick(now){if(dead)return;frame=requestAnimationFrame(tick);if(now-last<32)return;const dt=Math.min(.05,(now-(last||now))/1000);last=now;time+=dt;ambient(dt);paint(dt);}
  function resume(){cancelAnimationFrame(frame);last=0;if(!dead&&!document.hidden&&!reduced.matches)frame=requestAnimationFrame(tick);else if(!dead)paint(0);}
  const observer=new ResizeObserver(resize);observer.observe(host);document.addEventListener('visibilitychange',resume);reduced.addEventListener?.('change',resume);resize();resume();
  return {burst,dispose(){dead=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',resume);reduced.removeEventListener?.('change',resume);particles=[];rings=[];bolts=[];sprites.clear();canvas.remove();}};
 }
 window.PackEffects={themes,mount};
})();
