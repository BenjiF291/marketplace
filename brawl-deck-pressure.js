// Server-owned ranked deck targets; player skill never changes Bob's AI strength.
const AI_SKILL=700;
function state(data={}) {
 const saved=data.deckPressure||{};
 const count=value=>Math.max(0,Math.floor(Number(value)||0));
 // Older percentage-based history starts fresh under the points system.
 return saved.version===2?{version:2,wins:count(saved.wins),losses:count(saved.losses),boost:count(saved.boost)}:{version:2,wins:0,losses:0,boost:0};
}
function matchmaking(data={}) {
 const history=state(data);
 return {aiSkill:AI_SKILL,winStreak:history.wins,lossStreak:history.losses,deckBoost:history.boost};
}
function settle(data,result) {
 const history=state(data);
 if(result<0){const losses=history.losses+1;return {version:2,wins:0,losses,boost:losses>=3?0:Math.max(0,history.boost-3)};}
 if(result===0)return {...history,wins:0,losses:0};
 const wins=history.wins+1;
 return {version:2,wins,losses:0,boost:history.boost>0?history.boost+1:wins>=3?5:0};
}
module.exports={AI_SKILL,state,matchmaking,settle};
