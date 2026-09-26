const { effects: amuletEffects, EXCLUSIVES } = require('./amulet-utils');
const { gemIdentity } = require('./gem-utils');
const { dyeInventory } = require('./gem-workshop-utils');
const crypto = require('crypto');
const engine = require('./public/practice-engine');
const liveTurns = require('./public/brawl-turns');
const {PATH,replay,trophyUpdate} = require('./trophy-utils');
const skill = require('./brawl-skill');
module.exports=(app,db,getOwned,authenticate)=>{
 const route=(method,url,handler)=>app[method](url,async(req,res)=>{
  let id;
  try { id=await authenticate(req); } catch(error) { return res.status(401).send(error.message); }
  try{res.json(await handler(id,req.body||{}));}catch(error){res.status(400).send(error.message);}
 });
 route('get','/brawl/skill',async id=>db.runTransaction(async tx=>{
  const ref=db.collection('brawlProfiles').doc(id),doc=await tx.get(ref);
  const data=doc.data()||{},state=skill.progress(data);
  if(data.ratingVersion!==skill.RATING_VERSION)tx.set(ref,{...data,...state});
  return skill.profile(state);
 }));
 route('get','/trophies',async id=>{
  const user=await db.collection('users').doc(id).get();if(!user.exists)throw new Error('User not found');
  return {trophies:user.data().trophies||0,peak:user.data().trophyPeak||0,claimed:user.data().trophyClaims||[],path:PATH.map(reward=>({...reward,amuletName:EXCLUSIVES.find(entry=>entry.id===reward.amulet)?.name||null}))};
 });
 route('post','/computer-battles/start',async(id,body)=>{
  if(body.mode && body.mode!=='skill')throw new Error('Training is local and cannot award progression');
  if(!Array.isArray(body.cardIds)||body.cardIds.length!==6||new Set(body.cardIds).size!==6)throw new Error('Choose six different cards');
  const owned=await getOwned(id);
  const available=owned.length>=6?owned:engine.trainingCards();
  const player=body.cardIds.map(cardId=>available.find(card=>(card.battleCardId||card.id)===cardId));
  if(player.some(card=>!card))throw new Error('Selected cards are unavailable');
  if(!engine.validSpecials(player))throw new Error('Only one special card is allowed per deck');
  const snapshot=await db.collection('battleCards').get();
  const pool=snapshot.docs.map(doc=>({...doc.data(),id:doc.id}));
  const generated=engine.rankedDeck(pool,available,player);
  const board=Array(16).fill(null);board[5]=engine.starterCard(pool,[...player,...generated.deck]);
  const initial={board,player,computer:generated.deck,turn:engine.startingPlayer(player,generated.deck)};
  const timed=[...player,...generated.deck].some(card=>engine.ability(card)==='mirror-interrupt');
  const ref=db.collection('computerBattles').doc();const seed=crypto.randomInt(2147483647);
  const session=await db.runTransaction(async tx=>{
    const userRef=db.collection('users').doc(id),user=await tx.get(userRef);if(!user.exists)throw new Error('User not found');
    const profileRef=db.collection('brawlProfiles').doc(id),profileDoc=await tx.get(profileRef);
    const progress=profileDoc.data()||{}; let rating=skill.progress(progress);
    let previous=null,previousRef=null,forfeitedSkill=null;
    const active=progress.activeComputerBattle||user.data().activeComputerBattle;
    if(active){previousRef=db.collection('computerBattles').doc(active);previous=await tx.get(previousRef);}
    const changes={activeComputerBattle:ref.id};
    if(previous?.exists&&previous.data().status==='active'){
      Object.assign(changes,trophyUpdate(user.data(),previous.data().mode==='skill'?'medium':previous.data().difficulty,-1));
      if(previous.data().mode==='skill'){const settled=skill.settle(rating,-1,null,previous.data().skillAtStart,true);forfeitedSkill=settled.change;rating=settled.state;}
      tx.update(previousRef,{status:'forfeit',finishedAt:new Date()});
    }
    const skillLevel=rating.skillLevel;
    const difficulty={policy:'adaptive-v3',skill:skillLevel};
    const live=timed?liveTurns.create(initial,difficulty,seed):null;
    tx.set(ref,{userId:id,initial,seed,difficulty,live,mode:'skill',assessmentVersion:2,skillAtStart:skillLevel,status:'active',createdAt:new Date()});
    tx.set(profileRef,{...progress,...rating,activeComputerBattle:ref.id});
    tx.update(userRef,changes);
    return {difficulty,live,profile:skill.profile(rating),forfeitedSkill};
  });
  return {id:ref.id,initial,seed,mode:'skill',assessmentVersion:2,...session,target:generated.target,average:generated.average,playerAverage:generated.playerAverage};
 });
 route('post','/computer-battles/turn',async(id,body)=>{
  if(typeof body.id!=='string'||!body.id||body.id.includes('/'))throw new Error('Invalid battle');
  return db.runTransaction(async tx=>{
    const ref=db.collection('computerBattles').doc(body.id),doc=await tx.get(ref);
    if(!doc.exists||doc.data().userId!==id||doc.data().status!=='active'||!doc.data().live)throw new Error('Timed battle unavailable');
    const live=liveTurns.advance(doc.data().live,body.action||{},Date.now());
    // Polling without a move must not rewrite the entire battle.
    if(live.events.length!==doc.data().live.events.length)tx.update(ref,{live});
    return {live};
  });
 });
 route('post','/computer-battles/finish',async(id,body)=>{
  if(typeof body.id!=='string'||!body.id||body.id.includes('/'))throw new Error('Invalid battle');
  const ref=db.collection('computerBattles').doc(body.id),doc=await ref.get();
  if(!doc.exists||doc.data().userId!==id)throw new Error('Battle not found');
  const result=doc.data().status==='active'?replay(doc.data(),body.moves,true):null;
  return db.runTransaction(async tx=>{
    const current=await tx.get(ref),userRef=db.collection('users').doc(id),user=await tx.get(userRef);
    const profileRef=db.collection('brawlProfiles').doc(id),profileDoc=await tx.get(profileRef);
    if(current.data().status!=='active')return current.data().response || {trophies:user.data().trophies||0,delta:current.data().delta||0,status:current.data().status};
    const isSkill=current.data().mode==='skill';
    const rating=skill.progress(profileDoc.data()||{});
    const settled=isSkill?skill.settle(rating,result.result,result.quality,current.data().skillAtStart):null;
    const change=settled?.change||null;
    // Use the CURRENT level; boosters never become permanent inventory items.
    const activeBooster=skill.profile(rating).booster;
    const update=trophyUpdate(user.data(),isSkill?'medium':current.data().difficulty,result.result);
    const footy=isSkill&&result.result>0?activeBooster.footy:0;
    if(isSkill&&result.result>0){update.trophies+=Math.round(25*activeBooster.trophyPercent/100)+(amuletEffects(user.data()).trophybonus||0);update.trophyPeak=Math.max(update.trophyPeak,update.trophies);}
    const ruby=isSkill&&result.result>0?activeBooster.ruby:0;
    if(ruby)update.gems={...(user.data().gems||{}),bronze:(user.data().gems?.bronze||0)+ruby};
    if(footy)update.balance=(user.data().balance||0)+footy;
    if(isSkill)tx.set(profileRef,{...profileDoc.data(),...settled.state,activeComputerBattle:null});
    const delta=update.trophies-(user.data().trophies||0);
    tx.update(userRef,{...update,...(isSkill?require('./town-hall-progress').gameplay(user.data(),result.result>0?'ranked win':result.result<0?'ranked loss':'ranked draw'):require('./town-hall-progress').gameplay(user.data(),'training battle')),activeComputerBattle:null});
    const response={trophies:update.trophies,delta,status:'finished',footy,ruby,skill:change,moveReviews:result.moveReviews||[],profile:isSkill?skill.profile(settled.state):null};
    tx.update(ref,{status:'finished',result:result.result,delta,response,finishedAt:new Date()});
    return response;
  });
 });
 route('post','/trophies/claim',async(id,body)=>{
  const reward=PATH.find(entry=>entry.at===body.at);if(!reward)throw new Error('Unknown reward');
  let rewardTier=null;
  if(reward.pack){const tiers=await db.collection('ascendTiers').get();rewardTier=tiers.docs.map(doc=>({...doc.data(),id:doc.id})).find(tier=>gemIdentity(tier).gemKey===reward.pack);if(!rewardTier?.cards?.length)throw new Error('No cards configured for this reward pack yet');}
  return db.runTransaction(async tx=>{
    const ref=db.collection('users').doc(id),doc=await tx.get(ref);if(!doc.exists)throw new Error('User not found');
    const user=doc.data(),claims=user.trophyClaims||[];
    if((user.trophyPeak||0)<reward.at)throw new Error('Reach this trophy milestone first');
    if(claims.includes(reward.at))throw new Error('Reward already claimed');
    const gems={...(user.gems||{})};for(const [key,count] of Object.entries(reward.gems))gems[key]=(gems[key]||0)+count;
    const amulets={...(user.amulets||{})};if(reward.amulet)amulets[reward.amulet]=(amulets[reward.amulet]||0)+1;
    const dyes=dyeInventory(user);for(const [key,count] of Object.entries(reward.dyes||{}))dyes[key]=(dyes[key]||0)+count;
    if(reward.pack){
      const packId=`trophy-${reward.pack}`;
      tx.set(db.collection('packs').doc(packId),{name:reward.packName,cardIds:rewardTier.cards,color:rewardTier.backgroundColor||'#b79d4a',trophyReward:true});
      for(let i=0;i<(reward.packCount||1);i++)tx.set(db.collection('items').doc(),{name:reward.packName,itemType:'pack',packId,packColor:rewardTier.backgroundColor||'#b79d4a',price:0,sellerId:id,buyerId:id,sold:true,listedForSale:false,sourceItemId:null,imageUrl:null,purchasedAt:new Date(),createdAt:new Date()});
    }
    tx.update(ref,{...require('./town-hall-progress').gameplay(user,'trophy reward'),gems,amulets,gemDyes:dyes,balance:(user.balance||0)+reward.footy,trophyClaims:[...claims,reward.at]});return {success:true};
  });
 });
};
