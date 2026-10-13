const test=require('node:test');
const assert=require('node:assert/strict');
const skill=require('./brawl-skill');
const engine=require('./public/practice-engine');
test('skill stays bounded, defaults sensibly and decision quality matters independently of result',()=>{
  assert.equal(skill.level(undefined),500);assert.equal(skill.level(NaN),500);
  assert.equal(skill.skillChange(1200,1,1).after,1200);
  assert.equal(skill.skillChange(0,-1,0).after,0);
  assert.ok(skill.skillChange(400,1,1).delta>skill.skillChange(400,1,0).delta);
  assert.ok(skill.skillChange(400,1,0).delta<0);
  assert.ok(skill.skillChange(400,1,1).delta>0);
  assert.ok(skill.skillChange(400,-1,0).delta<0);
  for(const m of skill.MILESTONES){
    assert.equal(skill.booster(m.at).at,m.at);
    assert.ok(skill.booster(m.at-1).at<m.at);
    assert.equal(skill.booster(m.at).at,m.at);
  }
});
test('adaptive AI is deterministic, legal and improves smoothly with skill',()=>{
  const board=Array(16).fill(null);board[5]={...engine.trainingCards()[0],ownerId:'player'};
  const hand=engine.trainingCards().slice(0,2),opponent=engine.trainingCards().slice(2,4);
  const policy=level=>({policy:'adaptive-v2',skill:level});
  const mean=level=>Array.from({length:80},(_,i)=>engine.chooseMove(board,hand,opponent,policy(level),engine.seeded(i*98765+41)).value).reduce((a,b)=>a+b)/80;
  assert.ok(mean(950)>mean(50));
  assert.ok(Math.abs(mean(501)-mean(500))<10);
  for(const level of [0,300,600,1000]){
    const move=engine.chooseMove(board,hand,opponent,policy(level),engine.seeded(42));
    assert.deepEqual(move,engine.chooseMove(board,hand,opponent,policy(level),engine.seeded(42)));
    assert.equal(board[move.cell],null);assert.ok(hand[move.cardIndex]);
  }
});

test('placements depend on decisions and result, stay hidden until fifth, and reward thresholds are reversible',()=>{
 let strong={},weak={};
 for(let i=0;i<5;i++){
  strong=skill.settle(strong,1,.98,500).state;
  weak=skill.settle(weak,-1,.6,500).state;
  assert.equal(skill.profile(strong).skillLevel===null,i<4);
  assert.equal(skill.profile(strong).placed,i===4);
 }
 assert.ok(strong.skillLevel>weak.skillLevel);
 assert.equal(skill.booster(599).footy,0);assert.equal(skill.booster(600).footy,10);
 assert.equal(skill.booster(799).ruby,0);assert.equal(skill.booster(800).ruby,1);
 assert.equal(skill.booster(799).ruby,0);assert.equal(skill.booster(800).ruby,1);
 assert.equal(skill.skillChange(350,1,.72).decisionPoints,21);
 assert.equal(skill.skillChange(350,1,.98).decisionPoints,40);
 assert.equal(skill.skillChange(350,1,null).decisionPoints,0);
});

test('existing ratings survive the 1200 cap and Champion stays at 1000',()=>{
 const state={ratingVersion:2,placementsCompleted:5,skillLevel:1000,ratedGames:50};
 assert.equal(skill.progress(state).skillLevel,1000);assert.equal(skill.profile(state).maxSkill,1200);
 assert.equal(skill.profile(state).placed,true);assert.equal(skill.level(99999),1200);
 assert.equal(skill.booster(999).at,800);assert.equal(skill.booster(1000).at,1000);assert.equal(skill.booster(1200).at,1000);
 const buffered=skill.settle({...state,skillLevel:1100},-1,.7,1100);
 assert.ok(buffered.state.skillLevel>=1000);assert.equal(skill.profile(buffered.state).booster.at,1000);
});
test('upper-rating win streaks do not inflate gains and sparse choices carry less evidence',()=>{
 const state={ratingVersion:2,placementsCompleted:5,skillLevel:1000,ratedGames:60};
 const normal=skill.settle(state,1,.98,1000),streak=skill.settle({...state,ratingDirection:1,ratingStreak:8},1,.98,1000);
 assert.equal(normal.change.delta,streak.change.delta);assert.ok(normal.change.delta<=18);
 assert.ok(skill.skillChange(800,1,1,false,200).outcomePoints<skill.skillChange(800,1,1,false,800).outcomePoints);
 assert.ok(skill.skillChange(800,1,1,false,800,{assessedMoves:1}).decisionPoints<skill.skillChange(800,1,1,false,800,{assessedMoves:6}).decisionPoints);
 const few=skill.settle({},1,1,500,false,{assessedMoves:1}),many=skill.settle({},1,1,500,false,{assessedMoves:6});
 assert.ok(few.state.skillLevel<many.state.skillLevel);
});

