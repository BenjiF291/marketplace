const INTERVAL=2*60*60*1000,DURATION=24*60*60*1000;
function profile(u,now=Date.now()){const j=u.vaultJob;return {workers:j?.workers||[],active:!!j&&now<j.started+DURATION,ends:j?j.started+DURATION:0,claimable:j?Math.max(0,Math.min(12,Math.floor((now-j.started)/INTERVAL))-(j.claimed||0)):0};}
function action(u,b,now=Date.now()){
 const state=profile(u,now),balance=Number(u.balance)||0;
 if(b.action==='vault-start'){if(u.villageGridVersion===2&&u.villageLayout?.vault===undefined)throw Error('Place the Footy vault on your island first.');if(state.active)throw Error('The vault already has a worker.');return {balance:balance+state.claimable,vaultJob:{workers:require('./village-workforce').allocate(u,1,now),started:now,claimed:0}};}
 if(!u.vaultJob)throw Error('No vault shift to collect.');
 if(b.action==='vault-recall')return {balance:balance+state.claimable,vaultJob:null};
 if(b.action==='vault-collect'){if(!state.claimable)throw Error('No Footy ready yet.');return {balance:balance+state.claimable,vaultJob:state.active?{...u.vaultJob,claimed:(u.vaultJob.claimed||0)+state.claimable}:null};}
 throw Error('Unknown vault action.');
}
module.exports={profile,action,DURATION};
