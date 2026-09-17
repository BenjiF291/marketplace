const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('server.js','utf8');
test('single-account refresh reads only that account and excludes private fields',async()=>{
 let handler,reads=0;
 const doc={id:'u',exists:true,data:()=>({username:'Player',balance:12,password:'secret'})};
 const context={app:{get:(url,fn)=>handler=fn},db:{collection:()=>({doc:id=>{assert.equal(id,'u');return {get:async()=>{reads++;return doc;}};},get:()=>{throw Error('Directory read');}})},serializeDate:value=>value,console};
 vm.runInNewContext(source.slice(source.indexOf("app.get('/users',"),source.indexOf("app.get('/users',")+source.slice(source.indexOf("app.get('/users',")).indexOf('\n});')+4),context);
 let payload,status=200;const response={json:value=>payload=value,status:n=>{status=n;return response;},send:()=>{}};
 await handler({query:{userId:'u'}},response);
 assert.equal(reads,1);assert.equal(payload[0].balance,12);assert.equal(payload[0].password,undefined);
 await handler({query:{userId:['u']}},response);assert.equal(status,400);assert.equal(reads,1);
});
test('match polling settles only overdue clocks',async()=>{
 let handler,settlements=0;
 const match={participantIds:['u'],status:'board',turnPlayerId:'u',turnStartedAt:new Date(),clocks:{u:60000}};
 const context={app:{get:(url,fn)=>handler=fn},db:{collection:()=>({doc:()=>({get:async()=>({id:'m',exists:true,data:()=>match})})})},battleTimeouts:{expire:async()=>{settlements++;return match;}},battleMatchView:(id,value)=>value,require,console};
 vm.runInNewContext(source.slice(source.indexOf("app.get('/battle-matches/:matchId',"),source.indexOf("app.post('/battle-matches/:matchId/cancel',")),context);
 const req={header:()=> 'u',params:{matchId:'m'}},res={json:()=>{},status(){return this;},send(){}};
 await handler(req,res);assert.equal(settlements,0);
 match.turnStartedAt=new Date(Date.now()-61000);await handler(req,res);assert.equal(settlements,1);
 match.status='finished';await handler(req,res);assert.equal(settlements,1);
});
