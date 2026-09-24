// Curated designs, not a repeating stat-growth curve. Conditions are checked
// whenever a reward is calculated, using the account's current state.
const SETS = [
 [
  ['fortune','Fortune Dial',{wheel:3}],
  ['unsealer','Unsealer',{pack:12}],
  ['geode','Hidden Geode',{packgem:20}],
  ['lifeline','Pocket Lifeline',{wheel:6},'lowfunds'],
  ['apprentice','Crystal Apprentice',{converter:10}]
 ],[
  ['reclaimer','Reclaimer',{salvage:12}],
  ['dust','Gem Dust',{pigment:1}],
  ['chime','Third Chime',{wheelstreak:12}],
  ['workbench','Small Workbench',{converter:8,pack:8}],
  ['secondwind','Second Wind',{ascend:25},'lowfunds']
 ],[
  ['bargainer','Bargainer',{market:6}],
  ['patron','Independent Patron',{vip:15},'novip'],
  ['bookkeeper','Pack Bookkeeper',{pack:18,gemshop:5}],
  ['duelist','Duelist Purse',{battle:15}],
  ['rainyday','Rainy Day Fund',{salvage:20},'lowfunds']
 ],[
  ['palette','Full Palette',{pigment:2},'diverse'],
  ['kiln','Perfect Kiln',{fullbatch:1}],
  ['prism','Prism Exchange',{converter:10,gemshop:8}],
  ['prospector','Prospector',{packgem:25,salvage:8}],
  ['minimalist','Geode Brush',{pigment:1,packgem:10}]
 ],[
  ['rising','Rising Star',{ascend:40}],
  ['merchant','Merchant Crest',{market:7}],
  ['royal','Royal Weekend',{vipdays:2}],
  ['treasury','Ruby Treasury',{pack:25},'rubystash'],
  ['celebration','Celebration Bell',{wheelstreak:15,ascend:15}]
 ],[
  ['artisan','Artisan Seal',{gemshop:15}],
  ['recycling','Recycling Loop',{salvage:15,converter:10}],
  ['studio','Collectors Studio',{pigment:2,packgem:15}],
  ['garden','Ascension Garden',{ascend:35,pack:15}],
  ['jeweller','Jewellers Circle',{gemshop:15,converter:15},'diverse']
 ],[
  ['timekeeper','Timekeeper',{vipdays:4}],
  ['diplomat','Diplomat',{vip:12,market:5}],
  ['patronage','Royal Patronage',{pack:35},'vip'],
  ['veteran','Veterans Crest',{battle:20,trophybonus:1}],
  ['precision','Precision Tools',{converter:16,fullbatch:1}]
 ],[
  ['laurel','Lightning Laurel',{trophybonus:2}],
  ['storm','Storm Chime',{wheel:5,wheelstreak:12}],
  ['duality','Duel and Discover',{battle:15,packgem:20}],
  ['spark','Ascension Spark',{ascend:45,pigment:1}],
  ['circuit','Complete Circuit',{wheel:8,converter:15},'full']
 ],[
  ['summit','Summit Star',{ascend:50,gemshop:6}],
  ['crown','Collectors Crown',{pack:45,packgem:20}],
  ['unity','Unity Prism',{market:8,pigment:2},'diverse'],
  ['champion','Club Champion',{trophybonus:3,battle:20}],
  ['atelier','Diamond Atelier',{fullbatch:1,pigment:2,converter:10}]
 ]
];
const CONDITIONS={lowfunds:'While your balance is below 100 Footy',diverse:'While at least three different gem tiers are equipped',novip:'While VIP is inactive',vip:'While VIP is active',rubystash:'While holding at least 100 Rubies (not consumed)',full:'While all five amulet slots are occupied'};
function active(condition,user,slots,now=Date.now()) {
 const date=user.vipUntil?.toDate?user.vipUntil.toDate():new Date(user.vipUntil||0);
 switch(condition){
 case 'lowfunds':return Number(user.balance||0)<100;
 case 'diverse':return new Set(slots.map(slot=>slot.gemKey).filter(key=>key&&key!=='trophy-road')).size>=3;
 case 'novip':return date.getTime()<=now;
 case 'vip':return date.getTime()>now;
 case 'rubystash':return Number(user.gems?.bronze||0)>=100;
 case 'full':return slots.length===5;
 default:return !condition;
 }
}
module.exports={SETS,CONDITIONS,active};
