const {effects,discounted}=require('./amulet-utils');
const HOUR=3600000;
function dailyDuration(user,config){return Math.round(Number(config.cooldownHours||7)*HOUR*(1-(effects(user).dailycooldown||0)/100));}
function dailyNextAt(user,config){return user.isAdmin===true?0:user.freePackLastClaimAt?Number(user.freePackLastClaimAt)+dailyDuration(user,config):0;}
function shopDuration(user,minutes){return Math.round(minutes*60000*(1-(effects(user).shopcooldown||0)/100));}
function shopNextAt(user,id,minutes){const last=Number(user.packShopLastPurchases?.[id]);return minutes&&Number.isFinite(last)&&last>0?last+shopDuration(user,minutes):0;}
function shopPrice(user,offer){const buffs=effects(user),percent=Math.max(buffs.packshop||0,offer.currency==='footy'?buffs.market||0:0);return offer.currency==='footy'?discounted(offer.price,percent):Math.ceil(offer.price*(1-percent/100));}
async function loadContext(db,user,tx){
 const read=ref=>tx?tx.get(ref):ref.get(),context={daily:require('./free-pack').defaults(),packs:[]};
 if(user.freePackLastClaimAt){const doc=await read(db.collection('gameSettings').doc('freePack'));if(doc.exists)context.daily=doc.data();}
 const ids=Object.keys(user.packShopLastPurchases||{}).filter(id=>id&&!id.includes('/'));
 context.packs=(await Promise.all(ids.map(async id=>{const doc=await read(db.collection('packs').doc(id));return doc.exists?{...doc.data(),id}:null;}))).filter(Boolean);return context;
}
module.exports={dailyDuration,dailyNextAt,shopDuration,shopNextAt,shopPrice,loadContext};
