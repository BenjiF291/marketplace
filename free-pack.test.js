const test=require('node:test'),assert=require('node:assert/strict');
const rules=require('./free-pack');
const catalog={gem:Object.keys(rules.GEM_NAMES).map(id=>({id,name:rules.GEM_NAMES[id]})),boost:[{id:'skip'},{id:'leap'}],pack:[{id:'p'}],card:[{id:'Bronze_jan.png'}],rubyItem:[{id:'pet:fox'}],amulet:[{id:'road:champion'}]};

test('daily claims apply opening Footy/Ruby, packed-token bonuses and reduced cooldown exactly once',async()=>{
 const h=harness(),u=h.records['users/u'];u.amuletSlots=[{bonuses:{pack:12,packgem:100,packtokens:2,dailycooldown:25}}];
 h.records['gameSettings/freePack']={...rules.defaults(),cards:[{title:'Tokens',options:[{kind:'brawlToken',id:'rill-species',min:3,max:3,chance:100}]}]};
 const result=await h.invoke('post','/free-pack/claim',{requestId:'amulet-daily-claim'});assert.equal(result.status,200);assert.equal(result.payload.rewards[0].amount,5);assert.equal(result.payload.rewards[0].label,'5 Rill Brawl tokens');
 assert.equal(h.records['users/u'].balance,12);assert.equal(h.records['users/u'].gems.bronze,1);assert.equal(h.records['users/u'].creatureBrawl.tokens.rill,5);assert.equal(result.payload.nextAt-result.payload.claimedAt,7*3600000*.75);
 const saved=structuredClone(h.records);await h.invoke('post','/free-pack/claim',{requestId:'amulet-daily-claim'});assert.deepEqual(h.records,saved);assert.equal((await h.invoke('get','/free-pack')).payload.nextAt,result.payload.nextAt);
 assert.equal((await h.invoke('post','/free-pack/claim',{requestId:'amulet-daily-early'})).status,400);
});
test('defaults have exactly five cards, requested ranges and equal starter odds',()=>{
 const config=rules.validate(rules.defaults(),catalog);assert.equal(config.cooldownHours,7);assert.equal(config.cards.length,5);
 assert.deepEqual(config.cards[0].options.map(o=>[o.min,o.max]),[[5,15],[3,12],[1,1],[1,1],[3,6]]);
 assert.deepEqual(config.cards[3].options.map(o=>[o.min,o.max]),[[10,25],[7,17],[2,2],[1,1],[6,15]]);
 assert.ok(config.cards.slice(0,4).every(card=>card.options.every(o=>o.chance===20)));
});
test('weighted draws honor boundaries, zero chances, and inclusive ranges',()=>{
 const config=rules.defaults();for(const [roll,index] of [[0,0],[199999,0],[200000,1],[999999,4]]){
  let calls=0;const rewards=rules.draw(config,n=>calls++%2===0?roll:n-1);assert.equal(rewards[0].kind,config.cards[0].options[index].kind);assert.equal(rewards[0].id,config.cards[0].options[index].id);assert.equal(rewards[0].amount,config.cards[0].options[index].max);
 }
 config.cards[0].options[0].chance=0;config.cards[0].options[1].chance=40;assert.equal(rules.draw(config,()=>0)[0].kind,'footy');
});
test('admin config rejects invalid chances, quantities and unknown items',()=>{
 for(const change of [c=>c.cards=[],c=>c.cards=Array(31).fill(c.cards[0]),c=>c.cards[0].options[0].chance=21,c=>c.cards[0].options[0].min=2.5,c=>c.cards[0].options[0].id='missing',c=>c.cooldownHours=0]){const c=rules.defaults();change(c);assert.throws(()=>rules.validate(c,catalog));}
});
test('awards aggregate into real wallets and boost inventories without changing the original user',()=>{
 const user={balance:5,gems:{bronze:2,'rare-bronze':1},timeBoosts:{skip:1}};
 const result=rules.apply(user,[{kind:'gem',id:'bronze',amount:10},{kind:'gem',id:'rare-bronze',amount:6},{kind:'boost',id:'skip',amount:2},{kind:'boost',id:'leap',amount:1},{kind:'footy',amount:12}]);
 assert.equal(result.balance,17);assert.deepEqual(result.gems,{bronze:12,'rare-bronze':7});assert.deepEqual(result.timeBoosts,{skip:3,leap:1});assert.equal(user.balance,5);
});
function harness(admin=false){
 const records={'users/u':{isAdmin:admin,balance:0}},handlers={};let serial=0,queue=Promise.resolve();
 const snap=key=>({exists:!!records[key],data:()=>structuredClone(records[key]),id:key.split('/').pop()});
 const ref=key=>({key,id:key.split('/').pop(),get:async()=>snap(key),set:async value=>records[key]=structuredClone(value)});
 const db={collection:name=>({doc:id=>ref(name+'/'+(id||'new'+serial++)),get:async()=>({docs:Object.keys(records).filter(key=>key.startsWith(name+'/')).map(snap)})}),runTransaction:fn=>{
  const run=queue.then(async()=>{const writes=[];const result=await fn({get:async r=>{assert.equal(writes.length,0,'all reads precede writes');return snap(r.key);},set:(r,v)=>writes.push(()=>records[r.key]=structuredClone(v)),update:(r,v)=>writes.push(()=>records[r.key]={...records[r.key],...structuredClone(v)})});writes.forEach(write=>write());return result;});queue=run.catch(()=>{});return run;
 }};
 const app=Object.fromEntries(['get','post','put'].map(method=>[method,(url,fn)=>handlers[method+' '+url]=fn]));require('./free-pack-routes')(app,db,async req=>{if(req.denied)throw Error('Unauthorized');return 'u';});
 return {records,invoke:async(method,url,body={},denied=false)=>{let status=200,payload;await handlers[method+' '+url]({body,denied},{status(code){status=code;return this;},send(value){payload=value;},json(value){payload=value;}});return {status,payload};}};
}

