const rules=require('./free-pack'),wallet=require('./gem-wallet');
function odds(pack){if(!pack.cardIds?.length)return pack.rewardCards||[];return [...(pack.rewardCards||[]),{title:'Collection card',options:[...new Set(pack.cardIds)].map(id=>({kind:'card',id,min:1,max:1,chance:100/new Set(pack.cardIds).size}))}];}
module.exports=(app,db,authenticate)=>{
 const route=(method,url,fn)=>app[method](url,async(req,res)=>{let id;try{id=await authenticate(req);}catch(error){return res.status(401).send(error.message);}try{res.json(await fn(id,req.body||{}));}catch(error){res.status(400).send(error.message);}});
 route('get','/pack-shop',async id=>{
  const [packs,setting,user,catalog]=await Promise.all([db.collection('packs').get(),db.collection('gameSettings').doc('freePack').get(),db.collection('users').doc(id).get(),require('./free-pack-routes').catalog(db)]);
  if(!user.exists)throw Error('User not found');const config=setting.exists?setting.data():rules.defaults(),u=user.data(),now=Date.now();
  return {serverNow:now,canEdit:u.isAdmin===true,catalog,daily:{id:'daily',daily:true,name:config.name,cards:config.cards,enabled:config.enabled,nextAt:u.isAdmin?0:u.freePackLastClaimAt?u.freePackLastClaimAt+config.cooldownHours*3600000:0},packs:packs.docs.filter(d=>d.data().shop?.enabled&&require('./pack-builder').hasRewards(d.data())).map(d=>{const p=d.data();return {id:d.id,name:p.name,appearance:p.appearance||{base:p.color,accent:p.color},price:p.shop.price,currency:p.shop.currency,cards:odds(p)};})};
 });
 route('post','/pack-shop/buy',async(id,body)=>{
  if(typeof body.packId!=='string'||!body.packId||body.packId.includes('/')||typeof body.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(body.requestId))throw Error('Invalid purchase request.');
  return db.runTransaction(async tx=>{
   const userRef=db.collection('users').doc(id),packRef=db.collection('packs').doc(body.packId),receiptRef=db.collection('packShopPurchases').doc(id+'_'+body.requestId);
   const [user,pack,previous]=await Promise.all([tx.get(userRef),tx.get(packRef),tx.get(receiptRef)]);
   if(previous.exists){if(previous.data().packId!==body.packId)throw Error('Purchase request belongs to another pack.');return previous.data();}
   if(!user.exists||!pack.exists)throw Error('Pack or user not found.');const p=pack.data(),u=user.data(),offer=p.shop;
   if(!offer?.enabled||!require('./pack-builder').hasRewards(p))throw Error('This pack is no longer for sale.');
   if(!Number.isFinite(offer.price)||offer.price<=0||!['footy',...Object.keys(rules.GEM_NAMES)].includes(offer.currency))throw Error('This pack has an invalid price.');
   if(body.price!==offer.price||body.currency!==offer.currency)throw Error('The price changed. Refresh the shop before buying.');
   let update;
   if(offer.currency==='footy'){const balance=Number(u.balance)||0;if(balance<offer.price)throw Error('Not enough Footy.');update={balance:Math.round((balance-offer.price)*100)/100};}
   else{if(!Number.isSafeInteger(offer.price))throw Error('Invalid gem price.');const gems=wallet.wallet(u.gems);if((gems[offer.currency]||0)<offer.price)throw Error('Not enough '+rules.GEM_NAMES[offer.currency]+'.');gems[offer.currency]-=offer.price;update={gems};}
   const item=db.collection('items').doc(),receipt={itemId:item.id,packId:body.packId,name:p.name,price:offer.price,currency:offer.currency,appearance:p.appearance||null,packColor:p.color||'#667eea',purchasedAt:Date.now()};
   tx.update(userRef,update);tx.set(item,{name:p.name,itemType:'pack',packId:body.packId,packColor:receipt.packColor,price:0,sellerId:id,buyerId:id,sold:true,listedForSale:false,purchasedAt:new Date(),createdAt:new Date(),source:'pack-shop'});tx.set(receiptRef,receipt);return receipt;
  });
 });
};
module.exports.odds=odds;
