// Account-owned progression. Shared-room decoration and presence are separate.
const THRESHOLDS=[0,100,300,650,1150,1850,2850,4200,6000,8500];
const REWARDS={wheel:5,pack:12,journey:15,'ranked win':20,'ranked draw':12,'ranked loss':8};
const PROJECTS=[{id:'stonework',name:'Restore the stonework',key:'bronze',kind:'gems',amount:5,xp:20,cost:'5 Rubies'}, {id:'windows',name:'Glaze the stained-glass windows',key:'gold',kind:'gems',amount:2,xp:45,cost:'2 Citrine'}, {id:'supplies',name:'Provision the builders',key:'food',kind:'rubyItems',amount:3,xp:15,cost:'3 Crystal Crunch'}];
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
function project(user,id,now=Date.now()){
 const p=PROJECTS.find(p=>p.id===id);if(!p)throw Error('Choose a community project.');if(profile(user).level===10)throw Error('Your Town Hall is already at maximum level.');
 const today=day(now),used=user.townHallProjectDay===today?Number(user.townHallProjectXP)||0:0;if(used+p.xp>100)throw Error('Project limit reached: up to 100 XP per UTC day.');
 const bag={...(user[p.kind]||{})};if(!(bag[p.key]>=p.amount))throw Error('This project needs '+p.cost+'.');bag[p.key]-=p.amount;
 return {...grant(user,p.xp,p.name,now),[p.kind]:bag,townHallProjectDay:today,townHallProjectXP:used+p.xp};
}
module.exports={THRESHOLDS,REWARDS,PROJECTS,UNLOCKS,profile,grant,gameplay,project};
