const rules=require('./free-pack');
function validate(body,catalog){
 const appearance={base:body.color||'#667eea',accent:body.color||'#667eea',trim:'#ffe1a0',...body.appearance};
 const cards=body.rewardCards||[];
 if(!Array.isArray(cards))throw Error('Invalid reward cards.');
 if(Array.isArray(body.cardIds)&&!body.cardIds.length&&!cards.length)throw Error('Add at least one collection card or extra reward.');
 const config=rules.validate({name:body.name,enabled:true,cooldownHours:7,appearance,cards:cards.length?cards:[{title:'Placeholder',options:[{kind:'footy',id:'',min:1,max:1,chance:100}]}]},catalog);
 // Leave room for the original guaranteed collection card and transaction metadata.
 const count=cards.reduce((n,c)=>n+Math.max(...c.options.map(o=>['card','pack'].includes(o.kind)?o.max:0)),0);
 if(count>390)throw Error('Use at most 390 additional inventory items per opening.');
 const shop=body.shop||{enabled:false,price:10,currency:'footy'};
 if(typeof shop.enabled!=='boolean'||!Number.isFinite(shop.price)||shop.price<0.01||shop.price>100000000||(!Number.isSafeInteger(shop.price)&&shop.currency!=='footy')||!['footy',...Object.keys(rules.GEM_NAMES)].includes(shop.currency))throw Error('Set a positive shop price and available currency.');
 return {appearance:config.appearance,rewardCards:cards.length?config.cards:[],shop:{enabled:shop.enabled,price:shop.currency==='footy'?Math.round(shop.price*100)/100:shop.price,currency:shop.currency}};
}
function draw(pack,catalog){return pack.rewardCards?.length?rules.draw({cards:pack.rewardCards}).map(r=>{const item=catalog[r.kind]?.find(i=>i.id===r.id);return {...r,label:rules.label(r,catalog),...(item?.rarity?{rarity:item.rarity}:{}),...(item?.gemKey?{gemKey:item.gemKey}:{}),...(r.kind==='pack'?{packName:item?.name||r.id,packColor:item?.color||'#667eea',appearance:item?.appearance||null}:{})};}):[];}
const hasRewards=pack=>!!(pack&&(pack.cardIds?.length||pack.rewardCards?.length));
module.exports={validate,draw,hasRewards};
