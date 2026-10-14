const animals=require('./public/stable-animals');
module.exports=(app,db,authenticate)=>{
 app.get('/stable',async(req,res)=>{
  let id;try{id=await authenticate(req);}catch{return res.status(401).send('Please log in again.');}
  try{const doc=await db.collection('users').doc(id).get();if(!doc.exists)return res.status(404).send('Account not found.');
   if(require('./town-hall-progress').profile(doc.data()).level<1)return res.status(403).send('The Stable unlocks at Town Hall level 1.');
   const inventory=animals.inventory(doc.data());res.json({animals:inventory,total:inventory.reduce((sum,a)=>sum+a.count,0)});
  }catch{res.status(500).send('Could not load your Stable.');}
 });
};
