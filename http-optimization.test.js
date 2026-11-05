const test=require('node:test'),assert=require('node:assert/strict'),express=require('express'),http=require('node:http'),path=require('node:path'),zlib=require('node:zlib');
test('HTTP responses compress JSON, preserve private state, and cache only public assets',async()=>{
 const app=express();require('./http-optimization')(app,path.join(__dirname,'public'));
 const payload={items:Array.from({length:1000},(_,i)=>({id:i,name:'Pocket Dragon',grade:1}))};
 app.get('/test-state',(req,res)=>res.json(payload));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const get=(url,headers={})=>new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port:server.address().port,path:url,headers},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));}).on('error',reject);});
 try{
  const response=await get('/test-state',{'Accept-Encoding':'gzip'});
  assert.equal(response.headers['content-encoding'],'gzip');assert.equal(response.headers['cache-control'],'private, no-store');
  assert.deepEqual(JSON.parse(zlib.gunzipSync(response.body)),payload);assert.ok(response.body.length<JSON.stringify(payload).length/4);
  const asset=await get('/assets/pwa/island-icon-v3-192.png');assert.equal(asset.headers['cache-control'],'public, max-age=3600');
  const manifest=await get('/manifest.webmanifest');assert.equal(manifest.status,200);assert.match(manifest.headers['content-type'],/application\/manifest\+json/);assert.equal(manifest.headers['cache-control'],'public, max-age=0, must-revalidate');
  const code=await get('/app.js');assert.equal(code.headers['cache-control'],'public, max-age=0, must-revalidate');
  assert.equal((await get('/app.js',{'If-None-Match':code.headers.etag})).status,304);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
