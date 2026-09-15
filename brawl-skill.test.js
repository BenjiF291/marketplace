const test=require('node:test');
const assert=require('node:assert/strict');
const skill=require('./brawl-skill');
const engine=require('./public/practice-engine');
test('skill stays bounded, defaults sensibly and decision quality matters independently of result',()=>{
  assert.equal(skill.level(undefined),300);assert.equal(skill.level(NaN),300);
  assert.equal(skill.skillChange(1000,1,1).after,1000);
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
