/* A furnished, locally rendered Town Hall. Units use a 24-unit eye height. */
(function(root){
 function build(){
 const faces=[],blockers=[];
 function quad(points,colour,material='wood'){faces.push({points,colour,material});}
 function box(x,y,z,w,h,d,c,material='wood',solid=false){const l=x-w/2,r=x+w/2,n=z-d/2,f=z+d/2,t=y+h;quad([[l,y,n],[r,y,n],[r,t,n],[l,t,n]],c,material);quad([[r,y,f],[l,y,f],[l,t,f],[r,t,f]],c,material);quad([[l,y,f],[l,y,n],[l,t,n],[l,t,f]],c,material);quad([[r,y,n],[r,y,f],[r,t,f],[r,t,n]],c,material);quad([[l,t,n],[r,t,n],[r,t,f],[l,t,f]],c,material);if(solid)blockers.push({x,z,w,d});}
 function beam(a,b,width,c){const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),ox=-dy/len*width/2,oy=dx/len*width/2;const p=[[a[0]+ox,a[1]+oy,a[2]-width/2],[b[0]+ox,b[1]+oy,b[2]-width/2],[b[0]-ox,b[1]-oy,b[2]-width/2],[a[0]-ox,a[1]-oy,a[2]-width/2]];quad(p,c);quad(p.map(v=>[v[0],v[1],v[2]+width]),c);for(let i=0;i<4;i++){const j=(i+1)%4;quad([p[i],p[j],[p[j][0],p[j][1],p[j][2]+width],[p[i][0],p[i][1],p[i][2]+width]],c);}}
 function cylinder(x,y,z,r,h,c,n=12){for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;quad([[x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],[x+Math.cos(b)*r,y+h,z+Math.sin(b)*r],[x+Math.cos(a)*r,y+h,z+Math.sin(a)*r]],c,'metal');quad([[x,y+h,z],[x+Math.cos(a)*r,y+h,z+Math.sin(a)*r],[x+Math.cos(b)*r,y+h,z+Math.sin(b)*r]],c,'metal');}}
 // Individually laid oak floorboards, stone enclosure, and vaulted timber ceiling.
 box(0,-3,120,220,3,240,'#a07848','wood');
 for(let row=0;row<24;row++)for(let col=0;col<5;col++){let x=-110+col*48+(row%2)*24;const l=Math.max(-110,x),r=Math.min(110,x+47.5);if(r>l)box((l+r)/2,0,row*10+5,r-l,.16,9.6,['#a98151','#b08a58','#967044','#bd945f'][(row*7+col*3)%4]);}
 box(-113,0,120,6,76,240,'#b6a88b','stone');box(113,0,120,6,76,240,'#b6a88b','stone');box(0,0,243,226,76,6,'#b6a88b','stone');box(0,0,-3,226,76,6,'#b6a88b','stone');
 quad([[-110,76,0],[0,110,0],[0,110,240],[-110,76,240]],'#745237');quad([[0,110,0],[110,76,0],[110,76,240],[0,110,240]],'#745237');
 quad([[-110,76,240],[110,76,240],[0,110,240]],'#a89a7c','stone');quad([[-110,76,0],[110,76,0],[0,110,0]],'#a89a7c','stone');
 for(const x of [-108,108]){box(x,0,120,4,4,240,'#593c29');box(x,29,120,4,2,240,'#6c4c30');for(const z of [3, 60,120,180,237]){box(x,0,z,7,78,7,'#62462f');box(x,0,z,10,6,10,'#876443');}}
 for(const z of [3,60,120,180,237]){beam([-110,75,z],[0,109,z],6,'#513923');beam([0,109,z],[110,75,z],6,'#513923');beam([-110,74,z],[110,74,z],5,'#64462c');beam([-108,55,z],[-80,74,z],4,'#64462c');beam([108,55,z],[80,74,z],4,'#64462c');}
 box(0,104,120,7,5,240,'#523821');
 // Teal woven runner with stitched gold borders and repeated diamond motifs.
 box(0,.25,120,68,.2,125,'#235b60','cloth');for(const x of [-31,31])box(x,.47,120,1,.03,120,'#d1b67a','cloth');for(const z of [60,180])box(0,.47,z,63,.03,1,'#d1b67a','cloth');for(let z=72;z<176;z+=20)quad([[0,.5,z-6],[7,.5,z],[0,.5,z+6],[-7,.5,z]],'#b69b61','cloth');for(let x=-32;x<=32;x+=2)for(const z of [56,184])box(x,.22,z,.5,.08,5,'#cdb77f','cloth');
 // Raised rear dais and carved council desk.
 box(0,0,216,110,3,46,'#715133','wood',true);box(0,0,189,102,1.5,9,'#947044');
 box(0,3,210,83,21,22,'#795032','wood',true);box(0,24,210,90,3,28,'#b08046');box(0,5,197.8,80,3,1,'#c19650');for(const x of [-35,-17,17,35])box(x,6,198,2,16,1.6,'#c39750');box(0,7,197.5,25,14,1,'#20545a');
 cylinder(0,29,210,4,1,'#a6813c');box(-20,27,207,12,.25,9,'#ebd7a4','paper');box(-16,27.3,211,8,.4,5,'#cebd89','paper');box(24,27,210,9,2,7,'#486b65');box(24,29,210,8,.4,6,'#dfcba1','paper');
 // High-backed chair and brass finials.
 box(0,4,230,25,16,3,'#65442c');box(0,20,230,25,30,3,'#735334');box(0,23,227.8,18,22,1,'#25646a','cloth');for(const x of [-13,13]){box(x,4,230,2,49,3,'#775c32');cylinder(x,53,230,2,3,'#d5ae60');}
 // Back-wall island chart in a broad gilded frame.
 box(0,40,238,65,37,2,'#5c4028');box(0,42,236.8,61,33,.8,'#bc9653');quad([[-28,44,236],[28,44,236],[28,73,236],[-28,73,236]],'#ffffff','map');
 for(const x of [-68,68]){box(x,44,237,22,34,1,'#205861','cloth');box(x,78,236,26,2,3,'#d4ac60');quad([[x-11,44,236],[x+11,44,236],[x,35,236]],'#205861','cloth');quad([[x,69,235.4],[x+6,61,235.4],[x,53,235.4],[x-6,61,235.4]],'#d6b46b','metal');}
 // Bookcases: shelves, dividers, and individually sized coloured spines.
 for(const z of [65,175]){box(-101,0,z,16,60,43,'#513822','wood',true);for(const y of [3,18,33,48,60])box(-99,y,z,20,2,46,'#a17a46');for(const zz of [z-21,z+21])box(-99,0,zz,20,61,2,'#89613a');for(let shelf=0;shelf<3;shelf++)for(let k=0;k<11;k++){const zz=z-18+k*3.5,h=8+(k*7+shelf*3)%6;box(-89,5+shelf*15,zz,2.4,h,2.7,['#456d65','#965745','#bb9753','#425567','#797144'][k%5]);box(-87.7,7+shelf*15,zz,.2,.6,2.8,'#d5b679');}}
 // Window alcoves with mullions, blue daylight and heavy green curtains.
 for(const z of [70,175]){box(109,26,z,2,39,31,'#513d2a');box(107.6,29,z,1,33,26,'#b9d8cd','glass');for(const zz of [z-13,z,z+13])box(106.5,29,zz,2,34,1.2,'#cdb982');box(106.5,44,z,2,1.2,27,'#cdb982');box(104,25,z,12,3,38,'#c0ae82','stone');for(const zz of [z-19,z+19]){for(let k=0;k<4;k++)box(105-k*.8,22,zz+k,2,45,1.2,k%2?'#275552':'#397069','cloth');}box(104,67,z,3,2,46,'#b19156');}
 // Stone hearth, dark firebox, stacked logs, faceted amber flames and mantel treasures.
 box(98,0,122,24,4,44,'#817b6b','stone',true);box(108,4,122,3,32,32,'#28241f','plain');for(const z of [102,142])box(99,4,z,22,36,7,'#9b9681','stone');box(99,35,122,25,8,48,'#a7a088','stone');box(101,43,122,18,28,35,'#8c8775','stone');box(97,42,122,29,3,51,'#c1b394','stone');
 for(let k=0;k<5;k++){box(98,5,112+k*4,15,3,3,'#44301f');quad([[89,7,110+k*5],[97,13+k%3*3,112+k*5],[102,6,114+k*5]],k%2?'#ffd57c':'#ec913d','glow');}cylinder(97,45,106,3,8,'#b39451');cylinder(97,45,138,3,5,'#54857c');
 // Reading table and benches; feet and top are distinct solid forms.
 blockers.push({x:-57,z:119,w:29,d:43});for(const x of [-69,-45])for(const z of [100,138]){box(x,0,z,4,18,4,'#775738');box(x,2,z,6,2,6,'#977140');}box(-57,14,119,29,3,43,'#775738');box(-57,18,119,35,3,49,'#ac8350');for(const z of [88,150]){box(-57,0,z,29,10,9,'#725337','wood',true);box(-57,10,z,34,2,12,'#a57e4b');}box(-59,21,120,16,.5,13,'#e6d4a8','paper');box(-55,22,123,10,1,7,'#436b68');
 // Entry door, iron straps, and small coat pegs.
 box(0,0,1,38,53,3,'#5e4029');for(const x of [-21,21])box(x,0,3,4,57,6,'#a58e68','stone');box(0,53,3,46,5,6,'#a58e68','stone');for(const y of [13,37])box(0,y,3.1,35,2,.7,'#343c37','metal');cylinder(12,25,4,1.5,2,'#cfad60');
 // Suspended hexagonal chandelier, chains, candle cups and warm wax tips.
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2,b=(i+1)/8*Math.PI*2,x=Math.cos(a)*24,z=124+Math.sin(a)*24;quad([[x,61,z],[Math.cos(b)*24,61,124+Math.sin(b)*24],[Math.cos(b)*24,64,124+Math.sin(b)*24],[x,64,z]],'#a27d3c','metal');cylinder(x,63,z,3,1,'#bd9a52');cylinder(x,64,z,1.5,7,'#e7d6a6');cylinder(x,71,z,.8,2,'#ffe6a1',6);if(i%2===0)beam([x,64,z],[0,98,124],.6,'#65553b');}
 return {faces,blockers,spawn:{x:0,z:32,yaw:0,pitch:0}};
 }
 function navigation(room){const valid=(x,z)=>Number.isFinite(x)&&Number.isFinite(z)&&x>-104&&x<104&&z>7&&z<234&&!room.blockers.some(b=>Math.abs(x-b.x)<b.w/2+5&&Math.abs(z-b.z)<b.d/2+5);return {valid,spawn:()=>({...room.spawn}),move(p,dx,dz){let {x,z}=p;const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/2));for(let i=0;i<n;i++){if(valid(x+dx/n,z+dz/n)){x+=dx/n;z+=dz/n;}else if(valid(x+dx/n,z))x+=dx/n;else if(valid(x,z+dz/n))z+=dz/n;}return {x,z};}};}
 const api={build,navigation};if(typeof module!=='undefined')module.exports=api;else root.TownHallRoom=api;
})(typeof window==='undefined'?globalThis:window);
