/* Installation is optional: normal browser navigation remains unchanged. */
(() => {
 if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
 let installPrompt,registration;
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const style=document.createElement('style');style.textContent='.pwa-controls{position:fixed;bottom:max(14px,env(safe-area-inset-bottom));left:14px;z-index:10000;display:flex;gap:8px}.pwa-controls button{font:13px system-ui;padding:10px 14px;border:1px solid #ccb477;border-radius:18px;background:#245950;color:#fff1cf;cursor:pointer}.pwa-help{position:fixed;inset:0;margin:auto;width:min(340px,80vw);height:fit-content;border:2px solid #bda46d;border-radius:20px;padding:25px;background:#fff3d6;color:#264a3d;font:16px/1.6 system-ui}.pwa-help h2{font:700 24px Georgia;margin:0 0 18px}.pwa-help li{padding:8px 0}.pwa-help small{display:block;font-size:12px;color:#5e776d}.pwa-help button{display:block;margin-top:18px;padding:12px 20px;background:#245950;color:#fff1cf;border:0;border-radius:12px}.pwa-help::backdrop{background:#173e4499}';document.head.append(style);
 const controls=document.createElement('div');controls.className='pwa-controls';const install=document.createElement('button');install.textContent='Install island';install.hidden=true;controls.append(install);document.body.append(controls);
 // Keep the optional button usable when the island occupies the dialog top layer.
 const place=()=>{const map=document.querySelector('#villageMap[open]');const parent=map||document.body;if(controls.parentElement!==parent)parent.append(controls);};
 new MutationObserver(place).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});place();
 function instructions(){const d=document.createElement('dialog');d.className='pwa-help';d.setAttribute('aria-label','Add your island to your iPhone');const title=document.createElement('h2');title.textContent='Your island, one tap away';const list=document.createElement('ol');for(const text of ['Tap Share in Safari (the square with an upward arrow).','Tap Add to Home Screen.','Tap Add.']){const li=document.createElement('li');li.textContent=text;list.append(li);}const tip=document.createElement('small');tip.textContent='Open this page in Safari first. If Add to Home Screen is missing, scroll down in Share or choose Edit Actions.';const b=document.createElement('button');b.textContent='Got it';b.onclick=()=>d.close();d.append(title,list,tip,b);d.onclose=()=>d.remove();document.body.append(d);d.showModal();}

 install.onclick=async()=>{if(!installPrompt){instructions();return;}try{await installPrompt.prompt();await installPrompt.userChoice;}finally{installPrompt=null;install.hidden=true;}};
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;install.hidden=standalone();});window.addEventListener('appinstalled',()=>{install.hidden=true;installPrompt=null;});
 if(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1))install.hidden=standalone();
 // Apply waiting workers at startup/login, never reload an active game.
 const registrationReady=navigator.serviceWorker.register('practice-sw.js',{updateViaCache:'none'}).then(reg=>{registration=reg;if(reg.waiting)reg.waiting.postMessage({type:'ACTIVATE_UPDATE'});return reg;}).catch(()=>null);
 async function prepareForLogin(){
  let expired=false,timer;
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>{expired=true;resolve();},5000);});
  const update=(async()=>{
   const reg=await registrationReady;if(!reg||expired)return;
   try{await reg.update();}catch{return;}if(expired)return;
   if(reg.installing){const worker=reg.installing;await new Promise(resolve=>{if(['installed','activated','redundant'].includes(worker.state))return resolve();const changed=()=>{if(['installed','activated','redundant'].includes(worker.state)){worker.removeEventListener('statechange',changed);resolve();}};worker.addEventListener('statechange',changed);});}
   if(expired||!reg.waiting)return;
   await new Promise(resolve=>{const worker=reg.waiting;const changed=()=>{if(['activated','redundant'].includes(worker.state)){worker.removeEventListener('statechange',changed);resolve();}};worker.addEventListener('statechange',changed);worker.postMessage({type:'ACTIVATE_UPDATE'});changed();});
  })().catch(()=>{});
  await Promise.race([update,timeout]);expired=true;clearTimeout(timer);
 }
 window.IslandPWA={prepareForLogin};
 // Login pages can finish an update before any game state is active.
 if(location.pathname.endsWith('/login.html'))prepareForLogin();
})();