function calibratedRun(start,quality,results,games=160,evidence={assessedMoves:6}){
 let state={ratingVersion:2,placementsCompleted:5,skillLevel:start,ratedGames:60};
 const levels=[];for(let i=0;i<games;i++){state=skill.settle(state,results[i%results.length],quality,state.skillLevel,false,evidence).state;levels.push(state.skillLevel);}return {state,levels};
}
test('sound tactical play settles near 900 from either side and tolerates ordinary result variation',()=>{
 assert.equal(skill.qualityLevel(.90),900);
 for(const start of [200,500,900,1200]){
  for(const results of [[1,-1],[1,1,-1,-1,0],[1,1,1,-1,-1]]){
   const run=calibratedRun(start,.90,results);assert.ok(run.levels.slice(-30).every(n=>n>=875&&n<=930),JSON.stringify({start,results,last:run.state.skillLevel}));
  }
 }
});
test('repeated wins with ordinary decisions cannot farm Champion or the cap',()=>{
 const ordinary=calibratedRun(500,.90,[1],500),weak=calibratedRun(1000,.75,[1],500);
 assert.ok(ordinary.state.skillLevel<1000);
 const sparse=calibratedRun(500,.90,[1],500,{assessedMoves:1});assert.ok(sparse.state.skillLevel<1000);
 const forced=calibratedRun(900,null,[1],100,{assessedMoves:0});assert.equal(forced.state.skillLevel,900);assert.ok(ordinary.state.skillLevel>900);
 assert.ok(weak.state.skillLevel<800);assert.ok(weak.levels.slice(-100).every(n=>n<800));
 const expert=calibratedRun(500,.985,[1,-1]),elite=calibratedRun(500,1,[1,-1]);
 assert.ok(expert.state.skillLevel>=1080&&expert.state.skillLevel<=1120);assert.ok(elite.state.skillLevel>=1180);
});
test('quality-free matches supply no invented decision correction; forfeits cost exactly 12',()=>{
 const state={ratingVersion:2,placementsCompleted:5,skillLevel:1100,ratedGames:100,ratingDirection:-1,ratingStreak:8};
 assert.equal(skill.settle(state,0,null,1100,false,{assessedMoves:0}).change.delta,0);
 assert.equal(skill.settle(state,-1,null,1100,true).change.delta,-12);
 assert.equal(skill.skillChange(900,0,.90).delta,0);
 assert.equal(skill.skillChange(900,1,.90).delta,6);assert.equal(skill.skillChange(900,-1,.90).delta,-6);
});
test('placements use the same calibrated scale and completed accounts keep their ratings until they play',()=>{
 let state={};for(let i=0;i<5;i++)state=skill.settle(state,0,.90,skill.progress(state).skillLevel,false,{assessedMoves:6}).state;
 assert.ok(state.skillLevel>=850&&state.skillLevel<=925);assert.equal(skill.profile(state).placed,true);
 assert.equal(skill.progress({ratingVersion:2,placementsCompleted:5,skillLevel:1037}).skillLevel,1037);
});

test('the same average play with occasional bad games still hovers near 900',()=>{
 let state={ratingVersion:2,placementsCompleted:5,skillLevel:500,ratedGames:60};const late=[];
 for(let i=0;i<400;i++){state=skill.settle(state,i%2?1:-1,[1,1,1,.6][i%4],state.skillLevel,false,{assessedMoves:6}).state;if(i>=300)late.push(state.skillLevel);}
 const average=late.reduce((a,b)=>a+b,0)/late.length;assert.ok(average>=880&&average<=925,`average ${average}`);assert.ok(late.every(n=>n>=860&&n<=950));
});
