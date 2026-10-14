const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib');
const context={window:{}};vm.runInNewContext(fs.readFileSync('public/card-mask-files.js','utf8'),context);const files=context.window.CardMaskFiles;
function decode(bytes){let offset=8,w,h,parts=[];while(offset<bytes.length){const n=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8),data=bytes.subarray(offset+8,offset+8+n);offset+=n+12;if(type==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);assert.equal(data[8],8);assert.equal(data[9],6);assert.equal(data[12],0);}if(type==='IDAT')parts.push(data);}
 const raw=zlib.inflateSync(Buffer.concat(parts)),stride=w*4,pixels=Buffer.alloc(stride*h);let at=0;for(let y=0;y<h;y++){const filter=raw[at++];for(let x=0;x<stride;x++){const index=y*stride+x,a=x>=4?pixels[index-4]:0,b=y?pixels[index-stride]:0,c=y&&x>=4?pixels[index-stride-4]:0;let v=0;if(filter===1)v=a;else if(filter===2)v=b;else if(filter===3)v=(a+b)>>1;else if(filter===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}pixels[index]=(raw[at++]+v)&255;}}
 return {w,h,pixels};}
test('all generated masks preserve card interiors and match unchanged source images',()=>{
 assert.ok(Object.keys(files).length>=70);let whiteRemoved=0;
 for(const [name,hash] of Object.entries(files)){const source=fs.readFileSync('public/images/'+name);assert.equal(crypto.createHash('sha256').update(source).digest('hex'),hash.sourceHash,name);const {w,h,pixels}=decode(source),mask=fs.readFileSync('public/assets/card-masks/'+name+'.svg','utf8'),kept=new Uint8Array(w*h);assert.ok(mask.includes(`viewBox="0 0 ${w} ${h}"`));
  assert.equal(crypto.createHash('sha256').update(mask).digest('hex'),hash.maskHash,name);
  const crossings=Array.from({length:h},()=>[]);const path=mask.match(/ d="([^"]+)"/)[1];
  for(const contour of path.split('Z').filter(Boolean)){const points=[...contour.matchAll(/[ML](\d+) (\d+)/g)].map(m=>[Number(m[1]),Number(m[2])]);for(let i=0;i<points.length;i++){const [x,y]=points[i],[nx,ny]=points[(i+1)%points.length];assert.ok(x===nx||y===ny);if(x===nx)for(let row=Math.min(y,ny);row<Math.max(y,ny);row++)crossings[row].push(x);}}
  for(let y=0;y<h;y++){const edges=crossings[y].sort((a,b)=>a-b);assert.equal(edges.length%2,0);for(let i=0;i<edges.length;i+=2)kept.fill(1,y*w+edges[i],y*w+edges[i+1]);}

  const rowBounds=Array.from({length:h},(_,y)=>{let left=0,right=w-1;while(left<w&&!kept[y*w+left])left++;while(right>=0&&!kept[y*w+right])right--;return [left,right];});
  const background=(x,y)=>{const at=(y*w+x)*4;if(!pixels[at+3])return true;const low=Math.min(pixels[at],pixels[at+1],pixels[at+2]),high=Math.max(pixels[at],pixels[at+1],pixels[at+2]);return low>=242&&high-low<=10;};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!pixels[i*4+3])continue;if(background(x,y)&&!kept[i])whiteRemoved++;
   // All central artwork (including white lettering) must remain fully visible.
   if(x>=w*.3&&x<w*.7&&y>=h*.25&&y<h*.75&&kept[i]!==1)assert.fail(name+': central artwork removed at '+i);
   if(kept[i]||background(x,y)||Math.min(pixels[i*4],pixels[i*4+1],pixels[i*4+2])>=220||x<rowBounds[y][0]+2||x>rowBounds[y][1]-2||y<2||y>=h-2)continue;
   let interior=true;for(let dy=-2;dy<=2&&interior;dy++)for(let dx=-2;dx<=2;dx++)if(background(x+dx,y+dy)){interior=false;break;}
   if(interior)assert.fail(name+': interior artwork removed at '+i);
  }

 }
 assert.ok(whiteRemoved>10000);
});
test('display masks follow dynamic card images, preserve src, and leave unrelated images alone',()=>{
 let notify;const style=new Map(),classes=new Set(),image={src:'/images/Bronze_jan.png',getAttribute(){return this.src;},style:{getPropertyValue:k=>style.get(k)||'',setProperty:(k,v)=>style.set(k,v)},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},nodeType:1,matches:s=>s==='img',querySelectorAll:()=>[]};
 const window={CardMaskFiles:files,addEventListener(){}};const env={window,URL,WeakMap,Set,Object,API_URL:'https://api.example.com',location:{origin:'https://game.example.com'},document:{baseURI:'https://game.example.com/index.html',body:{},querySelectorAll:()=>[image]},MutationObserver:class{constructor(fn){notify=fn;}observe(){}disconnect(){}}};
 vm.runInNewContext(fs.readFileSync('public/card-cutouts.js','utf8'),env);assert.equal(image.src,'/images/Bronze_jan.png');assert.ok(classes.has('card-image-cutout'));assert.ok(style.get('mask-image').includes('Bronze_jan.png.svg'));
 image.src='/assets/creatures/tharos-poster.png';notify([{type:'attributes',target:image}]);assert.equal(classes.has('card-image-cutout'),false);assert.equal(style.get('mask-image'),'');
 image.src='https://unrelated.example/images/Bronze_jan.png';window.CardCutouts.attach(image);assert.equal(classes.has('card-image-cutout'),false);
 image.src='https://api.example.com/images/Bronze_jan.png';notify([{type:'childList',addedNodes:[image]}]);assert.ok(classes.has('card-image-cutout'));
});
