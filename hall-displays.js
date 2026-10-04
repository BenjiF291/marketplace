const crypto=require('node:crypto');
const {rates}=require('./collectible-rewards');
const PERIOD=6*3600000,DAY=86400000;
function cycle(now,random=Math.random){return {id:crypto.randomUUID(),remaining:Math.round((3+2*(random()+random()))*DAY),elapsed:0,paid:0};}
function resume(c,now){return {...c,startedAt:now,breakAt:now+c.remaining};}
function advance(d,now){if(d.broken)return {display:d,xp:0};const elapsed=d.elapsed+Math.max(0,Math.min(now,d.breakAt)-d.startedAt),paid=Math.floor(elapsed/rates(d.item).period),xp=Math.max(0,paid-d.paid)*rates(d.item).periodic;return {xp,display:{...d,elapsed,paid,remaining:Math.max(0,d.breakAt-now),startedAt:now,broken:now>=d.breakAt}};}
module.exports={PERIOD,DAY,rates,cycle,resume,advance};
