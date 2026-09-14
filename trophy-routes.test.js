const test=require('node:test');const assert=require('node:assert/strict');
function harness(seed){
 const records=structuredClone(seed),handlers={};let serial=0;
 const snap=key=>({exists:!!records[key],data:()=>structuredClone(records[key]),id:key.split('/').pop()});
 const ref=key=>({key,id:key.split('/').pop(),get:async()=>snap(key)});
 const db={collection:name=>({doc:id=>ref(`${name}/${id||`new${serial++}`}`),get:async()=>({docs:Object.keys(records).filter(key=>key.startsWith(name+'/')).map(snap)})}),
 runTransaction:async fn=>{const writes=[];const result=await fn({get:async ref=>{assert.equal(writes.length,0);return snap(ref.key);},update:(ref,value)=>writes.push(()=>records[ref.key]={...records[ref.key],...value}),set:(ref,value)=>writes.push(()=>records[ref.key]=value)});writes.forEach(fn=>fn());return result;}};
 const app={get:(url,fn)=>handlers[url]=fn,post:(url,fn)=>handlers[url]=fn};
 require('./trophy-routes')(app,db,async()=>[]);
 return {records,invoke:async(url,body)=>{let status=200,payload;await handlers[url]({header:()=> 'u',body},{status(code){status=code;return this;},send(value){payload=value;},json(value){payload=value;}});return {status,payload};}};
}
test('milestone can only be claimed once and uses peak trophies',async()=>{
 const h=harness({'users/u':{trophies:0,trophyPeak:75,balance:10,gems:{bronze:2}}});
 assert.equal((await h.invoke('/trophies/claim',{at:75})).status,200);
 assert.equal(h.records['users/u'].balance,110);assert.equal(h.records['users/u'].gems.bronze,7);
 assert.equal((await h.invoke('/trophies/claim',{at:75})).status,400);
 assert.equal((await h.invoke('/trophies/claim',{at:150})).status,400);
 assert.equal(h.records['users/u'].balance,110);
});
test('completed game trophies are awarded once even when the finish request repeats',async()=>{
 const initial={board:Array(16).fill(null),player:[],computer:[],turn:'player'};initial.board[0]={ownerId:'player'};
 const h=harness({'users/u':{trophies:0,activeComputerBattle:'m'},'computerBattles/m':{userId:'u',status:'active',difficulty:'hard',seed:1,initial}});
 assert.equal((await h.invoke('/computer-battles/finish',{id:'m',moves:[]})).payload.trophies,40);
 assert.equal((await h.invoke('/computer-battles/finish',{id:'m',moves:[]})).payload.trophies,40);
 assert.equal(h.records['users/u'].trophies,40);
});
test('starting again forfeits unfinished trophy match and rejects invalid decks',async()=>{
 const h=harness({'users/u':{trophies:20,activeComputerBattle:'old'},'computerBattles/old':{userId:'u',status:'active',difficulty:'medium'}});
 const body={difficulty:'easy',first:'player',cardIds:Array.from({length:6},(_,i)=>`training-${i}`)};
 assert.equal((await h.invoke('/computer-battles/start',body)).status,200);
 assert.equal(h.records['users/u'].trophies,10);assert.equal(h.records['computerBattles/old'].status,'forfeit');
 assert.equal((await h.invoke('/computer-battles/start',{...body,cardIds:['madeup']})).status,400);
});
