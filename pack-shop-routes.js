const rules=require('./free-pack'),wallet=require('./gem-wallet'),timing=require('./pack-timing');
function odds(pack){if(!pack.cardIds?.length)return pack.rewardCards||[];return [...(pack.rewardCards||[]),{title:'Collection card',options:[...new Set(pack.cardIds)].map(id=>({kind:'card',id,min:1,max:1,chance:100/new Set(pack.cardIds).size}))}];}
function cooldown(offer){const minutes=offer.cooldownMinutes??0;if(!Number.isSafeInteger(minutes)||minutes<0||minutes>525600)throw Error('This pack has an invalid purchase cooldown.');return minutes;}
function nextPurchase(user,packId,minutes){return timing.shopNextAt(user,packId,minutes);}
module.exports=(app,db,authenticate)=>{
 const route=(method,url,fn)=>app[method](url,async(req,res)=>{let id;try{id=await authenticate(req);}catch(error){return res.status(401).send(error.message);}try{res.json(await fn(id,req.body||{}));}catch(error){res.status(400).send(error.message);}});
 route('get','/pack-shop',async id=>{
  const [packs,setting,user,catalog]=await Promise.all([db.collection('packs').get(),db.collection('gameSettings').doc('freePack').get(),db.collection('users').doc(id).get(),require('./free-pack-routes').catalog(db)]);
  if(!user.exists)throw Error('User not found');const config=setting.exists?setting.data():rules.defaults(),u=user.data(),now=Date.now();
  return {serverNow:now,canEdit:u.isAdmin===true,catalog,daily:{id:'daily',daily:true,name:config.name,cards:rules.amuletOdds(u,require('./unique-creature-rewards').cards(config.cards,catalog,u)),enabled:config.enabled,nextAt:timing.dailyNextAt(u,config)},packs:packs.docs.filter(d=>d.data().shop?.enabled&&require('./pack-builder').hasRewards(d.data())).map(d=>{const p=d.data();return {id:d.id,name:p.name,appearance:p.appearance||{base:p.color,accent:p.color},price:timing.shopPrice(u,p.shop),basePrice:p.shop.price,currency:p.shop.currency,cooldownMinutes:cooldown(p.shop),nextAt:nextPurchase(u,d.id,cooldown(p.shop)),cards:rules.amuletOdds(u,require('./unique-creature-rewards').cards(odds(p),catalog,u))};})};
 });
 route('post','/pack-shop/buy',async(id,body)=>{
  const rewardCatalog=await require('./free-pack-routes').catalog(db,{ includeRandomCards: false });
  if(typeof body.packId!=='string'||!body.packId||body.packId.includes('/')||typeof body.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(body.requestId))throw Error('Invalid purchase request.');
  return db.runTransaction(async tx=>{
   const userRef=db.collection('users').doc(id),packRef=db.collection('packs').doc(body.packId),receiptRef=db.collection('packShopPurchases').doc(id+'_'+body.requestId);
   const [user,pack,previous]=await Promise.all([tx.get(userRef),tx.get(packRef),tx.get(receiptRef)]);
   if(previous.exists){if(previous.data().packId!==body.packId)throw Error('Purchase request belongs to another pack.');return previous.data();}
   if(!user.exists||!pack.exists)throw Error('Pack or user not found.');const p=pack.data(),u=user.data(),offer=p.shop;
   if(!offer?.enabled||!require('./pack-builder').hasRewards(p))throw Error('This pack is no longer for sale.');
   if(!Number.isFinite(offer.price)||offer.price<=0||!['footy',...Object.keys(rules.GEM_NAMES)].includes(offer.currency))throw Error('This pack has an invalid price.');
   if(!p.cardIds?.length&&!require('./unique-creature-rewards').cards(p.rewardCards||[],rewardCatalog,u).length)throw Error('You already own all Unique creatures available in this pack.');
   const price=timing.shopPrice(u,offer);
   if(body.price!==price||body.currency!==offer.currency)throw Error('The price changed. Refresh the shop before buying.');
   const now=Date.now(),cooldownMinutes=cooldown(offer),nextAt=nextPurchase(u,body.packId,cooldownMinutes);
   if(now<nextAt){const minutes=Math.ceil((nextAt-now)/60000);throw Error(`This pack unlocks in ${Math.floor(minutes/60)}h ${minutes%60}m.`);}
   let update;
   if(offer.currency==='footy'){const balance=Number(u.balance)||0;if(balance<price)throw Error('Not enough Footy.');update={balance:Math.round((balance-price)*100)/100};}
   else{if(!Number.isSafeInteger(offer.price))throw Error('Invalid gem price.');const gems=wallet.wallet(u.gems);if((gems[offer.currency]||0)<price)throw Error('Not enough '+rules.GEM_NAMES[offer.currency]+'.');gems[offer.currency]-=price;update={gems};}
   update.packShopLastPurchases={...u.packShopLastPurchases,[body.packId]:now};
   const item=db.collection('items').doc(),receipt={itemId:item.id,packId:body.packId,name:p.name,price,currency:offer.currency,appearance:p.appearance||null,packColor:p.color||'#667eea',purchasedAt:now,nextAt:cooldownMinutes?now+timing.shopDuration(u,cooldownMinutes):0};
   const proof=require('./card-upgrades').markPack(tx,db,item,id,body.packId,p);
   tx.update(userRef,update);tx.set(item,{name:p.name,itemType:'pack',packId:body.packId,packColor:receipt.packColor,price:0,sellerId:id,buyerId:id,sold:true,listedForSale:false,purchasedAt:new Date(),createdAt:new Date(),source:'pack-shop',...proof});tx.set(receiptRef,receipt);return receipt;
  });
 });
};
module.exports.odds=odds;
