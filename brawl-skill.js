const DEFAULT_SKILL = 500; // Internal matchmaking prior, never an assigned starting rating.
const PLACEMENT_GAMES = 5;
const MAX_SKILL = 1200;
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
function level(value) { return Number.isFinite(value) ? Math.max(0, Math.min(MAX_SKILL, Math.round(value))) : DEFAULT_SKILL; }
function progress(data={}) {
  if(data.ratingVersion!==RATING_VERSION) return {ratingVersion:RATING_VERSION,skillLevel:level(data.skillLevel),placementsCompleted:0,placementTotal:0};
  return {...data,skillLevel:level(data.skillLevel),placementsCompleted:Math.max(0,Math.min(PLACEMENT_GAMES,Math.floor(data.placementsCompleted||0))),placementTotal:Number(data.placementTotal)||0};
}
function booster(value) { return MILESTONES.filter(m => level(value) >= m.at).at(-1) || NO_BOOSTER; }
function profile(data={}) {
  const state=progress(data),placed=state.placementsCompleted===PLACEMENT_GAMES;
  return {maxSkill:MAX_SKILL,skillLevel:placed?state.skillLevel:null,placed,placementsCompleted:state.placementsCompleted,placementsRequired:PLACEMENT_GAMES,
    booster:placed?booster(state.skillLevel):NO_BOOSTER,next:placed?MILESTONES.find(m=>m.at>state.skillLevel)||null:null,milestones:MILESTONES};
}
// Calibration anchors are bounded-search decision quality, not human win rates.
// Sound tactical play with occasional mistakes centres on 900; the increasingly
// narrow bands above it reserve 1000-1200 for much more consistent decisions.
const QUALITY_SCALE = [[0,0],[.55,400],[.75,650],[.90,900],[.96,1000],[.985,1100],[1,1200]];
function qualityLevel(quality) {
  const q=Math.max(0,Math.min(1,quality));
  for(let i=1;i<QUALITY_SCALE.length;i++){const [lo,a]=QUALITY_SCALE[i-1],[hi,b]=QUALITY_SCALE[i];if(q<=hi)return level(a+(b-a)*(q-lo)/(hi-lo));}
  return MAX_SKILL;
}
function skillChange(value, result, quality, forfeit=false, opponentSkill=value, evidence={}) {
  const before=level(value);
  const expectedResult=1/(1+10**((level(opponentSkill)-before)/300));
  const confidence=Number.isFinite(evidence.assessedMoves)?Math.min(1,Math.max(0,evidence.assessedMoves)/4):1;
  const outcomePoints=forfeit?-12:Math.round(12*((result+1)/2-expectedResult)*confidence);
  const assessedLevel=quality===null?null:qualityLevel(quality);
  const decisionPoints=forfeit||assessedLevel===null?0:Math.round(Math.max(-40,Math.min(40,.08*(assessedLevel-before)*confidence)));
  const after=level(before+outcomePoints+decisionPoints);
  const assessed=quality===null?'No meaningful choice to assess':`estimated move quality ${Math.round(quality*100)}% (performance level ${assessedLevel})`;
  return {before,after,delta:after-before,quality:forfeit||quality===null?null:Math.round(quality*100),outcomePoints,decisionPoints,
    explanation:forfeit?'Unfinished ranked Brawl forfeited (-12).':`${result>0?'Win':result<0?'Loss':'Draw'}: ${outcomePoints>0?'+':''}${outcomePoints}; ${assessed}: ${decisionPoints>=0?'+':''}${decisionPoints}. Move quality is a bounded search estimate, not proof of perfect play.`};
}
function settle(data,result,quality,opponentSkill,forfeit=false,evidence={}) {
  let state=progress(data);
  const confidence=Number.isFinite(evidence.assessedMoves)?Math.min(1,Math.max(0,evidence.assessedMoves)/4):1;
  if(!forfeit&&Number.isFinite(quality)&&confidence>0){
    const priorWeight=Number.isFinite(state.qualityWeight)?Math.max(0,state.qualityWeight):0;
    const weight=Math.min(10,priorWeight+confidence);
    const previous=Number.isFinite(state.qualityMean)?state.qualityMean:quality;
    state={...state,qualityMean:previous+(quality-previous)*confidence/weight,qualityWeight:weight};
  }
  const recentQuality=quality===null?null:state.qualityMean??quality;
  if(state.placementsCompleted===PLACEMENT_GAMES){
    const change=skillChange(state.skillLevel,result,recentQuality,forfeit,opponentSkill,evidence);
    change.quality=forfeit||quality===null?null:Math.round(quality*100);
    if(!forfeit&&quality!==null)change.explanation=change.explanation.replace(`estimated move quality ${Math.round(recentQuality*100)}%`,`estimated move quality ${Math.round(quality*100)}% (recent average ${Math.round(recentQuality*100)}%)`);
    const direction=Math.sign(change.delta),prior=state.ratingDirection||0;
    const streak=direction&&direction===prior?Math.min(8,(state.ratingStreak||0)+1):direction?1:0;
    const games=Math.max(0,state.ratedGames||0);
    // The same evidence has the same effect in either direction. Volume and
    // streaks never multiply rating gains; quality continually anchors the level.
    return {state:{...state,skillLevel:change.after,ratedGames:games+1,ratingDirection:direction,ratingStreak:streak},
      change:{...change,calibration:games<10,streak}};
  }
  // Use the same calibrated quality scale. Results contribute 20%,
  // relative to the opponent faced; choices contribute 80%.
  const decisionLevel=forfeit?0:quality===null?level(opponentSkill):level(confidence*qualityLevel(recentQuality)+(1-confidence)*level(opponentSkill));
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
module.exports={QUALITY_SCALE,qualityLevel,MAX_SKILL,DEFAULT_SKILL,PLACEMENT_GAMES,RATING_VERSION,MILESTONES,level,progress,booster,profile,skillChange,settle};
