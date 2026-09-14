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
