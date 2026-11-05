const test=require('node:test'),assert=require('node:assert/strict'),register=require('./creature-brawl-routes'),S=require('./creature-brawl-service');
function fixture(user={stableAnimals:{'rill-species':2,'brugar-species':1,'krynn-species':1},balance:0}){
 const records={'users/u':structuredClone(user)},handlers={};let queue=Promise.resolve();const snap=key=>({id:key.split('/').pop(),exists:!!records[key],data:()=>structuredClone(records[key])});const ref=key=>({key,get:async()=>snap(key)});
 const db={collection:name=>({doc:id=>ref(name+'/'+id),get:async()=>({docs:Object.keys(records).filter(key=>key.startsWith(name+'/')).map(snap)})}),runTransaction:fn=>{const result=queue.then(async()=>{const writes=[];const value=await fn({get:async r=>{assert.equal(writes.length,0,'read before writes');return snap(r.key);},set:(r,v)=>writes.push(()=>records[r.key]=structuredClone(v)),update:(r,v)=>writes.push(()=>records[r.key]={...records[r.key],...structuredClone(v)})});writes.forEach(f=>f());return value;});queue=result.catch(()=>{});return result;}};
 const app=Object.fromEntries(['get','post'].map(method=>[method,(url,fn)=>handlers[method+' '+url]=fn]));register(app,db,async req=>{if(req.denied)throw Error('No session');return req.user||'u';});
 async function invoke(method,path,body={},params={},user='u',denied=false,query={}){let status=200,payload;await handlers[method+' '+path]({body,params,user,denied,query},{status(n){status=n;return this;},json(v){payload=v;},send(v){payload=v;}});return {status,payload};}
 return {records,db,invoke};
}
const state=h=>h.invoke('get','/api/brawl/state');
async function create(h,extra={}){const lobby=(await state(h)).payload;return h.invoke('post','/api/brawl/matches',{ids:lobby.owned.slice(0,3).map(u=>u.id),difficulty:'balanced',stage:0,...extra});}
const action=(h,m,body,actionId='action-123')=>h.invoke('post','/api/brawl/matches/:matchId/actions',{expectedRevision:m.expectedRevision,actionId,...body},{matchId:m.id});

test('Brawl exposes only the highest-grade owned copy and migrates duplicate saved teams',async()=>{
 const instances={low:{id:'low',kind:'rill-species',ordinal:0,grade:1},best:{id:'best',kind:'rill-species',ordinal:1,grade:4},tie:{id:'tie',kind:'rill-species',ordinal:2,grade:4},unowned:{id:'unowned',kind:'rill-species',ordinal:3,grade:10}};
 const h=fixture({stableAnimals:{'rill-species':3,'brugar-species':1,'krynn-species':1},creatureBrawl:{instances,selected:['low','tie'],tokens:{rill:9}},balance:0});
 const lobby=(await state(h)).payload;assert.equal(lobby.owned.length,3);assert.equal(lobby.owned.filter(u=>u.kind==='rill-species').length,1);
 assert.equal(lobby.owned.find(u=>u.kind==='rill-species').id,'best');assert.deepEqual(lobby.selected,['best']);
 assert.equal(lobby.owned.find(u=>u.id==='best').grade,4);assert.equal(lobby.tokens.rill,9);
 assert.equal(Object.keys(h.records['users/u'].creatureBrawl.instances).length,6);assert.equal(h.records['users/u'].stableAnimals['rill-species'],3);
 const other=lobby.owned.filter(u=>u.kind!=='rill-species').map(u=>u.id);
 assert.equal((await h.invoke('post','/api/brawl/team',{ids:['low','best',other[0]]})).status,400);
 assert.equal((await create(h,{ids:['low',...other]})).status,400);
 assert.equal((await create(h,{ids:['best','tie',other[0]]})).status,400);
 assert.equal((await h.invoke('post','/api/brawl/team',{ids:['best',...other]})).status,200);
 const match=(await create(h,{ids:['best',...other]})).payload.match;assert.equal(match.state.units.find(u=>u.id==='best').grade,4);
});

