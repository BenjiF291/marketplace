const crypto=require('node:crypto');const world=require('./public/hall-world');
const progress=require('./town-hall-progress');const displays=require('./hall-displays');
const DECOR=require('./ruby-shop').CATALOG.filter(x=>x.kind==='relic');
module.exports=(app,db,authenticate,clock=Date.now)=>{
 const tokens=new Map(),members=new Map(),accounts=new Map(),messages=[],invites=new Map();let cached=null,cacheUntil=0;
 const ref=db.collection('communityRooms').doc('town-hall');
 const seen=new Map();
 async function room(viewer){
  if(!cached||clock()>cacheUntil){const doc=await ref.get();cached={level:1,revision:0,decor:{},...(doc.data()||{})};cacheUntil=clock()+15000;}
  // One-time, deployment-safe reset requested by the owner. Clear old shelves without awarding XP or destroying inventory.
  if(cached.displayRulesVersion!==2){cached=await db.runTransaction(async tx=>{const r={revision:0,decor:{},...((await tx.get(ref)).data()||{})};if(r.displayRulesVersion===2)return r;const next={...r,decor:{},displayRulesVersion:2,revision:r.revision+(Object.keys(r.decor).length?1:0)};tx.set(ref,next);return next;});seen.clear();}
  const now=clock(),known=seen.get(viewer)||new Set(),entries=Object.values(cached.decor||{});
  if(!entries.some(d=>!d.broken&&(!d.id||now>=Math.min(d.breakAt,d.startedAt+displays.rates(d.item).period-(d.elapsed%displays.rates(d.item).period))||d.owner!==viewer&&!known.has(d.id))))return cached;
  const result=await db.runTransaction(async tx=>{
   const r={revision:0,decor:{},...((await tx.get(ref)).data()||{})},users=new Map(),receipts=new Map(),changedUsers=new Set(),observed=[];let changed=false;
   for(const owner of new Set(Object.values(r.decor).map(d=>d.owner))){const ur=db.collection('users').doc(owner);users.set(owner,{ref:ur,user:(await tx.get(ur)).data()||{}});}
   for(const d of Object.values(r.decor))if(!d.id&&!d.broken){Object.assign(d,displays.resume(displays.cycle(now),now));changed=true;}
   for(const d of Object.values(r.decor)){if(d.id&&!d.broken&&d.owner!==viewer&&!known.has(d.id)){const rr=db.collection('hallDisplayViews').doc(crypto.createHash('sha256').update(d.id+':'+viewer).digest('hex'));receipts.set(d.id,{ref:rr,exists:(await tx.get(rr)).exists});}}
   for(const [slot,raw] of Object.entries(r.decor)){
    let d=raw;if(d.broken)continue;
    if(!d.id){d={...d,...displays.resume(displays.cycle(now),now)};changed=true;}
    const owner=users.get(d.owner),step=displays.advance(d,now);let gain=step.xp;
    if(step.display.broken){d=step.display;owner.user.rubyItems={...owner.user.rubyItems,[d.item]:Math.max(0,(owner.user.rubyItems?.[d.item]||0)-1)};owner.user.hallDisplayCycles={...owner.user.hallDisplayCycles};delete owner.user.hallDisplayCycles[d.item];changedUsers.add(d.owner);changed=true;}
    else {if(gain){d=step.display;changed=true;}if(d.owner!==viewer&&!known.has(d.id)){const receipt=receipts.get(d.id);if(receipt&&!receipt.exists){gain+=displays.rates(d.item).visitor;tx.set(receipt.ref,{display:d.id,viewer,at:now});}if(receipt)observed.push(d.id);}}
    if(gain){Object.assign(owner.user,progress.grant(owner.user,gain,'Town Hall display',now));changedUsers.add(d.owner);}r.decor[slot]=d;
   }
   if(changed){r.revision++;tx.set(ref,r);}for(const id of changedUsers){const u=users.get(id);tx.set(u.ref,u.user);}return {room:r,users,observed};
  });
  cached=result.room;for(const [id,u] of result.users)if(accounts.has(id))accounts.set(id,u.user);for(const id of result.observed)known.add(id);seen.set(viewer,known);return cached;
 }

 function clean(){const now=clock();for(const [token,s] of tokens)if(s.expires<=now)tokens.delete(token);for(const [id,m] of members)if(now-m.lastSeen>12000)members.delete(id);for(const [id,v] of invites)if(v.expires<now)invites.delete(id);}
 function session(req){clean();const s=tokens.get(req.header('X-Hall-Token'));if(!s)throw Error('Your room session ended. Re-enter the Town Hall.');s.expires=clock()+5*60000;return s;}
 async function snapshot(id){const r=await room(id);clean();return {self:id,serverNow:clock(),members:[...members.values()].map(({lastSeen,lastAction,lastChat,...m})=>m),invites:[...invites.values()].filter(v=>v.to===id||v.from===id),messages:messages.slice(-30),room:{revision:r.revision,decor:Object.fromEntries(Object.entries(r.decor||{}).filter(([,v])=>v.owner&&DECOR.some(i=>i.id===v.item)))},progress:progress.profile(accounts.get(id)),owned:accounts.get(id)?.rubyItems||{},resources:require('./gem-wallet').wallet(accounts.get(id)?.gems),projects:progress.PROJECTS,rewards:progress.REWARDS,catalog:DECOR,seats:world.SEATS};}
 function seated(m){return m&&m.seat!==null&&Math.hypot(world.position(m,clock()).x-world.SEATS[m.seat].x,world.position(m,clock()).y-world.SEATS[m.seat].y)<15;}
 app.post('/admin/town-hall/join',async(req,res)=>{
  let id;try{id=await authenticate(req);}catch{return res.status(401).send('Please log in again.');}
  try{const doc=await db.collection('users').doc(id).get();const u=doc.data();if(!u)return res.status(403).send('Account not found.');
   accounts.set(id,u);clean();if(members.size>=40&&!members.has(id))throw Error('The room is full. Try again shortly.');
   const token=crypto.randomBytes(32).toString('hex');tokens.set(token,{id,expires:clock()+5*60000});
   if(!members.has(id))members.set(id,{id,name:String(u.username||'Player').slice(0,40),character:world.character(u.townHallCharacter),path:[{x:450,y:510}],startedAt:clock(),seat:null,lastSeen:clock()});else{members.get(id).lastSeen=clock();members.get(id).character=world.character(u.townHallCharacter);}
   res.json({token,...await snapshot(id)});
  }catch(e){res.status(400).send(e.message);}
 });
 app.get('/admin/town-hall/state',async(req,res)=>{try{const s=session(req),m=members.get(s.id);if(!m)throw Error('Re-enter the Town Hall.');m.lastSeen=clock();res.json(await snapshot(s.id));}catch(e){res.status(401).send(e.message);}});
 app.post('/admin/town-hall/action',async(req,res)=>{
  try{const s=session(req),m=members.get(s.id);if(!m)throw Error('Re-enter the Town Hall.');const b=req.body||{},now=clock();m.lastSeen=now;
   if(b.type==='leave'){tokens.delete(req.header('X-Hall-Token'));if(![...tokens.values()].some(t=>t.id===s.id))members.delete(s.id);return res.json({success:true});}
   if(now-(m.lastAction||0)<100)throw Error('Please wait a moment.');m.lastAction=now;
   if(b.type==='move'){const to={x:Number(b.x),y:Number(b.y)};m.path=world.route(world.position(m,now),to);m.startedAt=now;m.seat=null;}
   else if(b.type==='sit'){if(!Number.isInteger(b.seat)||!world.SEATS[b.seat])throw Error('Choose a seat.');if([...members.values()].some(p=>p.id!==s.id&&p.seat===b.seat))throw Error('Someone is already sitting there.');m.path=world.route(world.position(m,now),world.SEATS[b.seat]);m.startedAt=now;m.seat=b.seat;}
   else if(b.type==='stand'){m.seat=null;}
   else if(b.type==='chat'||b.type==='emote'){if(now-(m.lastChat||0)<1200)throw Error('Please wait before speaking again.');const text=b.type==='emote'?({wave:'waves hello',cheer:'cheers!',laugh:'laughs',clap:'applauds'})[b.emote]:String(b.text||'').trim();if(!text||text.length>180)throw Error('Write a message of 1–180 characters.');m.lastChat=now;m.bubble={text,until:now+5000};messages.push({id:crypto.randomUUID(),name:m.name,text,emote:b.type==='emote',at:now});if(messages.length>40)messages.shift();}
   else if(b.type==='refresh'){const u=(await db.collection('users').doc(s.id).get()).data();accounts.set(s.id,u);cacheUntil=0;}
   else if(b.type==='project'){throw Error('Resource-for-XP projects have been retired. Earn XP by playing.');}
   else if(b.type==='character'){const ref=db.collection('users').doc(s.id),character=await db.runTransaction(async tx=>{const owner=(await tx.get(ref)).data(),next=require('./public/wardrobe').validate(owner,b.character);tx.update(ref,{townHallCharacter:next});return next;});m.character=character;}
   else if(b.type==='invite'){
    const other=members.get(b.target);if(!seated(m)||!seated(other)||other.id===m.id)throw Error('Both players need to be seated at the table.');
    if(!Number.isInteger(b.averageLimit)||b.averageLimit<1||b.averageLimit>99||!Number.isInteger(b.timeControlSeconds)||b.timeControlSeconds<15||b.timeControlSeconds>3600)throw Error('Choose a valid deck limit and time control.');
    if([...invites.values()].some(v=>v.from===m.id&&!v.matchId))throw Error('Your previous invitation is still waiting.');
    const id=crypto.randomUUID();invites.set(id,{id,from:m.id,to:other.id,name:m.name,averageLimit:b.averageLimit,timeControlSeconds:b.timeControlSeconds,expires:now+60000});
   }else if(b.type==='accept'){
    const invite=invites.get(b.inviteId);if(!invite||invite.to!==m.id)throw Error('That invitation is no longer available.');
    const other=members.get(invite.from);if(!seated(m)||!seated(other))throw Error('Both players must still be seated.');
    const matchRef=db.collection('battleMatches').doc('hall-'+invite.id);
    await db.runTransaction(async tx=>{const existing=await tx.get(matchRef);if(!existing.exists)tx.set(matchRef,require('./battle-match-create')(other,m,invite.averageLimit,0,invite.timeControlSeconds,new Date(now)));});
    invite.matchId=matchRef.id;m.matchId=matchRef.id;other.matchId=matchRef.id;
   }else if(b.type==='decline'){const invite=invites.get(b.inviteId);if(invite&&(invite.to===m.id||invite.from===m.id))invites.delete(invite.id);}
   else if(b.type==='decorate'||b.type==='clean-display'){
    await room(s.id);
    if(!Number.isInteger(b.slot)||b.slot<0||b.slot>7||b.type==='decorate'&&b.item!==null&&!DECOR.some(d=>d.id===b.item))throw Error('Choose an owned collectible and shelf.');
    const userRef=db.collection('users').doc(s.id);
    const result=await db.runTransaction(async tx=>{const doc=await tx.get(ref),userDoc=await tx.get(userRef),u=userDoc.data(),r={revision:0,decor:{},...(doc.data()||{})};
     if(b.revision!==r.revision){cacheUntil=0;throw Error('The hall changed. Refresh and try again.');}
     const old=r.decor[b.slot],next={...r,revision:r.revision+1,decor:{...r.decor}};
     if(b.type==='clean-display'){
      if(!old?.broken)throw Error('This display does not need cleaning.');
      Object.assign(u,progress.grant(u,displays.rates(old.item).cleanup,'Display cleanup',now));delete next.decor[b.slot];
     }else{
      if(old)throw Error('This shelf is occupied. Displays stay until they break and are cleaned up.');
      if(b.item===null)throw Error('Displays cannot be taken down. They stay until they break.');
      if(!(u.rubyItems?.[b.item]>0))throw Error('Buy this collectible in the Ruby shop first.');
      if(Object.values(r.decor).some(v=>v.owner===s.id&&v.item===b.item&&!v.broken))throw Error('That collectible is already on display.');
      if(Object.values(r.decor).filter(v=>v.owner===s.id&&!v.broken).length>=3)throw Error('You can display at most three collectibles.');
      next.decor[b.slot]={...displays.resume(displays.cycle(now),now),item:b.item,by:m.name,owner:s.id};
     }
     tx.set(userRef,u);tx.set(ref,next);return {room:next,user:u};
    });cached=result.room;cacheUntil=now+15000;accounts.set(s.id,result.user);
   }else throw Error('Unknown room action.');
   res.json(await snapshot(s.id));
  }catch(e){res.status(400).send(e.message);}
 });
};
