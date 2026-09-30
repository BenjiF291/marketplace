/* Shared, deterministic plot rules. Server validates every saved arrangement. */
(function(root){
 const LEVELS={townhall:0,archive:0,market:0,forge:0,arena:0,wheel:0,blacksmith:1,pets:2,cabinet:1,dye:3,compressor:4,vault:0,vip:5};
 // Coordinates follow the grassy parcels in island-painted.png, not a rectangular grid.
 const PLOTS=[
  [530,215],[605,215],[745,255],[815,255],
  [345,335],[420,340],[550,340],[625,365],
  [840,345],[920,335],[445,430],[505,430],
  [290,485],[365,495],[535,535],[615,550],
  [735,535],[815,525],[930,455],[1005,465],
  [1040,535],[450,610],[695,685],[785,680]
 ].map(([x,y],id)=>({id,x,y,width:72,depth:32}));
 const DEFAULTS={townhall:8,archive:6,market:13,forge:3,arena:10,wheel:1,blacksmith:16,pets:18,cabinet:12,dye:17,compressor:21,vault:14,vip:22};
 const house=id=>/^house:([0-9]|10)$/.test(id);
 function profile(user={}){const saved=user.villageLayout||{},positions={},used=new Set();for(const id of [...Object.keys(LEVELS),...Object.keys(saved).filter(house).sort()]){const n=saved[id];if(Number.isInteger(n)&&n>=0&&n<PLOTS.length&&!used.has(n)){positions[id]=n;used.add(n);}}
  for(const id of Object.keys(LEVELS)){if(id in positions)continue;const n=!used.has(DEFAULTS[id])?DEFAULTS[id]:PLOTS.find(p=>!used.has(p.id)).id;positions[id]=n;used.add(n);}
  return {positions,revision:Number.isSafeInteger(user.villageLayoutRevision)?user.villageLayoutRevision:0,houseTiers:Object.fromEntries(Object.keys(positions).filter(house).map(id=>[id,Math.max(1,Math.min(3,Math.trunc(Number(user.villageHouseTiers?.[id])||1)))])),rubies:Number(user.gems?.bronze)||0,villagers:Object.keys(positions).filter(house).reduce((n,id)=>n+[0,3,5,10][Math.max(1,Math.min(3,Math.trunc(Number(user.villageHouseTiers?.[id])||1)))],0)};
 }
 function validate(user,positions,revision,level){const old=profile(user);if(revision!==old.revision)throw Error('Your village changed elsewhere. Reload the layout before saving.');if(!positions||typeof positions!=='object'||Array.isArray(positions))throw Error('Choose a valid layout.');const used=new Set();for(const [id,n] of Object.entries(positions)){if(!(Object.hasOwn(LEVELS,id))&&!house(id))throw Error('Unknown building.');if(!Number.isInteger(n)||n<0||n>=PLOTS.length||used.has(n))throw Error('Every building needs its own land plot.');used.add(n);if(Object.hasOwn(LEVELS,id)&&LEVELS[id]>level&&n!==old.positions[id])throw Error('That building is not unlocked yet.');}for(const id of Object.keys(LEVELS))if(!(id in positions))throw Error('Existing buildings must stay on the island.');const homes=Object.keys(positions).filter(house),existing=Object.keys(old.positions).filter(house),added=homes.filter(id=>!existing.includes(id));
 if(added.length&&homes.length>Math.min(10,level+1))throw Error('Upgrade your Town Hall to unlock another house.');
 if(existing.some(id=>!homes.includes(id)))throw Error('Purchased houses must stay on the island.');
 const cost=added.length*10,gems={...(user.gems||{})};if(cost>(Number(gems.bronze)||0))throw Error('Each new house costs 10 rubies.');if(cost)gems.bronze=(Number(gems.bronze)||0)-cost;
 return {villageLayout:{...positions},villageLayoutRevision:old.revision+1,...(cost?{gems}:{}),villageHouseTiers:{...old.houseTiers,...Object.fromEntries(added.map(id=>[id,1]))}};}
 const api={LEVELS,PLOTS,DEFAULTS,house,profile,validate};if(typeof module!=='undefined')module.exports=api;else root.VillageLayout=api;
})(typeof window==='undefined'?globalThis:window);
