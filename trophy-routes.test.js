const test=require('node:test');const assert=require('node:assert/strict');
function harness(seed,owned=[]){
 const records=structuredClone(seed),handlers={};let serial=0;
 const snap=key=>({exists:!!records[key],data:()=>structuredClone(records[key]),id:key.split('/').pop()});
 const ref=key=>({key,id:key.split('/').pop(),get:async()=>snap(key)});
 const db={collection:name=>({doc:id=>ref(`${name}/${id||`new${serial++}`}`),get:async()=>({docs:Object.keys(records).filter(key=>key.startsWith(name+'/')).map(snap)})}),
 runTransaction:async fn=>{const writes=[];const result=await fn({get:async ref=>{assert.equal(writes.length,0);return snap(ref.key);},update:(ref,value)=>writes.push(()=>records[ref.key]={...records[ref.key],...value}),set:(ref,value)=>writes.push(()=>records[ref.key]=value)});writes.forEach(fn=>fn());return result;}};
 const app={get:(url,fn)=>handlers[url]=fn,post:(url,fn)=>handlers[url]=fn};
 require('./trophy-routes')(app,db,async()=>owned,async req=>req.header('X-User-Id'));
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
   const choices=session.assessmentVersion===2?engine.assessMoves(game.board,game.player,game.computer,'player'):engine.rankMoves(game.board,game.player,game.computer,'player');
   const move=worst?choices.at(-1):choices[0];moves.push({cardIndex:move.cardIndex,cell:move.cell});
   game.board=engine.play(game.board,game.player[move.cardIndex],move.cell,'player');game.player.splice(move.cardIndex,1);game.turn=game.computer.length?'computer':'player';
  }else{
   const move=engine.chooseMove(game.board,game.computer,game.player,session.difficulty,engine.seeded(session.seed+turn++));
   game.board=engine.play(game.board,game.computer[move.cardIndex],move.cell,'computer');game.computer.splice(move.cardIndex,1);game.turn=game.player.length?'player':'computer';
  }
 }
 return moves;
}
test('new accounts begin unranked placements and clients cannot choose ranked strength',async()=>{
 const h=harness({'users/u':{}});
 assert.equal((await h.invoke('/brawl/skill')).payload.skillLevel,null);
 assert.equal(h.records['brawlProfiles/u'].placementsCompleted,0);
 const start=await h.invoke('/computer-battles/start',{...rankedBody,difficulty:0,skillLevel:1000});
 assert.equal(start.status,200);assert.deepEqual(start.payload.difficulty,{policy:'adaptive-v3',skill:500});
 assert.ok(Math.abs(start.payload.target-start.payload.playerAverage)<=.4);
 assert.equal(start.payload.profile.placed,false);
 assert.equal((await h.invoke('/computer-battles/start',{...rankedBody,mode:'training'})).status,400);
});
test('ranked replay assesses optimal decisions, saves once, rejects invalid replay',async()=>{
 const h=harness({'users/u':{balance:0}});
 const {payload:session}=await h.invoke('/computer-battles/start',rankedBody);
 assert.equal((await h.invoke('/computer-battles/finish',{id:session.id,moves:[]})).status,400);
 const moves=complete(session);
 const {payload:result,status}=await h.invoke('/computer-battles/finish',{id:session.id,moves,quality:0,skillLevel:1000});
 assert.equal(status,200);assert.equal(result.skill.quality,100);
 assert.equal(result.skill.placement,true);assert.equal(result.skill.after,null);
 assert.equal(h.records['brawlProfiles/u'].placementsCompleted,1);assert.equal(result.moveReviews.length,6);
 const saved=structuredClone(h.records);
 assert.deepEqual((await h.invoke('/computer-battles/finish',{id:session.id,moves})).payload,result);
 assert.deepEqual(h.records,saved);
});
test('forfeit lowers skill and disables then restores milestones based on current level',async()=>{
 const h=harness({'users/u':{},'brawlProfiles/u':{skillLevel:300,ratingVersion:2,placementsCompleted:5}});
 await h.invoke('/computer-battles/start',rankedBody);
 const next=await h.invoke('/computer-battles/start',rankedBody);
 assert.equal(next.payload.profile.skillLevel,288);assert.deepEqual(next.payload.difficulty,{policy:'adaptive-v3',skill:288});
 assert.equal((await h.invoke('/brawl/skill')).payload.booster.at,150);
 h.records['brawlProfiles/u'].skillLevel=301;
 assert.equal((await h.invoke('/brawl/skill')).payload.booster.at,300);
});
test('booster payout uses current skill, not skill at start, and applies once',async()=>{
 const initial={board:Array(16).fill(null),player:[],computer:[],turn:'player'};initial.board[0]={ownerId:'player'};
 const h=harness({'users/u':{balance:0},'brawlProfiles/u':{skillLevel:150,ratingVersion:2,placementsCompleted:5},'computerBattles/m':{userId:'u',status:'active',mode:'skill',skillAtStart:1000,difficulty:940,seed:1,initial}});
 const {payload:r}=await h.invoke('/computer-battles/finish',{id:'m',moves:[]});
 assert.equal(r.footy,0);assert.equal(r.ruby,0);assert.equal(r.delta,26);assert.equal(h.records['users/u'].balance,0);
 await h.invoke('/computer-battles/finish',{id:'m',moves:[]});assert.equal(h.records['users/u'].balance,0);
});
test('poor decisions score worse than optimal decisions through authoritative replay',async()=>{
 const {replay}=require('./trophy-utils');
 const h=harness({'users/u':{}});const {payload:session}=await h.invoke('/computer-battles/start',rankedBody);
 assert.ok(replay(session,complete(session),true).quality>replay(session,complete(session,true),true).quality);
});

