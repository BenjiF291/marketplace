const animals=require('./public/stable-animals'),growth=require('./creature-growth');
module.exports=(app,db,authenticate)=>{
 app.get('/stable',async(req,res)=>{
  let id;try{id=await authenticate(req);}catch{return res.status(401).send('Please log in again.');}
  try{const doc=await db.collection('users').doc(id).get();if(!doc.exists)return res.status(404).send('Account not found.');
   if(require('./town-hall-progress').profile(doc.data()).level<1)return res.status(403).send('The Stable unlocks at Town Hall level 1.');
   const inventory=animals.residents(doc.data()).map(a=>growth.decorate(doc.data(),a));res.json({animals:inventory,total:inventory.length,foods:growth.foods(doc.data()),tokens:require('./creature-token-wallet').wallet(doc.data().creatureBrawl)});
  }catch{res.status(500).send('Could not load your Stable.');}
 });
 app.post('/stable/name',async(req,res)=>{
  let id;try{id=await authenticate(req);}catch{return res.status(401).send('Please log in again.');}
  const instanceId=req.body?.instanceId;
  if(typeof instanceId!=='string'||typeof req.body?.name!=='string')return res.status(400).send('Choose a resident and a name.');
  const name=req.body.name.trim().replace(/\s+/gu,' ');
  if(name.length>32||/[<>\p{Cc}\p{Cf}]/u.test(name))return res.status(400).send('Use up to 32 characters without control characters or angle brackets.');
  try{const animal=await db.runTransaction(async tx=>{const ref=db.collection('users').doc(id),doc=await tx.get(ref);if(!doc.exists)throw Error('Account not found.');
   const user=doc.data(),resident=animals.residents(user).find(a=>a.instanceId===instanceId);if(!resident)throw Error('This resident is not in your stable.');
   const stableNames={...user.stableNames};if(name)stableNames[instanceId]=name;else delete stableNames[instanceId];tx.update(ref,{stableNames});
   return animals.residents({...user,stableNames}).find(a=>a.instanceId===instanceId);
  });res.json({animal});}catch(error){res.status(400).send(error.message);}
 });

 app.post('/stable/feed',async(req,res)=>{
  let id;try{id=await authenticate(req);}catch{return res.status(401).send('Please log in again.');}
  const body=req.body||{};if(!/^[a-zA-Z0-9-]{16,80}$/.test(body.actionId||''))return res.status(400).send('Reopen feeding and try again.');
  try{const result=await db.runTransaction(async tx=>{const ref=db.collection('users').doc(id),receiptRef=db.collection('creatureFeedActions').doc(id+'_'+body.actionId),doc=await tx.get(ref),receipt=await tx.get(receiptRef);if(!doc.exists)throw Error('Account not found.');const user=doc.data();
   if(receipt.exists)return {animal:growth.resident(user,receipt.data().instanceId),foods:growth.foods(user),levelsGained:receipt.data().levelsGained,replayed:true};
   const {update,levelsGained}=growth.feed(user,body),next={...user,...update};tx.update(ref,update);tx.set(receiptRef,{instanceId:body.instanceId,levelsGained,at:Date.now()});return {animal:growth.resident(next,body.instanceId),foods:growth.foods(next),levelsGained};
  });res.json(result);}catch(error){res.status(400).send(error.message);}
 });

};
