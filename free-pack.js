const {randomInt}=require('node:crypto');
const GEM_NAMES=require('./gem-utils').GEM_NAMES||{bronze:'Ruby','rare-bronze':'Garnet',silver:'Moonstone','rare-silver':'Opal',gold:'Citrine','rare-gold':'Emerald',platinum:'Sapphire',lightning:'Amethyst',ultra:'Diamond'};
const options=(ruby,footy,skip,leap,garnet)=>[
 {kind:'gem',id:'bronze',min:ruby[0],max:ruby[1],chance:20},
 {kind:'footy',id:'',min:footy[0],max:footy[1],chance:20},
 {kind:'boost',id:'skip',min:skip,max:skip,chance:20},
 {kind:'boost',id:'leap',min:leap,max:leap,chance:20},
 {kind:'gem',id:'rare-bronze',min:garnet[0],max:garnet[1],chance:20}];
function defaults(){return {name:'Daily Discovery Pack',enabled:true,cooldownHours:7,cards:[...Array.from({length:3},()=>({title:'Island supplies',options:options([5,15],[3,12],1,1,[3,6])})),{title:'Extra supplies',options:options([10,25],[7,17],2,1,[6,15])},{title:'Admin surprise',options:[{kind:'gem',id:'bronze',min:10,max:10,chance:100}]}]};}
function validate(value,catalog){
 if(!value||typeof value.name!=='string'||!value.name.trim()||value.name.length>80||typeof value.enabled!=='boolean')throw Error('Enter a pack name and enabled setting.');
 if(!Number.isFinite(value.cooldownHours)||value.cooldownHours<1||value.cooldownHours>168)throw Error('Cooldown must be between 1 and 168 hours.');
 if(!Array.isArray(value.cards)||value.cards.length<1||value.cards.length>30)throw Error('Use between 1 and 30 reward cards.');
 const cards=value.cards.map((card,index)=>{
  if(typeof card.title!=='string'||!card.title.trim()||card.title.length>80||!Array.isArray(card.options)||!card.options.length||card.options.length>100)throw Error(`Card ${index+1} needs a title and 1-100 reward options.`);
  let sum=0;const options=card.options.map(option=>{
   const {kind,id,min,max,chance}=option;
   if(!['gem','footy','boost','rubyItem','amulet','pack','card','animal','brawlToken'].includes(kind))throw Error('Unknown reward type.');
   if(!Number.isInteger(min)||!Number.isInteger(max)||min<1||max<min||max>10000||(['pack','card','animal'].includes(kind)&&max>20))throw Error('Use whole amounts from 1 to 10000 (up to 20 for cards, packs or animals).');
   if(!Number.isFinite(chance)||chance<0||chance>100)throw Error('Chances must be between 0 and 100 percent.');
   if(kind!=='footy'&&!catalog[kind]?.some(entry=>entry.id===id))throw Error(`Choose an available ${kind} reward.`);
   sum+=chance;return {kind,id:kind==='footy'?'':id,min,max,chance};
  });
  if(Math.abs(sum-100)>.000001)throw Error(`Card ${index+1} chances must total 100% (currently ${sum}%).`);
  return {title:card.title.trim(),options};
 });
 const inventoryWrites=cards.reduce((sum,card)=>sum+Math.max(...card.options.map(o=>['pack','card'].includes(o.kind)?o.max:0)),0);
 if(inventoryWrites>400)throw Error('Reduce collection card or pack quantities: at most 400 inventory items per claim.');
 const appearance={base:'#75432b',accent:'#cf9859',trim:'#ffe1a0'};
 for(const key of Object.keys(appearance))if(value.appearance?.[key]!==undefined){if(typeof value.appearance[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(value.appearance[key]))throw Error('Choose valid pack colors.');appearance[key]=value.appearance[key];}
 return {name:value.name.trim(),enabled:value.enabled,cooldownHours:value.cooldownHours,cards,appearance};
}
function draw(config,random=randomInt,catalog={},user={}){const result=[],awarded=new Set(),unique=require('./unique-creature-rewards');for(const [index,source] of config.cards.entries()){const card=unique.cards([source],catalog,user,awarded)[0];if(!card)continue;
 const roll=random(1000000)/10000;let sum=0,selected;
 for(const option of card.options){sum+=option.chance;if(roll<sum){selected=option;break;}}
 if(!selected)selected=card.options.filter(o=>o.chance>0).at(-1);
 let id=selected.id;
 if(selected.kind==='brawlToken'&&id.startsWith('rarity:')||selected.kind==='rubyItem'&&id.startsWith('rarity:clothing:')){
  const pool=catalog[selected.kind]?.find(entry=>entry.id===id)?.members;
  if(!pool?.length)throw Error(selected.kind==='brawlToken'?'No creatures are currently assigned to '+id.slice(7)+' rarity.':'No clothing is currently assigned to '+id+' .');
  id=selected.kind==='brawlToken'?require('./brawl-token-selection').choose(pool,user,random):pool[random(pool.length)];
 }
 const reward={card:index+1,title:card.title,kind:selected.kind,id,amount:selected.min+random(selected.max-selected.min+1)};const uniqueId=unique.creature(reward,catalog);if(uniqueId){awarded.add(uniqueId);reward.amount=1;reward.rarity='unique';}result.push(reward);
}if(config.cards.length&&!result.length&&!config.allowEmpty)throw Error('You already own all Unique creatures available in this pack.');return result;}
function apply(user,rewards){
 const update={gems:require('./gem-wallet').wallet(user.gems),balance:require('./public/currency-format').footy(Number(user.balance)||0),timeBoosts:{...user.timeBoosts},rubyItems:{...user.rubyItems},amulets:{...user.amulets},stableAnimals:{...user.stableAnimals}};
 for(const reward of rewards){const {kind,id}=reward,amount=kind==='gem'?Math.round(reward.amount):kind==='footy'?require('./public/currency-format').footy(reward.amount):reward.amount;
  if(kind==='brawlToken'){const creature=require('./public/creature-brawl-catalog').creatures.find(c=>c.id===id);if(!creature)throw Error('Unknown Brawl token.');if(!Number.isSafeInteger(amount)||amount<1||amount>10005)throw Error('Invalid Brawl token amount.');if(!update.creatureBrawl)update.creatureBrawl={...user.creatureBrawl,tokens:require('./creature-token-wallet').wallet(user.creatureBrawl)};const tokens=update.creatureBrawl.tokens;tokens[creature.tokenKey]=(Number(tokens[creature.tokenKey])||0)+amount;}
  else if(kind==='animal'){const animal=require('./public/stable-animals').animals.find(a=>a.id===id);if(!animal)throw Error('Unknown animal.');const field=animal.companion?'rubyItems':'stableAnimals',key=animal.companion?'pet:'+id:id;update[field][key]=reward.rarity==='unique'?1:(Number(update[field][key])||0)+amount;}
  else if(kind==='footy')update.balance=require('./public/currency-format').footy(update.balance+amount);
  else {const field={gem:'gems',boost:'timeBoosts',rubyItem:'rubyItems',amulet:'amulets'}[kind];if(field)update[field][id]=kind==='rubyItem'&&id.startsWith('pet:')&&reward.rarity==='unique'?1:(Number(update[field][id])||0)+amount;}
 }
 return update;
}
function label(reward,catalog){const name=reward.kind==='footy'?'Footy':catalog[reward.kind]?.find(item=>item.id===reward.id)?.name||reward.id;return `${reward.amount} ${name}`;}
function rewardAmulets(user,rewards){const bonus=require('./amulet-utils').effects(user).packtokens||0;return rewards.map(reward=>{if(reward.kind!=='brawlToken'||!bonus)return reward;const amount=reward.amount+bonus;return {...reward,amount,...(reward.label?{label:reward.label.replace(/^\d+\s+/,amount+' ')}:{})};});}
function tokenProgress(user,rewards){
 const catalog=require('./public/creature-brawl-catalog'),wallet=require('./creature-token-wallet').wallet(user.creatureBrawl);
 const owned=require('./creature-brawl-service').reconcile({...user,...apply(user,rewards)}).owned;
 return rewards.map(reward=>{if(reward.kind!=='brawlToken')return reward;const creature=catalog.creatures.find(c=>c.id===reward.id),before=Number(wallet[creature.tokenKey])||0,after=before+reward.amount,grade=owned.find(i=>i.kind===reward.id)?.grade||1;wallet[creature.tokenKey]=after;return {...reward,tokenProgress:{owned:owned.some(i=>i.kind===reward.id),before,after,target:grade<10?grade*5:null,grade,species:creature.tokenKey}};});
}
function openingAmuletRewards(user,random=randomInt){const buffs=require('./amulet-utils').effects(user),rewards=[];if(buffs.pack)rewards.push({kind:'footy',id:'',amount:buffs.pack,label:buffs.pack+' Footy',source:'amulet'});if(buffs.packgem&&random(100)<buffs.packgem)rewards.push({kind:'gem',id:'bronze',amount:1,label:'1 Ruby',source:'amulet'});return rewards;}
function amuletOdds(user,cards){const bonus=require('./amulet-utils').effects(user).packtokens||0;return cards.map(card=>({...card,options:card.options.map(option=>option.kind==='brawlToken'?{...option,min:option.min+bonus,max:option.max+bonus}:option)}));}
module.exports={defaults,validate,draw,apply,label,GEM_NAMES,rewardAmulets,openingAmuletRewards,amuletOdds,tokenProgress};
