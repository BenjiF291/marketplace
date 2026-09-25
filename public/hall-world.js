(function(root){
 const SEATS=[{x:290,y:218},{x:395,y:218},{x:505,y:218},{x:610,y:218},{x:290,y:418},{x:395,y:418},{x:505,y:418},{x:610,y:418}];
 const SKINS=['#efc9a1','#d9a278','#ad7150','#754c38'],HAIR=['#382b27','#855336','#d8b46e','#d8d5cd'],COATS=['#486f89','#a35c60','#587b58','#8b6d9f','#bd9650'];
 function character(value={}){const pick=(key,list)=>list.includes(value[key])?value[key]:list[0];return {skin:pick('skin',SKINS),hair:pick('hair',HAIR),coat:pick('coat',COATS),style:['short','long','curly'].includes(value.style)?value.style:'short'};}
 const blocked=(x,y)=>x<60||x>840||y<150||y>550||(x>240&&x<660&&y>245&&y<390);
 function position(member,now){const path=member.path||[{x:member.x||450,y:member.y||515}];let distance=Math.max(0,now-(member.startedAt??now))*.15;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],length=Math.hypot(b.x-a.x,b.y-a.y);if(distance<length){const t=distance/length;return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}distance-=length;}return path.at(-1);}
 function route(from,to){
  if(!Number.isFinite(to.x)||!Number.isFinite(to.y)||blocked(to.x,to.y))throw Error('Choose an open part of the floor.');
  const cell=p=>({x:Math.round(p.x/10),y:Math.round(p.y/10)}),start=cell(from),end=cell(to),key=p=>p.x+','+p.y,queue=[start],seen=new Map([[key(start),null]]);let found=false;
  for(let i=0;i<queue.length;i++){const p=queue[i];if(key(p)===key(end)){found=true;break;}for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,y:p.y+dy};if(blocked(n.x*10,n.y*10)||seen.has(key(n)))continue;seen.set(key(n),p);queue.push(n);}}
  if(!found)throw Error('That spot cannot be reached.');const points=[to];let p=end;while(p){points.push({x:p.x*10,y:p.y*10});p=seen.get(key(p));}points.push(from);return points.reverse();
 }
 const api={SEATS,SKINS,HAIR,COATS,character,position,route,blocked};if(typeof module!=='undefined')module.exports=api;else root.HallWorld=api;
})(typeof window==='undefined'?globalThis:window);
