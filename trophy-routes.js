const crypto = require('crypto');
const engine = require('./public/practice-engine');
const {PATH,replay,trophyUpdate} = require('./trophy-utils');
module.exports=(app,db,getOwned)=>{
 const route=(method,url,handler)=>app[method](url,async(req,res)=>{
  const id=req.header('X-User-Id');if(!id)return res.status(401).send('Missing user');
  try{res.json(await handler(id,req.body||{}));}catch(error){res.status(400).send(error.message);}
 });
 route('get','/trophies',async id=>{
  const user=await db.collection('users').doc(id).get();if(!user.exists)throw new Error('User not found');
  return {trophies:user.data().trophies||0,peak:user.data().trophyPeak||0,claimed:user.data().trophyClaims||[],path:PATH};
 });
 route('post','/computer-battles/start',async(id,body)=>{
  if(!Object.hasOwn(engine.difficulties,body.difficulty)||!['player','computer'].includes(body.first))throw new Error('Choose difficulty and starting player');
  if(!Array.isArray(body.cardIds)||body.cardIds.length!==6||new Set(body.cardIds).size!==6)throw new Error('Choose six different cards');
  const owned=await getOwned(id);
  const available=owned.length>=6?owned:engine.trainingCards();
  const player=body.cardIds.map(cardId=>available.find(card=>(card.battleCardId||card.id)===cardId));
  if(player.some(card=>!card))throw new Error('Selected cards are unavailable');
  const snapshot=await db.collection('battleCards').get();
  const pool=snapshot.docs.map(doc=>({...doc.data(),id:doc.id}));
  const generated=engine.computerDeck(pool.length>=6?pool:engine.trainingCards(),player,body.difficulty);
  const board=Array(16).fill(null);board[5]={name:'Starter',top:5,right:5,bottom:5,left:5,averageScore:5,ownerId:'starter',color:'#8a8f98'};
  const initial={board,player,computer:generated.deck,turn:body.first};
  const ref=db.collection('computerBattles').doc();const seed=crypto.randomInt(2147483647);
  await db.runTransaction(async tx=>{
    const userRef=db.collection('users').doc(id),user=await tx.get(userRef);if(!user.exists)throw new Error('User not found');
    let previous=null,previousRef=null;
    if(user.data().activeComputerBattle){previousRef=db.collection('computerBattles').doc(user.data().activeComputerBattle);previous=await tx.get(previousRef);}
    const changes={activeComputerBattle:ref.id};
    if(previous?.exists&&previous.data().status==='active'){
      Object.assign(changes,trophyUpdate(user.data(),previous.data().difficulty,-1));
      tx.update(previousRef,{status:'forfeit',finishedAt:new Date()});
    }
    tx.set(ref,{userId:id,initial,seed,difficulty:body.difficulty,status:'active',createdAt:new Date()});
    tx.update(userRef,changes);
  });
  return {id:ref.id,initial,seed,difficulty:body.difficulty,target:generated.target,average:generated.average,playerAverage:generated.playerAverage};
 });
 route('post','/computer-battles/finish',async(id,body)=>{
  if(typeof body.id!=='string'||!body.id||body.id.includes('/'))throw new Error('Invalid battle');
  const ref=db.collection('computerBattles').doc(body.id),doc=await ref.get();
  if(!doc.exists||doc.data().userId!==id)throw new Error('Battle not found');
  const result=doc.data().status==='active'?replay(doc.data(),body.moves):null;
  return db.runTransaction(async tx=>{
    const current=await tx.get(ref),userRef=db.collection('users').doc(id),user=await tx.get(userRef);
    if(current.data().status!=='active')return {trophies:user.data().trophies||0,delta:current.data().delta||0,status:current.data().status};
    const update=trophyUpdate(user.data(),current.data().difficulty,result);
    const delta=update.trophies-(user.data().trophies||0);
    tx.update(userRef,{...update,activeComputerBattle:null});
    tx.update(ref,{status:'finished',result,delta,finishedAt:new Date()});
    return {trophies:update.trophies,delta,status:'finished'};
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
