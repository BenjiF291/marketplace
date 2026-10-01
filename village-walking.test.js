const test=require('node:test'),assert=require('node:assert/strict'),walking=require('./public/village-walking'),layout=require('./public/village-layout');
test('paths span the village and avoid every occupied building footprint',()=>{
 const obstacles=Object.values(layout.profile({}).positions).map(n=>({...layout.PLOTS[n],width:78,depth:30}));
 const map=walking.create(obstacles),xs=map.area.map(i=>map.points[i].x),ys=map.area.map(i=>map.points[i].y);
 assert.ok(Math.max(...xs)-Math.min(...xs)>700);assert.ok(Math.max(...ys)-Math.min(...ys)>450);
 for(const p of map.points)for(const b of obstacles)assert.ok(!(p.x>=b.x-b.width/2-5&&p.x<=b.x+b.width/2+5&&p.y>=b.y-b.depth/2-4&&p.y<=b.y+b.depth/2+4));
 for(let i=0;i<map.area.length;i+=91){const from=map.area[i],to=map.area[(i+1000)%map.area.length],path=map.route(from,to);assert.equal(path.at(-1),to);let previous=from;for(const next of path){assert.ok(map.canTravel(map.points[previous],map.points[next]));previous=next;}}
});
test('water, forest, fountain and cliffs are excluded; moved buildings change routes',()=>{
 const map=walking.create();for(const [x,y] of [[100,100],[700,900],[1200,500],[660,430],[350,200],[950,180]]){const p=map.points[map.nearest(x,y)];assert.ok(Math.hypot(p.x-x,p.y-y)>15);}
 const p=map.points[map.area[100]],changed=walking.create([{...p,width:78,depth:30}]);assert.ok(!changed.points.some(n=>n.x===p.x&&n.y===p.y));
});

test('routes use long diagonal strides rather than horizontal/vertical stair steps',()=>{
 const map=walking.create(),from=map.nearest(480,280),to=map.nearest(550,398),path=map.route(from,to);
 assert.equal(path.at(-1),to);let previous=map.points[from],diagonal=false,long=false;
 for(const id of path){const p=map.points[id];if(p.x!==previous.x&&p.y!==previous.y)diagonal=true;if(Math.hypot(p.x-previous.x,p.y-previous.y)>18)long=true;assert.ok(map.canTravel(previous,p));previous=p;}
 assert.ok(diagonal);assert.ok(long);
});
test('smoothing rejects shortcuts across the fountain and thin obstacles between endpoints',()=>{
 const map=walking.create();assert.equal(map.canTravel({x:620,y:430},{x:710,y:430}),false);
 const a=map.points[map.nearest(480,290)],b=map.points[map.nearest(484,302)];assert.ok(map.canTravel(a,b));
 const blocked=walking.create([{x:(a.x+b.x)/2,y:(a.y+b.y)/2,width:1,depth:1}]);assert.equal(blocked.canTravel(a,b),false);
});
