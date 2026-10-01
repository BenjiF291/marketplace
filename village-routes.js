const layout=require('./public/village-layout'),economy=require('./village-economy');
module.exports=(app,db,authenticate,getTiers)=>{
 app.get('/admin/village',async(req,res)=>{
  let id;try{id=await authenticate(req);}catch{return res.status(401).send('Please log in again to visit your island.');}
  try{
   const doc=await db.collection('users').doc(id).get();
   if(!doc.exists)return res.status(403).send('Account not found.');
   const user=doc.data(),tiers=await getTiers();
   const maxLevel=9,level=require('./town-hall-progress').profile(user).level-1;
   const forgeLevel=user.gemConverterAllUnlocked?Math.max(0,tiers.length-1):Math.min(Math.max(0,tiers.length-1),Math.max(0,Math.trunc(Number(user.gemConverterLevel)||0)));
   res.json({islandName:user.islandName||null,level,maxLevel,forgeLevel,tiers:tiers.map(t=>({id:t.id,name:t.name})),balance:Number(user.balance)||0,compressor:!!user.gemCompressor,isAdmin:user.isAdmin===true,preview:false,layout:layout.profile(user),economy:economy.profile(user)});
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
  let id;try{id=await authenticate(req);}catch{return res.status(401).send('Please log in again.');}
  try{const result=await db.runTransaction(async tx=>{const ref=db.collection('users').doc(id),doc=await tx.get(ref);if(!doc.exists)throw Error('Account not found.');const user=doc.data(),update=economy.action(user,req.body||{});tx.update(ref,update);const next={...user,...update};return {level:require('./town-hall-progress').profile(next).level-1,xpGained:(update.townHallXP??user.townHallXP??0)-(user.townHallXP||0),balance:Number(next.balance)||0,layout:layout.profile(next),economy:economy.profile(next)};});res.json(result);}catch(e){res.status(400).send(e.message);}
 });
};
