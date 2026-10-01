/* Pure local navigation rules shared by the first-person view and its tests. */
(function(root){
 const radius=5;
 function distance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
 const shore=[[245,340],[305,280],[440,270],[485,175],[650,150],[805,155],[960,230],[1080,300],[1165,420],[1180,560],[1070,655],[920,710],[810,755],[650,765],[530,740],[365,725],[290,600],[225,480]];
 function inside(x,z,polygon){let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++)if((polygon[i][1]>z)!==(polygon[j][1]>z)&&x<(polygon[j][0]-polygon[i][0])*(z-polygon[i][1])/(polygon[j][1]-polygon[i][1])+polygon[i][0])yes=!yes;return yes;}
 function create(roads,buildings,scenery=[],boundary=shore){
  const blockers=buildings.map(b=>({x:b.x,z:b.z,w:b.w||58,d:b.d||32}));
  const clear=(x,z)=>!scenery.some(o=>Math.hypot(x-o.x,z-o.z)<(o.radius||0)+radius)&&!blockers.some(b=>Math.abs(x-b.x)<b.w/2+radius&&Math.abs(z-b.z)<b.d/2+radius);
  const lanes=roads.map(([a,b])=>[a,b,11]);
  for(const b of buildings){const door=[b.x,b.z+(b.d||32)/2+7];let best=null,dist=Infinity;
   const candidates=[];
   for(const [a,c] of roads){const count=Math.max(1,Math.ceil(Math.hypot(c[0]-a[0],c[1]-a[1])/8));for(let i=0;i<=count;i++){const t=i/count,q=[a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t];candidates.push({q,n:Math.hypot(q[0]-door[0],q[1]-door[1])});}}
   candidates.sort((a,b)=>a.n-b.n);
   for(const {q,n} of candidates){let safe=true;const steps=Math.max(1,Math.ceil(n/2));for(let i=0;i<=steps;i++){const t=i/steps;if(!clear(door[0]+(q[0]-door[0])*t,door[1]+(q[1]-door[1])*t)){safe=false;break;}}if(safe){best=q;dist=n;break;}}

   if(best)lanes.push([best,door,9]);
  }
  const valid=(x,z)=>Number.isFinite(x)&&Number.isFinite(z)&&clear(x,z)&&inside(x,z,boundary)&&boundary.every((a,i)=>distance(x,z,a,boundary[(i+1)%boundary.length])>=radius);
  function move(pos,dx,dz){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/2));let {x,z}=pos;for(let i=0;i<steps;i++){const nx=x+dx/steps,nz=z+dz/steps;if(valid(nx,nz)){x=nx;z=nz;}else if(valid(nx,z))x=nx;else if(valid(x,nz))z=nz;}return {x,z};}
  function spawn(preferred={x:700,z:485}){if(valid(preferred.x,preferred.z))return {...preferred};let best=null,dist=Infinity;for(const [a,b] of lanes){const steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3);for(let i=0;i<=steps;i++){const t=i/(steps||1),x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,n=Math.hypot(x-preferred.x,z-preferred.z);if(n<dist&&valid(x,z)){best={x,z};dist=n;}}}return best;}
  function doorVisible(pos,b){const door={x:b.x,z:b.z+(b.d||32)/2+.5};if(Math.hypot(pos.x-door.x,pos.z-door.z)>95)return false;const length=Math.hypot(pos.x-door.x,pos.z-door.z);for(let i=1;i<length-1;i++){const t=i/length,x=pos.x+(door.x-pos.x)*t,z=pos.z+(door.z-pos.z)*t;if(blockers.some(o=>o.x!==b.x||o.z!==b.z?Math.abs(x-o.x)<o.w/2&&Math.abs(z-o.z)<o.d/2:false))return false;}return true;}
  return {lanes,valid,move,spawn,doorVisible};
 }
 const api={create,distance,shore,inside};if(typeof module!=='undefined')module.exports=api;else root.IslandWalkWorld=api;
})(typeof window==='undefined'?globalThis:window);
