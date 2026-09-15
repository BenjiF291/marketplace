const DEFAULT_SKILL = 500; // Internal matchmaking prior, never an assigned starting rating.
const PLACEMENT_GAMES = 5;
const RATING_VERSION = 2;
const MILESTONES = [
  {at:150, name:'Contender', footy:0, ruby:0, trophyPercent:5},
  {at:300, name:'Challenger', footy:0, ruby:0, trophyPercent:8},
  {at:450, name:'Tactician', footy:0, ruby:0, trophyPercent:12},
  {at:600, name:'Strategist', footy:10, ruby:0, trophyPercent:16},
  {at:800, name:'Master', footy:10, ruby:1, trophyPercent:20},
  {at:1000, name:'Champion', footy:15, ruby:1, trophyPercent:25}
];
const NO_BOOSTER = {at:0,name:'No booster',footy:0,ruby:0,trophyPercent:0};
function level(value) { return Number.isFinite(value) ? Math.max(0, Math.min(1000, Math.round(value))) : DEFAULT_SKILL; }
function progress(data={}) {
  if(data.ratingVersion!==RATING_VERSION) return {ratingVersion:RATING_VERSION,skillLevel:level(data.skillLevel),placementsCompleted:0,placementTotal:0};
  return {...data,skillLevel:level(data.skillLevel),placementsCompleted:Math.max(0,Math.min(PLACEMENT_GAMES,Math.floor(data.placementsCompleted||0))),placementTotal:Number(data.placementTotal)||0};
}
function booster(value) { return MILESTONES.filter(m => level(value) >= m.at).at(-1) || NO_BOOSTER; }
function profile(data={}) {
  const state=progress(data),placed=state.placementsCompleted===PLACEMENT_GAMES;
  return {skillLevel:placed?state.skillLevel:null,placed,placementsCompleted:state.placementsCompleted,placementsRequired:PLACEMENT_GAMES,
    booster:placed?booster(state.skillLevel):NO_BOOSTER,next:placed?MILESTONES.find(m=>m.at>state.skillLevel)||null:null,milestones:MILESTONES};
}
function skillChange(value, result, quality, forfeit=false) {
  const before=level(value);
  const outcomePoints=result*12;
  const expectedQuality=.55 + .4*before/1000;
  const decisionPoints=forfeit||quality===null?0:Math.round(32*(quality-expectedQuality));
  const after=level(before+outcomePoints+decisionPoints);
  const assessed=quality===null?'No meaningful choice to assess':`estimated move quality ${Math.round(quality*100)}% (expected ${Math.round(expectedQuality*100)}%)`;
  return {before,after,delta:after-before,quality:forfeit||quality===null?null:Math.round(quality*100),outcomePoints,decisionPoints,
    explanation:forfeit?'Unfinished ranked Brawl forfeited (-12).':`${result>0?'Win':result<0?'Loss':'Draw'}: ${outcomePoints>0?'+':''}${outcomePoints}; ${assessed}: ${decisionPoints>=0?'+':''}${decisionPoints}. Assessment includes defence, remaining cards and a possible recapture.`};
}
function settle(data,result,quality,opponentSkill,forfeit=false) {
  const state=progress(data);
  if(state.placementsCompleted===PLACEMENT_GAMES){
    const change=skillChange(state.skillLevel,result,quality,forfeit);
    return {state:{...state,skillLevel:change.after},change};
  }
  // Invert the post-placement quality expectation. Results contribute 20%,
  // relative to the opponent faced; choices contribute 80%.
  const decisionLevel=forfeit?0:quality===null?level(opponentSkill):level((quality-.55)/.4*1000);
  const resultLevel=level(level(opponentSkill)+result*150);
  const sample=level(.8*decisionLevel+.2*resultLevel);
  const placementsCompleted=state.placementsCompleted+1;
  const placementTotal=state.placementTotal+sample;
  const estimate=level(placementTotal/placementsCompleted);
  const placed=placementsCompleted===PLACEMENT_GAMES;
  return {state:{...state,skillLevel:estimate,placementsCompleted,placementTotal},
    change:{placement:true,placementsCompleted,placementsRequired:PLACEMENT_GAMES,before:null,after:placed?estimate:null,delta:null,
      quality:forfeit||quality===null?null:Math.round(quality*100),
      explanation:`${forfeit?'Forfeit':result>0?'Win':result<0?'Loss':'Draw'} recorded. Placement ${placementsCompleted}/${PLACEMENT_GAMES}. ${placed?`Starting Skill Level: ${estimate}.`:'Your rating will be assigned after five ranked games.'} Placement combines decision quality (80%) with the result and opponent level (20%).`}};
}
module.exports={DEFAULT_SKILL,PLACEMENT_GAMES,RATING_VERSION,MILESTONES,level,progress,booster,profile,skillChange,settle};
