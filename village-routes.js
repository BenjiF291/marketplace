const layout=require('./public/village-layout'),economy=require('./village-economy');
module.exports=(app,db,authenticate,getTiers)=>{
 app.get('/village/time-skips',async(req,res)=>{
  let id;try{id=await authenticate(req);}catch{return res.status(401).send('Please log in again.');}
  try{const doc=await db.collection('users').doc(id).get();if(!doc.exists)throw Error('Account not found.');
   const user=doc.data(),now=Date.now(),context=await require('./pack-timing').loadContext(db,user),bank=require('./time-bank').profile(user,now,context);
   res.json({serverNow:now,inventory:bank.inventory,boostMinutes:bank.boostMinutes,targets:bank.targets});
  }catch(e){res.status(400).send(e.message);}
 });
 app.get('/admin/village',async(req,res)=>{
  let id;try{id=await authenticate(req);}catch{return res.status(401).send('Please log in again to visit your island.');}
  try{
   const doc=await db.collection('users').doc(id).get();
   if(!doc.exists)return res.status(403).send('Account not found.');
   let user=await require('./gem-wallet').repair(db,db.collection('users').doc(id),doc.data()),tiers=await getTiers();
   if(user.villageCircleVersion!==1)user=await db.runTransaction(async tx=>{const ref=db.collection('users').doc(id),doc=await tx.get(ref),current=doc.data(),update=layout.migration(current,require('./town-hall-progress').profile(current).level-1);if(Object.keys(update).length)tx.update(ref,update);return {...current,...update};});
   const maxLevel=9,level=require('./town-hall-progress').profile(user).level-1;
   const forgeLevel=user.gemConverterAllUnlocked?Math.max(0,tiers.length-1):Math.min(Math.max(0,tiers.length-1),Math.max(0,Math.trunc(Number(user.gemConverterLevel)||0)));
   res.json({islandName:user.islandName||null,level,progress:require('./town-hall-progress').profile(user),maxLevel,forgeLevel,tiers:tiers.map(t=>({id:t.id,name:t.name})),balance:Number(user.balance)||0,refineryLevel:require('./gem-workshop-utils').refineryProgress(user,tiers).level,compressor:true,isAdmin:user.isAdmin===true,preview:false,layout:layout.profile(user),economy:economy.profile(user,Date.now(),await require('./pack-timing').loadContext(db,user))});
  }catch{res.status(500).send('Could not load your village. Please try again.');}
 });
 app.post('/village/name',async(req,res)=>{
  let id;try{id=await authenticate(req);}catch{return res.status(401).send('Please log in again.');}
  const name=typeof req.body?.name==='string'?req.body.name.trim().replace(/\s+/gu,' '):'';
  if(name.length<2||name.length>32||!/^[\p{L}\p{M}\p{N} '&.()-]+$/u.test(name))return res.status(400).send('Use 2-32 letters, numbers, spaces or simple punctuation.');
  try{const islandName=await db.runTransaction(async tx=>{const ref=db.collection('users').doc(id),doc=await tx.get(ref);if(!doc.exists)throw Error('Account not found.');const existing=doc.data().islandName;if(existing)return existing;tx.update(ref,{islandName:name});return name;});res.json({islandName});}catch(e){res.status(400).send(e.message);}
 });
 app.post('/village/layout',async(req,res)=>{
  let id;try{id=await authenticate(req);}catch{return res.status(401).send('Please log in again.');}
  try{const result=await db.runTransaction(async tx=>{const ref=db.collection('users').doc(id),doc=await tx.get(ref);if(!doc.exists)throw Error('Account not found.');const user=doc.data(),level=require('./town-hall-progress').profile(user).level-1;const update=layout.validate(user,req.body?.positions,req.body?.revision,level);tx.update(ref,update);return layout.profile({...user,...update});});res.json(result);}catch(e){res.status(400).send(e.message);}
 });

 app.post('/village/action',async(req,res)=>{
  if(req.body?.action==='time-use'&&!/^[a-zA-Z0-9-]{16,80}$/.test(req.body?.actionId||''))return res.status(400).send('Please reopen Time skip and try again.');
  let id;try{id=await authenticate(req);}catch{return res.status(401).send('Please log in again.');}
  try{const result=await db.runTransaction(async tx=>{const ref=db.collection('users').doc(id),doc=await tx.get(ref);if(!doc.exists)throw Error('Account not found.');const user=doc.data(),isBoost=req.body?.action==='time-use',receiptRef=isBoost?db.collection('timeBoostActions').doc(id+'_'+req.body.actionId):null,receipt=receiptRef?await tx.get(receiptRef):null;
   const context=await require('./pack-timing').loadContext(db,user,tx),update=receipt?.exists?{}:economy.action(user,req.body||{},Date.now(),context);
   const next={...user,...update},boostUse=isBoost?(receipt?.exists?receipt.data().used:{token:req.body.token,target:req.body.target,count:Math.max(0,Number(user.timeBoosts?.[req.body.token]||0)-Number(next.timeBoosts?.[req.body.token]||0))}):null;
   if(Object.keys(update).length)tx.update(ref,update);
   if(receiptRef&&!receipt.exists)tx.set(receiptRef,{used:boostUse,createdAt:Date.now()});
   return {...(isBoost?{boostUse,replayed:!!receipt?.exists}:{}),progress:require('./town-hall-progress').profile(next),level:require('./town-hall-progress').profile(next).level-1,xpGained:(update.townHallXP??user.townHallXP??0)-(user.townHallXP||0),balance:Number(next.balance)||0,layout:layout.profile(next),economy:economy.profile(next,Date.now(),context)};});res.json(result);}catch(e){res.status(400).send(e.message);}
 });
};
