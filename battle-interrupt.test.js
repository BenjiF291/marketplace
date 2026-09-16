const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const engine=require('./public/practice-engine');
function harness(elapsed=16000,power='interrupt') {
 const special={id:'mirror',name:'Mirror',linkedCardImage:'Mirror_test.png',mirrorPower:power,averageScore:5,top:5,right:5,bottom:5,left:5};
 let match={status:'board',participantIds:['a','b'],turnPlayerId:'b',turnStartedAt:new Date(Date.now()-elapsed),decks:{a:['mirror','a2'],b:['b1','b2']},colors:{a:'#123456',b:'#654321'},clocks:{a:90000,b:90000},board:Array(16).fill(null),prize:0};
 match.board[5]={cardId:'starter:s',playedBy:'starter',ownerId:'starter',name:'Start',top:1,right:1,bottom:1,left:1};
 let handler;const ref={};
 const context={app:{post:(url,fn)=>handler=fn},db:{collection:()=>({doc:()=>ref}),runTransaction:async fn=>fn({get:async()=>({exists:true,data:()=>structuredClone(match)}),update:(ref,data)=>Object.assign(match,data)})},
  battleTimeouts:{settle:async()=>null},battleEngine:engine,battleCardForBoard:(card,playerId,color)=>({...card,cardId:card.id,playedBy:playerId,ownerId:playerId,color}),getBattleCardsForUser:async()=>[special],otherBattlePlayer:()=> 'b',battleMatchView:(id,data)=>data,console,Date};
 const source=fs.readFileSync('server.js','utf8');vm.runInNewContext(source.slice(source.indexOf("app.post('/battle-matches/:matchId/place'"),source.indexOf("app.put('/admin/battle-cards/:cardId/power'")),context);
 return {get match(){return match;},request:async(body={cardId:'mirror',position:6})=>{let status=200,payload;await handler({header:()=> 'a',body,params:{matchId:'m'}},{status(code){status=code;return this;},send(value){payload=value;},json(value){payload=value;}});return {status,payload};}};
}
test('online interrupt requires server elapsed time and preserves active timer and turn',async()=>{
 const early=harness(1000);assert.equal((await early.request()).status,400);assert.equal(early.match.board[6],null);
 const h=harness(),started=h.match.turnStartedAt.getTime();const result=await h.request();assert.equal(result.status,200);
 assert.equal(h.match.turnPlayerId,'b');assert.equal(new Date(h.match.turnStartedAt).getTime(),started);assert.equal(h.match.clocks.a,90000);assert.equal(h.match.interruptsUsed.a,true);
 assert.equal((await h.request()).status,400);assert.equal(h.match.playedCards.length,1);
});
test('ordinary cards cannot claim an interrupt, and replacement retains used-card ledger',async()=>{
 const ordinary=harness(20000,'plain');assert.equal((await ordinary.request()).status,400);
 const replace=harness(1000,'replace');replace.match.turnPlayerId='a';
 const result=await replace.request({cardId:'mirror',position:5});assert.equal(result.status,200);assert.equal(replace.match.board[5].cardId,'mirror');assert.equal(replace.match.playedCards.length,1);
});
