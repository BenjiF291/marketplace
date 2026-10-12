const C=require('./public/valemere-config');
const clone=x=>structuredClone(x);
function initial(){return {version:1,revision:0,resources:{...C.initial},creatures:{},characters:{},habitats:{},buildings:{stables:true,rescue:true,academy:true},research:{},extraStorage:0,expeditions:0,jobs:{starter:{id:'starter',type:'rescue',creature:'aeri',endsAt:0}},milestones:{},receipts:[],report:null};}
const capacity=C.storageCapacity;
const stored=s=>Object.values(s.creatures).filter(c=>!c.habitat).length;
const busy=(s,id)=>Object.values(s.jobs).some(j=>j.creature===id);
const stats=C.stats;
function apply(input,b,now=Date.now(),dev=false){
 const s=clone(input);let xp=0;
 if(b.creature!==undefined&&b.creature!=='mira'&&!Object.hasOwn(C.creatures,b.creature))throw Error('Unknown creature.');
 if(typeof b.requestId!=='string'||!/^[a-zA-Z0-9_-]{12,80}$/.test(b.requestId))throw Error('Please retry this action.');
 if(s.receipts.includes(b.requestId))return {state:s,xp:0,duplicate:true};
 if(b.revision!==s.revision)throw Error('Your settlement changed in another view. Refresh and try again.');
 const need=(condition,message)=>{if(!condition)throw Error(message);};
 const spend=cost=>{for(const [k,v] of Object.entries(cost))need(s.resources[k]>=v,`Need ${v} ${k}. Gather supplies from an active habitat.`);for(const [k,v] of Object.entries(cost))s.resources[k]-=v;};
 const milestone=(key,kind)=>{if(!s.milestones[key]){s.milestones[key]=now;xp+=C.xp[kind];}};
 const creature=()=>{const c=s.creatures[b.creature];need(c,'Rescue this creature first.');return c;};
 const active=()=>{const c=creature();need(c.habitat,'Assign an active habitat first.');need(!busy(s,b.creature),'This creature is already busy. Collect its completed activity first.');return c;};
 const job=(type,seconds,extra={})=>{const id=b.requestId;s.jobs[id]={id,type,startedAt:now,endsAt:now+seconds*1000,...extra};};
 switch(b.action){
 case 'build':{
 const h=C.habitats.find(x=>x.id===b.target),building=C.buildings[b.target];need(h||building?.cost,'Choose a build spot.');
 if(h){need(!s.habitats[h.id],'Already built.');need(s.expeditions>=h.after,`Complete ${h.after} explorations first.`);spend(h.cost);s.habitats[h.id]=true;milestone('habitat:'+h.id,'habitat');}
 else{need(!s.buildings[b.target],'Already built.');spend(building.cost);s.buildings[b.target]=true;milestone('building:'+b.target,'building');}break;}
 case 'expand':need(capacity(s)<5,'The stables can already hold the entire collection.');spend(C.stableCost(s.extraStorage));s.extraStorage++;break;
 case 'assign':{const c=creature();need(!busy(s,b.creature),'Collect this creature’s activity before moving it.');if(b.target===null){need(stored(s)<capacity(s),'Storage is full. Expand the stables or assign another creature.');c.habitat=null;break;}
 const h=C.habitats.find(x=>x.id===b.target);need(h&&s.habitats[h.id],'Build this habitat first.');need((C.creatures[b.creature].motion==='ground'?'den':'roost')===h.kind,'This creature needs a '+(C.creatures[b.creature].motion==='ground'?'ground den.':'roost.'));need(!Object.values(s.creatures).some(other=>other.habitat===h.id),'This habitat is occupied.');c.habitat=h.id;break;}
 case 'gather':{active();need(['timber','stone','provisions'].includes(b.resource),'Choose a gathering resource.');const stat=stats(s,b.creature);job('gather',C.gatherDuration(s,b.creature),{creature:b.creature,resource:b.resource,amount:stat.capacity});break;}
 case 'train':{const c=active();need(s.buildings.arena,'Build the Training Arena.');need(c.level<C.levelCap,'Maximum training level reached.');spend(C.trainingCost(c.level));job('train',C.trainingDuration(s,b.creature),{creature:b.creature});break;}
 case 'character':{if(b.creature==='mira'){need(!s.characters.mira,'Mira is already here.');need(s.expeditions>=1,'Complete your first exploration.');spend({notes:2});s.characters.mira=true;}else{const c=creature();need(c.level>=2,'Train this creature to level 2.');need(!s.characters[b.creature],'This rider is already here.');spend(C.riderCost);s.characters[b.creature]=true;}break;}
 case 'bond':{const c=active();need(c.level>=2&&s.characters[b.creature],'Requires training level 2 and the correct rider.');need(!c.bonded,'Already bonded.');spend(C.bondCost);job('bond',C.bondSeconds,{creature:b.creature});break;}
 case 'explore':{const c=active(),dest=C.destinations[b.target];need(c.bonded,'Activate this creature’s partnership first.');need(dest&&c.level>=dest.level,'Train further before attempting this destination.');need(!dest.air||C.creatures[b.creature].motion!=='ground','This route requires wings or gliding.');spend(dest.cost);const rewards=C.exploreRewards(b.creature,b.target);job('explore',C.exploreDuration(b.creature,b.target),{creature:b.creature,target:b.target,rewards});break;}
 case 'rescue':{const def=C.creatures[b.creature];need(def&&!s.creatures[b.creature],'This unique creature is already rescued or unavailable.');need(!Object.values(s.jobs).some(j=>j.type==='rescue'),'A rescue operation is already underway.');need(s.expeditions>=def.rescueAfter,`Complete ${def.rescueAfter} explorations first.`);need(stored(s)<capacity(s),'Make room in the stables before starting a rescue.');spend(def.rescueCost);job('rescue',C.rescueDuration(s,b.creature),{creature:b.creature});break;}
 case 'research':{const r=C.researches[b.target];need(s.buildings.lab&&s.characters.mira,'Build the laboratory and invite Mira.');need(r&&!s.research[b.target],'Research unavailable or already completed.');need(!Object.values(s.jobs).some(j=>j.type==='research'),'Mira is already researching.');spend(r.cost);job('research',r.seconds,{target:b.target});break;}
 case 'claim':{const j=s.jobs[b.job];need(j,'This activity was already collected.');need(now>=j.endsAt,'This activity is still underway.');
 const reward={};if(j.type==='rescue'){need(stored(s)<capacity(s),'Rescue is safe and waiting. Expand storage or move a stored creature to a habitat.');need(!s.creatures[j.creature],'Already rescued.');s.creatures[j.creature]={level:1,habitat:null,bonded:false};milestone('rescue:'+j.creature,'rescue');}
 if(j.type==='gather')reward[j.resource]=j.amount;
 if(j.type==='train')s.creatures[j.creature].level++;
 if(j.type==='bond'){s.creatures[j.creature].bonded=true;milestone('bond:'+j.creature,'bond');}
 if(j.type==='research'){s.research[j.target]=true;milestone('research:'+j.target,'research');}
 if(j.type==='explore'){Object.assign(reward,j.rewards);s.expeditions++;milestone('explore:'+j.creature+':'+j.target,'exploration');}
 for(const [k,v] of Object.entries(reward))s.resources[k]+=v;
 s.report={type:j.type,creature:j.creature||null,target:j.target||null,reward,at:now,xp};delete s.jobs[j.id];break;}
 case 'dev-complete':need(dev,'Development tools are unavailable.');for(const j of Object.values(s.jobs))j.endsAt=now;break;
 default:throw Error('Unknown Valemere action.');
 }
 s.revision++;s.receipts=[...s.receipts,b.requestId].slice(-64);return {state:s,xp};
}
module.exports={initial,apply,stats,capacity,stored,busy};
