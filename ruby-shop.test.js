const test=require('node:test'),assert=require('node:assert/strict');const shop=require('./ruby-shop');
const tiers=['Bronze','Rare Bronze','Silver','Rare Silver','Gold','Rare Gold','Platinum','Lightning','Ultra','Special','Mythic'].map((name,order)=>({name,order,packs:[`p${order}`]}));
test('shop spends only Ruby, forbids duplicate collectibles and invalid goods',()=>{
 const user={gems:{bronze:150,gold:20}};const update=shop.purchase(user,'pet:fox');assert.equal(update.gems.bronze,50);assert.equal(update.gems.gold,20);assert.equal(user.gems.bronze,150);
 assert.throws(()=>shop.purchase({...user,...update},'pet:fox'),/Already/);assert.throws(()=>shop.purchase({gems:{bronze:1}},'fuel'),/enough/);assert.throws(()=>shop.purchase(user,'forged'));
});
test('compass eligibility follows all six boundaries, unclassified packs require Legendary',()=>{
 for(const [key,max] of [['common',2],['uncommon',5],['rare',7],['ultra',8],['mythical',10],['legendary',10]])for(let rank=0;rank<tiers.length;rank++)assert.equal(shop.compassAllowed('compass:'+key,`p${rank}`,tiers),rank<=max);
 assert.equal(shop.compassAllowed('compass:mythical','unclassified',tiers),false);assert.equal(shop.compassAllowed('compass:legendary','unclassified',tiers),true);assert.equal(shop.compassAllowed('compass:common','trophy-bronze',tiers),true);
 assert.equal(shop.compassAllowed('bad','p0',tiers),false);
});
test('compass draws unique choices, including small packs',()=>{
 assert.deepEqual(shop.choices(['a','a']),['a']);assert.equal(shop.choices(['a','b']).length,2);const cards=shop.choices(['a','b','c','d']);assert.equal(new Set(cards).size,3);
});
test('treats and recalls consume one item; pets never have hunger penalties',()=>{
 const user={rubyItems:{'pet:fox':1,food:2,recall:1},rubyEquipped:{pet:'pet:fox'},amuletSlots:[{id:'a',removableAt:Date.now()+99999}]};
 assert.equal(shop.use(user,{itemId:'food'}).rubyItems.food,1);const recalled=shop.use(user,{itemId:'recall',slot:0});assert.equal(recalled.amuletSlots[0],null);assert.equal(recalled.amulets.a,1);assert.equal(recalled.rubyItems.recall,0);
 assert.throws(()=>shop.use(user,{itemId:'recall',slot:4}));assert.throws(()=>shop.use({rubyItems:{food:1}},{itemId:'food'}));
 assert.equal(shop.use(user,{itemId:'pet:fox'}).rubyEquipped.pet,'pet:fox');
});
test('fuel has a 100 Footy saving cap and arming does not consume it',()=>{
 assert.equal(shop.fuelCost({rubyFuelArmed:true},75),37.5);assert.equal(shop.fuelCost({rubyFuelArmed:true},500),400);assert.equal(shop.fuelCost({},75),75);
 assert.deepEqual(shop.use({rubyItems:{fuel:1}},{itemId:'fuel'}),{rubyFuelArmed:true});
});
test('wheel retry replaces payout, preserves spin bonuses, and is once per day',()=>{
 const now=Date.now(),user={balance:100,lastSpin:new Date(now-1000),lastSpinAmount:51,wheelRetryReward:{multiplier:2,bonus:3},rubyItems:{retry:2},wheelSpinCount:3};
 const update=shop.retryWheel(user,8,now);assert.equal(update.balance,68);assert.equal(update.lastSpinAmount,19);assert.equal(update.rubyItems.retry,1);assert.equal(update.wheelSpinCount,undefined);assert.equal(update.lastSpin,undefined);
 assert.throws(()=>shop.retryWheel({...user,...update},24,now),/already/);assert.throws(()=>shop.retryWheel({...user,balance:0},8,now),/enough Footy/);
});
test('Ruby transactions authenticate and deduplicate retries of purchases',async()=>{
 const handlers={},records={'users/u':{gems:{bronze:100}}};let authenticated=0;
 const snap=key=>({exists:!!records[key],data:()=>records[key]});const db={collection:n=>({doc:id=>({key:n+'/'+id,get:async()=>snap(n+'/'+id)})}),runTransaction:fn=>fn({getAll:async(...refs)=>refs.map(r=>snap(r.key)),update:(ref,value)=>Object.assign(records[ref.key],value),set:(ref,value)=>records[ref.key]=value})};
 require('./ruby-shop-routes')({get:(p,fn)=>handlers[p]=fn,post:(p,fn)=>handlers[p]=fn},db,async()=>{authenticated++;return 'u';});
 let status=200;const res={json(){},status(n){status=n;return this;},send(){}};const req={params:{action:'buy'},body:{itemId:'fuel',actionId:'1234567890123456'}};
 await handlers['/ruby-shop/:action'](req,res);await handlers['/ruby-shop/:action'](req,res);
 assert.equal(status,200);assert.equal(records['users/u'].gems.bronze,85);assert.equal(records['users/u'].rubyItems.fuel,1);assert.equal(authenticated,2);
});
