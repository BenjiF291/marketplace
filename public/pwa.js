/* Installation is optional: normal browser navigation remains unchanged. */
(() => {
 if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
 let installPrompt,registration;
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const style=document.createElement('style');style.textContent='.pwa-controls{position:fixed;bottom:max(14px,env(safe-area-inset-bottom));left:14px;z-index:10000;display:flex;gap:8px}.pwa-controls button{font:13px system-ui;padding:10px 14px;border:1px solid #ccb477;border-radius:18px;background:#245950;color:#fff1cf;cursor:pointer}.pwa-help{position:fixed;inset:0;margin:auto;width:min(340px,80vw);height:fit-content;border:2px solid #bda46d;border-radius:20px;padding:25px;background:#fff3d6;color:#264a3d;font:16px/1.6 system-ui}.pwa-help::backdrop{background:#173e4499}';document.head.append(style);
 const controls=document.createElement('div');controls.className='pwa-controls';const install=document.createElement('button');install.textContent='Install island';install.hidden=true;controls.append(install);document.body.append(controls);
 // Keep the optional button usable when the island occupies the dialog top layer.
 const place=()=>{const map=document.querySelector('#villageMap[open]');const parent=map||document.body;if(controls.parentElement!==parent)parent.append(controls);};
 new MutationObserver(place).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});place();
 function instructions(){const d=document.createElement('dialog');d.className='pwa-help';const p=document.createElement('p');p.textContent='On iPhone or iPad, open this website in Safari. Open Share, choose Add to Home Screen, then Add. The website remains available in your browser too.';const b=document.createElement('button');b.textContent='Got it';b.onclick=()=>d.close();d.append(p,b);d.onclose=()=>d.remove();document.body.append(d);d.showModal();}
 install.onclick=async()=>{if(!installPrompt){instructions();return;}try{await installPrompt.prompt();await installPrompt.userChoice;}finally{installPrompt=null;install.hidden=true;}};
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;install.hidden=standalone();});window.addEventListener('appinstalled',()=>{install.hidden=true;installPrompt=null;});
 if(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1))install.hidden=standalone();
 function offerUpdate(){if(!registration.waiting||controls.querySelector('[data-update]'))return;const b=document.createElement('button');b.dataset.update='true';b.textContent='Update ready - reload';b.onclick=()=>{navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});registration.waiting?.postMessage({type:'ACTIVATE_UPDATE'});};controls.append(b);}
 navigator.serviceWorker.register('practice-sw.js',{updateViaCache:'none'}).then(reg=>{registration=reg;offerUpdate();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offerUpdate();});});}).catch(()=>{/* Installation failure must not stop the website. */});
})();
