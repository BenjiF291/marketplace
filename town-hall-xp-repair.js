// Translate the pre-tutorial XP curve without granting a level for a rules change.
const OLD=[0,1000,4000,8000,14000,22000,34000,50000,70000,100000];
const CURRENT=[0,200,1000,4000,8000,14000,22000,34000,50000,70000];
function repair(user){
 if(user.townHallXPResetVersion!==1||user.townHallTutorialRepairVersion===1)return {};
 const xp=Math.max(0,Math.floor(Number(user.townHallXP)||0));
 let level=Math.max(1,Math.min(10,Number(user.townHallRetainedLevel)||1));
 while(level<10&&xp>=OLD[level])level++;
 const progress=Math.max(0,xp-OLD[level-1]);
 const fraction=level===10?0:Math.min(1,progress/(OLD[level]-OLD[level-1]));
 const nextXP=CURRENT[level-1]+(level===10?0:Math.floor(fraction*(CURRENT[level]-CURRENT[level-1])));
 return {townHallXP:nextXP,townHallRetainedLevel:level,townHallProgressVersion:3,townHallTutorialRepairVersion:1,townHallTutorialRepairBackup:{xp,retainedLevel:user.townHallRetainedLevel||1}};
}
module.exports={repair};
