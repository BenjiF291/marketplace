const rules=require('./free-pack');
const fs=require('node:fs'),path=require('node:path');
module.exports=(app,db,authenticate)=>{
 const configRef=db.collection('gameSettings').doc('freePack');
 const rarities=new Set(['common','rare','epic','legendary','unique']);
 const entriesFrom=snapshot=>Object.fromEntries(snapshot.docs.map(doc=>[doc.id,doc.data()]));
 function rarityFor(kind,id,entries){const creature=kind==='animal'?id:kind==='rubyItem'&&id.startsWith('pet:')?id.slice(4):null;return creature?(rarities.has(entries[creature]?.rarity)?entries[creature].rarity:'unassigned'):null;}
 async function catalog(){
  const [packs,tiers,creatures]=await Promise.all([db.collection('packs').get(),db.collection('ascendTiers').get(),db.collection('creatureBookEntries').get()]);const entries=entriesFrom(creatures);
  return {animal:require('./public/stable-animals').animals.map(({id,name})=>({id,name,rarity:rarityFor('animal',id,entries)})),gem:Object.entries(rules.GEM_NAMES).map(([id,name])=>({id,name})),boost:[{id:'skip',name:'Skip'},{id:'leap',name:'Leap'}],rubyItem:require('./ruby-shop').CATALOG.map(({id,name})=>({id,name,...(id.startsWith('pet:')?{rarity:rarityFor('rubyItem',id,entries)}:{})})),amulet:require('./amulet-utils').catalog(tiers.docs.map(doc=>({...doc.data(),id:doc.id}))).map(({id,name,gemKey})=>({id,name,gemKey})),pack:packs.docs.filter(doc=>doc.data().cardIds?.length).map(doc=>({id:doc.id,name:doc.data().name||doc.id})),card:fs.readdirSync(path.join(__dirname,'public','images')).filter(name=>/\.(png|jpe?g|webp)$/i.test(name)).map(id=>({id,name:id}))};
 }
 const route=(method,url,admin,handler)=>app[method](url,async(req,res)=>{
  let id;try{id=await authenticate(req);}catch(error){return res.status(401).send(error.message);}
  try{if(admin){const user=await db.collection('users').doc(id).get();if(user.data()?.isAdmin!==true)return res.status(403).send('Admin access required.');}res.json(await handler(id,req.body||{}));}catch(error){res.status(400).send(error.message);}
 });
 route('get','/free-pack',false,async id=>{
  const [doc,user,creatures]=await Promise.all([configRef.get(),db.collection('users').doc(id).get(),db.collection('creatureBookEntries').get()]);if(!user.exists)throw Error('User not found.');
  const config=doc.exists?doc.data():rules.defaults(),now=Date.now();
  const nextAt=user.data().isAdmin===true?0:user.data().freePackLastClaimAt?user.data().freePackLastClaimAt+config.cooldownHours*3600000:0;
  const entries=entriesFrom(creatures),saved=user.data().freePackReceipt;const lastClaim=saved?{...saved,rewards:saved.rewards.map(reward=>{const rarity=rarityFor(reward.kind,reward.id,entries);return {...reward,...(rarity?{rarity}:{})};})}:null;
  return {config,serverNow:now,nextAt,canClaim:config.enabled&&now>=nextAt,canEdit:user.data().isAdmin===true,lastClaim};
 });
 route('get','/admin/free-pack',true,async()=>({config:(await configRef.get()).data()||rules.defaults(),catalog:await catalog()}));
 route('put','/admin/free-pack',true,async(id,body)=>{const config=rules.validate(body,await catalog());await configRef.set(config);return {config};});
 route('post','/free-pack/claim',false,async(id,body)=>{
  if(typeof body.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(body.requestId))throw Error('Invalid claim request.');
  const names=await catalog();
  return db.runTransaction(async tx=>{
   const userRef=db.collection('users').doc(id),claimRef=db.collection('freePackClaims').doc(id+'_'+body.requestId),doc=await tx.get(userRef),setting=await tx.get(configRef),previousClaim=await tx.get(claimRef);
   if(!doc.exists)throw Error('User not found.');const user=doc.data();
   if(previousClaim.exists)return previousClaim.data();
   if(user.freePackReceipt?.requestId===body.requestId)return user.freePackReceipt;
   const config=rules.validate(setting.exists?setting.data():rules.defaults(),names),now=Date.now();
   if(!config.enabled)throw Error('This pack is currently unavailable.');
   const nextAt=(user.freePackLastClaimAt||0)+config.cooldownHours*3600000;
   if(user.isAdmin!==true&&user.freePackLastClaimAt&&now<nextAt)throw Error('Your next free pack is not ready yet.');
   const rewards=rules.draw(config).map(reward=>{const item=names[reward.kind]?.find(item=>item.id===reward.id);return {...reward,label:rules.label(reward,names),...(item?.rarity?{rarity:item.rarity}:{}),...(item?.gemKey?{gemKey:item.gemKey}:{})};});
   // Read all reward pack metadata before making any transactional writes.
   const packDocs=new Map();for(const reward of rewards)if(reward.kind==='pack'&&!packDocs.has(reward.id))packDocs.set(reward.id,await tx.get(db.collection('packs').doc(reward.id)));
   for(const reward of rewards)if(reward.kind==='pack'||reward.kind==='card'){
    const pack=packDocs.get(reward.id)?.data();if(reward.kind==='pack'&&!pack?.cardIds?.length)throw Error('A configured reward pack is no longer available.');
    for(let i=0;i<reward.amount;i++)tx.set(db.collection('items').doc(),{name:reward.kind==='pack'?pack.name:`Card ${reward.id}`,itemType:reward.kind,packId:reward.kind==='pack'?reward.id:null,packColor:pack?.color||null,imageUrl:reward.kind==='card'?`/images/${reward.id}`:null,price:0,sellerId:id,buyerId:id,sold:true,listedForSale:false,sourceItemId:null,source:'free-pack',purchasedAt:new Date(now),createdAt:new Date(now)});
   }
   const receipt={requestId:body.requestId,name:config.name,rewards,claimedAt:now,nextAt:user.isAdmin===true?now:now+config.cooldownHours*3600000};
   tx.set(claimRef,receipt);
   tx.update(userRef,{...rules.apply(user,rewards),...require('./town-hall-progress').gameplay(user,'pack'),freePackLastClaimAt:now,freePackReceipt:receipt});
   return receipt;
  });
 });
};
