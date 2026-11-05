const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('achievement notifications persist, acknowledge only earned IDs, and never clear another account',async()=>{
 const users={a:{username:'A',advancements:{hall1:123}},b:{username:'B',advancements:{hall1:123}}},handlers={};
 const db={collection:()=>({doc:id=>({id})}),runTransaction:fn=>fn({get:async ref=>({exists:!!users[ref.id],data:()=>structuredClone(users[ref.id])}),update:(ref,data)=>Object.assign(users[ref.id],data)})};
 require('./advancement-routes')({get:(path,fn)=>handlers[path]=fn,post:(path,fn)=>handlers[path]=fn},db,async req=>{if(!req.user)throw Error();return req.user;});
 const earned=require('./advancements').CATALOG[0].id;
 users.a.advancements={[earned]:123};users.b.advancements={[earned]:123};
 async function call(path,body={},user='a'){let status=200,value;await handlers[path]({user,body,query:{}},{status(s){status=s;return this;},send(v){value=v;},json(v){value=v;}});return {status,value};}
 assert.ok((await call('/advancements/notifications')).value.unreadIds.includes(earned));
 assert.equal((await call('/advancements/seen',{ids:['not-a-badge']})).status,400);
 assert.equal((await call('/advancements/seen',{ids:[earned],player:'b'})).status,200);
 assert.ok(!(await call('/advancements/notifications')).value.unreadIds.includes(earned));
 assert.ok((await call('/advancements/notifications',{},'b')).value.unreadIds.includes(earned));
 assert.equal((await call('/advancements/seen',{ids:[earned]})).status,200);
 assert.notEqual((await call('/advancements/notifications',{},null)).status,200);
});

test('only visible achievement cards in an open profile are acknowledged',async()=>{
 let observe,queued=[],unread=['one','two'],count=0,requests=[];
 const ctx={currentUserId:'a',API_URL:'',resourceHeaders:()=>({}),document:{hidden:false,addEventListener(){}},window:{addEventListener(){},IslandTools:{setAchievementCount:n=>count=n}},IntersectionObserver:class{constructor(fn){observe=fn;}observe(){}unobserve(){}disconnect(){}},setInterval(){},setTimeout:fn=>{queued.push(fn);return queued.length;},clearTimeout(){},fetch:async(url,options)=>{requests.push(url);if(options?.body){const ids=JSON.parse(options.body).ids;unread=unread.filter(id=>!ids.includes(id));}return {ok:true,json:async()=>({unreadIds:unread})};}};
 vm.runInNewContext(fs.readFileSync('public/achievement-notifications.js','utf8'),ctx);const api=ctx.window.AchievementNotifications;
 await api.refresh();assert.equal(count,2);const root={open:true};api.watch(root);
 observe([{isIntersecting:true,intersectionRatio:.2,target:{dataset:{achievementId:'one'}}}]);assert.equal(queued.length,0);
 observe([{isIntersecting:true,intersectionRatio:.8,target:{dataset:{achievementId:'one'}}}]);await queued.pop()();assert.equal(count,1);
 root.open=false;observe([{isIntersecting:true,intersectionRatio:1,target:{dataset:{achievementId:'two'}}}]);assert.equal(queued.length,0);assert.equal(count,1);
});
