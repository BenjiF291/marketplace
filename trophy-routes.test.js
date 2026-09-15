const test=require('node:test');const assert=require('node:assert/strict');
function harness(seed){
 const records=structuredClone(seed),handlers={};let serial=0;
 const snap=key=>({exists:!!records[key],data:()=>structuredClone(records[key]),id:key.split('/').pop()});
 const ref=key=>({key,id:key.split('/').pop(),get:async()=>snap(key)});
 const db={collection:name=>({doc:id=>ref(`${name}/${id||`new${serial++}`}`),get:async()=>({docs:Object.keys(records).filter(key=>key.startsWith(name+'/')).map(snap)})}),
 runTransaction:async fn=>{const writes=[];const result=await fn({get:async ref=>{assert.equal(writes.length,0);return snap(ref.key);},update:(ref,value)=>writes.push(()=>records[ref.key]={...records[ref.key],...value}),set:(ref,value)=>writes.push(()=>records[ref.key]=value)});writes.forEach(fn=>fn());return result;}};
 const app={get:(url,fn)=>handlers[url]=fn,post:(url,fn)=>handlers[url]=fn};
 require('./trophy-routes')(app,db,async()=>[],async req=>req.header('X-User-Id'));
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

const engine=require('./public/practice-engine');
const rankedBody={mode:'skill',first:'player',cardIds:engine.trainingCards().map(c=>c.id)};
function complete(session, worst=false){
 const game=structuredClone(session.initial),moves=[];let turn=0;
 while(game.player.length||game.computer.length){
  if(game.turn==='player'){
   const choices=engine.rankMoves(game.board,game.player,game.computer,'player');
   const move=worst?choices.at(-1):choices[0];moves.push({cardIndex:move.cardIndex,cell:move.cell});
   game.board=engine.play(game.board,game.player[move.cardIndex],move.cell,'player');game.player.splice(move.cardIndex,1);game.turn=game.computer.length?'computer':'player';
  }else{
   const move=engine.chooseMove(game.board,game.computer,game.player,session.difficulty,engine.seeded(session.seed+turn++));
   game.board=engine.play(game.board,game.computer[move.cardIndex],move.cell,'computer');game.computer.splice(move.cardIndex,1);game.turn=game.player.length?'player':'computer';
  }
 }
 return moves;
}
test('new accounts get persistent 300 skill and clients cannot choose ranked strength',async()=>{
 const h=harness({'users/u':{}});
 assert.equal((await h.invoke('/brawl/skill')).payload.skillLevel,300);
 assert.equal(h.records['brawlProfiles/u'].skillLevel,300);
 const start=await h.invoke('/computer-battles/start',{...rankedBody,difficulty:0,skillLevel:1000});
 assert.equal(start.status,200);assert.deepEqual(start.payload.difficulty,{policy:'adaptive-v2',skill:300});
 assert.equal(start.payload.target,start.payload.playerAverage);
 assert.equal((await h.invoke('/computer-battles/start',{...rankedBody,mode:'training'})).status,400);
});
test('ranked replay assesses optimal decisions, saves once, rejects invalid replay',async()=>{
 const h=harness({'users/u':{balance:0}});
 const {payload:session}=await h.invoke('/computer-battles/start',rankedBody);
 assert.equal((await h.invoke('/computer-battles/finish',{id:session.id,moves:[]})).status,400);
 const moves=complete(session);
 const {payload:result,status}=await h.invoke('/computer-battles/finish',{id:session.id,moves,quality:0,skillLevel:1000});
 assert.equal(status,200);assert.equal(result.skill.quality,100);
 assert.equal(h.records['brawlProfiles/u'].skillLevel,result.skill.after);
 const saved=structuredClone(h.records);
 assert.deepEqual((await h.invoke('/computer-battles/finish',{id:session.id,moves})).payload,result);
 assert.deepEqual(h.records,saved);
});
test('forfeit lowers skill and disables then restores milestones based on current level',async()=>{
 const h=harness({'users/u':{},'brawlProfiles/u':{skillLevel:300}});
 await h.invoke('/computer-battles/start',rankedBody);
 const next=await h.invoke('/computer-battles/start',rankedBody);
 assert.equal(next.payload.skillLevel,288);assert.deepEqual(next.payload.difficulty,{policy:'adaptive-v2',skill:288});
 assert.equal((await h.invoke('/brawl/skill')).payload.booster.at,150);
 h.records['brawlProfiles/u'].skillLevel=301;
 assert.equal((await h.invoke('/brawl/skill')).payload.booster.at,300);
});
test('booster payout uses current skill, not skill at start, and applies once',async()=>{
 const initial={board:Array(16).fill(null),player:[],computer:[],turn:'player'};initial.board[0]={ownerId:'player'};
 const h=harness({'users/u':{balance:0},'brawlProfiles/u':{skillLevel:150},'computerBattles/m':{userId:'u',status:'active',mode:'skill',skillAtStart:1000,difficulty:940,seed:1,initial}});
 const {payload:r}=await h.invoke('/computer-battles/finish',{id:'m',moves:[]});
 assert.equal(r.footy,10);assert.equal(r.delta,26);assert.equal(h.records['users/u'].balance,10);
 await h.invoke('/computer-battles/finish',{id:'m',moves:[]});assert.equal(h.records['users/u'].balance,10);
});
test('poor decisions score worse than optimal decisions through authoritative replay',async()=>{
 const {replay}=require('./trophy-utils');
 const h=harness({'users/u':{}});const {payload:session}=await h.invoke('/computer-battles/start',rankedBody);
 assert.ok(replay(session,complete(session),true).quality>replay(session,complete(session,true),true).quality);
});
