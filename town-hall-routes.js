const crypto=require('node:crypto');const world=require('./public/hall-world');
const progress=require('./town-hall-progress');
const DECOR=require('./ruby-shop').CATALOG.filter(x=>x.kind==='relic');
module.exports=(app,db,authenticate,clock=Date.now)=>{
 const tokens=new Map(),members=new Map(),accounts=new Map(),messages=[],invites=new Map();let cached=null,cacheUntil=0;
 const ref=db.collection('communityRooms').doc('town-hall');
 async function room(){if(!cached||clock()>cacheUntil){const doc=await ref.get();cached={level:1,revision:0,decor:{},...(doc.data()||{})};cacheUntil=clock()+15000;}return cached;}
 function clean(){const now=clock();for(const [token,s] of tokens)if(s.expires<=now)tokens.delete(token);for(const [id,m] of members)if(now-m.lastSeen>12000)members.delete(id);for(const [id,v] of invites)if(v.expires<now)invites.delete(id);}
 function session(req){clean();const s=tokens.get(req.header('X-Hall-Token'));if(!s)throw Error('Your room session ended. Re-enter the Town Hall.');return s;}
 async function snapshot(id){const r=await room();clean();return {self:id,serverNow:clock(),members:[...members.values()].map(({lastSeen,lastAction,lastChat,...m})=>m),invites:[...invites.values()].filter(v=>v.to===id||v.from===id),messages:messages.slice(-30),room:{revision:r.revision,decor:Object.fromEntries(Object.entries(r.decor||{}).filter(([,v])=>v.owner&&DECOR.some(i=>i.id===v.item)))},progress:progress.profile(accounts.get(id)),owned:accounts.get(id)?.rubyItems||{},resources:accounts.get(id)?.gems||{},projects:progress.PROJECTS,rewards:progress.REWARDS,catalog:DECOR,seats:world.SEATS};}
 function seated(m){return m&&m.seat!==null&&Math.hypot(world.position(m,clock()).x-world.SEATS[m.seat].x,world.position(m,clock()).y-world.SEATS[m.seat].y)<15;}
 app.post('/admin/town-hall/join',async(req,res)=>{
  let id;try{id=await authenticate(req);}catch{return res.status(401).send('Please log in again.');}
  try{const doc=await db.collection('users').doc(id).get();const u=doc.data();if(!u)return res.status(403).send('Account not found.');
   accounts.set(id,u);clean();if(members.size>=40&&!members.has(id))throw Error('The room is full. Try again shortly.');
   const token=crypto.randomBytes(32).toString('hex');tokens.set(token,{id,expires:clock()+5*60000});
   if(!members.has(id))members.set(id,{id,name:String(u.username||'Player').slice(0,40),character:world.character(u.townHallCharacter),path:[{x:450,y:510}],startedAt:clock(),seat:null,lastSeen:clock()});else members.get(id).lastSeen=clock();
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
   else if(b.type==='character'){const character=world.character(b.character);await db.collection('users').doc(s.id).update({townHallCharacter:character});m.character=character;}
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
   else if(b.type==='decorate'){
    if(!Number.isInteger(b.slot)||b.slot<0||b.slot>7||b.item!==null&&!DECOR.some(d=>d.id===b.item))throw Error('Choose an owned collectible and shelf.');
    const userRef=db.collection('users').doc(s.id);
    const result=await db.runTransaction(async tx=>{const doc=await tx.get(ref),userDoc=await tx.get(userRef),u=userDoc.data(),r={revision:0,decor:{},...(doc.data()||{})};
     if(b.revision!==r.revision){cacheUntil=0;throw Error('The hall changed. Refresh and try again.');}
     const old=r.decor[b.slot];if(old?.owner&&old.owner!==s.id&&u.isAdmin!==true)throw Error('Only its owner can remove that display.');
     if(b.item!==null){if(!(u.rubyItems?.[b.item]>0))throw Error('Buy this collectible in the Ruby shop first.');if(Object.entries(r.decor).some(([slot,v])=>Number(slot)!==b.slot&&v.owner===s.id&&v.item===b.item))throw Error('That collectible is already on display.');}
     const next={revision:r.revision+1,decor:{...r.decor}};if(b.item===null)delete next.decor[b.slot];else next.decor[b.slot]={item:b.item,by:m.name,owner:s.id};
     let update={};if(b.item!==null&&!(u.townHallShowcased||[]).includes(b.item)){update={...progress.gameplay(u,'collectible display',now),townHallShowcased:[...(u.townHallShowcased||[]),b.item]};tx.set(userRef,{...u,...update});}
     tx.set(ref,next);return {room:next,user:{...u,...update}};
    });cached=result.room;cacheUntil=now+15000;accounts.set(s.id,result.user);
   }else throw Error('Unknown room action.');
   res.json(await snapshot(s.id));
  }catch(e){res.status(400).send(e.message);}
 });
};
