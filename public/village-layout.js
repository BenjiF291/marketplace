/* Shared, deterministic plot rules. Server validates every saved arrangement. */
(function(root){
 const LEVELS={townhall:0,archive:0,market:0,forge:0,arena:0,wheel:0,blacksmith:1,pets:2,cabinet:1,dye:3,compressor:4,vault:0,vip:5,petstation:2,farmhouse:1,jobs:0,timebank:3,'mine:0':1,'mine:1':3,'mine:2':4,'mine:3':6,'mine:4':9};
 // Coordinates follow the grassy parcels in island-painted.png, not a rectangular grid.
 // Traced in the original 1505 x 1045 painting; scale into the 1440 x 1000 world.
 // Keep IDs stable so saved arrangements, houses and active jobs survive repositioning.
 const PLOTS=[
  [552,215],[628,222],[782,240],[850,266],
  [360,348],[440,345],[650,363],[690,390],
  [916,338],[995,335],[486,425],[557,444],
  [329,491],[390,512],[577,549],[656,559],
  [800,535],[880,529],[953,438],[382,381],
  [1016,500],[488,628],[752,690],[824,691],
  [603,596],[1070,563],[566,333],[760,268],
  [1150,563],[900,620],[779,656],[900,388],[617,506]
 ].map(([x,y],id)=>({id,x:Math.round(x*1440/1505),y:Math.round(y*1000/1045),width:72,depth:32}));

 const Grid=typeof module!=='undefined'?require('./village-grid'):root.VillageGrid;
 const legacyCount=PLOTS.length;
 for(const cell of Grid.cells)PLOTS.push({id:PLOTS.length,x:cell.x+18,y:cell.y+18,col:cell.col,row:cell.row,width:60,depth:60,grid:true});
 const DEFAULTS={townhall:8,archive:6,market:13,forge:3,arena:10,wheel:1,blacksmith:16,pets:18,cabinet:12,dye:17,compressor:21,vault:14,vip:22,petstation:24,farmhouse:25,jobs:26,timebank:32,'mine:0':27,'mine:1':28,'mine:2':29,'mine:3':30,'mine:4':31};
 const house=id=>/^house:([0-9]|10)$/.test(id);
 function profile(user={}){const saved=user.villageLayout||{},positions={},used=new Set();for(const id of [...Object.keys(LEVELS),...Object.keys(saved).filter(house).sort()]){const n=saved[id];if(Number.isInteger(n)&&n>=0&&n<PLOTS.length&&!used.has(n)){positions[id]=n;used.add(n);}}
  if(user.villageGridVersion!==2)for(const id of Object.keys(LEVELS)){if(id in positions)continue;const n=!used.has(DEFAULTS[id])?DEFAULTS[id]:PLOTS.find(p=>!used.has(p.id)).id;positions[id]=n;used.add(n);}
  return {positions,revision:Number.isSafeInteger(user.villageLayoutRevision)?user.villageLayoutRevision:0,houseTiers:Object.fromEntries(Object.keys(positions).filter(house).map(id=>[id,Math.max(1,Math.min(3,Math.trunc(Number(user.villageHouseTiers?.[id])||1)))])),rubies:Math.max(0,Math.ceil(Number(user.gems?.bronze)||0)),villagers:Object.keys(positions).filter(house).reduce((n,id)=>n+[0,3,5,10][Math.max(1,Math.min(3,Math.trunc(Number(user.villageHouseTiers?.[id])||1)))],0)};
 }
 function validate(user,positions,revision,level){if(user.villageGridVersion===2)return validateGrid(user,positions,revision,level);const old=profile(user);if(revision!==old.revision)throw Error('Your village changed elsewhere. Reload the layout before saving.');if(!positions||typeof positions!=='object'||Array.isArray(positions))throw Error('Choose a valid layout.');const used=new Set();for(const [id,n] of Object.entries(positions)){if(!(Object.hasOwn(LEVELS,id))&&!house(id))throw Error('Unknown building.');if(!Number.isInteger(n)||n<0||n>=legacyCount||used.has(n))throw Error('Every building needs its own land plot.');used.add(n);if(Object.hasOwn(LEVELS,id)&&LEVELS[id]>level&&n!==old.positions[id])throw Error('That building is not unlocked yet.');}for(const id of Object.keys(LEVELS))if(!(id in positions))throw Error('Existing buildings must stay on the island.');const homes=Object.keys(positions).filter(house),existing=Object.keys(old.positions).filter(house),added=homes.filter(id=>!existing.includes(id));
 if(added.length&&homes.length>Math.min(10,level+1))throw Error('Upgrade your Town Hall to unlock another house.');
 if(existing.some(id=>!homes.includes(id)))throw Error('Purchased houses must stay on the island.');
 const cost=added.length*10,gems=Object.fromEntries(Object.entries(user.gems||{}).map(([key,n])=>[key,Math.max(0,Math.ceil(Number(n)||0))]));if(cost>(Number(gems.bronze)||0))throw Error('Each new house costs 10 rubies.');if(cost)gems.bronze=(Number(gems.bronze)||0)-cost;
 return {villageLayout:{...positions},villageLayoutRevision:old.revision+1,...(cost?{gems}:{}),villageHouseTiers:{...old.houseTiers,...Object.fromEntries(added.map(id=>[id,1]))}};}
 function migration(user,level){if(user.villageCircleVersion===1)return {};const source=Object.entries(profile(user).positions).filter(([id])=>house(id)||LEVELS[id]<=level),positions={},used=new Set();for(const [id,n] of source.filter(([,n])=>n<legacyCount)){positions[id]=n;used.add(n);}for(const [id,n] of source.filter(([,n])=>n>=legacyCount)){const at=point(id,n),p=PLOTS.slice(0,legacyCount).filter(p=>!used.has(p.id)).sort((a,b)=>Math.hypot(a.x-at.x,a.y-at.y)-Math.hypot(b.x-at.x,b.y-at.y))[0];positions[id]=p.id;used.add(p.id);}return {villageGridVersion:2,villageCircleVersion:1,villageLayout:positions,villageLayoutRevision:(user.villageLayoutRevision||0)+1};}
 function validPlacement(id,n,positions,ignore=id){return Number.isInteger(n)&&n>=0&&n<legacyCount&&!Object.entries(positions).some(([key,at])=>key!==ignore&&at===n);}
 function point(id,n){const p=PLOTS[n];if(!p)return null;return p.grid?{...p,x:p.col*Grid.SIZE+Grid.footprint(id).w*Grid.SIZE/2,y:p.row*Grid.SIZE+Grid.footprint(id).h*Grid.SIZE/2}:p;}
 function validateGrid(user,positions,revision,level){
  const old=profile(user);if(revision!==old.revision)throw Error('Your village changed elsewhere. Reload before saving.');if(!positions||typeof positions!=='object'||Array.isArray(positions))throw Error('Choose a valid layout.');
  for(const [id,n] of Object.entries(positions)){if(!Object.hasOwn(LEVELS,id)&&!house(id))throw Error('Unknown building.');if(!Number.isInteger(n)||!PLOTS[n])throw Error('Choose a circular land plot.');if(!house(id)&&LEVELS[id]>level)throw Error('That building is not unlocked yet.');if(n!==old.positions[id]&&!validPlacement(id,n,positions))throw Error('Choose an empty circular land plot.');}
  for(const id of Object.keys(old.positions))if(!(id in positions))throw Error('Placed buildings must stay on the island.');
  const added=Object.keys(positions).filter(id=>house(id)&&!(id in old.positions));if(added.length&&Object.keys(positions).filter(house).length>Math.min(10,level+1))throw Error('Upgrade the Town Hall to unlock another house.');
  const gems=Object.fromEntries(Object.entries(user.gems||{}).map(([k,v])=>[k,Math.max(0,Math.ceil(Number(v)||0))])),cost=added.length*10;if(cost>(gems.bronze||0))throw Error('Each new house costs 10 rubies.');if(cost)gems.bronze-=cost;
  return {villageGridVersion:2,villageLayout:{...positions},villageLayoutRevision:old.revision+1,villageHouseTiers:{...old.houseTiers,...Object.fromEntries(added.map(id=>[id,1]))},...(cost?{gems}:{})};
 }
 const initial=()=>({villageGridVersion:2,villageCircleVersion:1,villageLayout:{townhall:DEFAULTS.townhall}});
 const api={initial,Grid,legacyCount,migration,point,validPlacement,validateGrid,LEVELS,PLOTS,DEFAULTS,house,profile,validate};if(typeof module!=='undefined')module.exports=api;else root.VillageLayout=api;
})(typeof window==='undefined'?globalThis:window);
