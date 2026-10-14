const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib');
const context={window:{}};vm.runInNewContext(fs.readFileSync('public/card-mask-files.js','utf8'),context);const files=context.window.CardMaskFiles;
function decode(bytes){let offset=8,w,h,parts=[];while(offset<bytes.length){const n=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8),data=bytes.subarray(offset+8,offset+8+n);offset+=n+12;if(type==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);assert.equal(data[8],8);assert.equal(data[9],6);assert.equal(data[12],0);}if(type==='IDAT')parts.push(data);}
 const raw=zlib.inflateSync(Buffer.concat(parts)),stride=w*4,pixels=Buffer.alloc(stride*h);let at=0;for(let y=0;y<h;y++){const filter=raw[at++];for(let x=0;x<stride;x++){const index=y*stride+x,a=x>=4?pixels[index-4]:0,b=y?pixels[index-stride]:0,c=y&&x>=4?pixels[index-stride-4]:0;let v=0;if(filter===1)v=a;else if(filter===2)v=b;else if(filter===3)v=(a+b)>>1;else if(filter===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}pixels[index]=(raw[at++]+v)&255;}}
 return {w,h,pixels};}
test('all generated masks retain every colored source pixel and match unchanged source images',()=>{
 assert.ok(Object.keys(files).length>=70);let whiteRemoved=0;
 for(const [name,hash] of Object.entries(files)){const source=fs.readFileSync('public/images/'+name);assert.equal(crypto.createHash('sha256').update(source).digest('hex'),hash,name);const {w,h,pixels}=decode(source),mask=fs.readFileSync('public/assets/card-masks/'+name+'.svg','utf8'),kept=new Uint8Array(w*h);assert.ok(mask.includes(`viewBox="0 0 ${w} ${h}"`));
  for(const match of mask.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)){const x=Number(match[1]),y=Number(match[2]),n=Number(match[3]);assert.equal(n,Number(match[4]));assert.ok(x+n<=w&&y<h);kept.fill(1,y*w+x,y*w+x+n);}
  for(let i=0;i<w*h;i++){const at=i*4;if(!pixels[at+3])continue;const white=pixels[at]>=254&&pixels[at+1]>=254&&pixels[at+2]>=254;if(!white&&kept[i]!==1)assert.fail(name+': artwork removed at '+i);if(white&&!kept[i])whiteRemoved++;}
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
