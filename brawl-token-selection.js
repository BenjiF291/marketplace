const animals=require('./public/stable-animals').animals;
// Relative weights, not percentage points: at most 20% above an unowned, unused creature.
function weight(kind,user={}){
 const animal=animals.find(a=>a.id===kind),owned=animal?.companion?Number(user.rubyItems?.['pet:'+kind])>0:Number(user.stableAnimals?.[kind])>0;
 const games=Math.max(0,Math.floor(Number(user.creatureBrawl?.usageCounts?.[kind])||0));
 return 100+(owned?10:0)+Math.min(10,Math.floor(games/2));
}
function choose(pool,user,random){const weights=pool.map(kind=>weight(kind,user));if(weights.every(w=>w===weights[0]))return pool[random(pool.length)];let roll=random(weights.reduce((sum,w)=>sum+w,0));for(let i=0;i<pool.length;i++){if(roll<weights[i])return pool[i];roll-=weights[i];}return pool.at(-1);}
module.exports={weight,choose};
