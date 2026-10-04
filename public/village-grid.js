/* Grass parcels traced in the original island painting; paths and scenery excluded. */
(function(root){
 const SIZE=12,scale=1440/1505;
 const parcels=[
 [[515,207],[557,184],[635,188],[674,206],[663,251],[621,266],[548,247]],
 [[709,240],[754,218],[828,230],[861,271],[839,299],[774,299],[720,275]],
 [[333,317],[395,298],[460,307],[487,335],[471,381],[409,394],[352,366]],
 [[531,329],[598,306],[668,320],[713,351],[717,382],[665,405],[601,409],[559,380]],
 [[791,350],[857,330],[921,322],[1016,324],[1015,362],[979,380],[912,403],[819,408],[781,388]],
 [[488,409],[542,413],[566,445],[524,463],[478,461]],
 [[311,478],[352,469],[409,486],[409,510],[375,534],[317,518]],
 [[501,512],[549,499],[605,510],[666,524],[704,553],[705,586],[661,609],[594,609],[531,581]],
 [[766,502],[811,483],[860,485],[905,515],[928,542],[889,564],[824,578],[763,556]],
 [[935,430],[996,409],[1058,431],[1062,468],[1038,502],[988,508],[952,483]],
 [[1020,556],[1082,519],[1143,521],[1170,555],[1150,598],[1080,621],[1040,604]],
 [[721,654],[759,638],[801,643],[858,663],[875,701],[824,726],[752,721],[714,701]],
 [[452,623],[480,611],[510,624],[536,655],[515,670],[462,662]]
 ].map(poly=>poly.map(([x,y])=>[x*scale,y*scale]));
 function inside(x,y,p){let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
 const cells=[],keys=new Set();for(let row=14;row<62;row++)for(let col=22;col<98;col++){const x=col*SIZE,y=row*SIZE;if(parcels.some(p=>[[1,1],[11,1],[11,11],[1,11]].every(([dx,dy])=>inside(x+dx,y+dy,p)))){cells.push({col,row,x,y});keys.add(col+','+row);}}
 const footprint=id=>id==='townhall'||id==='arena'?{w:6,h:4}:/^house:/.test(id)?{w:3,h:3}:{w:5,h:3};
 function fits(id,col,row){const {w,h}=footprint(id);for(let dx=0;dx<w;dx++)for(let dy=0;dy<h;dy++)if(!keys.has((col+dx)+','+(row+dy)))return false;return true;}
 function rect(id,p){const {w,h}=footprint(id);return {left:p.x-w*SIZE/2,top:p.y-h*SIZE/2,right:p.x+w*SIZE/2,bottom:p.y+h*SIZE/2};}
 function overlap(a,b){return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}
 const api={SIZE,cells,keys,footprint,fits,rect,overlap};if(typeof module!=='undefined')module.exports=api;else root.VillageGrid=api;
})(typeof window==='undefined'?globalThis:window);
