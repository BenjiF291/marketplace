const INTERVAL=5*60*1000;
const LIMIT=20;
const SHIFT=INTERVAL*LIMIT;
const UPGRADE_LEVEL=7,UPGRADE_COST=600;
const TIERS=[{tier:0,limit:LIMIT,requiredWorkers:3},{tier:1,limit:25,requiredWorkers:12},{tier:2,limit:35,requiredWorkers:15}];
const UPGRADES=[{level:UPGRADE_LEVEL,cost:UPGRADE_COST,...TIERS[1]},{level:9,cost:800,...TIERS[2]}];
const settings=level=>TIERS[Math.max(0,Math.min(2,Math.trunc(Number(level)||0)))];
const tier=(user,id)=>settings(user.rubyMineTiers?.[id]).tier;
const upgrade=level=>UPGRADES[level]||null;
// Save the mine tier with each shift; legacy shifts retain their original capacity.
const shiftSettings=job=>settings(job?.tier||0);
const shiftDuration=job=>shiftSettings(job).limit*INTERVAL;
module.exports={INTERVAL,LIMIT,SHIFT,UPGRADE_LEVEL,UPGRADE_COST,tier,settings,upgrade,shiftSettings,shiftDuration};
