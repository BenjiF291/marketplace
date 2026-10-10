// Account-owned progression. Shared-room decoration and presence are separate.
const LEGACY_THRESHOLDS=[0,100,300,650,1150,1850,2850,4200,6000,8500];
const PREVIOUS_THRESHOLDS=LEGACY_THRESHOLDS.map(x=>x*12);
const THRESHOLDS=[0,200,1000,4000,8000,14000,22000,34000,50000,70000];
const MAX_XP=THRESHOLDS.at(-1);
function retainedLevel(user){const floor=Math.max(1,Math.min(10,user.townHallRetainedLevel||1));if(user.townHallProgressVersion===3)return floor;const thresholds=user.townHallProgressVersion===2?PREVIOUS_THRESHOLDS:LEGACY_THRESHOLDS;let level=1;while(level<10&&(Number(user.townHallXP)||0)>=thresholds[level])level++;return Math.max(level,floor);}

const REWARDS={'time bank work':2,'ruby mining':1,'farm gathering':1,'meal cooked':2,'vault work':2,'pet play':1,'house upgrade':5,'farmhouse upgrade':5,wheel:3,pack:5,journey:6,'ranked win':10,'ranked draw':6,'ranked loss':4,'training battle':2,'player battle':6,'market purchase':2,'market sale':3,'card sale':2,ascension:5,conversion:3,compression:2,'dye crafting':1,'dye applied':1,'converter upgrade':8,'refinery upgrade':8,'amulet crafted':4,'amulet slot unlocked':5,'ruby purchase':2,'pet treat':1,'trophy reward':3};
const PROJECTS=[];
const UNLOCKS={2:'Farmhouse, Blacksmith, Ruby emporium, first ruby mine and second house',3:'Pet station, Companion lodge and third house',4:'Time Bank, Tier 2 house upgrades, Colour studio, second ruby mine and fourth house',5:'Better food farmhouse upgrade (50 rubies), Crystal refinery, third ruby mine and fifth house',6:'Extraordinary food farmhouse upgrade (100 rubies), Royal hall and sixth house',7:'Tier 3 house upgrades, fourth ruby mine and seventh house',8:'Eighth villager house',9:'Ninth villager house',10:'Fifth ruby mine and tenth house (maximum)'};
const day=now=>new Date(now).toISOString().slice(0,10);
function profile(user={}){const xp=Math.min(MAX_XP,Math.max(0,Math.floor(Number(user.townHallXP)||0)));let level=1;while(level<10&&xp>=THRESHOLDS[level])level++;level=Math.max(level,retainedLevel(user));const base=THRESHOLDS[level-1],next=THRESHOLDS[level]??null;return {road:THRESHOLDS.map((xp,i)=>({level:i+1,xp,unlock:UNLOCKS[i+1]||'Town Hall, first house, job station, Footy vault, archive, marketplace, forge, arena and fortune pavilion'})),xp,level,progress:Math.max(0,xp-base),required:next===null?0:next-Math.min(base,xp),next,unlock:UNLOCKS[level+1]||'Maximum level reached',history:user.townHallHistory||[]};}
function grant(user,amount,activity,now=Date.now()){const xp=profile(user).xp,gain=Math.min(amount,MAX_XP-xp);return {townHallProgressVersion:3,townHallRetainedLevel:retainedLevel(user),townHallXP:xp+gain,townHallHistory:[{activity,amount:gain,at:now},...(user.townHallHistory||[])].slice(0,12)};}
function gameplay(user,activity,now=Date.now(),units=1){
 if(!REWARDS[activity]||!Number.isSafeInteger(units)||units<1)return {};
 const advancement=require('./advancements').record(user,activity,units,now);
 const today=day(now),used=user.townHallGameplayDay===today?Number(user.townHallGameplayXP)||0:0;
 const amount=Math.max(0,Math.min(REWARDS[activity]*units,MAX_XP-profile(user).xp));if(!amount)return advancement;
 return {...advancement,...grant(user,amount,activity,now),townHallGameplayDay:today,townHallGameplayXP:used+amount};
}
function resetToLevelStart(user){
 if(user.townHallXPResetVersion===1)return {};
 const level=profile(user).level;
 return {townHallXP:THRESHOLDS[level-1],townHallRetainedLevel:level,townHallProgressVersion:3,townHallXPResetVersion:1,townHallHistory:[]};
}
function project(){throw Error('Resource-for-XP projects have been retired. Earn XP by playing.');}

module.exports={MAX_XP,THRESHOLDS,REWARDS,PROJECTS,UNLOCKS,profile,grant,gameplay,project,resetToLevelStart};
