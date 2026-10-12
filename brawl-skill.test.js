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
 assert.equal(skill.skillChange(350,1,.72).decisionPoints,1);
 assert.equal(skill.skillChange(350,1,.98).decisionPoints,9);
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
