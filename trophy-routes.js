const crypto = require('crypto');
const engine = require('./public/practice-engine');
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
  const value=skill.level(doc.data()?.skillLevel);
  if(!doc.exists)tx.set(ref,{skillLevel:value});
  return skill.profile(value);
 }));
 route('get','/trophies',async id=>{
  const user=await db.collection('users').doc(id).get();if(!user.exists)throw new Error('User not found');
  return {trophies:user.data().trophies||0,peak:user.data().trophyPeak||0,claimed:user.data().trophyClaims||[],path:PATH};
 });
 route('post','/computer-battles/start',async(id,body)=>{
  if(body.mode && body.mode!=='skill')throw new Error('Training is local and cannot award progression');
  if(!['player','computer'].includes(body.first))throw new Error('Choose starting player');
  if(!Array.isArray(body.cardIds)||body.cardIds.length!==6||new Set(body.cardIds).size!==6)throw new Error('Choose six different cards');
  const owned=await getOwned(id);
  const available=owned.length>=6?owned:engine.trainingCards();
  const player=body.cardIds.map(cardId=>available.find(card=>(card.battleCardId||card.id)===cardId));
  if(player.some(card=>!card))throw new Error('Selected cards are unavailable');
  const snapshot=await db.collection('battleCards').get();
  const pool=snapshot.docs.map(doc=>({...doc.data(),id:doc.id}));
  const generated=engine.computerDeck(pool.length>=6?pool:engine.trainingCards(),player,'hard');
  const board=Array(16).fill(null);board[5]={name:'Starter',top:5,right:5,bottom:5,left:5,averageScore:5,ownerId:'starter',color:'#8a8f98'};
  const initial={board,player,computer:generated.deck,turn:body.first};
  const ref=db.collection('computerBattles').doc();const seed=crypto.randomInt(2147483647);
  const session=await db.runTransaction(async tx=>{
    const userRef=db.collection('users').doc(id),user=await tx.get(userRef);if(!user.exists)throw new Error('User not found');
    const profileRef=db.collection('brawlProfiles').doc(id),profileDoc=await tx.get(profileRef);
    const progress=profileDoc.data()||{}; let skillLevel=skill.level(progress.skillLevel);
    let previous=null,previousRef=null,forfeitedSkill=null;
    const active=progress.activeComputerBattle||user.data().activeComputerBattle;
    if(active){previousRef=db.collection('computerBattles').doc(active);previous=await tx.get(previousRef);}
    const changes={activeComputerBattle:ref.id};
    if(previous?.exists&&previous.data().status==='active'){
      Object.assign(changes,trophyUpdate(user.data(),previous.data().mode==='skill'?'medium':previous.data().difficulty,-1));
      if(previous.data().mode==='skill'){forfeitedSkill=skill.skillChange(skillLevel,-1,0,true);skillLevel=forfeitedSkill.after;}
      tx.update(previousRef,{status:'forfeit',finishedAt:new Date()});
    }
    const difficulty={policy:'adaptive-v2',skill:skillLevel};
    tx.set(ref,{userId:id,initial,seed,difficulty,mode:'skill',skillAtStart:skillLevel,status:'active',createdAt:new Date()});
    tx.set(profileRef,{...progress,skillLevel,activeComputerBattle:ref.id});
    tx.update(userRef,changes);
    return {difficulty,skillLevel,forfeitedSkill};
  });
  return {id:ref.id,initial,seed,mode:'skill',...session,target:generated.target,average:generated.average,playerAverage:generated.playerAverage};
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
    const before=skill.level(profileDoc.data()?.skillLevel);
    const change=isSkill?skill.skillChange(before,result.result,result.quality??(.55+.4*before/1000)):null;
    // Use the CURRENT level; boosters never become permanent inventory items.
    const activeBooster=skill.booster(before);
    const update=trophyUpdate(user.data(),isSkill?'medium':current.data().difficulty,result.result);
    const footy=isSkill&&result.result>0?activeBooster.footy:0;
    if(isSkill&&result.result>0){update.trophies+=Math.round(25*activeBooster.trophyPercent/100);update.trophyPeak=Math.max(update.trophyPeak,update.trophies);}
    if(footy)update.balance=(user.data().balance||0)+footy;
    if(isSkill)tx.set(profileRef,{...profileDoc.data(),skillLevel:change.after,activeComputerBattle:null});
    const delta=update.trophies-(user.data().trophies||0);
    tx.update(userRef,{...update,activeComputerBattle:null});
    const response={trophies:update.trophies,delta,status:'finished',footy,skill:change,profile:isSkill?skill.profile(change.after):null};
    tx.update(ref,{status:'finished',result:result.result,delta,response,finishedAt:new Date()});
    return response;
  });
 });
 route('post','/trophies/claim',async(id,body)=>{
  const reward=PATH.find(entry=>entry.at===body.at);if(!reward)throw new Error('Unknown reward');
  return db.runTransaction(async tx=>{
    const ref=db.collection('users').doc(id),doc=await tx.get(ref);if(!doc.exists)throw new Error('User not found');
    const user=doc.data(),claims=user.trophyClaims||[];
    if((user.trophyPeak||0)<reward.at)throw new Error('Reach this trophy milestone first');
    if(claims.includes(reward.at))throw new Error('Reward already claimed');
    const gems={...(user.gems||{})};for(const [key,count] of Object.entries(reward.gems))gems[key]=(gems[key]||0)+count;
    tx.update(ref,{gems,balance:(user.balance||0)+reward.footy,trophyClaims:[...claims,reward.at]});return {success:true};
  });
 });
};