test('practice rejects repeated creatures while distinct named variants remain selectable',async()=>{
 const h=fixture({balance:0});assert.equal((await create(h,{practice:true,kinds:['rill-species','rill-species','kanji']})).status,400);
 assert.equal((await create(h,{practice:true,kinds:['rill-species','rill','defender-rill']})).status,200);
});

test('rebalance preserves old match snapshots and applies new kits only to new matches',async()=>{
 const h=fixture(),created=(await create(h)).payload.match;
 const saved=h.records['creatureBrawlMatches/'+created.id];
 saved.catalogVersion='creature-brawl-v1';
 saved.state.units[0].moves[1].name='Original saved ability';
 const resumed=await state(h);assert.equal(resumed.status,200);
 assert.equal(resumed.payload.match.state.units[0].moves[1].name,'Original saved ability');
 assert.equal((await action(h,resumed.payload.match,{command:'begin'})).status,200);
 const fresh=(await create(fixture())).payload.match;
 assert.notEqual(fresh.state.units[0].moves[1].name,'Original saved ability');
 assert.equal(S.catalog.VERSION,'creature-brawl-kael-shadow-v4');
});
test('authorization, ownership reconciliation and named species do not grant unavailable creatures',async()=>{
 const h=fixture();assert.equal((await h.invoke('get','/api/brawl/state',{},{} ,'u',true)).status,401);const a=(await state(h)).payload,b=(await state(h)).payload;assert.equal(a.owned.length,3);assert.equal(new Set(a.owned.map(u=>u.id)).size,3);assert.deepEqual(a.owned.map(u=>u.id),b.owned.map(u=>u.id));assert.equal(a.owned.some(u=>u.kind==='veyrin'||u.kind==='tharos'||u.kind==='rill'),false);
 const ids=a.owned.slice(0,3).map(u=>u.id);assert.equal((await h.invoke('post','/api/brawl/team',{ids})).status,200);assert.equal((await h.invoke('post','/api/brawl/team',{ids:[ids[0],ids[0],ids[1]]})).status,400);assert.equal((await h.invoke('post','/api/brawl/matches',{ids:['fake',...ids.slice(1)],stage:0,difficulty:'balanced'})).status,400);
});
test('practice with zero owned creatures works, resumes, and never pays rewards or rating',async()=>{
 const h=fixture({balance:7}),created=await create(h,{practice:true,kinds:['veyrin','tharos','rill']});assert.equal(created.status,200);let m=created.payload.match;assert.equal(m.practice,true);assert.equal((await state(h)).payload.owned.length,0);const again=await create(h,{practice:true});assert.equal(again.payload.match.id,m.id);m=(await action(h,m,{command:'begin'})).payload.match;
 let n=0;while(m.phase!=='FINISHED'&&n++<85)m=(await action(h,m,{auto:true},'practice-'+n)).payload.match;assert.equal(m.phase,'FINISHED');assert.equal(h.records['users/u'].balance,7);assert.equal(h.records['users/u'].creatureBrawl.rating,0);assert.deepEqual(h.records['users/u'].creatureBrawl.tokens,{});assert.equal((await h.invoke('get','/api/brawl/matches/:matchId',{}, {matchId:m.id})).payload.match.state.phase,'FINISHED');
});
test('server enforces legal revisions and duplicate/concurrent actions resolve once',async()=>{
 const h=fixture();let m=(await create(h)).payload.match;m=(await action(h,m,{command:'begin'})).payload.match;
 const legal=S.engine.choose(m.state),before=JSON.stringify(h.records),bad=await action(h,m,{moveId:'hacked',targetId:'none'},'bad-action');assert.equal(bad.status,400);assert.equal(JSON.stringify(h.records),before);
 const [a,b]=await Promise.all([action(h,m,legal,'simultaneous-1'),action(h,m,legal,'simultaneous-2')]);assert.deepEqual([a.status,b.status],[200,409]);const replay=await action(h,m,legal,'simultaneous-1');assert.equal(replay.status,200);assert.equal(replay.payload.replayed,true);assert.equal(replay.payload.match.expectedRevision,a.payload.match.expectedRevision);
 assert.equal((await h.invoke('get','/api/brawl/matches/:matchId',{}, {matchId:m.id},'other')).status,400);const resumed=(await state(h)).payload.match;assert.equal(resumed.expectedRevision,a.payload.match.expectedRevision);assert.equal(resumed.state.actorId,a.payload.match.state.actorId);
});
test('terminal rewards settle atomically, give five rubies per win without a daily cap and no other currency',async()=>{
 const h=fixture();await state(h);h.records['users/u'].creatureBrawl.tokens={rill:6,kanji:3};let m=(await create(h)).payload.match;m=(await action(h,m,{command:'begin'})).payload.match;const stored=h.records['creatureBrawlMatches/'+m.id];stored.state.units.filter(u=>u.team===1).forEach(u=>{u.hp=1;u.next=stored.state.clock+10000;});stored.state.ap[0]=5;stored.state.units.find(u=>u.id===stored.state.actorId).moves=[{id:'basic',cost:0,target:'enemies',effects:[{type:'damage',power:100}]}];m=S.publicMatch(stored);const final=(await action(h,m,{moveId:'basic',targetId:'enemy-0'},'winning-action')).payload.match;assert.equal(final.reward.footy,0);assert.equal(final.reward.rubies,5);assert.equal(h.records['users/u'].balance,0);assert.equal(h.records['users/u'].gems.bronze,5);assert.equal(h.records['users/u'].creatureBrawl.rating,20);assert.deepEqual(final.reward.tokens,{});assert.deepEqual(h.records['users/u'].creatureBrawl.tokens,{rill:6,kanji:3});
 await action(h,m,{moveId:'basic',targetId:'enemy-0'},'winning-action');assert.equal(h.records['users/u'].balance,0);assert.equal(h.records['users/u'].gems.bronze,5);
 const u=h.records['users/u'],b=u.creatureBrawl;b.paidWins=10;const simulated={id:'cap',practice:false,stage:0,state:{phase:'FINISHED',winner:0,reason:'elimination',units:stored.state.units},catalogSnapshot:S.catalog};const update=S.settle(u,b,simulated,Date.now());assert.equal(simulated.reward.footy,0);assert.equal(simulated.reward.rubies,5);assert.equal(simulated.reward.rating,20);assert.equal(update.balance,undefined);assert.equal(update.gems.bronze,10);
});
test('grade upgrades use species tokens, preserve speed, respect cap and reject duplicate revisions',async()=>{
 const h=fixture({townHallXP:8000,townHallProgressVersion:3,stableAnimals:{'rill-species':1},balance:0});const lobby=(await state(h)).payload,u=lobby.owned[0];h.records['users/u'].creatureBrawl.tokens.rill=20;assert.equal(lobby.gradeCap,5);const body={instanceId:u.id,expectedGrade:1},upgrade=await h.invoke('post','/api/brawl/upgrades',body);assert.equal(upgrade.status,200);assert.equal(upgrade.payload.instance.grade,2);assert.equal(upgrade.payload.instance.stats.spd,u.stats.spd);assert.ok(upgrade.payload.instance.stats.hp>u.stats.hp);assert.equal(upgrade.payload.tokens.rill,15);assert.equal((await h.invoke('post','/api/brawl/upgrades',body)).status,409);assert.equal((await h.invoke('post','/api/brawl/upgrades',{...body,expectedGrade:2})).status,200);h.records['users/u'].creatureBrawl.instances[u.id].grade=5;h.records['users/u'].creatureBrawl.tokens.rill=1000;assert.equal((await h.invoke('post','/api/brawl/upgrades',{...body,expectedGrade:5})).status,400);
});
test('abandon records one loss, no reward and clears only the current active match',async()=>{
 const h=fixture();await state(h);h.records['users/u'].creatureBrawl.rating=50;const m=(await create(h)).payload.match;const body={expectedRevision:m.expectedRevision},params={matchId:m.id};assert.equal((await h.invoke('post','/api/brawl/matches/:matchId/abandon',body,params)).status,200);assert.equal(h.records['users/u'].creatureBrawl.rating,40);await h.invoke('post','/api/brawl/matches/:matchId/abandon',body,params);assert.equal(h.records['users/u'].creatureBrawl.rating,40);assert.equal(h.records['users/u'].balance,0);
});
module.exports={fixture};

