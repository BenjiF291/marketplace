const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('localhost game requests use the local backend while hosted games use Render',()=>{
 const source=fs.readFileSync('public/app.js','utf8'),definition=source.slice(source.indexOf('const API_URL ='),source.indexOf('let isServerOnline'));
 for(const hostname of ['localhost','127.0.0.1','[::1]','marketplace-aw8b.onrender.com','fishy-20779.web.app']){
  const result=vm.runInNewContext(definition+'\nAPI_URL',{window:{location:{hostname}}});assert.equal(result,['localhost','127.0.0.1','[::1]'].includes(hostname)?'http://localhost:3000':'https://marketplace-aw8b.onrender.com');
 }
});
