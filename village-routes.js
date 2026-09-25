// Private navigation prototype. No account or economy mutations.
module.exports=(app,db,authenticate,getTiers)=>{
 app.get('/admin/village',async(req,res)=>{
  let id;try{id=await authenticate(req);}catch{return res.status(401).send('Please log in again to preview the village.');}
  try{
   const doc=await db.collection('users').doc(id).get();
   if(!doc.exists||doc.data().isAdmin!==true)return res.status(403).send('The village preview is currently admin-only.');
   const user=doc.data(),tiers=await getTiers();
   const maxLevel=Math.max(0,tiers.length-1);
   const level=user.gemConverterAllUnlocked?maxLevel:Math.min(maxLevel,Math.max(0,Math.trunc(Number(user.gemConverterLevel)||0)));
   res.json({level,maxLevel,tiers:tiers.map(t=>({id:t.id,name:t.name})),balance:Number(user.balance)||0,compressor:!!user.gemCompressor,preview:true});
  }catch{res.status(500).send('Could not load your village. Please try again.');}
 });
};
