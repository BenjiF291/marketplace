// Account-owned progression. Shared-room decoration and presence are separate.
const THRESHOLDS=[0,100,300,650,1150,1850,2850,4200,6000,8500];
const REWARDS={'time bank work':2,'ruby mining':1,'farm gathering':1,'meal cooked':2,'vault work':2,'pet play':1,'house upgrade':5,'farmhouse upgrade':5,wheel:3,pack:5,journey:6,'ranked win':10,'ranked draw':6,'ranked loss':4,'training battle':2,'player battle':6,'market purchase':2,'market sale':3,'card sale':2,ascension:5,conversion:3,compression:2,'dye crafting':1,'dye applied':1,'converter upgrade':8,'compressor built':8,'amulet crafted':4,'amulet slot unlocked':5,'ruby purchase':2,'pet treat':1,'trophy reward':3};
const PROJECTS=[];
const UNLOCKS={2:'Farmhouse, Blacksmith, Ruby emporium, first ruby mine and second house',3:'Pet station, Companion lodge and third house',4:'Time Bank, Tier 2 house upgrades, Colour studio, second ruby mine and fourth house',5:'Better food farmhouse upgrade (50 rubies), Crystal refinery, third ruby mine and fifth house',6:'Extraordinary food farmhouse upgrade (100 rubies), Royal hall and sixth house',7:'Tier 3 house upgrades, fourth ruby mine and seventh house',8:'Eighth villager house',9:'Ninth villager house',10:'Fifth ruby mine and tenth house (maximum)'};
const day=now=>new Date(now).toISOString().slice(0,10);
function profile(user={}){const xp=Math.min(8500,Math.max(0,Math.floor(Number(user.townHallXP)||0)));let level=1;while(level<10&&xp>=THRESHOLDS[level])level++;const base=THRESHOLDS[level-1],next=THRESHOLDS[level]??null;return {road:THRESHOLDS.map((xp,i)=>({level:i+1,xp,unlock:UNLOCKS[i+1]||'Town Hall, first house, job station, Footy vault, archive, marketplace, forge, arena and fortune pavilion'})),xp,level,progress:xp-base,required:next===null?0:next-base,next,unlock:UNLOCKS[level+1]||'Maximum level reached',history:user.townHallHistory||[]};}
function grant(user,amount,activity,now=Date.now()){const xp=profile(user).xp,gain=Math.min(amount,8500-xp);return {townHallXP:xp+gain,townHallHistory:[{activity,amount:gain,at:now},...(user.townHallHistory||[])].slice(0,12)};}
function gameplay(user,activity,now=Date.now(),units=1){
 if(!REWARDS[activity]||!Number.isSafeInteger(units)||units<1)return {};
 const today=day(now),used=user.townHallGameplayDay===today?Number(user.townHallGameplayXP)||0:0;
 const amount=Math.max(0,Math.min(REWARDS[activity]*units,8500-profile(user).xp));if(!amount)return {};
 return {...grant(user,amount,activity,now),townHallGameplayDay:today,townHallGameplayXP:used+amount};
}
function project(){throw Error('Resource-for-XP projects have been retired. Earn XP by playing.');}

module.exports={THRESHOLDS,REWARDS,PROJECTS,UNLOCKS,profile,grant,gameplay,project};
