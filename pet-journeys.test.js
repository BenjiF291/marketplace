const test=require('node:test'),assert=require('node:assert/strict');
const j=require('./pet-journeys'),shop=require('./ruby-shop');
const tiers=['Bronze','Rare Bronze','Silver','Rare Silver','Gold','Rare Gold','Platinum','Lightning','Ultra','Fighter','Genious'].map((name,order)=>({id:'t'+order,name,order,packs:['p'+order]}));
const packs=tiers.map((t,i)=>({id:'p'+i,name:t.name,cardIds:['card'+i]}));
const loot=j.tables(tiers,packs);
const user=()=>({rubyItems:{'pet:fox':1,'pet:snail':1,'pet:dragon':1,food:3,'food:trail':2,'food:feast':1},gems:{bronze:10},gemConverterLevel:0});
test('priced pet perks improve actual rewards and match the displayed odds for every food',()=>{
 for(const food of loot){
  const fox=food.petOdds['pet:fox'],snail=food.petOdds['pet:snail'],dragon=food.petOdds['pet:dragon'];
  const mean=t=>t.quantities.reduce((n,q)=>n+q.amount*q.weight/1000000,0);
  assert.ok(mean(snail)>mean(fox));assert.equal(mean(dragon),mean(snail));
  assert.deepEqual(snail.gems,fox.gems);
  assert.ok(dragon.gems.slice(8).reduce((n,g)=>n+g.weight,0)>fox.gems.slice(8).reduce((n,g)=>n+g.weight,0));
  assert.equal(1000000-dragon.rewards[0].weight,2*(1000000-fox.rewards[0].weight));
  for(const [id,table] of Object.entries(food.petOdds)){
   for(const rows of [table.gems,table.quantities,table.rewards])assert.equal(rows.reduce((n,r)=>n+r.weight,0),1000000);
   for(const roll of [0,400000,750000,990000,999999]){
    const trip=j.start(user(),id,food.id,loot,'perks',0,[roll,roll,roll]).petJourneys[id];
    assert.equal(trip.reward.amount,j.draw(table.quantities,roll).amount);assert.ok(trip.reward.amount>=1&&trip.reward.amount<=5);
    assert.equal(trip.reward.gemKey,j.draw(table.gems,roll).gemKey);assert.deepEqual(trip.reward.bonus,j.draw(table.rewards,roll));assert.equal(trip.endsAt,j.HOURS);
   }
  }
 }
});
test('journey odds sum exactly to 100%, include every gem, and better food improves results',()=>{
 let previousRank=-1,previousAmount=0,previousBonus=0;
 for(const table of loot){
  for(const rows of [table.gems,table.quantities,table.rewards])assert.equal(rows.reduce((n,r)=>n+r.weight,0),1000000);
  assert.equal(table.gems.length,tiers.length);assert.ok(table.gems.every(g=>g.weight>0));
  const rank=table.gems.reduce((n,g,i)=>n+g.weight*i/1000000,0),amount=table.quantities.reduce((n,q)=>n+q.amount*q.weight/1000000,0),bonus=1000000-table.rewards[0].weight;
  assert.ok(rank>previousRank);assert.ok(amount>previousAmount);assert.ok(bonus>previousBonus);
  previousRank=rank;previousAmount=amount;previousBonus=bonus;
  assert.ok(table.rewards.some(r=>r.kind==='pack'));assert.ok(table.rewards.some(r=>r.kind==='amulet'));
  assert.ok(!table.rewards.some(r=>r.kind==='pack'&&r.id==='p0'));
 }
 assert.equal(j.draw(loot[0].gems,999999).gemName,'Genious Crystal');
 assert.equal(j.tables(tiers.slice(0,1),[])[0].rewards[0].weight,1000000);
});
test('each pet can travel independently, consuming one food, with server-owned time and rewards',()=>{
 const u=user(),now=1000;
 Object.assign(u,j.start(u,'pet:fox','food',loot,'trip1',now,[999999,999999,0]));
 assert.equal(u.rubyItems.food,2);assert.equal(u.petJourneys['pet:fox'].endsAt,now+4*3600000);
 assert.throws(()=>j.start(u,'pet:fox','food',loot,'trip2'),/already/);
 Object.assign(u,j.start(u,'pet:snail','food:trail',loot,'trip2',now,[0,0,0]));
 assert.equal(Object.keys(u.petJourneys).length,2);assert.equal(u.rubyItems['food:trail'],1);
 assert.throws(()=>j.claim(u,'pet:fox','trip1',now+j.HOURS-1),/still travelling/);
 assert.throws(()=>j.claim(u,'pet:fox','wrong',now+j.HOURS),/not found/);
 const result=j.claim(u,'pet:fox','trip1',now+j.HOURS);Object.assign(u,result.update);
 assert.equal(u.gems['tier-t10'],5);assert.equal(u.gemConverterLevel,0);assert.equal(u.gems.bronze,10);
 assert.throws(()=>j.claim(u,'pet:fox','trip1',now+j.HOURS),/already claimed/);
 Object.assign(u,j.start(u,'pet:fox','food',loot,'trip3',now+j.HOURS,[0,0,0]));
 assert.throws(()=>j.claim(u,'pet:fox','trip1',now+2*j.HOURS),/not found/);
 assert.throws(()=>j.start({...user(),rubyItems:{food:1}},'pet:fox','food',loot,'x'),/not own/);
 assert.throws(()=>j.start({...user(),rubyItems:{'pet:fox':1}},'pet:fox','food',loot,'x'),/serving/);
 assert.throws(()=>j.start(user(),'pet:fox','forged',loot,'x'),/unavailable/);
 assert.throws(()=>shop.use(u,{itemId:'food',petId:'pet:fox'}),/journey/);
});
test('multiple pet equipment preserves legacy pets, filters unowned pets, and never duplicates',()=>{
 let u={...user(),rubyEquipped:{pet:'pet:fox',profile:'profile:crown'}};
 Object.assign(u,shop.use(u,{itemId:'pet:snail'}));Object.assign(u,shop.use(u,{itemId:'pet:snail'}));
 assert.deepEqual(j.pets(u),['pet:fox','pet:snail']);assert.equal(u.rubyEquipped.profile,'profile:crown');
 assert.deepEqual(j.pets({...u,rubyItems:{'pet:snail':1}}),['pet:snail']);
});
function harness(){
 const handlers={},records={'users/u':user()};tiers.forEach(t=>records['ascendTiers/'+t.id]=t);packs.forEach(p=>records['packs/'+p.id]=p);
 const snap=key=>({id:key.split('/')[1],exists:!!records[key],data:()=>structuredClone(records[key])});
 const db={collection:n=>({get:async()=>({docs:Object.keys(records).filter(k=>k.startsWith(n+'/')).map(snap)}),doc:id=>({key:n+'/'+id,get:async()=>snap(n+'/'+id)})}),runTransaction:async fn=>{
  const pending=[];const result=await fn({getAll:async(...refs)=>{assert.equal(pending.length,0,'all reads precede writes');return refs.map(r=>snap(r.key));},update:(r,v)=>pending.push(()=>Object.assign(records[r.key],v)),set:(r,v)=>pending.push(()=>records[r.key]=v)});pending.forEach(f=>f());return result;
 }};
 require('./ruby-shop-routes')({get:(p,fn)=>handlers[p]=fn,post:(p,fn)=>handlers[p]=fn},db,async req=>{if(req.denied)throw Error('Unauthorized');return 'u';});
 const call=async(action,body={},denied=false)=>{let status=200,value;const res={json:v=>value=v,status:n=>{status=n;return res;},send:v=>value=v};await handlers[action.startsWith('/')?action:'/ruby-shop/:action']({params:{action},body,denied},res);return {status,value};};
 return {records,call};
}
test('journey routes conceal pending loot, reject early claims, deduplicate actions and unequip only one pet',async()=>{
 const {records,call}=harness(),start={petId:'pet:fox',foodId:'food',actionId:'start-1234567890123456'};
 assert.equal((await call('journey-start',start,true)).status,400);assert.equal(records['users/u'].rubyItems.food,3);
 assert.equal((await call('journey-start',start)).status,200);assert.equal((await call('journey-start',start)).status,200);assert.equal(records['users/u'].rubyItems.food,2);
 const visible=(await call('/ruby-shop')).value;assert.equal(visible.journeys[0].reward,undefined);
 assert.equal((await call('journey-claim',{petId:'pet:fox',journeyId:start.actionId,actionId:'early-1234567890123456'})).status,400);
 records['users/u'].rubyEquipped={pets:['pet:fox','pet:snail']};await call('clear',{kind:'pet',itemId:'pet:fox',actionId:'clear-1234567890123456'});assert.deepEqual(records['users/u'].rubyEquipped.pets,['pet:snail']);
 const table=(await call('/pet-journeys')).value[0];assert.ok(table.rewards.some(r=>r.kind==='pack'));assert.ok(table.rewards.every(r=>!r.pack));assert.ok(Object.values(table.petOdds).every(t=>t.rewards.every(r=>!r.pack)));
});
test('rare pack and amulet claims mint exactly once, even with different retry action IDs',async()=>{
 for(const kind of ['pack','amulet']){
  const {records,call}=harness(),u=records['users/u'],bonus=loot[0].rewards.find(r=>r.kind===kind),journeyId='trip-1234567890123456';
  u.petJourneys={'pet:fox':{id:journeyId,status:'travelling',endsAt:0,reward:{gemKey:'ultra',gemName:'Diamond',amount:5,bonus}}};
  const request={petId:'pet:fox',journeyId,actionId:'claim-1234567890123456'};
  assert.equal((await call('journey-claim',request)).status,200);assert.equal((await call('journey-claim',request)).status,200);
  assert.equal((await call('journey-claim',{...request,actionId:'again-1234567890123456'})).status,400);
  assert.equal(u.gems.ultra,5);
  if(kind==='amulet')assert.equal(u.amulets[bonus.id],1);
  else {const minted=Object.entries(records).filter(([k])=>k.startsWith('items/'));assert.equal(minted.length,1);assert.equal(minted[0][1].buyerId,'u');assert.deepEqual(records['packs/'+minted[0][1].packId].cardIds,bonus.pack.cardIds);}
 }
});
