const test=require('node:test'),assert=require('node:assert/strict');
function harness(){
 const records={'users/admin':{isAdmin:true},'users/player':{isAdmin:false}},handlers={};
 const snapshot=key=>({id:key.split('/').pop(),data:()=>structuredClone(records[key])});
 const db={collection:name=>({doc:id=>({get:async()=>snapshot(name+'/'+id),set:async data=>{records[name+'/'+id]=structuredClone(data);}}),get:async()=>({docs:Object.keys(records).filter(k=>k.startsWith(name+'/')).map(snapshot)})})};
 const app=Object.fromEntries(['get','post'].map(method=>[method,(url,fn)=>handlers[method]=fn]));require('./pack-reward-presets')(app,db,async req=>{if(req.user==='anonymous')throw Error('Sign in');return req.user;});
 return {records,invoke:async(method,body={},user='admin')=>{let status=200,payload;await handlers[method]({body,user},{status(value){status=value;return this;},send(value){payload=value;},json(value){payload=value;}});return {status,payload};}};
}
const cards=()=>[{title:'Ruby bonus',options:[{kind:'gem',id:'bronze',min:5,max:15,chance:100}]}];
test('only admins can save and list reward presets',async()=>{
 const h=harness();for(const method of ['get','post']){assert.equal((await h.invoke(method,{name:'Bonus',cards:cards()},'player')).status,403);assert.equal((await h.invoke(method,{},'anonymous')).status,401);}
});
test('presets preserve reward amounts and odds and are independent copies',async()=>{
 const h=harness(),body={name:'Ruby bonus',cards:cards()},saved=await h.invoke('post',body);assert.equal(saved.status,200);body.cards[0].options[0].min=99;
 const listed=await h.invoke('get');assert.equal(listed.payload.presets.length,1);assert.equal(listed.payload.presets[0].cards[0].options[0].min,5);assert.equal(listed.payload.presets[0].cards[0].options[0].max,15);assert.equal(listed.payload.presets[0].cards[0].options[0].chance,100);
 listed.payload.presets[0].cards[0].title='Edited locally';assert.equal((await h.invoke('get')).payload.presets[0].cards[0].title,'Ruby bonus');
 const invalid=cards();invalid[0].options[0].chance=50;assert.equal((await h.invoke('post',{name:'Bad',cards:invalid})).status,400);assert.equal((await h.invoke('post',{name:'',cards:cards()})).status,400);assert.equal((await h.invoke('post',{name:'Empty',cards:[]})).status,400);assert.equal((await h.invoke('get')).payload.presets.length,1);
});
