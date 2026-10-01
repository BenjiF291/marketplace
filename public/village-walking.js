/* Walkable corridors traced along the painted island's paths, in artwork pixels.
 * Everything outside them (water, cliffs, trees and rocks) is off limits.
 * Building footprints are subtracted whenever the arrangement changes. */
(function(root){
 const trails=[
  [[680,190],[695,218],[688,257],[710,286],[751,302]],
  [[495,270],[509,300],[504,343],[514,369],[551,389],[578,417],[593,445]],
  [[751,302],[750,339],[752,371],[738,394],[690,411]],
  [[751,302],[790,320],[828,327],[860,315]],
  [[860,315],[911,306],[971,304],[1028,303],[1042,331],[1033,367],[997,384]],
  [[997,384],[1047,399],[1071,415],[1107,418]],
  [[997,384],[957,400],[923,418],[889,436],[876,458]],
  [[876,458],[812,463],[780,453]],
  [[593,445],[628,417],[663,410],[690,411],[734,416],[763,434],[780,453],[761,478],[727,493],[681,496],[633,479],[607,465],[593,445]],
  [[1107,418],[1096,445],[1085,479],[1063,508],[1020,528],[982,544]],
  [[876,458],[896,482],[929,508],[958,532],[982,544]],
  [[982,544],[1000,578],[1029,607],[1038,638],[1020,656]],
  [[982,544],[950,563],[905,582],[850,601],[792,611],[733,618]],
  [[733,618],[705,650],[692,681],[692,711]],
  [[733,618],[729,576],[738,541],[727,493]],
  [[733,618],[674,630],[621,635],[575,627],[538,606],[514,580]],
  [[514,580],[474,555],[453,526],[447,494],[461,483]],
  [[461,483],[509,477],[554,469],[593,445]],
  [[461,483],[417,467],[377,451],[351,427],[333,398],[302,369],[279,349]],
  [[447,494],[413,519],[385,548],[372,573]],
  [[514,580],[487,608],[457,628],[432,659],[416,690]],
  [[575,627],[568,650],[555,677]]
 ];
 const scale=1440/1505,step=6,radius=12;
 const segments=trails.flatMap(line=>line.slice(1).map((p,i)=>[line[i].map(n=>n*scale),p.map(n=>n*scale)]));
 function distance(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);}
 function create(obstacles=[]){
  const points=[],index=new Map();
  const clear=(x,y)=>!obstacles.some(b=>x>=b.x-b.width/2-5&&x<=b.x+b.width/2+5&&y>=b.y-b.depth/2-4&&y<=b.y+b.depth/2+4);
  for(let y=174;y<=696;y+=step)for(let x=252;x<=1080;x+=step){if(clear(x,y)&&segments.some(([a,b])=>distance(x,y,a,b)<=radius)){index.set(`${x},${y}`,points.length);points.push({x,y,links:[]});}}
  points.forEach(p=>{for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){const id=index.get(`${p.x+dx},${p.y+dy}`);if(id!==undefined&&clear(p.x+dx/2,p.y+dy/2))p.links.push(id);}});
  const seen=new Set();let area=[];
  for(let i=0;i<points.length;i++){if(seen.has(i))continue;const part=[i];seen.add(i);for(let j=0;j<part.length;j++)for(const next of points[part[j]].links)if(!seen.has(next)){seen.add(next);part.push(next);}if(part.length>area.length)area=part;}
  function nearest(x,y){let best=null,d=Infinity;for(const id of area){const p=points[id],n=(p.x-x)**2+(p.y-y)**2;if(n<d){d=n;best=id;}}return best;}
  function route(from,to){if(from===null||to===null)return [];const prev=new Map([[from,null]]),queue=[from];for(let i=0;i<queue.length&&!prev.has(to);i++)for(const next of points[queue[i]].links)if(!prev.has(next)){prev.set(next,queue[i]);queue.push(next);}if(!prev.has(to))return [];const path=[];for(let at=to;at!==from;at=prev.get(at))path.push(at);return path.reverse();}
  return {points,area,nearest,route};
 }
 const api={create};if(typeof module!=='undefined')module.exports=api;else root.VillageWalking=api;
})(typeof window==='undefined'?globalThis:window);