test('packed Brawl tokens add to the deck species balance and preserve the Brawl profile',async()=>{
 const h=harness(true),profile={tokens:{rill:6,kanji:2},rating:50,selected:['resident-1'],instances:{'resident-1':{id:'resident-1',kind:'rill-species',ordinal:0,grade:1}},match:{id:'saved-battle'}};
 h.records['users/u'].creatureBrawl=structuredClone(profile);
 const editor=await h.invoke('get','/admin/free-pack');assert.equal(editor.payload.catalog.brawlToken.length,20);
 assert.ok(editor.payload.catalog.brawlToken.some(t=>t.id==='rill-species'&&t.species==='rill'));
 const config=rules.defaults();config.cards=[{title:'Rill tokens',options:[{kind:'brawlToken',id:'rill-species',min:4,max:4,chance:100}]}];
 assert.equal((await h.invoke('put','/admin/free-pack',config)).status,200);
 const claimed=await h.invoke('post','/free-pack/claim',{requestId:'packed-rill-tokens'});assert.equal(claimed.status,200);
 assert.equal(claimed.payload.rewards[0].label,'4 Rill Brawl tokens');
 assert.deepEqual(h.records['users/u'].creatureBrawl,{...profile,tokens:{rill:10,kanji:2}});
 assert.deepEqual(h.records['users/u'].stableAnimals,{});
 await h.invoke('post','/free-pack/claim',{requestId:'packed-rill-tokens'});assert.equal(h.records['users/u'].creatureBrawl.tokens.rill,10);
 config.cards[0].options[0].id='fake-token';assert.equal((await h.invoke('put','/admin/free-pack',config)).status,400);
});

