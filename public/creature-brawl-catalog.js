/* Valemere battle-design proposals. Species biology/lore is not inferred from rider powers. */
(function(root){
 const VERSION='creature-brawl-kael-shadow-v4';
 const damage=(power=1,extra={})=>({type:'damage',power,...extra});
 const status=(type,duration=2,magnitude=.2,target)=>({type:'status',status:type,duration,magnitude,...(target?{target}:{})});
 const move=(id,name,cost,target,effects,description)=>({id,name,cost,target,effects,description});
 const basic=name=>move('basic',name,0,'enemy',[damage()],'Strike one enemy. Free; always usable while Bound.');
 const identities=[["fox", "Ember Fox", "fox", "Swift", "Nimble Bite", "feint", "rally"], ["snail", "Crystal Snail", "snail", "Protector", "Shell Bump", "guard", "taunt"], ["dragon", "Pocket Dragon", "dragon", "Furious", "Claw Strike", "embers", "sweep"], ["rill", "Aeri", "rill", "Swift", "Talon Strike", "gust", "slipstream"], ["rill-species", "Rill", "rill", "Swift", "Talon Jab", "double", "lift"], ["brugar", "Brakk", "brugar", "Protector", "Club-tail Sweep", "brace", "challenge"], ["brugar-species", "Brugar", "brugar", "Protector", "Twin-tail Swipe", "bulwark", "crush"], ["krynn", "Virex", "krynn", "Cunning", "Shadow Claw", "snare", "expose"], ["krynn-species", "Krynn", "krynn", "Cunning", "Raking Claw", "shred", "silence"], ["fenra", "Saelis", "fenra", "Cunning", "Hoof Strike", "restore", "clarity"], ["fenra-species", "Fenra", "fenra", "Cunning", "Crest Strike", "mend", "pulse"], ["veyrin", "Kael", "veyrin", "Cunning", "Dusk Fang", "umbral-mark", "nightfall"], ["tharos", "Tharos", "veyrin", "Furious", "Horned Strike", "rush", "sweep"], ["talren", "Talren", "talren", "Furious", "Horn Strike", "charge", "break"], ["northern-talren", "Northern Talren", "northern-talren", "Protector", "Resolute Strike", "guard", "stand"], ["defender-talren", "Defender Talren", "defender-talren", "Protector", "Armoured Strike", "wall", "check"], ["defender-rill", "Defender Rill", "defender-rill", "Swift", "Guarding Talons", "screen", "dive"], ["kanji", "Kanji", "kanji", "Swift", "Saber Bite", "feather-rush", "wing-guard"], ["trusk", "Trusk", "trusk", "Protector", "Heavy Swipe", "scale-guard", "armoured-rush"], ["velkris", "Velkris", "velkris", "Cunning", "Fang Snap", "tail-strike", "carapace-guard"]];
 // Class baselines. Server definitions apply modest rarity bonuses before grade scaling.
 // Individual class-shaped identities: HP, attack, defence, speed, special multiplier.
 const statProfiles={
  fox:[840,270,55,123,1],snail:[1320,205,120,74,1],dragon:[960,300,62,105,1],
  rill:[910,260,64,119,1],'rill-species':[1040,238,77,108,1],
  brugar:[1420,220,108,78,1],'brugar-species':[1480,240,92,70,1],
  krynn:[920,282,62,110,1.05],'krynn-species':[1050,258,80,100,1.05],
  fenra:[1010,242,74,112,1.05],'fenra-species':[1100,232,83,106,1.05],
  veyrin:[1060,262,78,104,1.08],tharos:[1190,280,82,82,1],talren:[1080,282,65,100,1],
  'northern-talren':[1250,228,104,88,1],'defender-talren':[1180,295,90,84,1],
  'defender-rill':[1120,245,88,98,1],kanji:[1020,275,68,102,1],
  trusk:[1210,285,88,80,1],velkris:[980,272,82,96,1.05]
 };
 const classMoves={
  Swift:id=>move(id,'Disarming Strike',2,'enemy',[damage(1.2),status('atkDown',2,.2)],'Strike at 120% power. Lower enemy attack 20% for 2 of its turns.'),
  Cunning:id=>move(id,'Expose Guard',2,'enemy',[damage(1.1),status('defDown',2,.25)],'Strike at 110% power. Lower enemy defence 25% for 2 of its turns.'),
  Furious:id=>move(id,'Battle Cry',2,'enemy',[damage(1.1),status('atkUp',2,.2,'self')],'Strike at 110% power. Raise own attack 20% for 2 future turns.'),
  Protector:id=>move(id,'Restoring Guard',3,'allies',[{type:'heal',ratio:.12},status('defUp',2,.2,'self')],'Heal each ally 12% max HP. Raise own defence 20% for 2 future turns.')
 };
 const ultimate={
  fox:()=>[3,'Woodland Rally','allies',[status('spdUp',2,.2),status('atkUp',2,.15)],'Raise team speed 20% and attack 15% for 2 turns.'],
  snail:()=>[3,'Steadfast Shell','self',[{type:'shield',ratio:.22},status('taunt',2)],'Shield self for 22% max HP and draw single-target attacks for 2 future turns.'],
  dragon:()=>[4,'Ember Storm','enemies',[damage(.85),status('burn',2)],'Strike all enemies at 85% power. Burn each for 5% max HP on its next 2 turns.'],
  rill:()=>[3,'Slipstream','allies',[status('spdUp',2,.25)],'Raise team speed 25% for 2 turns.'],
  'rill-species':()=>[3,'Uplifting Call','ally',[{type:'heal',ratio:.2},{type:'cleanse'},{type:'shield',ratio:.1}],'Heal one ally 20%, shield it for 10% max HP, and remove one debuff.'],
  brugar:()=>[3,'Bedrock Challenge','self',[status('taunt',2),status('defUp',2,.3),{type:'shield',ratio:.15}],'Draw single-target attacks, raise defence 30%, and shield self 15% for 2 future turns.'],
  'brugar-species':()=>[4,'Grounded Crush','enemy',[damage(2.15,{ignoreDef:.3})],'Strike one enemy at 215% power, ignoring 30% defence.'],
  krynn:()=>[4,'Expose Weakness','enemies',[damage(.8),status('defDown',2,.25)],'Strike all enemies at 80% power and lower defence 25% for 2 turns.'],
  'krynn-species':()=>[4,'Disrupting Roar','enemies',[damage(.75),status('atkDown',2,.2)],'Strike all enemies at 75% power and lower attack 20% for 2 turns.'],
  fenra:()=>[4,'Clear Resolve','allies',[{type:'cleanse'},{type:'heal',ratio:.15},status('atkUp',2,.15)],'Remove one debuff per ally, heal each 15% max HP, and raise attack 15% for 2 turns.'],
  'fenra-species':()=>[4,'Crest Pulse','enemies',[damage(.8),{type:'heal',ratio:.1,target:'allies'}],'Strike all enemies at 80% power and heal every ally 10% max HP.'],
  veyrin:()=>[4,'Nightfall','enemies',[damage(.65),status('atkDown',2,.2),status('spdDown',2,.2)],'Unleash a wave of shadow over all enemies: deal 65% damage and reduce their attack and speed by 20% for 2 of their turns. Weakens enemy retaliation and gives your team more room to act.'],
  tharos:()=>[4,'Thunderous Sweep','enemies',[damage(1.1)],'Strike all enemies at 110% power.'],
  talren:()=>[4,'Breaking Bellow','enemies',[damage(.8),status('defDown',2,.25)],'Strike all enemies at 80% power and lower defence 25% for 2 turns.'],
  'northern-talren':()=>[3,'Unbroken Stand','self',[status('taunt',2),{type:'heal',ratio:.2}],'Heal self 20% max HP and draw single-target attacks for 2 future turns.'],
  'defender-talren':()=>[3,'Shield Check','enemy',[damage(1.15),status('stun',1)],'Strike at 115% power and skip the target\'s next turn. Recovery prevents immediate repeat stuns.'],
  'defender-rill':()=>[4,'Swooping Assault','enemies',[damage(.95),status('spdDown',2,.2)],'Strike all enemies at 95% power and lower speed 20% for 2 turns.'],
  kanji:()=>[3,'Wing Guard','allies',[{type:'shield',ratio:.18},status('defUp',2,.15)],'Shield each ally for 18% max HP and raise defence 15% for 2 turns.'],
  trusk:()=>[3,'Armoured Rush','enemy',[damage(1.7,{ignoreDef:.25}),status('defUp',2,.2,'self')],'Strike at 170% power, ignoring 25% defence. Raise own defence 20% for 2 future turns.'],
  velkris:()=>[3,'Venomous Sting','enemy',[damage(.85),status('burn',2),status('bind',1)],'Strike at 85% power. Venom deals 5% max HP on the next 2 turns; Bind blocks specials for 1 turn.']
 };
 const roster=identities.map(([id,name,species,role,basicName,secondId,thirdId])=>{
  const [hp,atk,def,spd,specialPower]=statProfiles[id],base={hp,atk,def,spd,specialPower};
  const [cost,title,target,effects,description]=ultimate[id]();
  return [id,name,species,role,base.hp,base.atk,base.def,base.spd,base.specialPower,basicName,classMoves[role](secondId),move(thirdId,title,cost,target,effects,description)];
 });
 const animals=typeof module!=='undefined'?require('./stable-animals').animals:root.StableAnimals.animals;
 const creatures=roster.map(([id,name,species,role,hp,atk,def,spd,specialPower,basicName,second,third])=>({id,name,species,tokenKey:({'rill':'aeri','brugar':'brakk','krynn':'virex','fenra':'saelis','veyrin':'kael','tharos':'tharos'})[id]||species,role,base:{hp,atk,def,spd,specialPower},size:['tharos','veyrin','brugar','brugar-species','defender-talren','trusk'].includes(id)?'large':'normal',poster:animals.find(a=>a.id===id).poster,moves:[basic(basicName),second,third],requirement:'Own this creature through packs or the existing creature/companion unlocks.'}));
 const config={apCap:5,surgeAt:24,drawAt:80,ratingWin:20,ratingLoss:10,winFooty:20,paidWinsPerDay:10,arenas:[0,100,250,500,900],difficulties:[{id:'gentle',name:'Gentle',scale:.92},{id:'balanced',name:'Balanced',scale:1},{id:'challenging',name:'Challenging',scale:1.08}]};
 const api={VERSION,creatures,config};if(typeof module!=='undefined')module.exports=api;else root.CreatureBrawlCatalog=api;
})(typeof window==='undefined'?globalThis:window);
