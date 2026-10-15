const {randomUUID}=require('node:crypto');
module.exports=(app,db,authenticate)=>{
 const collection=db.collection('packRewardPresets');
 const route=(method,handler)=>app[method]('/admin/pack-reward-presets',async(req,res)=>{
  let userId;try{userId=await authenticate(req);}catch(error){return res.status(401).send(error.message);}
  try{const user=await db.collection('users').doc(userId).get();if(user.data()?.isAdmin!==true)return res.status(403).send('Admin access required.');res.json(await handler(userId,req.body||{}));}catch(error){res.status(400).send(error.message);}
 });
 route('get',async()=>({presets:(await collection.get()).docs.map(doc=>({id:doc.id,...doc.data()})).sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base',numeric:true}))}));
 route('post',async(userId,body)=>{
  if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>80)throw Error('Enter a preset name up to 80 characters.');
  if(!Array.isArray(body.cards)||!body.cards.length)throw Error('Choose at least one reward card to save.');
  const catalog=await require('./free-pack-routes').catalog(db);
  const {rewardCards}=require('./pack-builder').validate({name:body.name.trim(),rewardCards:body.cards},catalog);
  const id=randomUUID(),preset={name:body.name.trim(),cards:rewardCards,createdBy:userId,createdAt:Date.now()};await collection.doc(id).set(preset);return {preset:{id,...preset}};
 });
};
