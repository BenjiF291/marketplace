const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('server.js','utf8'),start=source.indexOf("app.post('/spin-wheel'"),end=source.indexOf("\napp.",start+10),route=source.slice(start,end);
for(const vip of [false,true])test(`wheel breakdown separates ${vip?'VIP doubled':'normal'} prize from amulet and streak bonuses`,async()=>{
 let handler,result,update;const user={balance:100,vipUntil:vip?new Date(Date.now()+86400000):null,wheelSpinCount:2,gems:{}};
 const context={app:{post:(url,fn)=>handler=fn},db:{collection:()=>({doc:()=>({})}),runTransaction:fn=>fn({get:async()=>({exists:true,data:()=>user}),update:(_ref,v)=>update=v})},Math:Object.assign(Object.create(Math),{random:()=>0}),Date,Number,console,amuletEffects:()=>({wheel:3,wheelstreak:4}),roundFooty:n=>Math.round(n*100)/100,require:()=>({gameplay:()=>({})})};
 vm.runInNewContext(route,context);await handler({authenticatedUserId:'u',body:{userId:'u'}},{json:v=>result=v,status:()=>({send:e=>{throw Error(e)}})});
 assert.equal(result.baseReward,8);assert.equal(result.spinReward,vip?16:8);assert.equal(result.vipMultiplier,vip?2:1);assert.equal(result.bonusFooty,7);assert.equal(result.amount,(vip?16:8)+7);assert.equal(update.balance,100+result.amount);
});
