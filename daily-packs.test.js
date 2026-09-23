const test=require('node:test'),assert=require('node:assert/strict');
const {TIERS,chooseTier,dayKey,expiryDate}=require('./daily-packs');
test('daily pack draw has exact nonlinear weights from Bronze through Ultra',()=>{
 const counts={};for(let i=0;i<1000;i++){const tier=chooseTier(i);counts[tier]=(counts[tier]||0)+1;}
 assert.equal(counts.Bronze,800);assert.equal(counts.Ultra,10);
 TIERS.forEach((tier,i)=>{assert.equal(counts[tier.name],tier.weight);if(i)assert.ok(tier.weight<TIERS[i-1].weight);});
 for(const invalid of [-1,1000,NaN,0.5])assert.throws(()=>chooseTier(invalid));
});
test('daily key follows Amsterdam midnight in both seasons; stock lasts 120 hours',()=>{
 assert.equal(dayKey(new Date('2026-09-23T21:59:59Z')),'2026-09-23');
 assert.equal(dayKey(new Date('2026-09-23T22:00:00Z')),'2026-09-24');
 assert.equal(dayKey(new Date('2026-12-23T23:00:00Z')),'2026-12-24');
 assert.equal(expiryDate('2026-10-24T12:00:00Z').toISOString(),'2026-10-29T12:00:00.000Z');
});
test('daily scheduler persists one plan, reuses its draw after failure, and skips repeated reads',async()=>{
 const {createDailyPackService}=require('./daily-packs');const records={};let reads=0,configured=false;
 const ref=key=>({id:key.split('/').pop(),key,get:async()=>({id:key.split('/').pop(),exists:true,data:()=>({cardIds:['bronze.png']})})});
 const db={collection:name=>({doc:id=>ref(`${name}/${id}`)}),runTransaction:async fn=>fn({
  get:async ref=>{reads++;return {exists:!!records[ref.key],data:()=>records[ref.key]};},
  set:(ref,data)=>records[ref.key]=data,update:(ref,data)=>Object.assign(records[ref.key],data)
 })};
 const options={db,random:()=>0,getTiers:async()=>configured?[{name:'Bronze',packs:['bronze']}]:[],getSettings:async()=>({sellerId:'admin',price:50,quantity:20,perUserLimit:1})};
 const run=createDailyPackService(options),now=new Date('2026-09-23T10:00:00Z');
 await assert.rejects(run(now),/assign a pack/);configured=true;await run(now);
 const plan=records['marketListingPlans/daily-2026-09-23'];assert.equal(plan.price,50);assert.equal(plan.expiresAt-now,432000000);
 const count=reads;await run(now);assert.equal(reads,count);
 await createDailyPackService({...options,random:()=>999})(now);
 assert.equal(records['marketListingPlans/daily-2026-09-23'],plan);
 assert.equal(Object.keys(records).length,2);
});
test('daily prices stay within 1x–2x and cluster around the 1.4x mode',()=>{
 const {dailyPrice}=require('./daily-packs');
 assert.equal(dailyPrice(25,0),25);assert.equal(dailyPrice(25,999999),50);
 assert.equal(dailyPrice(25,400000),35);
 const buckets=Array(10).fill(0);
 for(let roll=0;roll<1000000;roll+=100){const price=dailyPrice(100,roll);assert.ok(price>=100&&price<=200);buckets[Math.min(9,Math.floor((price-100)/10))]++;}
 assert.ok(buckets[3]>buckets[0]&&buckets[4]>buckets[9]);
 assert.ok(buckets[3]+buckets[4]+buckets[5]>5000);
 for(const bad of [0,-1,NaN,Infinity])assert.throws(()=>dailyPrice(bad,0));
});
