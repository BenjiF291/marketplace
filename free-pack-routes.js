const rules=require('./free-pack');
const fs=require('node:fs'),path=require('node:path');
module.exports=(app,db,authenticate)=>{
 const configRef=db.collection('gameSettings').doc('freePack');
 const catalog=options=>module.exports.catalog(db,options);
 const entriesFrom=snapshot=>Object.fromEntries(snapshot.docs.map(doc=>[doc.id,doc.data()]));
 const rarities=new Set(['common','rare','epic','legendary','unique']);
 function rarityFor(kind,id,entries){const creature=kind==='animal'?id:kind==='rubyItem'&&id.startsWith('pet:')?id.slice(4):null;return creature?(rarities.has(entries[creature]?.rarity)?entries[creature].rarity:'unassigned'):null;}
 const route=(method,url,admin,handler)=>app[method](url,async(req,res)=>{
  let id;try{id=await authenticate(req);}catch(error){return res.status(401).send(error.message);}
  try{if(admin){const user=await db.collection('users').doc(id).get();if(user.data()?.isAdmin!==true)return res.status(403).send('Admin access required.');}res.json(await handler(id,req.body||{}));}catch(error){res.status(400).send(error.message);}
 });
 route('get','/free-pack',false,async id=>{
  const [doc,user,creatures]=await Promise.all([configRef.get(),db.collection('users').doc(id).get(),db.collection('creatureBookEntries').get()]);if(!user.exists)throw Error('User not found.');
  const config=doc.exists?doc.data():rules.defaults(),now=Date.now();
  const nextAt=require('./pack-timing').dailyNextAt(user.data(),config);
  const names=await catalog({ includeRandomCards: config.cards.some(card => card.options.some(option => option.kind === 'randomCardByTier')) }),personal=require('./unique-creature-rewards').cards(config.cards,names,user.data());
  const entries=entriesFrom(creatures),saved=user.data().freePackReceipt;const lastClaim=saved?{...saved,rewards:saved.rewards.map(reward=>{const rarity=rarityFor(reward.kind,reward.id,entries);return {...reward,...(rarity?{rarity}:{})};})}:null;
  return {config:{...config,cards:personal},randomCardByTier:names.randomCardByTier,serverNow:now,nextAt,canClaim:config.enabled&&personal.length>0&&now>=nextAt,canEdit:user.data().isAdmin===true,lastClaim};
 });
 route('get','/admin/free-pack',true,async()=>({config:(await configRef.get()).data()||rules.defaults(),catalog:await catalog()}));
 route('put','/admin/free-pack',true,async(id,body)=>{const config=rules.validate(body,await catalog());await configRef.set(config);return {config};});
 route('post','/free-pack/claim',false,async(id,body)=>{
  if(typeof body.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(body.requestId))throw Error('Invalid claim request.');
  const baseNames=await catalog({ includeRandomCards: false });
  return db.runTransaction(async tx=>{
   const userRef=db.collection('users').doc(id),claimRef=db.collection('freePackClaims').doc(id+'_'+body.requestId),doc=await tx.get(userRef),setting=await tx.get(configRef),previousClaim=await tx.get(claimRef);
   if(!doc.exists)throw Error('User not found.');const user=doc.data();
   if(previousClaim.exists)return previousClaim.data();
   if(user.freePackReceipt?.requestId===body.requestId)return user.freePackReceipt;
   const saved=setting.exists?setting.data():rules.defaults();
   const names = saved.cards?.some(card => card?.options?.some(option => option?.kind === 'randomCardByTier'))
    ? await catalog() : baseNames;
   const config=rules.validate(saved,names),now=Date.now();
   if(!config.enabled)throw Error('This pack is currently unavailable.');
   const nextAt=require('./pack-timing').dailyNextAt(user,config);
   if(user.isAdmin!==true&&user.freePackLastClaimAt&&now<nextAt)throw Error('Your next free pack is not ready yet.');
   const rewards=rules.rewardAmulets(user,rules.draw(config,undefined,names,user).map(reward=>{const item=names[reward.kind]?.find(item=>item.id===reward.id);return {...reward,label:rules.label(reward,names),...(item?.rarity?{rarity:item.rarity}:{}),...(item?.gemKey?{gemKey:item.gemKey}:{}),...(reward.kind==='pack'?{packName:item.name,packColor:item.color,appearance:item.appearance||null}:{})};}));rewards.push(...rules.openingAmuletRewards(user));
   rewards.splice(0,rewards.length,...rules.tokenProgress(user,rewards));
   // Read all reward pack metadata before making any transactional writes.
   const packDocs=new Map();for(const reward of rewards)if(reward.kind==='pack'&&!packDocs.has(reward.id))packDocs.set(reward.id,await tx.get(db.collection('packs').doc(reward.id)));
   const upgrades = require('./card-upgrades');
   const extraProofs = rewards.reduce((sum, reward) =>
     sum + (upgrades.requiresPackProof(packDocs.get(reward.id)?.data()) ? reward.amount : 0), 0);
   const itemWrites = rewards.reduce((sum, reward) => sum + (['card','pack'].includes(reward.kind) ? reward.amount : 0), 0);
   if (extraProofs + itemWrites > 450) throw Error('This pack would award too many inventory items.');
   await upgrades.grant(tx,db,id,rewards);
   for(const reward of rewards)if(reward.kind==='pack'||reward.kind==='card'){
    const pack=packDocs.get(reward.id)?.data();if(reward.kind==='pack'&&!require('./pack-builder').hasRewards(pack))throw Error('A configured reward pack is no longer available.');
    for(let i=0;i<reward.amount;i++){const item=db.collection('items').doc();const proof=upgrades.markPack(tx,db,item,id,reward.id,pack);tx.set(item,{...proof,name:reward.kind==='pack'?pack.name:`Card ${reward.id}`,itemType:reward.kind,packId:reward.kind==='pack'?reward.id:null,packColor:pack?.color||null,imageUrl:reward.kind==='card'?`/images/${reward.id}`:null,price:0,sellerId:id,buyerId:id,sold:true,listedForSale:false,sourceItemId:null,source:'free-pack',purchasedAt:new Date(now),createdAt:new Date(now)});}
   }
   const receipt={requestId:body.requestId,name:config.name,appearance:config.appearance,rewards,claimedAt:now,nextAt:user.isAdmin===true?now:now+require('./pack-timing').dailyDuration(user,config)};
   tx.set(claimRef,receipt);
   tx.update(userRef,{...rules.apply(user,rewards),...require('./town-hall-progress').gameplay(user,'pack'),freePackLastClaimAt:now,freePackReceipt:receipt});
   return receipt;
  });
 });
};

