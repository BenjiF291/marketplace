const DEFAULT_SKILL = 300;
const MILESTONES = [
  {at:150, name:'Contender', footy:10, trophyPercent:5},
  {at:300, name:'Challenger', footy:20, trophyPercent:8},
  {at:450, name:'Tactician', footy:30, trophyPercent:12},
  {at:600, name:'Strategist', footy:45, trophyPercent:16},
  {at:800, name:'Master', footy:60, trophyPercent:20},
  {at:1000, name:'Champion', footy:80, trophyPercent:25}
];
function level(value) { return Number.isFinite(value) ? Math.max(0, Math.min(1000, Math.round(value))) : DEFAULT_SKILL; }
function booster(value) { return MILESTONES.filter(m => level(value) >= m.at).at(-1) || {at:0,name:'No booster',footy:0,trophyPercent:0}; }
function profile(value) { const skillLevel=level(value); return {skillLevel,booster:booster(skillLevel),next:MILESTONES.find(m=>m.at>skillLevel)||null,milestones:MILESTONES}; }
function skillChange(value, result, quality, forfeit=false) {
  const before=level(value);
  const outcomePoints=result*12;
  const expectedQuality=.55 + .4*before/1000;
  const decisionPoints=forfeit?0:Math.round(32*(quality-expectedQuality));
  const after=level(before+outcomePoints+decisionPoints);
  return {before,after,delta:after-before,quality:forfeit?null:Math.round(quality*100),outcomePoints,decisionPoints,
    explanation:forfeit?'Unfinished ranked Brawl forfeited (-12).':`${result>0?'Win':result<0?'Loss':'Draw'}: ${outcomePoints>0?'+':''}${outcomePoints}; decision quality ${Math.round(quality*100)}%: ${decisionPoints>=0?'+':''}${decisionPoints}. Quality compares your placements with the best available moves and replies.`};
}
module.exports={DEFAULT_SKILL,MILESTONES,level,booster,profile,skillChange};
