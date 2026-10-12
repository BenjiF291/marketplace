/* Shared, displayable balance. The server imports the same catalogue and validates every action. */
(function(root){
 const C={version:1,initial:{timber:130,stone:90,provisions:100,notes:0},levelCap:6,
 xp:{rescue:8,habitat:3,building:4,bond:10,research:6,exploration:4},
 creatures:{
 aeri:{name:'Aeri',species:'Skywing',rider:'Lysa',motion:'fly',color:'#68b7bb',role:'Aerial searches and remote locations',rate:1.1,capacity:18,training:1,rescueAfter:0,rescueCost:{},rescueSeconds:0},
 kael:{name:'Kael',species:'Veyrin',rider:'Elara',motion:'ground',color:'#d4bd8f',role:'Difficult terrain and pressure-related obstacles',rate:1,capacity:22,training:1.1,rescueAfter:1,rescueCost:{timber:25,provisions:20},rescueSeconds:90},
 virex:{name:'Virex',species:'Ground predator',rider:'Corvin',motion:'ground',color:'#668977',role:'Precise scouting and controlled missions',rate:1.4,capacity:16,training:.9,rescueAfter:2,rescueCost:{timber:35,provisions:25},rescueSeconds:120},
 brakk:{name:'Brakk',species:'Ground predator',rider:'Garrin',motion:'ground',color:'#a27960',role:'Heavy recovery and demanding ground assignments',rate:.85,capacity:32,training:1.3,rescueAfter:3,rescueCost:{timber:45,provisions:30},rescueSeconds:150},
 saelis:{name:'Saelis',species:'Winged three-tailed steed',rider:'Neriah',motion:'glide',color:'#a8b6d2',role:'Forest exploration and natural materials',rate:1.15,capacity:24,training:1.1,rescueAfter:4,rescueCost:{timber:55,provisions:35},rescueSeconds:180}
 },
 habitats:[{id:'roost1',kind:'roost',x:765,y:350,after:0,cost:{timber:20,stone:10}},{id:'den1',kind:'den',x:410,y:435,after:1,cost:{timber:35,stone:20}},{id:'den2',kind:'den',x:600,y:330,after:2,cost:{timber:45,stone:25}},{id:'den3',kind:'den',x:725,y:485,after:3,cost:{timber:55,stone:30}},{id:'roost2',kind:'roost',x:865,y:490,after:4,cost:{timber:65,stone:40}}],
 buildings:{stables:{name:'Main Stables',x:420,y:350},rescue:{name:'Rescue Station',x:895,y:350},arena:{name:'Training Arena',x:540,y:400,cost:{timber:40,stone:20}},lab:{name:"Mira’s Laboratory",x:650,y:245,cost:{timber:30,stone:20}},academy:{name:'Academy Hall',x:550,y:245},portal:{name:'Return to Fishy',x:930,y:585}},
 researches:{capacity:{name:'Trail panniers',description:'Every creature carries 8 more resources.',cost:{notes:2,timber:20},seconds:30},stables:{name:'Loft conversion',description:'Two additional storage spaces.',cost:{notes:4,timber:25},seconds:60},training:{name:'Gentle conditioning',description:'Training takes 25% less time.',cost:{notes:6,provisions:30},seconds:75},rescue:{name:'Signal beacons',description:'Rescue searches take 30% less time.',cost:{notes:6,stone:30},seconds:75}},
 destinations:{woodland:{name:'Woodland edges',description:'Follow old boundary trails and bring back natural supplies.',level:2,seconds:45,cost:{provisions:6},rewards:{timber:24,provisions:12,notes:4},specialist:'saelis'},pass:{name:'Mountain passes',description:'Read the wind and recover supplies from the broken high road.',level:3,seconds:90,cost:{provisions:10},rewards:{stone:35,timber:12,notes:6},specialist:'kael'},outpost:{name:'Abandoned outposts',description:'Scout a quiet watchpost, then recover its heavy field equipment.',level:3,seconds:100,cost:{provisions:10},rewards:{stone:28,timber:28,notes:6},specialist:'brakk',scout:'virex'},islets:{name:'Beyond the sea stacks',description:'A remote route for wings or a controlled glide, with sheltered places to land.',level:3,air:true,seconds:110,cost:{provisions:12},rewards:{timber:30,provisions:20,notes:8},specialist:'aeri'}},
 gatherSeconds:25,bondSeconds:40,bondCost:{provisions:20,timber:10},riderCost:{provisions:10},trainingCost:level=>({provisions:12*level,stone:4*level}),trainingSeconds:(level,c)=>Math.round(25*level*c.training),stableCost:extra=>({timber:20+extra*10,stone:10})
 };
 C.balance={capacityPerLevel:4,ratePerLevel:.15,capacityResearch:8,stableResearch:2,trainingResearch:.75,rescueResearch:.7,specialty:1.25,scoutDuration:.8};
 C.storageCapacity=s=>1+s.extraStorage+(s.research.stables?C.balance.stableResearch:0);
 C.stats=(s,id)=>{const c=s.creatures[id],d=C.creatures[id];return {capacity:d.capacity+(c.level-1)*C.balance.capacityPerLevel+(s.research.capacity?C.balance.capacityResearch:0),rate:d.rate*(1+(c.level-1)*C.balance.ratePerLevel)};};
 C.gatherDuration=(s,id)=>Math.round(C.gatherSeconds/C.stats(s,id).rate);
 C.trainingDuration=(s,id)=>Math.ceil(C.trainingSeconds(s.creatures[id].level,C.creatures[id])*(s.research.training?C.balance.trainingResearch:1));
 C.rescueDuration=(s,id)=>Math.ceil(C.creatures[id].rescueSeconds*(s.research.rescue?C.balance.rescueResearch:1));
 C.exploreDuration=(id,destination)=>Math.round(C.destinations[destination].seconds*(C.destinations[destination].scout===id?C.balance.scoutDuration:1));
 C.exploreRewards=(id,destination)=>Object.fromEntries(Object.entries(C.destinations[destination].rewards).map(([key,value])=>[key,C.destinations[destination].specialist===id?Math.ceil(value*C.balance.specialty):value]));
 if(typeof module!=='undefined')module.exports=C;else root.ValemereConfig=C;
})(typeof window==='undefined'?globalThis:window);
