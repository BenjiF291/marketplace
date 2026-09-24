const shop=require('./ruby-shop');const {randomInt}=require('node:crypto');
module.exports=(app,db,authenticate)=>{
 app.get('/ruby-shop',async(req,res)=>{try{const id=await authenticate(req),doc=await db.collection('users').doc(id).get();if(!doc.exists)throw Error('User not found');const u=doc.data();res.json({catalog:shop.CATALOG,owned:u.rubyItems||{},equipped:u.rubyEquipped||{},rubies:u.gems?.bronze||0,fuelArmed:!!u.rubyFuelArmed,treats:u.rubyTreats||0,slots:u.amuletSlots||[]});}catch(e){res.status(400).send(e.message);}});
 app.post('/ruby-shop/:action',async(req,res)=>{try{
 const id=await authenticate(req),body=req.body;
 if(!/^[a-zA-Z0-9-]{16,80}$/.test(body.actionId||''))throw Error('Invalid action identifier');
 const base=[8,10,12,16,20,24][randomInt(6)];
 const result=await db.runTransaction(async tx=>{
  const ref=db.collection('users').doc(id),receipt=db.collection('rubyActions').doc(`${id}_${body.actionId}`);
  const [user,prior]=await tx.getAll(ref,receipt);if(prior.exists)return prior.data().result;if(!user.exists)throw Error('User not found');
  let update;
  if(req.params.action==='buy')update=shop.purchase(user.data(),body.itemId);
  else if(req.params.action==='use')update=body.itemId==='retry'?shop.retryWheel(user.data(),base):shop.use(user.data(),body);
  else if(req.params.action==='clear'&&['pet','profile','opening'].includes(body.kind))update={rubyEquipped:{...(user.data().rubyEquipped||{}),[body.kind]:null}};
  else throw Error('Unknown action');
  const result={success:true,...(body.itemId==='retry'?{amount:update.lastSpinAmount,balance:update.balance,baseReward:base}:{} )};
  tx.update(ref,update);tx.set(receipt,{result,createdAt:new Date()});return result;
 });res.json(result);
 }catch(e){res.status(400).send(e.message);}});
};