test('leaving during an action records exactly one loss without requiring the latest revision',async()=>{
 const h=fixture();await state(h);h.records['users/u'].creatureBrawl.rating=50;
 let m=(await create(h)).payload.match;const before=m.expectedRevision;m=(await action(h,m,{command:'begin'})).payload.match;
 assert.ok(m.expectedRevision>before);
 const leave=()=>h.invoke('post','/api/brawl/matches/:matchId/leave',{expectedRevision:before},{matchId:m.id});
 const [a,b]=await Promise.all([leave(),leave()]);assert.equal(a.status,200);assert.equal(b.status,200);
 assert.equal(a.payload.match.state.winner,1);assert.equal(a.payload.match.reward.rating,-10);assert.equal(h.records['users/u'].creatureBrawl.rating,40);assert.equal(h.records['users/u'].creatureBrawl.activeMatch,null);assert.equal(h.records['users/u'].balance,0);
 assert.equal((await h.invoke('post','/api/brawl/matches/:matchId/leave',{}, {matchId:m.id},'other')).status,400);
});

test('reopening after an interrupted exit forfeits the saved match once',async()=>{
 const h=fixture();await state(h);h.records['users/u'].creatureBrawl.rating=50;await create(h);
 const reopen=()=>h.invoke('get','/api/brawl/state',{}, {},'u',false,{forfeitActive:'1'});
 const result=await reopen();assert.equal(result.status,200);assert.equal(result.payload.match.phase,'FINISHED');assert.equal(result.payload.match.reward.rating,-10);assert.equal(result.payload.rating,40);
 await reopen();assert.equal(h.records['users/u'].creatureBrawl.rating,40);assert.equal(h.records['users/u'].creatureBrawl.activeMatch,null);
});

