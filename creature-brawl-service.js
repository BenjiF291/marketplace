const growth=require('./creature-growth');
const crypto=require('node:crypto'),catalog=require('./public/creature-brawl-catalog'),engine=require('./public/creature-brawl-engine'),animals=require('./public/stable-animals').animals;
function reconcile(user){
 const b=structuredClone(user.creatureBrawl||{});b.instances=b.instances||{};b.tokens=require('./creature-token-wallet').wallet(b);b.rating=Math.max(0,Number(b.rating)||0);b.sequence=b.sequence||0;b.selected=b.selected||[];b.paidWins=Math.max(0,Number(b.paidWins)||0);
 const owned=[];
 for(const creature of catalog.creatures){const companion=animals.find(a=>a.id===creature.id).companion,count=Math.min(1000,Math.max(0,Math.floor(Number(companion?user.rubyItems?.['pet:'+creature.id]:user.stableAnimals?.[creature.id])||0)));const prior=Object.values(b.instances).filter(i=>i.kind===creature.id).sort((a,b)=>a.ordinal-b.ordinal);
  for(let n=0;n<count;n++){let instance=prior.find(i=>i.ordinal===n);if(!instance){instance={id:crypto.randomUUID(),kind:creature.id,ordinal:n,grade:1};b.instances[instance.id]=instance;}instance.level=growth.profile(user,creature.id,n).level;owned.push(instance);}
 }
 // Keep every resident in storage, but Brawl uses the strongest owned copy of each kind.
 const strongest=new Map();for(const instance of owned){const prior=strongest.get(instance.kind);if(!prior||instance.grade>prior.grade||(instance.grade===prior.grade&&instance.level>prior.level))strongest.set(instance.kind,instance);}
 b.selected=[...new Set(b.selected.map(id=>{const instance=owned.find(i=>i.id===id);return instance?strongest.get(instance.kind).id:null;}).filter(Boolean))].slice(0,3);
 return {profile:b,owned:[...strongest.values()],allOwned:owned};
}
const gradeCap=(user,instance)=>growth.gradeCap(instance?growth.profile(user,instance.kind,instance.ordinal).level:1);
const RARITIES=['common','rare','epic','legendary','unique'];
function rarityOf(kind,entries={}){const value=entries[kind]?.rarity||entries[kind];return RARITIES.includes(value)?value:'common';}
function definition(kind,entries={}){const original=catalog.creatures.find(c=>c.id===kind);if(!original)throw Error('Unknown creature.');const rarity=rarityOf(kind,entries),multiplier=1+.04*RARITIES.indexOf(rarity),base={...original.base};for(const key of ['hp','atk','def'])base[key]=Math.round(base[key]*multiplier);return {...original,base,rarity};}
function catalogFor(entries={}){return {...catalog,VERSION:catalog.VERSION+':rarity-stats1:'+crypto.createHash('sha256').update(JSON.stringify(catalog.creatures.map(c=>rarityOf(c.id,entries)))).digest('hex').slice(0,12),creatures:catalog.creatures.map(c=>definition(c.id,entries))};}
function unit(instance,grade=instance.grade||1,entries={}){const c=definition(instance.kind,entries);if(!c)throw Error('Unknown creature.');const factor=1+.08*(grade-1);return {id:instance.id,kind:c.id,species:c.species,rarity:c.rarity,tokenKey:c.tokenKey,name:c.name,role:c.role,size:c.size,poster:c.poster,grade,nextStats:grade<10?{...c.base,hp:Math.round(c.base.hp*(1+.08*grade)),atk:Math.round(c.base.atk*(1+.08*grade)),def:Math.round(c.base.def*(1+.08*grade))}:null,level:instance.level||1,growth:{key:growth.key(instance.kind,instance.ordinal),level:instance.level||1,grade,gradeCap:growth.gradeCap(instance.level||1),upgradeCost:grade<10?growth.tokenCost(grade):0},stats:{...c.base,hp:Math.round(c.base.hp*factor),atk:Math.round(c.base.atk*factor),def:Math.round(c.base.def*factor)},moves:structuredClone(c.moves)};}
function power(u){return u.stats.hp/10+u.stats.atk+u.stats.def*.5+u.stats.spd*.7;}
function opponent(team,difficulty,stage,sequence,entries={}){
 const used=new Set(),grade=Math.max(1,Math.min(10,Math.round(team.reduce((n,u)=>n+u.grade,0)/team.length))),target=catalog.config.difficulties.find(d=>d.id===difficulty).scale;
 const targets=[Math.max(0,stage-1),stage,stage];
 const enemy=targets.map((rank,i)=>{
  // Nearby tiers add variety, while distant tiers stay out of early arenas.
  const candidates=catalog.creatures.filter(c=>!used.has(c.id));
  const distance=c=>Math.abs(RARITIES.indexOf(rarityOf(c.id,entries))-rank);
  const closest=Math.min(...candidates.map(distance));
  const pool=candidates.filter(c=>distance(c)<=Math.max(1,closest));
  const weights=pool.map(c=>distance(c)===0?6:1);
  let roll=crypto.randomInt(weights.reduce((n,w)=>n+w,0)),creature=pool[pool.length-1];
  for(let j=0;j<pool.length;j++){roll-=weights[j];if(roll<0){creature=pool[j];break;}}
  used.add(creature.id);return unit({id:'enemy-'+i,kind:creature.id,grade},grade,entries);
 });
 // Match grades, then preserve the actual rarity advantage rather than normalising it away.
 for(const u of enemy)for(const key of ['hp','atk','def'])u.stats[key]=Math.round(u.stats[key]*target);
 return enemy;
}
function runAI(state,all=false){let s=state,safety=0;while(s.phase!=='FINISHED'&&(all||s.units.find(u=>u.id===s.actorId)?.team===1)){if(++safety>100)throw Error('Combat safety limit reached.');const action=engine.choose(s);if(!action)throw Error('Actor has no legal move.');s=engine.act(s,action);}return s;}
function winFooty(user,base){return require('./amulet-utils').round(base+Math.min(500,base*(require('./amulet-utils').effects(user).battle||0)/100));}
function settle(user,b,match,now){
 if(match.state.phase!=='FINISHED'||match.settled)return null;const config=match.catalogSnapshot?.config||catalog.config;match.settled=true;const won=match.state.winner===0,draw=match.state.winner===null;const reward={practice:match.practice,rating:0,rubies:0,footy:0,tokens:{},reason:match.state.reason};
 if(!match.practice&&match.state.reason!=='abandoned'){
  b.usageCounts={...b.usageCounts};
  for(const kind of new Set((match.state.units||[]).filter(u=>u.team===0).map(u=>u.kind))){if(catalog.creatures.some(c=>c.id===kind))b.usageCounts[kind]=Math.min(1000000,(Number(b.usageCounts[kind])||0)+1);}
 }
 if(!match.practice){reward.rating=draw?0:won?config.ratingWin:-Math.min(b.rating,config.ratingLoss);b.rating=Math.max(0,b.rating+reward.rating);const day=new Date(now).toISOString().slice(0,10);if(b.rewardDay!==day){b.rewardDay=day;b.paidWins=0;}
  if(won&&match.state.reason!=='abandoned'){reward.rubies=5;b.paidWins++;}
  if(won){b.clearedStages=[...new Set([...(b.clearedStages||[]),match.stage])].sort((a,b)=>a-b);b.ladder=b.clearedStages.length;}
 }
 match.reward=reward;b.lastMatch=match.id;b.activeMatch=null;return {creatureBrawl:b,...(reward.rubies?{gems:{...require('./gem-wallet').wallet(user.gems),bronze:require('./gem-wallet').whole(user.gems?.bronze)+reward.rubies}}:{})};
}
function publicMatch(m,afterEvent=0){if(!m)return null;return {id:m.id,practice:m.practice,difficulty:m.difficulty,stage:m.stage,phase:m.phase,settled:m.settled,reward:m.reward||null,expectedRevision:m.revision,state:{...m.state,events:m.state.events.filter(e=>e.seq>afterEvent)}};}
module.exports={reconcile,gradeCap,unit,power,opponent,runAI,settle,publicMatch,catalog,engine,winFooty,catalogFor,rarityOf};
