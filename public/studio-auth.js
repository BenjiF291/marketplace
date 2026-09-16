(() => {
  const heading=document.querySelector('.auth-header h1'),subtitle=document.querySelector('.auth-header p');
  const original=[heading.textContent,subtitle.textContent];
  const toggle=document.createElement('button');toggle.type='button';toggle.className='auth-ui-toggle';document.body.append(toggle);
  let mode='studio';try{mode=localStorage.getItem('footy-ui-default')||'studio';}catch(_){}
  function apply(){document.body.classList.toggle('auth-studio',mode==='studio');heading.textContent=mode==='studio'?'Welcome to the club.':original[0];subtitle.textContent=mode==='studio'?'Your collection. Your next great game.':original[1];toggle.textContent=mode==='studio'?'Classic UI':'Try new UI';}
  toggle.onclick=()=>{mode=mode==='studio'?'classic':'studio';try{localStorage.setItem('footy-ui-default',mode);}catch(_){}apply();};apply();
})();