test('leaving practice ends the match without rating or rewards',async()=>{
 const h=fixture();await state(h);h.records['users/u'].creatureBrawl.rating=50;const m=(await create(h,{practice:true})).payload.match;
 const result=await h.invoke('post','/api/brawl/matches/:matchId/leave',{}, {matchId:m.id});assert.equal(result.status,200);assert.equal(result.payload.match.state.winner,1);assert.equal(result.payload.match.reward.rating,0);assert.equal(h.records['users/u'].creatureBrawl.rating,50);assert.equal(h.records['users/u'].balance,0);
});

test('matching catalog version omits static catalog while returning current player state',async()=>{
 const h=fixture();const full=(await state(h)).payload;
 const compact=(await h.invoke('get','/api/brawl/state',{}, {},'u',false,{catalogVersion:full.catalog.VERSION})).payload;
 assert.equal(compact.catalog,undefined);assert.equal(compact.catalogVersion,full.catalog.VERSION);
 assert.deepEqual(compact.owned,full.owned);assert.equal(compact.rating,full.rating);
 const stale=(await h.invoke('get','/api/brawl/state',{}, {},'u',false,{catalogVersion:'old'})).payload;
 assert.equal(stale.catalog.VERSION,full.catalog.VERSION);
});

test('individual creature levels unlock grade 6/7 at 24 and grade 8/10 at 51, including duplicate residents',async()=>{
 const h=fixture({stableAnimals:{'rill-species':2},creatureBrawl:{tokens:{rill:10000},instances:{first:{id:'first',kind:'rill-species',ordinal:0,grade:5},second:{id:'second',kind:'rill-species',ordinal:1,grade:5}}},creatureGrowth:{'rill-species:0':{level:24,hunger:0},'rill-species:1':{level:23,hunger:0}}});
 assert.equal((await h.invoke('post','/api/brawl/upgrades',{growthKey:'rill-species:1',expectedGrade:5})).status,400);
 let r=await h.invoke('post','/api/brawl/upgrades',{growthKey:'rill-species:0',expectedGrade:5});assert.equal(r.status,200);assert.equal(r.payload.instance.grade,6);assert.equal(r.payload.tokens.rill,9900);
 r=await h.invoke('post','/api/brawl/upgrades',{growthKey:'rill-species:0',expectedGrade:6});assert.equal(r.status,200);assert.equal(r.payload.instance.grade,7);assert.equal((await h.invoke('post','/api/brawl/upgrades',{growthKey:'rill-species:0',expectedGrade:7})).status,400);
 h.records['users/u'].creatureGrowth['rill-species:0'].level=51;
 for(const grade of [7,8,9])assert.equal((await h.invoke('post','/api/brawl/upgrades',{growthKey:'rill-species:0',expectedGrade:grade})).status,200);
 assert.equal(h.records['users/u'].creatureBrawl.instances.first.grade,10);assert.equal(h.records['users/u'].creatureBrawl.instances.second.grade,5);
});