test('collection pack tokens aggregate across cards without granting creatures or mutating saved data',()=>{
 const user={creatureBrawl:{tokens:{rill:6},rating:70},stableAnimals:{'rill-species':3}};
 const update=rules.apply(user,[{kind:'brawlToken',id:'rill-species',amount:3},{kind:'brawlToken',id:'rill',amount:2},{kind:'brawlToken',id:'kanji',amount:5}]);
 assert.deepEqual(update.creatureBrawl,{tokens:{rill:9,aeri:2,kanji:5},rating:70});assert.equal(user.creatureBrawl.tokens.rill,6);
 assert.deepEqual(update.stableAnimals,user.stableAnimals);
 assert.equal(require('./creature-brawl-service').reconcile({...user,...update}).profile.tokens.rill,9);
 assert.throws(()=>rules.apply(user,[{kind:'brawlToken',id:'unknown',amount:1}]));
 assert.throws(()=>rules.apply(user,[{kind:'brawlToken',id:'rill-species',amount:-1}]));
 const first=rules.apply({},[{kind:'brawlToken',id:'trusk',amount:2}]);assert.equal(first.creatureBrawl.tokens.trusk,2);
});
test('claims persist five rewards and seven-hour cooldown; retries and simultaneous claims never double-award',async()=>{
 const h=harness();assert.equal((await h.invoke('get','/free-pack')).payload.canClaim,true);
 const requests=[{requestId:'claim-first'},{requestId:'claim-second'}];
 const results=await Promise.all(requests.map(request=>h.invoke('post','/free-pack/claim',request)));
 assert.deepEqual(results.map(result=>result.status).sort(),[200,400]);
 const winner=results.findIndex(result=>result.status===200),first=results[winner];
 assert.equal(first.payload.rewards.length,5);assert.equal(first.payload.nextAt-first.payload.claimedAt,7*3600000);
 const saved=structuredClone(h.records);assert.deepEqual((await h.invoke('post','/free-pack/claim',requests[winner])).payload,first.payload);assert.deepEqual(h.records,saved);
 assert.equal((await h.invoke('get','/free-pack')).payload.canClaim,false);
 h.records['users/u'].freePackLastClaimAt-=7*3600000;assert.equal((await h.invoke('post','/free-pack/claim',{requestId:'claim-third'})).status,200);
});
test('only admins can edit; disabled packs cannot be claimed; custom fifth cards reach inventory',async()=>{
 const normal=harness();assert.equal((await normal.invoke('get','/admin/free-pack')).status,403);assert.equal((await normal.invoke('put','/admin/free-pack',rules.defaults())).status,403);assert.equal((await normal.invoke('post','/free-pack/claim',{requestId:'denied-id'},true)).status,401);
 const h=harness(true);h.records['packs/p']={name:'Test pack',cardIds:['Bronze_jan.png']};
 const config=rules.defaults();config.cards[4].options=[{kind:'pack',id:'p',min:2,max:2,chance:100}];
 assert.equal((await h.invoke('put','/admin/free-pack',config)).status,200);
 assert.equal((await h.invoke('post','/free-pack/claim',{requestId:'custom-pack'})).status,200);
 const items=Object.entries(h.records).filter(([key])=>key.startsWith('items/')).map(([,v])=>v);assert.equal(items.length,2);assert.ok(items.every(item=>item.packId==='p'&&item.buyerId==='u'&&item.sold));
 config.enabled=false;await h.invoke('put','/admin/free-pack',config);h.records['users/u'].freePackLastClaimAt=0;assert.equal((await h.invoke('post','/free-pack/claim',{requestId:'disabled-pack'})).status,400);
});

test('animal reward options are editable and claims store non-companions exactly once',async()=>{
 const h=harness(true);const editor=await h.invoke('get','/admin/free-pack');
 assert.equal(editor.payload.catalog.animal.length,20);assert.ok(editor.payload.catalog.animal.some(a=>a.id==='defender-rill'));
 const config=rules.defaults();config.cards[4].options=[{kind:'animal',id:'tharos',min:2,max:2,chance:100}];
 assert.equal((await h.invoke('put','/admin/free-pack',config)).status,200);
 const claim=await h.invoke('post','/free-pack/claim',{requestId:'animal-pack'});assert.equal(claim.status,200);assert.equal(claim.payload.rewards[4].label,'2 Tharos');
 assert.equal(h.records['users/u'].stableAnimals.tharos,2);assert.equal(h.records['users/u'].rubyItems['pet:tharos'],undefined);
 await h.invoke('post','/free-pack/claim',{requestId:'animal-pack'});assert.equal(h.records['users/u'].stableAnimals.tharos,2);
 config.cards[4].options[0].id='made-up';assert.equal((await h.invoke('put','/admin/free-pack',config)).status,400);
});
test('fox, snail and pocket dragon animal rewards stay in the companion inventory',()=>{
 const update=rules.apply({stableAnimals:{tharos:1},rubyItems:{'pet:fox':1}},['fox','snail','dragon','talren'].map(id=>({kind:'animal',id,amount:2})));
 assert.deepEqual(update.stableAnimals,{tharos:1,talren:2});assert.equal(update.rubyItems['pet:fox'],3);assert.equal(update.rubyItems['pet:snail'],2);assert.equal(update.rubyItems['pet:dragon'],2);
});

