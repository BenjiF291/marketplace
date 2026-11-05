/* Unseen achievements persist on the account; only visible own-profile cards are acknowledged. */
(()=>{
 let unread=new Set(),version=0,timer,ackTimer,pendingOwner;const pending=new Set();
 const publish=()=>window.IslandTools?.setAchievementCount(unread.size);
 const accept=data=>{unread=new Set(data.unreadIds||[]);publish();};
 async function refresh(){if(typeof currentUserId==='undefined'||!currentUserId||document.hidden)return;const owner=currentUserId,request=++version;try{const r=await fetch(API_URL+'/advancements/notifications',{headers:resourceHeaders()});if(r.ok){const data=await r.json();if(request===version&&owner===currentUserId)accept(data);}}catch{}}
 function schedule(){clearTimeout(timer);timer=setTimeout(refresh,400);}
 async function acknowledge(){const ids=[...pending];pending.clear();if(!ids.length||pendingOwner!==currentUserId)return;const request=++version;try{const r=await fetch(API_URL+'/advancements/seen',{method:'POST',headers:resourceHeaders(),body:JSON.stringify({ids})});if(r.ok){const data=await r.json();if(request===version)accept(data);else schedule();}}catch{}}
 function watch(root){const owner=currentUserId;const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting&&entry.intersectionRatio>=.6&&root.open&&!document.hidden){if(owner!==currentUserId)continue;if(pendingOwner!==owner)pending.clear();pendingOwner=owner;pending.add(entry.target.dataset.achievementId);observer.unobserve(entry.target);clearTimeout(ackTimer);ackTimer=setTimeout(acknowledge,300);}}, {root,threshold:.6});return {observe:card=>observer.observe(card),disconnect:()=>observer.disconnect()};}
 window.AchievementNotifications={refresh,schedule,watch,has:id=>unread.has(id)};
 for(const event of ['island-ready','focus','game-progress-changed'])window.addEventListener(event,schedule);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
 setInterval(refresh,30000);
})();
