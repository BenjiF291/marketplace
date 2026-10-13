// Synthetic rating calibration; this does not predict human win rates.
// Usage: node brawl-rating-balance.cjs
const skill=require('./brawl-skill');
for(const [name,qualities,results] of [
 ['ordinary tactical play',[.90],[1,-1]],
 ['ordinary play, occasional bad games',[1,1,1,.6],[1,-1]],
 ['ordinary play, winning 60%',[.90],[1,1,1,-1,-1]],
 ['ordinary play, all wins',[.90],[1]],
 ['stronger play',[.96],[1,-1]],
 ['expert play',[.985],[1,-1]]
]){
 let state={ratingVersion:2,placementsCompleted:5,skillLevel:500,ratedGames:60};const late=[];
 for(let i=0;i<400;i++){state=skill.settle(state,results[i%results.length],qualities[i%qualities.length],state.skillLevel,false,{assessedMoves:6}).state;if(i>=300)late.push(state.skillLevel);}
 console.log({name,average:Math.round(late.reduce((a,b)=>a+b,0)/late.length),min:Math.min(...late),max:Math.max(...late)});
}