test('admins can repeatedly claim with no cooldown while every request stays idempotent',async()=>{
 const h=harness(true);const first=await h.invoke('post','/free-pack/claim',{requestId:'admin-first'});assert.equal(first.status,200);assert.equal(first.payload.nextAt,first.payload.claimedAt);
 assert.equal((await h.invoke('get','/free-pack')).payload.canClaim,true);assert.equal((await h.invoke('get','/free-pack')).payload.nextAt,0);
 const second=await h.invoke('post','/free-pack/claim',{requestId:'admin-second'});assert.equal(second.status,200);
 const saved=structuredClone(h.records);const retry=await h.invoke('post','/free-pack/claim',{requestId:'admin-first'});assert.deepEqual(retry.payload,first.payload);assert.deepEqual(h.records,saved);
 h.records['users/u'].isAdmin=false;assert.equal((await h.invoke('post','/free-pack/claim',{requestId:'not-admin-now'})).status,400);
});

test('creature ribbons receive book rarity in the admin gallery, new claims and saved reward previews',async()=>{
 const h=harness(true);h.records['creatureBookEntries/tharos']={rarity:'unique'};h.records['creatureBookEntries/fox']={rarity:'rare'};
 const gallery=await h.invoke('get','/admin/free-pack');assert.equal(gallery.payload.catalog.animal.find(a=>a.id==='tharos').rarity,'unique');assert.equal(gallery.payload.catalog.rubyItem.find(a=>a.id==='pet:fox').rarity,'rare');
 const config=rules.defaults();config.cards[4].options=[{kind:'animal',id:'tharos',min:1,max:1,chance:100,rarity:'common'}];await h.invoke('put','/admin/free-pack',config);
 const claim=await h.invoke('post','/free-pack/claim',{requestId:'rarity-pack'});assert.equal(claim.payload.rewards[4].rarity,'unique');
 h.records['creatureBookEntries/tharos'].rarity='epic';const status=await h.invoke('get','/free-pack');assert.equal(status.payload.lastClaim.rewards[4].rarity,'epic');assert.equal(h.records['users/u'].stableAnimals.tharos,1);
});

test('amulet tier metadata survives admin catalogue reads and pack settlement',async()=>{
 const h=harness(true);h.records['ascendTiers/random-gold-id']={name:'Gold',order:4};const admin=await h.invoke('get','/admin/free-pack');const item=admin.payload.catalog.amulet.find(a=>a.gemKey==='gold');assert.ok(item);
 const config=rules.defaults();config.cards[4].options=[{kind:'amulet',id:item.id,min:1,max:1,chance:100}];assert.equal((await h.invoke('put','/admin/free-pack',config)).status,200);const claim=await h.invoke('post','/free-pack/claim',{requestId:'gold-amulet'});assert.equal(claim.status,200);assert.equal(claim.payload.rewards[4].gemKey,'gold');assert.equal(h.records['users/u'].amulets[item.id],1);
});


test('admin pack colors are validated, persisted and included in claims',async()=>{
 const h=harness(true),config=rules.defaults();config.name='Bronze';config.appearance={base:'#693d22',accent:'#c48b52',trim:'#ffe5b0'};
 assert.equal((await h.invoke('put','/admin/free-pack',config)).status,200);
 assert.deepEqual((await h.invoke('get','/admin/free-pack')).payload.config.appearance,config.appearance);
 const claim=await h.invoke('post','/free-pack/claim',{requestId:'bronze-colors'});assert.equal(claim.payload.name,'Bronze');assert.deepEqual(claim.payload.appearance,config.appearance);
 config.appearance.base='url(unsafe)';assert.equal((await h.invoke('put','/admin/free-pack',config)).status,400);
 const normal=harness();assert.equal((await normal.invoke('put','/admin/free-pack',rules.defaults())).status,403);
});

test('token reward receipts show progressive species balances without changing payout',()=>{
 const user={stableAnimals:{'rill-species':2},creatureBrawl:{tokens:{rill:4},instances:{r:{id:'r',kind:'rill-species',ordinal:0,grade:3}}}};
 const rewards=[{kind:'brawlToken',id:'rill-species',amount:2},{kind:'brawlToken',id:'rill',amount:3}];
 const decorated=rules.tokenProgress(user,rewards);
 assert.deepEqual(decorated.map(r=>[r.tokenProgress.before,r.tokenProgress.after]),[[4,6],[0,3]]);
 assert.equal(decorated[0].tokenProgress.target,15);
 assert.deepEqual(rules.apply(user,decorated),rules.apply(user,rewards));assert.equal(user.creatureBrawl.tokens.rill,4);
});

