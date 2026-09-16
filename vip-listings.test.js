const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('server.js','utf8');
test('VIP percentage persists on every stock item and its listing group, including scheduled publication',async()=>{
 for(const scheduled of [false,true]) {
  const records={},writes=[];let serial=0;
  const transaction={get:async()=>({exists:true,data:()=>({status:'scheduled'})}),set:(ref,value)=>writes.push([ref.key,value]),update:(ref,value)=>writes.push([ref.key,value]),commit:async()=>{}};
  const db={collection:name=>({doc:id=>({id:id||String(serial++),key:`${name}/${id||serial}`,get:async()=>({exists:true,id:'pack',data:()=>({name:'Gold',color:'#aabbcc'})})})}),batch:()=>transaction,runTransaction:fn=>fn(transaction)};
  const context={db,listingCurrency:async()=>({currency:'footy',currencyName:'Footy'}),Date};
  vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function createMarketplaceListingEntries'),source.indexOf('async function syncPlannedMarketplaceListings')),context);
  await context.createMarketplaceListingEntries({sellerId:'admin',itemType:'pack',productId:'pack',price:100,quantity:3,perUserLimit:0,vipDiscountPercent:25,...(scheduled?{planRef:{key:'plan'}}:{})});
  writes.forEach(([key,value])=>records[key]=value);
  const stocks=Object.entries(records).filter(([key])=>key.startsWith('items/'));assert.equal(stocks.length,3);assert.ok(stocks.every(([,item])=>item.vipDiscountPercent===25));
  assert.equal(Object.entries(records).find(([key])=>key.startsWith('marketListingGroups/'))[1].vipDiscountPercent,25);
  if(scheduled)assert.equal(records.plan.status,'published');
 }
});
test('admin listing API rejects invalid VIP percentages and retains them on planned listings',async()=>{
 let handler,saved;
 const context={app:{post:(url,fn)=>handler=fn},userIsAdmin:async()=>true,isValidPositiveNumber:n=>Number.isFinite(n)&&n>0,listingCurrency:async()=>({currency:'footy'}),db:{collection:()=>({doc:()=>({id:'plan',set:async data=>saved=data})})},Date,console};
 vm.runInNewContext(source.slice(source.indexOf("app.post('/admin/market-listings',"),source.indexOf('/* ------------------ TEST ITEMS')),context);
 const call=async percent=>{let status=200;await handler({header:()=> 'admin',body:{itemType:'pack',productId:'p',price:100,quantity:1,perUserLimit:0,scheduledAt:new Date(Date.now()+86400000).toISOString(),vipDiscountPercent:percent}},{status(n){status=n;return this;},send(){},json(){}});return status;};
 for(const invalid of [-1,100,10.5,'25'])assert.equal(await call(invalid),400);
 assert.equal(await call(25),201);assert.equal(saved.vipDiscountPercent,25);
});
