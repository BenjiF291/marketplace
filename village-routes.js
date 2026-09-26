// Private navigation prototype. No account or economy mutations.
module.exports=(app,db,authenticate,getTiers)=>{
 app.get('/admin/village',async(req,res)=>{
  let id;try{id=await authenticate(req);}catch{return res.status(401).send('Please log in again to visit your island.');}
  try{
   const doc=await db.collection('users').doc(id).get();
   if(!doc.exists)return res.status(403).send('Account not found.');
   const user=doc.data(),tiers=await getTiers();
   const maxLevel=9,level=require('./town-hall-progress').profile(user).level-1;
   const forgeLevel=user.gemConverterAllUnlocked?Math.max(0,tiers.length-1):Math.min(Math.max(0,tiers.length-1),Math.max(0,Math.trunc(Number(user.gemConverterLevel)||0)));
   res.json({level,maxLevel,forgeLevel,tiers:tiers.map(t=>({id:t.id,name:t.name})),balance:Number(user.balance)||0,compressor:!!user.gemCompressor,isAdmin:user.isAdmin===true,preview:false});
  }catch{res.status(500).send('Could not load your village. Please try again.');}
 });
};