test('only authenticated admins can grant valid Brawl tokens without changing progress',async()=>{
 const h=fixture({isAdmin:true,creatureBrawl:{tokens:{rill:4},rating:77,selected:['existing'],instances:{saved:{grade:3}}}});
 h.records['users/player']={creatureBrawl:{tokens:{rill:6,dragon:2},rating:123,selected:['saved'],instances:{saved:{grade:4}},activeMatch:'match'}};
 assert.equal((await h.invoke('get','/api/brawl/admin/tokens',{}, {},'player')).status,403);
 assert.equal((await h.invoke('post','/api/brawl/admin/tokens',{userId:'u',species:'rill',quantity:5},{},'player')).status,403);
 assert.equal((await h.invoke('post','/api/brawl/admin/tokens',{},{},'u',true)).status,401);
 const types=await h.invoke('get','/api/brawl/admin/tokens');assert.equal(types.status,200);assert.equal(types.payload.species.filter(s=>s.id==='rill').length,1);
 for(const quantity of [0,-1,1.5,'4',Number.MAX_SAFE_INTEGER+1])assert.equal((await h.invoke('post','/api/brawl/admin/tokens',{userId:'player',species:'rill',quantity})).status,400);
 assert.equal((await h.invoke('post','/api/brawl/admin/tokens',{userId:'player',species:'invalid',quantity:3})).status,400);
 assert.equal((await h.invoke('post','/api/brawl/admin/tokens',{userId:'missing',species:'rill',quantity:3})).status,400);
 const before=structuredClone(h.records['users/player']);
 const result=await h.invoke('post','/api/brawl/admin/tokens',{userId:'player',species:'rill',quantity:20});assert.equal(result.status,200);assert.equal(result.payload.total,26);
 before.creatureBrawl.tokens.rill=26;assert.deepEqual(h.records['users/player'],before);
 await Promise.all([1,2].map(()=>h.invoke('post','/api/brawl/admin/tokens',{userId:'player',species:'rill',quantity:3})));assert.equal(h.records['users/player'].creatureBrawl.tokens.rill,32);
 assert.equal((await h.invoke('post','/api/brawl/admin/tokens',{userId:'player',species:'rill',quantity:Number.MAX_SAFE_INTEGER})).status,400);
});