module.exports.catalog=async function(db,{ includeRandomCards = true } = {}){
 const rarities=new Set(['common','rare','epic','legendary','unique']);
 const entriesFrom=snapshot=>Object.fromEntries(snapshot.docs.map(doc=>[doc.id,doc.data()]));
 function rarityFor(kind,id,entries){const creature=kind==='animal'?id:kind==='rubyItem'&&id.startsWith('pet:')?id.slice(4):null;return creature?(rarities.has(entries[creature]?.rarity)?entries[creature].rarity:'unassigned'):null;}
 async function catalog(){
  const [packs,tiers,creatures]=await Promise.all([db.collection('packs').get(),db.collection('ascendTiers').get(),db.collection('creatureBookEntries').get()]);const entries=entriesFrom(creatures);
  const randomCards=require('./random-card-rewards');
  const randomCardByTier=includeRandomCards ? await randomCards.catalogue(__dirname,tiers.docs.map(doc=>doc.data())) : [];
  return {randomCardByTier,...require('./public/upgrader-catalog').rewards,brawlToken:(()=>{const tokens=require('./public/creature-brawl-catalog').creatures.map(({id,name,species,role,poster})=>({id,name:name+' Brawl tokens',species,role,poster,rarity:rarityFor('animal',id,entries)}));return [...['common','rare','epic','legendary','unique'].map(rarity=>({id:'rarity:'+rarity,name:rarity[0].toUpperCase()+rarity.slice(1)+' Brawl tokens (random creature)',rarity,members:tokens.filter(c=>c.rarity===rarity).map(c=>c.id)})).filter(group=>group.members.length),...tokens];})(),animal:require('./public/stable-animals').animals.map(({id,name})=>({id,name,rarity:rarityFor('animal',id,entries)})),gem:Object.entries(rules.GEM_NAMES).map(([id,name])=>({id,name})),boost:[{id:'skip',name:'Skip'},{id:'leap',name:'Leap'}],rubyItem:(()=>{const clothes=require('./public/wardrobe').catalog,groups=['common','rare','epic','legendary','unique'].map(rarity=>({id:'rarity:clothing:'+rarity,name:rarity[0].toUpperCase()+rarity.slice(1)+' clothing (random clothing or accessory)',rarity,members:clothes.filter(item=>item.rarity===rarity).map(item=>item.id)})).filter(group=>group.members.length);return [...groups,...require('./ruby-shop').CATALOG.map(({id,name,rarity})=>({id,name,...(rarity?{rarity}:{}),...(id.startsWith('pet:')?{rarity:rarityFor('rubyItem',id,entries)}:{})}))];})(),amulet:require('./amulet-utils').catalog(tiers.docs.map(doc=>({...doc.data(),id:doc.id}))).map(({id,name,gemKey})=>({id,name,gemKey})),pack:packs.docs.filter(doc=>require('./pack-builder').hasRewards(doc.data())).map(doc=>({id:doc.id,name:doc.data().name||doc.id,color:doc.data().color||'#667eea',appearance:doc.data().appearance||null})),card:fs.readdirSync(path.join(__dirname,'public','images')).filter(name=>/\.(png|jpe?g|webp)$/i.test(name)).map(id=>({id,name:id}))};
 }
 return catalog();
};
