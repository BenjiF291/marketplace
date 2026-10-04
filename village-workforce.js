const {SHIFT:MINE_SHIFT}=require('./ruby-mine-rules');
const layout=require('./public/village-layout'),{randomInt}=require('node:crypto');
function residents(u){return Object.entries(layout.profile(u).houseTiers).flatMap(([house,tier])=>Array.from({length:[0,3,5,10][tier]},(_,i)=>`${house}/${i}`));}
function assigned(job,all){if(!job)return [];return Array.isArray(job.workers)?job.workers:job.worker?[job.worker]:all.filter(id=>id.startsWith(job.house+'/'));}
function profile(u,now=Date.now()){
 const all=residents(u),busy=new Set();
 const jobs=[...Object.values(u.rubyMineShifts||{}).filter(j=>now<j.started+MINE_SHIFT),...Object.values(u.farmJobs||{}).filter(j=>now<j.ends),...require('./pet-stations').stations(u),...(u.timeBank?[u.timeBank]:[]),...(u.vaultJob&&now<u.vaultJob.started+86400000?[u.vaultJob]:[])];
 for(const job of jobs)for(const id of assigned(job,all))if(all.includes(id))busy.add(id);
 return {total:all.length,available:all.filter(id=>!busy.has(id)),busy:[...busy]};
}
function allocate(u,count,now){const free=profile(u,now).available;if(free.length<count)throw Error(`You need ${count} available villagers.`);const selected=[];while(selected.length<count)selected.push(free.splice(randomInt(free.length),1)[0]);return selected;}
module.exports={residents,assigned,profile,allocate};
