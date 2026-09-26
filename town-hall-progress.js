// Account-owned progression. Shared-room decoration and presence are separate.
const THRESHOLDS=[0,100,300,650,1150,1850,2850,4200,6000,8500];
const REWARDS={wheel:3,pack:5,journey:6,'ranked win':10,'ranked draw':6,'ranked loss':4,'training battle':2,'player battle':6,'market purchase':2,'market sale':3,'card sale':2,ascension:5,conversion:3,compression:2,'dye crafting':1,'dye applied':1,'converter upgrade':8,'compressor built':8,'amulet crafted':4,'amulet slot unlocked':5,'ruby purchase':2,'pet treat':1,'trophy reward':3,'collectible display':3};
const PROJECTS=[];
const UNLOCKS={2:'Blacksmith and Ruby emporium',3:'Companion lodge',4:'Colour studio',5:'Crystal refinery',6:'Royal hall',7:'Town Hall prestige VII',8:'Town Hall prestige VIII',9:'Town Hall prestige IX',10:'Town Hall mastery'};
const day=now=>new Date(now).toISOString().slice(0,10);
function profile(user={}){const xp=Math.min(8500,Math.max(0,Math.floor(Number(user.townHallXP)||0)));let level=1;while(level<10&&xp>=THRESHOLDS[level])level++;const base=THRESHOLDS[level-1],next=THRESHOLDS[level]??null;return {xp,level,progress:xp-base,required:next===null?0:next-base,next,unlock:UNLOCKS[level+1]||'Maximum level reached',history:user.townHallHistory||[]};}
function grant(user,amount,activity,now=Date.now()){const xp=profile(user).xp,gain=Math.min(amount,8500-xp);return {townHallXP:xp+gain,townHallHistory:[{activity,amount:gain,at:now},...(user.townHallHistory||[])].slice(0,12)};}
function gameplay(user,activity,now=Date.now()){
 if(user.isAdmin!==true||!REWARDS[activity])return {}; // Private preview until public release.
 const today=day(now),used=user.townHallGameplayDay===today?Number(user.townHallGameplayXP)||0:0;
 const amount=Math.max(0,Math.min(REWARDS[activity],100-used,8500-profile(user).xp));if(!amount)return {};
 return {...grant(user,amount,activity,now),townHallGameplayDay:today,townHallGameplayXP:used+amount};
}
function project(){throw Error('Resource-for-XP projects have been retired. Earn XP by playing.');}

module.exports={THRESHOLDS,REWARDS,PROJECTS,UNLOCKS,profile,grant,gameplay,project};