test('packed Kael and Tharos rewards and receipts stay separate after legacy migration',()=>{
 const user={creatureBrawl:{tokens:{veyrin:7,tharos:2}}},rewards=[{kind:'brawlToken',id:'veyrin',amount:3},{kind:'brawlToken',id:'tharos',amount:4}];
 const receipt=rules.tokenProgress(user,rewards);assert.deepEqual(receipt.map(r=>[r.tokenProgress.before,r.tokenProgress.after]),[[7,10],[2,6]]);
 const update=rules.apply(user,rewards);assert.deepEqual(update.creatureBrawl.tokens,{kael:10,tharos:6});assert.deepEqual(user.creatureBrawl.tokens,{veyrin:7,tharos:2});
});

test('token portraits distinguish owned variants and same-pack creature unlocks',()=>{
 const rewards=[{kind:'brawlToken',id:'rill-species',amount:2},{kind:'brawlToken',id:'rill',amount:3}];
 const receipt=rules.tokenProgress({stableAnimals:{'rill-species':1}},rewards);assert.equal(receipt[0].tokenProgress.owned,true);assert.equal(receipt[1].tokenProgress.owned,false);
 const unlocked=rules.tokenProgress({},[{kind:'animal',id:'rill',amount:1},...rewards]);assert.equal(unlocked[1].tokenProgress.owned,false);assert.equal(unlocked[2].tokenProgress.owned,true);
});

test('rarity token options roll normal card odds first, then uniformly choose an eligible variant',()=>{
 const names={brawlToken:[{id:'rarity:common',name:'Common Brawl tokens',members:['rill-species','rill']},{id:'rill-species'},{id:'rill'}]},config={...rules.defaults(),cards:[{title:'Common tokens',options:[{kind:'brawlToken',id:'rarity:common',min:2,max:4,chance:25},{kind:'footy',id:'',min:5,max:5,chance:75}]}]};
 rules.validate(config,names);
 for(const [pick,kind] of [[0,'rill-species'],[1,'rill']]){const values=[0,pick,2],bounds=[];const result=rules.draw(config,n=>{bounds.push(n);return values.shift();},names)[0];assert.equal(result.id,kind);assert.equal(result.kind,'brawlToken');assert.equal(result.amount,4);assert.deepEqual(bounds,[1000000,2,3]);}
 const other=rules.draw(config,n=>n===1000000?250000:0,names)[0];assert.equal(other.kind,'footy');
 assert.throws(()=>rules.draw(config,()=>0,{brawlToken:[]}),/No creatures/);
});
test('daily rarity token claims resolve real creatures once and credit only that variant',async()=>{
 const h=harness(true);h.records['creatureBookEntries/rill-species']={rarity:'common'};h.records['creatureBookEntries/rill']={rarity:'common'};
 const config={...rules.defaults(),cards:[{title:'Common tokens',options:[{kind:'brawlToken',id:'rarity:common',min:3,max:3,chance:100}]}]};
 assert.equal((await h.invoke('put','/admin/free-pack',config)).status,200);
 const claim=await h.invoke('post','/free-pack/claim',{requestId:'rarity-token-claim'});assert.equal(claim.status,200);const reward=claim.payload.rewards[0];assert.ok(['rill','rill-species'].includes(reward.id));assert.equal(reward.kind,'brawlToken');assert.equal(reward.rarity,'common');assert.equal(reward.amount,3);
 const key=reward.id==='rill'?'aeri':'rill';assert.equal(h.records['users/u'].creatureBrawl.tokens[key],3);
 const retry=await h.invoke('post','/free-pack/claim',{requestId:'rarity-token-claim'});assert.deepEqual(retry.payload,claim.payload);assert.equal(h.records['users/u'].creatureBrawl.tokens[key],3);
});

