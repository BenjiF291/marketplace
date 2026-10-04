// Individual showcase identities. Keep these rules independent of the shop to avoid circular imports.
const HOURS=3600000;
const RULES={
 'relic:books':{periodic:1,hours:7,visitor:1,cleanup:1,focus:'Steady starter'},
 'relic:fern':{periodic:1,hours:6,visitor:1,cleanup:2,focus:'Community garden'},
 'relic:pennant':{periodic:2,hours:7,visitor:1,cleanup:1,focus:'Passive income'},
 'relic:rose':{periodic:2,hours:6,visitor:2,cleanup:1,focus:'Visitor favourite'},
 'relic:moon':{periodic:3,hours:5.5,visitor:1,cleanup:2,focus:'Passive specialist'},
 'relic:skystones':{periodic:3,hours:5,visitor:2,cleanup:2,focus:'Balanced showcase'},
 'relic:crown':{periodic:4,hours:5.5,visitor:3,cleanup:3,focus:'Prestige showcase'},
 'relic:dragon':{periodic:5,hours:5,visitor:3,cleanup:3,focus:'Premium passive income'}
};
function rates(id){const r=RULES[id];if(!r)throw Error('Unknown collectible.');return {...r,period:r.hours*HOURS};}
function description(id){const r=rates(id);return `${r.focus}: ${r.periodic} XP every ${r.hours} hours; ${r.visitor} XP per first-time visitor; ${r.cleanup} XP for whoever cleans up. Once displayed, it cannot be removed or replaced. Breaks permanently after 3-7 days (usually 5). Maximum 3 displays per player.`;}
module.exports={RULES,rates,description};
