const rules=require('./free-pack');
const fs=require('node:fs'),path=require('node:path');
module.exports=(app,db,authenticate)=>{
 const configRef=db.collection('gameSettings').doc('freePack');
 async function catalog(){
  const [packs,tiers]=await Promise.all([db.collection('packs').get(),db.collection('ascendTiers').get()]);
  return {gem:Object.entries(rules.GEM_NAMES).map(([id,name])=>({id,name})),boost:[{id:'skip',name:'Skip'},{id:'leap',name:'Leap'}],rubyItem:require('./ruby-shop').CATALOG.map(({id,name})=>({id,name})),amulet:require('./amulet-utils').catalog(tiers.docs.map(doc=>({...doc.data(),id:doc.id}))).map(({id,name})=>({id,name})),pack:packs.docs.filter(doc=>doc.data().cardIds?.length).map(doc=>({id:doc.id,name:doc.data().name||doc.id})),card:fs.readdirSync(path.join(__dirname,'public','images')).filter(name=>/\.(png|jpe?g|webp)$/i.test(name)).map(id=>({id,name:id}))};
 }
 const route=(method,url,admin,handler)=>app[method](url,async(req,res)=>{
  let id;try{id=await authenticate(req);}catch(error){return res.status(401).send(error.message);}
  try{if(admin){const user=await db.collection('users').doc(id).get();if(user.data()?.isAdmin!==true)return res.status(403).send('Admin access required.');}res.json(await handler(id,req.body||{}));}catch(error){res.status(400).send(error.message);}
 });
 route('get','/free-pack',false,async id=>{
  const [doc,user]=await Promise.all([configRef.get(),db.collection('users').doc(id).get()]);if(!user.exists)throw Error('User not found.');
  const config=doc.exists?doc.data():rules.defaults(),now=Date.now();
  const nextAt=user.data().freePackLastClaimAt?user.data().freePackLastClaimAt+config.cooldownHours*3600000:0;
  return {config,serverNow:now,nextAt,canClaim:config.enabled&&now>=nextAt,canEdit:user.data().isAdmin===true,lastClaim:user.data().freePackReceipt||null};
 });
 route('get','/admin/free-pack',true,async()=>({config:(await configRef.get()).data()||rules.defaults(),catalog:await catalog()}));
 route('put','/admin/free-pack',true,async(id,body)=>{const config=rules.validate(body,await catalog());await configRef.set(config);return {config};});
 route('post','/free-pack/claim',false,async(id,body)=>{
  if(typeof body.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(body.requestId))throw Error('Invalid claim request.');
  const names=await catalog();
  return db.runTransaction(async tx=>{
   const userRef=db.collection('users').doc(id),doc=await tx.get(userRef),setting=await tx.get(configRef);
   if(!doc.exists)throw Error('User not found.');const user=doc.data();
   if(user.freePackReceipt?.requestId===body.requestId)return user.freePackReceipt;
   const config=rules.validate(setting.exists?setting.data():rules.defaults(),names),now=Date.now();
   if(!config.enabled)throw Error('This pack is currently unavailable.');
   const nextAt=(user.freePackLastClaimAt||0)+config.cooldownHours*3600000;
   if(user.freePackLastClaimAt&&now<nextAt)throw Error('Your next free pack is not ready yet.');
   const rewards=rules.draw(config).map(reward=>({...reward,label:rules.label(reward,names)}));
   // Read all reward pack metadata before making any transactional writes.
   const packDocs=new Map();for(const reward of rewards)if(reward.kind==='pack'&&!packDocs.has(reward.id))packDocs.set(reward.id,await tx.get(db.collection('packs').doc(reward.id)));
   for(const reward of rewards)if(reward.kind==='pack'||reward.kind==='card'){
    const pack=packDocs.get(reward.id)?.data();if(reward.kind==='pack'&&!pack?.cardIds?.length)throw Error('A configured reward pack is no longer available.');
    for(let i=0;i<reward.amount;i++)tx.set(db.collection('items').doc(),{name:reward.kind==='pack'?pack.name:`Card ${reward.id}`,itemType:reward.kind,packId:reward.kind==='pack'?reward.id:null,packColor:pack?.color||null,imageUrl:reward.kind==='card'?`/images/${reward.id}`:null,price:0,sellerId:id,buyerId:id,sold:true,listedForSale:false,sourceItemId:null,source:'free-pack',purchasedAt:new Date(now),createdAt:new Date(now)});
   }
   const receipt={requestId:body.requestId,name:config.name,rewards,claimedAt:now,nextAt:now+config.cooldownHours*3600000};
   tx.update(userRef,{...rules.apply(user,rewards),...require('./town-hall-progress').gameplay(user,'pack'),freePackLastClaimAt:now,freePackReceipt:receipt});
   return receipt;
  });
 });
};