test('clothing rarity pools expose all wardrobe items and award a real matching wearable exactly once',async()=>{
 const wardrobe=require('./public/wardrobe'),valid=['common','rare','epic','legendary','unique'];assert.ok(wardrobe.catalog.every(item=>valid.includes(item.rarity)));
 const h=harness(true),admin=await h.invoke('get','/admin/free-pack'),catalog=admin.payload.catalog;
 const groups=catalog.rubyItem.filter(item=>item.id.startsWith('rarity:clothing:'));assert.equal(groups.length,5);
 assert.equal(new Set(groups.flatMap(g=>g.members)).size,wardrobe.catalog.length);
 for(const group of groups)for(const id of group.members)assert.equal(wardrobe.catalog.find(item=>item.id===id).rarity,group.rarity);
 const config={...rules.defaults(),cards:[{title:'Clothes',options:[{kind:'rubyItem',id:'rarity:clothing:common',min:1,max:1,chance:100}]}]};
 assert.equal((await h.invoke('put','/admin/free-pack',config)).status,200);
 const claim=await h.invoke('post','/free-pack/claim',{requestId:'clothing-rarity-claim'});assert.equal(claim.status,200);
 const item=wardrobe.catalog.find(item=>item.id===claim.payload.rewards[0].id);assert.ok(item);assert.equal(item.rarity,'common');assert.equal(h.records['users/u'].rubyItems[item.id],1);
 assert.equal(wardrobe.owns(h.records['users/u'],item),true);const saved=structuredClone(h.records);await h.invoke('post','/free-pack/claim',{requestId:'clothing-rarity-claim'});assert.deepEqual(h.records,saved);
});

test('owned Unique creatures disappear from personal odds and redistribute equally, without removing their tokens',async()=>{
 const h=harness(true);h.records['creatureBookEntries/veyrin']={rarity:'unique'};h.records['users/u'].stableAnimals={veyrin:1};
 h.records['gameSettings/freePack']={...rules.defaults(),cards:[{title:'Test',options:[{kind:'animal',id:'veyrin',min:1,max:1,chance:30},{kind:'footy',id:'',min:7,max:7,chance:10},{kind:'brawlToken',id:'veyrin',min:2,max:2,chance:60}]}]};
 const profile=(await h.invoke('get','/free-pack')).payload;assert.deepEqual(profile.config.cards[0].options.map(o=>[o.kind,o.chance]),[['footy',25],['brawlToken',75]]);
 const claim=await h.invoke('post','/free-pack/claim',{requestId:'unique-owned-claim'});assert.equal(claim.status,200);assert.equal(h.records['users/u'].stableAnimals.veyrin,1);assert.ok(claim.payload.rewards.every(r=>r.kind!=='animal'));
});
test('Unique creatures are awarded once even across multiple cards, aliases or oversized quantities',()=>{
 const catalog={animal:[{id:'veyrin',rarity:'unique'},{id:'fox',rarity:'unique'}],rubyItem:[{id:'pet:fox',rarity:'unique'}]};
 const cards=[{title:'First',options:[{kind:'animal',id:'veyrin',min:3,max:3,chance:100}]},{title:'Second',options:[{kind:'animal',id:'veyrin',min:1,max:1,chance:50},{kind:'footy',id:'',min:3,max:3,chance:50}]}];
 const rewards=rules.draw({cards},()=>0,catalog,{});assert.equal(rewards[0].amount,1);assert.equal(rewards[1].kind,'footy');assert.equal(rules.apply({},rewards).stableAnimals.veyrin,1);
 const alias=[{title:'Pet',options:[{kind:'animal',id:'fox',min:1,max:1,chance:100}]},{title:'Pet again',options:[{kind:'rubyItem',id:'pet:fox',min:1,max:1,chance:100}]}];assert.equal(rules.draw({cards:alias},()=>0,catalog,{}).length,1);
 assert.throws(()=>rules.draw({cards:[cards[0]]},()=>0,catalog,{stableAnimals:{veyrin:1}}),/already own/);
 assert.deepEqual(rules.draw({cards:[cards[0]],allowEmpty:true},()=>0,catalog,{stableAnimals:{veyrin:1}}),[]);
});

test('concurrent daily claims cannot award a second copy of the same Unique creature',async()=>{
 const h=harness(true);h.records['creatureBookEntries/veyrin']={rarity:'unique'};
 h.records['gameSettings/freePack']={...rules.defaults(),cards:[{title:'Unique',options:[{kind:'animal',id:'veyrin',min:1,max:1,chance:100}]}]};
 const results=await Promise.all(['unique-race-one','unique-race-two'].map(requestId=>h.invoke('post','/free-pack/claim',{requestId})));
 assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(h.records['users/u'].stableAnimals.veyrin,1);
 const state=await h.invoke('get','/free-pack');assert.equal(state.payload.canClaim,false);assert.equal(state.payload.config.cards.length,0);
});
