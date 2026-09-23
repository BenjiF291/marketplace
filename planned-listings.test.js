const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
test('planned listing deletion requires admin, deletes scheduled plans and refuses published plans', async () => {
 const source = fs.readFileSync('server.js','utf8');
 const start = source.indexOf("app.delete('/admin/market-listings/planned/:planId'");
 const code = source.slice(start, source.indexOf('\n});',start)+5);
 let handler, deleted = false, admin = true, status = 'scheduled', responseStatus;
 const ref = {};
 const db = {collection:()=>({doc:()=>ref}),runTransaction:fn=>fn({get:async()=>({exists:true,data:()=>({status})}),delete:()=>{deleted=true;}})};
 vm.runInNewContext(code,{app:{delete:(path,fn)=>handler=fn},db,userIsAdmin:async()=>admin});
 const invoke = async()=>{responseStatus=200;await handler({header:()=> 'admin',params:{planId:'plan'}},{status(code){responseStatus=code;return this;},send(){},json(){}});};
 admin=false;await invoke();assert.equal(responseStatus,403);assert.equal(deleted,false);
 admin=true;status='published';await invoke();assert.equal(responseStatus,409);assert.equal(deleted,false);
 status='scheduled';await invoke();assert.equal(responseStatus,200);assert.equal(deleted,true);
});
test('dismissing notices preserves publication status and expiry and requires admin', async () => {
 const source = fs.readFileSync('server.js', 'utf8');
 const start = source.indexOf("app.post('/admin/market-listings/planned/:planId/dismiss'");
 const code = source.slice(start, source.indexOf('\n});', start) + 5);
 let handler, admin = true, responseStatus;
 let plan = { status: 'published', expiresAt: '2030-01-01', listingGroupId: 'stock' };
 const db = { collection: () => ({ doc: () => ({}) }), runTransaction: fn => fn({
   get: async () => ({ exists: true, data: () => plan }),
   update: (ref, update) => { plan = { ...plan, ...update }; }
 }) };
 vm.runInNewContext(code, { app: { post: (path, fn) => handler = fn }, db, userIsAdmin: async () => admin });
 const invoke = async () => { responseStatus = 200; await handler({ header: () => 'admin', params: { planId: 'plan' } }, { status(code) { responseStatus = code; return this; }, send() {}, json() {} }); };
 admin = false; await invoke(); assert.equal(responseStatus, 403); assert.equal(plan.dismissed, undefined);
 admin = true; await invoke(); assert.equal(plan.dismissed, true); assert.equal(plan.status, 'published'); assert.equal(plan.expiresAt, '2030-01-01'); assert.equal(plan.listingGroupId, 'stock');
 plan = { status: 'expired' }; await invoke(); assert.equal(plan.dismissed, true);
 plan = { status: 'scheduled' }; await invoke(); assert.equal(responseStatus, 409); assert.equal(plan.dismissed, undefined);
});

test('expiration preserves purchased stock including a purchase racing cleanup',async()=>{
 const source=fs.readFileSync('server.js','utf8');const deleted=[];
 const item=(id,sold)=>({id,ref:{id},exists:true,data:()=>({sold})});
 const plan={ref:{update:async()=>{}},data:()=>({listingGroupId:'g',expiresAt:new Date(0)})};
 const db={collection:name=>({where:(field,op,value)=>({get:async()=>({docs:name==='items'?[item('owned',true),item('race',false),item('unsold',false)]:value==='scheduled'?[]:[plan]})}),doc:()=>({delete:async()=>{}})}),runTransaction:fn=>fn({getAll:async()=>[item('race',true),item('unsold',false)],delete:ref=>deleted.push(ref.id)})};
 const context={db,console,Date};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('async function syncPlannedMarketplaceListings'),source.indexOf('async function findTierForCard')),context);
 await context.syncPlannedMarketplaceListings();assert.deepEqual(deleted,['unsold']);
});
