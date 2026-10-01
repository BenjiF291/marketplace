/* Runs before the app so the saved title is present before the first paint. */
(() => {
 const root=document.getElementById('islandLoading');
 let name='Your island',value=0;
 const key=()=>`footy-island-name:${localStorage.getItem('userId')}`;
 try{name=localStorage.getItem(key())||name;}catch{}
 function title(next){name=next||'Your island';document.querySelectorAll('[data-island-name]').forEach(n=>n.textContent=name);if(next)try{localStorage.setItem(key(),next);}catch{}}
 function progress(next,stage){value=Math.max(value,Math.min(100,next));document.querySelectorAll('.island-loader-content').forEach(n=>{n.querySelector('progress').value=value;n.querySelector('[data-load-percent]').textContent=Math.round(value)+'%';n.querySelector('[data-load-stage]').textContent=stage;});}
 function reset(){value=0;root.classList.remove('island-load-error');progress(5,'Sailing to your island...');}
 function content(){return root.querySelector('.island-loader-content').cloneNode(true);}
 title(name==='Your island'?null:name);
 window.IslandLoading={title,progress,reset,content};
})();
