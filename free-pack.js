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
 if(!Array.isArray(value.cards)||value.cards.length!==5)throw Error('The pack needs exactly five cards.');
 const cards=value.cards.map((card,index)=>{
  if(typeof card.title!=='string'||!card.title.trim()||card.title.length>80||!Array.isArray(card.options)||!card.options.length||card.options.length>50)throw Error(`Card ${index+1} needs a title and 1?50 reward options.`);
  let sum=0;const options=card.options.map(option=>{
   const {kind,id,min,max,chance}=option;
   if(!['gem','footy','boost','rubyItem','amulet','pack','card'].includes(kind))throw Error('Unknown reward type.');
   if(!Number.isInteger(min)||!Number.isInteger(max)||min<1||max<min||max>10000||(['pack','card'].includes(kind)&&max>20))throw Error('Use whole amounts from 1 to 10000 (up to 20 for cards/packs).');
   if(!Number.isFinite(chance)||chance<0||chance>100)throw Error('Chances must be between 0 and 100 percent.');
   if(kind!=='footy'&&!catalog[kind]?.some(entry=>entry.id===id))throw Error(`Choose an available ${kind} reward.`);
   sum+=chance;return {kind,id:kind==='footy'?'':id,min,max,chance};
  });
  if(Math.abs(sum-100)>.000001)throw Error(`Card ${index+1} chances must total 100% (currently ${sum}%).`);
  return {title:card.title.trim(),options};
 });
 return {name:value.name.trim(),enabled:value.enabled,cooldownHours:value.cooldownHours,cards};
}
function draw(config,random=randomInt){return config.cards.map((card,index)=>{
 const roll=random(1000000)/10000;let sum=0,selected;
 for(const option of card.options){sum+=option.chance;if(roll<sum){selected=option;break;}}
 if(!selected)selected=card.options.filter(o=>o.chance>0).at(-1);
 return {card:index+1,title:card.title,kind:selected.kind,id:selected.id,amount:selected.min+random(selected.max-selected.min+1)};
});}
function apply(user,rewards){
 const update={gems:require('./gem-wallet').wallet(user.gems),balance:Number(user.balance)||0,timeBoosts:{...user.timeBoosts},rubyItems:{...user.rubyItems},amulets:{...user.amulets}};
 for(const reward of rewards){const {kind,id,amount}=reward;
  if(kind==='footy')update.balance=Math.round((update.balance+amount)*100)/100;
  else {const field={gem:'gems',boost:'timeBoosts',rubyItem:'rubyItems',amulet:'amulets'}[kind];if(field)update[field][id]=(Number(update[field][id])||0)+amount;}
 }
 return update;
}
function label(reward,catalog){const name=reward.kind==='footy'?'Footy':catalog[reward.kind]?.find(item=>item.id===reward.id)?.name||reward.id;return `${reward.amount} ${name}`;}
module.exports={defaults,validate,draw,apply,label,GEM_NAMES};
