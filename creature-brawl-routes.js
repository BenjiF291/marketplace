const service=require('./creature-brawl-service'),{randomUUID}=require('node:crypto');
module.exports=(app,db,authenticate)=>{
 const loadRarities=async()=>{const collection=db.collection('creatureBookEntries');if(!collection.get)return {};const snapshot=await collection.get();return Object.fromEntries(snapshot.docs.map(d=>[d.id,d.data()]));};
 const route=(method,path,fn)=>app[method](path,async(req,res)=>{let id;try{id=await authenticate(req);}catch(e){return res.status(401).send(e.message);}try{res.json(await fn(id,req.body||{},req.params||{},req.query||{},['/api/brawl/state','/api/brawl/matches','/api/brawl/upgrades'].includes(path)?await loadRarities():{}));}catch(e){res.status(e.status||400).send(e.message);}});
 const userRef=id=>db.collection('users').doc(id),matchRef=id=>db.collection('creatureBrawlMatches').doc(id);
 const conflict=()=>{const e=Error('This turn changed. Reload the match before acting.');e.status=409;throw e;};
 const matchOwner=(doc,id)=>{if(!doc.exists||doc.data().userId!==id)throw Error('Match not found.');const m=doc.data();if(![service.catalog.VERSION,'creature-brawl-individual-v3','creature-brawl-balance-v2','creature-brawl-v1'].includes(m.catalogVersion)||m.state.rulesVersion!==service.engine.VERSION)throw Error('This saved rules version is unavailable.');return m;};
 const admin=async(tx,id)=>{const doc=await tx.get(userRef(id));if(!doc.exists||doc.data().isAdmin!==true){const e=Error('Forbidden');e.status=403;throw e;}};
 route('get','/api/brawl/admin/tokens',(id)=>db.runTransaction(async tx=>{
  await admin(tx,id);return {species:service.catalog.creatures.map(c=>({id:c.tokenKey,name:c.name}))};
 }));
 route('post','/api/brawl/admin/tokens',(id,body)=>db.runTransaction(async tx=>{
  await admin(tx,id);
  if(typeof body.userId!=='string'||!body.userId||body.userId.includes('/')||!service.catalog.creatures.some(c=>c.tokenKey===body.species)||!Number.isSafeInteger(body.quantity)||body.quantity<=0)throw Error('Choose a player, token type and positive whole quantity.');
  const ref=userRef(body.userId),doc=await tx.get(ref);if(!doc.exists)throw Error('Player not found.');
  const b=doc.data().creatureBrawl||{},tokens=require('./creature-token-wallet').wallet(b),total=(Number(tokens[body.species])||0)+body.quantity;
  if(!Number.isSafeInteger(total)||total<0)throw Error('Token balance exceeds the supported amount.');
  tokens[body.species]=total;tx.update(ref,{creatureBrawl:{...b,tokens}});
  return {species:body.species,quantity:body.quantity,total};
 }));
 route('get','/api/brawl/state',(id,body,params,query,rarities)=>db.runTransaction(async tx=>{
  const ref=userRef(id),doc=await tx.get(ref);if(!doc.exists)throw Error('Account not found.');const user=doc.data(),{profile:b,owned}=service.reconcile(user);let match=null;
  if(b.activeMatch){const d=await tx.get(matchRef(b.activeMatch));if(d.exists){match=matchOwner(d,id);if(query.forfeitActive==='1'&&!match.settled){match.state.phase='FINISHED';match.state.winner=1;match.state.reason='abandoned';match.phase='FINISHED';match.revision++;service.settle(user,b,match,Date.now());tx.set(matchRef(match.id),match);}}else b.activeMatch=null;}
  tx.update(ref,{creatureBrawl:b});return {...(query.catalogVersion===service.catalogFor(rarities).VERSION?{}:{catalog:service.catalogFor(rarities)}),catalogVersion:service.catalogFor(rarities).VERSION,owned:owned.map(i=>({...i,...service.unit(i,i.grade,rarities),growth:require('./creature-growth').profile(user,i.kind,i.ordinal)})),selected:b.selected,rating:b.rating,winRubies:5,tokens:b.tokens,gradeCap:service.gradeCap(user),foods:require('./creature-growth').foods(user),settlementLevel:require('./town-hall-progress').profile(user).level,ladder:b.ladder||0,paidWins:b.rewardDay===new Date().toISOString().slice(0,10)?b.paidWins||0:0,match:service.publicMatch(match)};
 }));
 route('post','/api/brawl/team',(id,body)=>db.runTransaction(async tx=>{
  const ref=userRef(id),doc=await tx.get(ref);if(!doc.exists)throw Error('Account not found.');const {profile:b,owned}=service.reconcile(doc.data());if(b.activeMatch)throw Error('Finish or abandon your active match first.');if(!Array.isArray(body.ids)||body.ids.length!==3||new Set(body.ids).size!==3||body.ids.some(key=>!owned.some(i=>i.id===key)))throw Error('Choose three different owned creatures, using their highest-grade copies.');b.selected=body.ids;tx.update(ref,{creatureBrawl:b});return {selected:b.selected};
 }));
 route('post','/api/brawl/matches',(id,body,params,query,rarities)=>db.runTransaction(async tx=>{
  const ref=userRef(id),doc=await tx.get(ref);if(!doc.exists)throw Error('Account not found.');const user=doc.data(),{profile:b,owned}=service.reconcile(user);
  if(b.activeMatch){const existing=await tx.get(matchRef(b.activeMatch));if(existing.exists)return {match:service.publicMatch(matchOwner(existing,id))};}
  if(!service.catalog.config.difficulties.some(d=>d.id===body.difficulty))throw Error('Choose a difficulty.');
  const practice=body.practice===true,stage=Number(body.stage);if(!Number.isInteger(stage)||stage<0||stage>4||(!practice&&service.catalog.config.arenas[stage]>b.rating))throw Error('This arena stage is locked.');
  let team;if(practice){const kinds=Array.isArray(body.kinds)?body.kinds:['rill-species','brugar-species','krynn-species'];if(kinds.length!==3||new Set(kinds).size!==3||kinds.some(kind=>!service.catalog.creatures.some(c=>c.id===kind)))throw Error('Choose three different practice creatures.');team=kinds.map((kind,i)=>service.unit({kind,id:'loan-'+i,grade:1},1,rarities));}
  else{if(!Array.isArray(body.ids)||body.ids.length!==3||new Set(body.ids).size!==3)throw Error('Choose three different creatures.');team=body.ids.map(key=>{const instance=owned.find(i=>i.id===key);if(!instance)throw Error('Choose the highest-grade owned copy of this creature.');return service.unit(instance,instance.grade,rarities);});b.selected=body.ids;}
  b.sequence++;const matchId=randomUUID(),enemy=service.opponent(team,body.difficulty,stage,b.sequence,rarities),m={id:matchId,userId:id,practice,stage,difficulty:body.difficulty,catalogVersion:service.catalog.VERSION,catalogSnapshot:service.catalogFor(rarities),state:service.engine.create(matchId,[team,enemy],{priority:b.sequence%2,config:service.catalog.config}),revision:0,phase:'PREVIEW',settled:false,actions:{},createdAt:Date.now()};b.activeMatch=matchId;tx.set(matchRef(matchId),m);tx.update(ref,{creatureBrawl:b});return {match:service.publicMatch(m)};
 }));
 route('get','/api/brawl/matches/:matchId',async(id,body,params)=>({match:service.publicMatch(matchOwner(await matchRef(params.matchId).get(),id))}));
 route('post','/api/brawl/matches/:matchId/actions',(id,body,params)=>db.runTransaction(async tx=>{
  const ref=matchRef(params.matchId),[doc,userDoc]=await Promise.all([tx.get(ref),tx.get(userRef(id))]);const m=matchOwner(doc,id);if(!userDoc.exists)throw Error('Account not found.');
  if(typeof body.actionId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(body.actionId))throw Error('Invalid action ID.');
  const eventCursor=Number.isSafeInteger(body.eventCursor)&&body.eventCursor>=0?body.eventCursor:0;
  if(m.actions[body.actionId])return {match:service.publicMatch(m,eventCursor),replayed:true};if(body.expectedRevision!==m.revision)conflict();if(m.settled||m.phase==='FINISHED')throw Error('This match is finished.');
  if(m.phase==='PREVIEW'){if(body.command!=='begin')throw Error('Begin the battle first.');m.phase='BATTLE';m.state=service.runAI(m.state);}
  else{const actor=m.state.units.find(u=>u.id===m.state.actorId);if(actor?.team!==0)throw Error('It is not your activation.');const action=body.auto===true?service.engine.choose(m.state):{moveId:body.moveId,targetId:body.targetId};m.state=service.engine.act(m.state,action);m.state=service.runAI(m.state);}
  m.revision++;m.actions[body.actionId]=m.revision;const {profile:b}=service.reconcile(userDoc.data());if(b.activeMatch!==m.id)throw Error('This is not your active match.');const reward=service.settle(userDoc.data(),b,m,Date.now());if(m.state.phase==='FINISHED')m.phase='FINISHED';tx.set(ref,m);if(reward)tx.update(userRef(id),reward);return {match:service.publicMatch(m,eventCursor)};
 }));
 const abandonMatch=checkRevision=>(id,body,params)=>db.runTransaction(async tx=>{
  const ref=matchRef(params.matchId),[doc,userDoc]=await Promise.all([tx.get(ref),tx.get(userRef(id))]);const m=matchOwner(doc,id);if(m.settled)return {match:service.publicMatch(m)};if(checkRevision&&body.expectedRevision!==m.revision)conflict();const {profile:b}=service.reconcile(userDoc.data());if(b.activeMatch!==m.id)throw Error('Not your active match.');m.state.phase='FINISHED';m.state.winner=1;m.state.reason='abandoned';m.phase='FINISHED';m.revision++;const update=service.settle(userDoc.data(),b,m,Date.now());tx.set(ref,m);tx.update(userRef(id),update);return {match:service.publicMatch(m)};
 });
 route('post','/api/brawl/matches/:matchId/abandon',abandonMatch(true));
 route('post','/api/brawl/matches/:matchId/leave',abandonMatch(false));
 route('post','/api/brawl/upgrades',(id,body,params,query,rarities)=>db.runTransaction(async tx=>{
  const ref=userRef(id),doc=await tx.get(ref);if(!doc.exists)throw Error('Account not found.');const {profile:b,allOwned:owned}=service.reconcile(doc.data());if(b.activeMatch)throw Error('Upgrades are unavailable during a match.');const instance=owned.find(i=>body.growthKey?require('./creature-growth').key(i.kind,i.ordinal)===body.growthKey:i.id===body.instanceId);if(!instance)throw Error('You do not own this creature.');if(body.expectedGrade!==instance.grade)conflict();if(instance.grade>=service.gradeCap(doc.data(),instance))throw Error('Feed this creature to level '+(instance.grade<7?24:51)+' to unlock higher Brawl grades.');const species=service.catalog.creatures.find(c=>c.id===instance.kind).tokenKey,cost=require('./creature-growth').tokenCost(instance.grade);if((b.tokens[species]||0)<cost)throw Error(`Needs ${cost} ${species} tokens.`);b.tokens[species]-=cost;instance.grade++;b.instances[instance.id]=instance;tx.update(ref,{creatureBrawl:b});return {instance:{...service.unit(instance,instance.grade,rarities),growth:require('./creature-growth').profile({...doc.data(),creatureBrawl:b},instance.kind,instance.ordinal)},tokens:b.tokens};
 }));
};
