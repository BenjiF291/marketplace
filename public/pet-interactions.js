/* Interactions are local; only feeding and journey actions spend resources. */
window.showPetInteraction=(id,name,{feed,journey}={})=>{
 const old=document.getElementById('petInteraction');if(old)old.remove();
 const d=document.createElement('dialog');d.id='petInteraction';d.className='ruby-dialog pet-interaction';
 const title=document.createElement('h2');title.textContent=name;const art=document.createElement('div');art.className='pet-play-art';art.innerHTML=companionArt(id);
 const message=document.createElement('p');message.setAttribute('role','status');message.textContent='What shall we do?';
 const controls=document.createElement('div');controls.className='companion-mode-controls';let timer;
 const add=(label,action)=>{const b=document.createElement('button');b.textContent=label;b.onclick=action;controls.append(b);};
 for(const [label,mood,text] of [['Pet','pet','Happy head scratches!'],['Play fetch','fetch','Go get the crystal!'],['Dance','dance','A little victory dance!'],['Nap','nap','A cosy little snooze.']])add(label,()=>{clearTimeout(timer);art.dataset.mood='';void art.offsetWidth;art.dataset.mood=mood;message.textContent=text;timer=setTimeout(()=>delete art.dataset.mood,4000);});
 if(feed)add('Give Crystal Crunch',async event=>{const button=event.currentTarget;button.disabled=true;try{const result=await feed();message.textContent=result?.success?'Crunch! Thank you for the treat.':result?.error||'Please wait for your current action to finish.';}catch(e){message.textContent=e.message;}finally{button.disabled=false;}});
 if(journey)add('Plan a journey',()=>{d.close();journey();});
 add('Close',()=>d.close());d.append(title,art,message,controls);document.body.append(d);d.addEventListener('close',()=>{clearTimeout(timer);d.remove();},{once:true});d.showModal();
};