test('five placements assign a rating, then ordinary skill changes begin; retries do not count twice',async()=>{
 const h=harness({'users/u':{}});
 for(let i=1;i<=5;i++){
   const {payload:session}=await h.invoke('/computer-battles/start',rankedBody);
   const moves=complete(session);
   const {payload:r}=await h.invoke('/computer-battles/finish',{id:session.id,moves});
   assert.equal(r.profile.placementsCompleted,i);assert.equal(r.profile.placed,i===5);
   assert.equal(r.footy,0);assert.equal(r.ruby,0);
   assert.equal(r.profile.skillLevel===null,i<5);
   await h.invoke('/computer-battles/finish',{id:session.id,moves});
   assert.equal(h.records['brawlProfiles/u'].placementsCompleted,i);
 }
 const {payload:session}=await h.invoke('/computer-battles/start',rankedBody);
 const {payload:r}=await h.invoke('/computer-battles/finish',{id:session.id,moves:complete(session)});
 assert.equal(r.skill.placement,undefined);assert.equal(typeof r.skill.delta,'number');
});
test('existing accounts get placements once without losing old trophies; forfeit counts as a placement',async()=>{
 const h=harness({'users/u':{trophies:125},'brawlProfiles/u':{skillLevel:720}});
 const first=await h.invoke('/brawl/skill');assert.equal(first.payload.placed,false);
 await h.invoke('/computer-battles/start',rankedBody);
 const second=await h.invoke('/computer-battles/start',rankedBody);
 assert.equal(second.payload.forfeitedSkill.placement,true);
 assert.equal(second.payload.profile.placementsCompleted,1);
 assert.equal(h.records['users/u'].trophies,115);
 assert.equal((await h.invoke('/brawl/skill')).payload.placementsCompleted,1);
});
test('server chooses higher-strength deck to start regardless of client request',async()=>{
 for(const averageScore of [4,6]){
  const seed={'users/u':{}};
  for(let i=0;i<6;i++)seed[`battleCards/c${i}`]={name:`c${i}`,averageScore,top:5,right:5,bottom:5,left:5};
  const h=harness(seed);
  const {payload:session}=await h.invoke('/computer-battles/start',{...rankedBody,first:averageScore===6?'player':'computer'});
  assert.equal(session.initial.turn,averageScore===6?'computer':'player');
 }
});
test('Master win grants one Ruby and modest Footy exactly once, using current eligibility',async()=>{
 const initial={board:Array(16).fill(null),player:[],computer:[],turn:'player'};initial.board[0]={ownerId:'player'};
 const h=harness({'users/u':{balance:0,gems:{bronze:2,gold:3}},'brawlProfiles/u':{skillLevel:800,ratingVersion:2,placementsCompleted:5},'computerBattles/m':{userId:'u',status:'active',mode:'skill',skillAtStart:1000,difficulty:940,seed:1,initial}});
 const {payload:r}=await h.invoke('/computer-battles/finish',{id:'m',moves:[]});
 assert.equal(r.ruby,1);assert.equal(r.footy,10);assert.deepEqual(h.records['users/u'].gems,{bronze:3,gold:3});
 await h.invoke('/computer-battles/finish',{id:'m',moves:[]});assert.equal(h.records['users/u'].gems.bronze,3);
});

test('ranked start rejects two special cards using authoritative inventory',async()=>{
 const owned=engine.trainingCards();owned[0].linkedCardImage='Fighter_seb.png';owned[1].linkedCardImage='Mirror_ben.png';
 const h=harness({'users/u':{balance:100}},owned);
 const result=await h.invoke('/computer-battles/start',{mode:'skill',cardIds:owned.map(c=>c.id)});
 assert.equal(result.status,400);assert.match(result.payload,/one special/);assert.equal(Object.keys(h.records).length,1);
});
test('ranked start uses owned cards plus outsiders and caps Bob specials',async()=>{
 const owned=engine.trainingCards();owned[0].linkedCardImage='Mini_naomi.png';
 const outsiders=engine.trainingCards().map((card,i)=>({...card,id:`outside-${i}`,battleCardId:`outside-${i}`}));
 const records={'users/u':{balance:100}};outsiders.forEach(card=>records[`battleCards/${card.id}`]=card);
 const h=harness(records,owned),result=await h.invoke('/computer-battles/start',{mode:'skill',cardIds:owned.map(c=>c.id)});
 assert.equal(result.status,200);const deck=result.payload.initial.computer;
 assert.ok([1,2].includes(deck.filter(c=>c.id.startsWith('outside-')).length));assert.ok(engine.validSpecials(deck));
});
