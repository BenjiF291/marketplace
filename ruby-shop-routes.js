const shop=require('./ruby-shop');const {randomInt}=require('node:crypto');
const journeys=require('./pet-journeys');
module.exports=(app,db,authenticate)=>{
 let lootCache=null,lootUntil=0;
 const loot=()=>{if(!lootCache||Date.now()>=lootUntil){lootUntil=Date.now()+60000;lootCache=db.collection('ascendTiers').get().then(async snapshot=>{
  const tiers=snapshot.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>Number(a.order)-Number(b.order));
  const ids=[...new Set(tiers.slice(4).flatMap(t=>t.packs||[]))];
  const packs=await Promise.all(ids.map(id=>db.collection('packs').doc(id).get()));
  return journeys.tables(tiers,packs.filter(d=>d.exists).map(d=>({...d.data(),id:d.id})));
 }).catch(e=>{lootCache=null;throw e;});}return lootCache;};
 app.get('/pet-journeys',async(req,res)=>{try{await authenticate(req);const tables=await loot();const clean=t=>({...t,rewards:t.rewards.map(({pack,...r})=>r)});res.json(tables.map(t=>({...clean(t),petOdds:Object.fromEntries(Object.entries(t.petOdds).map(([id,odds])=>[id,clean(odds)]))})));}catch(e){res.status(400).send(e.message);}});

 app.get('/ruby-shop',async(req,res)=>{try{const id=await authenticate(req),doc=await db.collection('users').doc(id).get();if(!doc.exists)throw Error('User not found');const u=doc.data();res.json({catalog:shop.CATALOG,owned:u.rubyItems||{},equipped:{...(u.rubyEquipped||{}),pets:journeys.pets(u)},journeys:Object.values(u.petJourneys||{}).map(({reward,...j})=>({...j,...(j.status==='claimed'?{reward}: {})})),serverNow:Date.now(),rubies:u.gems?.bronze||0,fuelArmed:!!u.rubyFuelArmed,treats:u.rubyTreats||0,slots:u.amuletSlots||[]});}catch(e){res.status(400).send(e.message);}});
 app.post('/ruby-shop/:action',async(req,res)=>{try{
 const id=await authenticate(req),body=req.body;
 if(!/^[a-zA-Z0-9-]{16,80}$/.test(body.actionId||''))throw Error('Invalid action identifier');
 const base=[8,10,12,16,20,24][randomInt(6)];
 const journeyTables=req.params.action==='journey-start'?await loot():null;
 const rolls=[randomInt(1000000),randomInt(1000000),randomInt(1000000)];
 const result=await db.runTransaction(async tx=>{
  const ref=db.collection('users').doc(id),receipt=db.collection('rubyActions').doc(`${id}_${body.actionId}`);
  const [user,prior]=await tx.getAll(ref,receipt);if(prior.exists)return prior.data().result;if(!user.exists)throw Error('User not found');
  let update,journeyReward;
  if(req.params.action==='journey-start')update=journeys.start(user.data(),body.petId,body.foodId,journeyTables,body.actionId,Date.now(),rolls);
  else if(req.params.action==='journey-claim'){
    const claimed=journeys.claim(user.data(),body.petId,body.journeyId);update=claimed.update;journeyReward=claimed.reward;
    if(journeyReward.bonus.kind==='pack'){
      const packId=`journey-${id}-${body.journeyId}`,pack=journeyReward.bonus.pack;
      tx.set(db.collection('packs').doc(packId),{...pack,createdAt:new Date(),journeyReward:true});
      tx.set(db.collection('items').doc(packId),{name:pack.name+' Pack',itemType:'pack',packId,packColor:pack.color,price:0,sellerId:id,buyerId:id,sold:true,listedForSale:false,imageUrl:null,sourceItemId:null,purchasedAt:new Date(),createdAt:new Date()});
    }
  }
  else if(req.params.action==='buy')update=shop.purchase(user.data(),body.itemId);
  else if(req.params.action==='use')update=body.itemId==='retry'?shop.retryWheel(user.data(),base):shop.use(user.data(),body);
  else if(req.params.action==='clear'&&body.kind==='pet')update={rubyEquipped:{...(user.data().rubyEquipped||{}),pet:null,pets:journeys.pets(user.data()).filter(p=>p!==body.itemId)}};
  else if(req.params.action==='clear'&&['pet','profile','opening'].includes(body.kind))update={rubyEquipped:{...(user.data().rubyEquipped||{}),[body.kind]:null}};
  else throw Error('Unknown action');
  const result={success:true,...(journeyReward?{reward:journeyReward}:{}),...(body.itemId==='retry'?{amount:update.lastSpinAmount,balance:update.balance,baseReward:base}:{} )};
  tx.update(ref,update);tx.set(receipt,{result,createdAt:new Date()});return result;
 });res.json(result);
 }catch(e){res.status(400).send(e.message);}});
};
