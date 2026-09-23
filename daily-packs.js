const { randomInt } = require('node:crypto');
const TIERS = Object.freeze([
  ['Bronze',800],['Rare Bronze',60],['Silver',40],['Rare Silver',25],
  ['Gold',20],['Rare Gold',18],['Platinum',15],['Lightning',12],['Ultra',10]
].map(([name,weight])=>Object.freeze({name,weight,percent:weight/10})));

function chooseTier(roll = randomInt(1000)) {
  if (!Number.isInteger(roll) || roll < 0 || roll >= 1000) throw new Error('Invalid daily pack roll');
  let total=0;
  for(const tier of TIERS) { total+=tier.weight; if(roll<total)return tier.name; }
}
function dayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
function expiryDate(postedAt) {
  return new Date(new Date(postedAt).getTime()+5*24*60*60*1000);
}
// Triangular distribution: minimum 1x, mode 1.4x, maximum 2x.
function dailyPrice(sellPrice, roll = randomInt(1000000)) {
  const base=Number(sellPrice);
  if(!Number.isFinite(base)||base<=0)throw new Error('Daily pack: tier needs a positive sell price');
  if(!Number.isInteger(roll)||roll<0||roll>=1000000)throw new Error('Invalid price roll');
  const u=roll/999999;
  const multiplier=u<0.4 ? 1+Math.sqrt(u*0.4) : 2-Math.sqrt((1-u)*0.6);
  return Math.round(base*multiplier*100)/100;
}
module.exports={TIERS,chooseTier,dayKey,expiryDate,dailyPrice};

// One persisted draw per Amsterdam date. Separate from the admin notice so
// deleting/dismissing a notice never causes a second draw for the same day.
function createDailyPackService({db,getTiers,getSettings,random=randomInt}) {
  let completedDay=null;
  return async function ensureDailyPack(now=new Date()) {
    const day=dayKey(now);
    if(completedDay===day)return;
    const marker=db.collection('dailyPackDays').doc(day);
    const roll=random(1000);
    const draw=await db.runTransaction(async tx=>{
      const previous=await tx.get(marker);
      if(previous.exists)return previous.data();
      const value={tierName:chooseTier(roll),createdAt:now,status:'drawn'};
      tx.set(marker,value);return value;
    });
    if(draw.status==='scheduled'){completedDay=day;return;}
    const tiers=await getTiers();
    const tier=tiers.find(entry=>String(entry.name).trim().toLowerCase()===draw.tierName.toLowerCase());
    if(!tier?.packs?.length)throw new Error(`Daily pack: assign a pack to ${draw.tierName}`);
    const packs=await Promise.all([...new Set(tier.packs)].map(id=>db.collection('packs').doc(id).get()));
    const available=packs.filter(doc=>doc.exists&&doc.data().cardIds?.length);
    if(!available.length)throw new Error(`Daily pack: no usable ${draw.tierName} packs`);
    const pack=available[random(available.length)];
    const settings=await getSettings(tier,pack);
    if(!settings.sellerId||!Number.isFinite(settings.price)||settings.price<=0||!Number.isInteger(settings.quantity)||settings.quantity<1||settings.quantity>400)throw new Error('Daily pack: invalid seller, price or stock settings');
    const plan=db.collection('marketListingPlans').doc(`daily-${day}`);
    await db.runTransaction(async tx=>{
      const latest=await tx.get(marker);
      if(latest.data().status==='scheduled')return;
      tx.set(plan,{sellerId:settings.sellerId,itemType:'pack',productId:pack.id,
        price:settings.price,quantity:settings.quantity,perUserLimit:settings.perUserLimit||0,
        currency:'footy',vipDiscountPercent:settings.vipDiscountPercent||0,
        scheduledAt:now,expiresAt:expiryDate(now),createdAt:now,status:'scheduled',
        dailyPack:true,tierName:draw.tierName});
      tx.update(marker,{status:'scheduled',planId:plan.id});
    });
    completedDay=day;
  };
}
module.exports.createDailyPackService=createDailyPackService;
