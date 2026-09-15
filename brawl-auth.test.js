const test=require('node:test');const assert=require('node:assert/strict');
test('ranked authentication requires a valid unexpired token bound to the account',async()=>{
  const records={};const auth=require('./brawl-auth')({collection:()=>({doc:key=>({set:async value=>records[key]=value,get:async()=>({exists:!!records[key],data:()=>records[key]})})})});
  const token=await auth.issue('alice');
  const req=(id,t)=>({header:name=>name==='Authorization'?`Bearer ${t}`:id});
  assert.equal(await auth.authenticate(req('alice',token)),'alice');
  await assert.rejects(auth.authenticate(req('bob',token)));
  await assert.rejects(auth.authenticate(req('alice','')));
  await assert.rejects(auth.authenticate(req('alice','0'.repeat(64))));
  Object.values(records)[0].expiresAt=0;
  await assert.rejects(auth.authenticate(req('alice',token)));
  assert.ok(!Object.keys(records).includes(token));
});
