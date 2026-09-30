/* Shared, deterministic plot rules. Server validates every saved arrangement. */
(function(root){
 const LEVELS={townhall:0,archive:0,market:0,forge:0,arena:0,wheel:0,blacksmith:1,pets:2,cabinet:1,dye:3,compressor:4,vault:0,vip:5};
 const PLOTS=Array.from({length:24},(_,i)=>({id:i,x:370+(i%6)*140,y:310+Math.floor(i/6)*125}));
 const DEFAULTS={townhall:8,archive:6,market:13,forge:3,arena:10,wheel:1,blacksmith:16,pets:18,cabinet:12,dye:17,compressor:21,vault:14,vip:22};
 const house=id=>/^house:([0-9]|10)$/.test(id);
 function profile(user={}){const saved=user.villageLayout||{},positions={},used=new Set();for(const id of [...Object.keys(LEVELS),...Object.keys(saved).filter(house).sort()]){const n=saved[id];if(Number.isInteger(n)&&n>=0&&n<PLOTS.length&&!used.has(n)){positions[id]=n;used.add(n);}}
  for(const id of Object.keys(LEVELS)){if(id in positions)continue;const n=!used.has(DEFAULTS[id])?DEFAULTS[id]:PLOTS.find(p=>!used.has(p.id)).id;positions[id]=n;used.add(n);}
  return {positions,revision:Number.isSafeInteger(user.villageLayoutRevision)?user.villageLayoutRevision:0,villagers:Object.keys(positions).filter(house).length*3};
 }
 function validate(user,positions,revision,level){const old=profile(user);if(revision!==old.revision)throw Error('Your village changed elsewhere. Reload the layout before saving.');if(!positions||typeof positions!=='object'||Array.isArray(positions))throw Error('Choose a valid layout.');const used=new Set();for(const [id,n] of Object.entries(positions)){if(!(Object.hasOwn(LEVELS,id))&&!house(id))throw Error('Unknown building.');if(!Number.isInteger(n)||n<0||n>=PLOTS.length||used.has(n))throw Error('Every building needs its own land plot.');used.add(n);if(Object.hasOwn(LEVELS,id)&&LEVELS[id]>level&&n!==old.positions[id])throw Error('That building is not unlocked yet.');}for(const id of Object.keys(LEVELS))if(!(id in positions))throw Error('Existing buildings must stay on the island.');return {villageLayout:{...positions},villageLayoutRevision:old.revision+1};}
 const api={LEVELS,PLOTS,DEFAULTS,house,profile,validate};if(typeof module!=='undefined')module.exports=api;else root.VillageLayout=api;
})(typeof window==='undefined'?globalThis:window);