test('ruby-only rewards preserve other gems and never pay losses, draws, practice or abandonment',()=>{
 for(const [practice,winner,reason] of [[false,1,'elimination'],[false,null,'draw'],[true,0,'elimination'],[false,0,'abandoned']]){
  const user={balance:80,gems:{bronze:19,gold:3},creatureBrawl:{rating:50}},b=S.reconcile(user).profile,m={id:'test',practice,stage:0,state:{phase:'FINISHED',winner,reason},catalogSnapshot:S.catalog};const result=S.settle(user,b,m,Date.now());assert.equal(m.reward.rubies,0);assert.equal(m.reward.footy,0);assert.deepEqual(m.reward.tokens,{});assert.equal(result.gems,undefined);assert.equal(result.balance,undefined);
 }
 const user={gems:{bronze:19,gold:3}},b=S.reconcile(user).profile,m={id:'win',practice:false,stage:0,state:{phase:'FINISHED',winner:0,reason:'elimination'},catalogSnapshot:S.catalog};const result=S.settle(user,b,m,Date.now());assert.deepEqual(result.gems,{bronze:24,gold:3});assert.equal(S.settle(user,b,m,Date.now()),null);
});

test('variant tokens are distinct in admin grants, upgrades and legacy migration',async()=>{
 const h=fixture({isAdmin:true,stableAnimals:{veyrin:1,tharos:1,'rill-species':1,rill:1},creatureBrawl:{tokens:{veyrin:20,rill:10},rating:44}});
 const types=(await h.invoke('get','/api/brawl/admin/tokens')).payload.species;
 assert.equal(types.length,S.catalog.creatures.length);assert.equal(new Set(types.map(t=>t.id)).size,types.length);
 assert.ok(types.some(t=>t.id==='kael'&&t.name==='Kael'));assert.ok(types.some(t=>t.id==='tharos'&&t.name==='Tharos'));assert.ok(types.some(t=>t.id==='aeri'));assert.ok(types.some(t=>t.id==='rill'));
 let current=(await state(h)).payload;assert.equal(current.tokens.kael,20);assert.equal(current.tokens.veyrin,undefined);assert.equal(current.tokens.rill,10);assert.equal(current.tokens.aeri,undefined);
 const tharos=current.owned.find(c=>c.kind==='tharos'),kael=current.owned.find(c=>c.kind==='veyrin');
 assert.equal((await h.invoke('post','/api/brawl/upgrades',{instanceId:tharos.id,expectedGrade:1})).status,400);
 assert.equal((await h.invoke('post','/api/brawl/admin/tokens',{userId:'u',species:'tharos',quantity:8})).status,200);
 assert.equal((await h.invoke('post','/api/brawl/upgrades',{instanceId:tharos.id,expectedGrade:1})).status,200);
 current=(await state(h)).payload;assert.equal(current.tokens.tharos,3);assert.equal(current.tokens.kael,20);assert.equal(current.tokens.rill,10);
 assert.equal((await h.invoke('post','/api/brawl/upgrades',{instanceId:kael.id,expectedGrade:1})).status,200);
 current=(await state(h)).payload;assert.equal(current.tokens.kael,15);assert.equal(current.tokens.tharos,3);
});

test('live book rarity affects owned profiles, next-grade previews and new matches without rewriting saved combat',async()=>{
 const h=fixture();h.records['creatureBookEntries/rill-species']={rarity:'unique'};const lobby=(await state(h)).payload,unit=lobby.owned.find(u=>u.kind==='rill-species');
 assert.equal(unit.rarity,'unique');assert.equal(unit.stats.hp,Math.round(S.catalog.creatures.find(c=>c.id===unit.kind).base.hp*1.16));
 const c=lobby.catalog.creatures.find(c=>c.id===unit.kind);assert.equal(c.rarity,'unique');assert.equal(c.base.hp,unit.stats.hp);
 const created=(await create(h)).payload.match,before=structuredClone(h.records['creatureBrawlMatches/'+created.id].state.units);
 h.records['creatureBookEntries/rill-species']={rarity:'common'};const fresh=(await state(h)).payload;assert.notEqual(fresh.catalogVersion,lobby.catalogVersion);assert.deepEqual(h.records['creatureBrawlMatches/'+created.id].state.units,before);
});
