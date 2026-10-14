const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const rules=require('./free-pack');
function harness(){
 const ids=new Map(),nodes=[];
 class Node{constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.dataset={};this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.listeners={};this.className='';this.style={setProperty:(k,v)=>{this.style[k]=v;}};this.isConnected=true;this.classList={add:name=>this.className+=' '+name};nodes.push(this);}
 focus(){}set innerHTML(value){this._html=value;this.children=[];if(value.includes('class="reward-wrapper-name"')){const name=new Node('strong');name.className='reward-wrapper-name';this.append(name);}}get innerHTML(){return this._html;}
 set id(value){this._id=value;ids.set(value,this);}get id(){return this._id;}setAttribute(k,v){this.attributes[k]=v;}append(...children){for(const c of children){if(c.parentNode)c.parentNode.children=c.parentNode.children.filter(n=>n!==c);c.parentNode=this;this.children.push(c);}}replaceChildren(...children){this.children=[];this.append(...children);}remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.isConnected=false;}addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}showModal(){this.open=true;}close(){this.open=false;for(const fn of this.listeners.close||[])fn();}click(){if(!this.disabled)return this.onclick?.({target:this,stopPropagation(){}});}
 matches(selector){return selector.startsWith('.')?this.className.split(' ').includes(selector.slice(1)):selector==='button:not(:disabled)'?this.tag==='button'&&!this.disabled:this.tag===selector;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}querySelectorAll(selector){return this.children.flatMap(c=>[...(c.matches(selector)?[c]:[]),...c.querySelectorAll(selector)]);}}
 const body=new Node('body'),storage=new Map(),config=rules.defaults(),catalog={animal:require('./public/stable-animals').animals,gem:[{id:'bronze',name:'Ruby'},{id:'rare-bronze',name:'Garnet'}],boost:[{id:'skip',name:'Skip'},{id:'leap',name:'Leap'}]};let saved,claims=0;
 const timers=new Map();let timerId=0;
 const context={console,setTimeout:(fn)=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),matchMedia:()=>({matches:false}),Date,Math,Number,Object,Array,JSON,crypto:{randomUUID:()=> 'preview-claim'},currentUserId:'u',API_URL:'',resourceHeaders:()=>({}),loadUsers(){},loadInventory(){},setInterval:()=>1,clearInterval(){},
 localStorage:{getItem:key=>storage.get(key),setItem:(key,v)=>storage.set(key,v),removeItem:key=>storage.delete(key)},Event:class{},window:{addEventListener(){},dispatchEvent(){}},
 document:{body,hidden:false,createElement:tag=>new Node(tag),getElementById:id=>ids.get(id),querySelector:selector=>selector==='#villageMap[open]'?{}:body.querySelector(selector)},
 Option:function(text,value){const n=new Node('option');n.textContent=text;n.value=value;return n;},
 fetch:async(url,options)=>{let data;if(url==='/free-pack')data={config,serverNow:Date.now(),nextAt:0,canClaim:true,canEdit:true};else if(url==='/free-pack/claim'){claims++;data={requestId:'preview-claim',name:config.name,nextAt:Date.now()+25200000,rewards:rules.draw(config,()=>0).map(r=>({...r,label:rules.label(r,catalog)}))};}else if(options.method==='PUT'){saved=JSON.parse(options.body);data={config:saved};}else data={config,catalog};return {ok:true,json:async()=>data};}};
 context.window.StableAnimals=require('./public/stable-animals');vm.createContext(context);vm.runInContext(fs.readFileSync('public/reward-card-art.js','utf8'),context);context.RewardCardArt=context.window.RewardCardArt;vm.runInContext(fs.readFileSync('public/reward-opening.js','utf8'),context);vm.runInContext(fs.readFileSync('public/free-pack.js','utf8'),context);vm.runInContext(fs.readFileSync('public/island-tools.js','utf8'),context);
 return {context,body,Node,ids,timers,flush(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());},get claims(){return claims;},get saved(){return saved;}};
}
test('toolbar has five actions, retracts accessibly, and forwards arrange and profile actions',async()=>{
 const h=harness();const launcher=new h.Node('button');launcher.textContent='Creature book';const bar=h.context.window.IslandTools.wrap(launcher);h.body.append(bar);
 const actions=bar.querySelector('.island-tool-actions');assert.equal(actions.children.length,6);
 const toggle=bar.querySelector('.island-tools-toggle');toggle.click();assert.equal(actions.hidden,true);assert.equal(toggle.attributes['aria-expanded'],'false');toggle.click();assert.equal(actions.hidden,false);
 let arranged=0,profile=0;const source=new h.Node('button');source.id='arrangeVillageButton';source.onclick=()=>arranged++;h.context.PlayerProfile={open:()=>profile++};
 await actions.children[2].click();actions.children[3].click();assert.equal(arranged,1);assert.equal(profile,1);
 const select=new h.Node('select');select.id='villageBuildingFinder';let changed=0;select.onchange=()=>changed++;h.context.window.IslandTools.attachBuildingFinder(select);const finder=bar.querySelector('.island-building-finder');assert.equal(finder.hidden,false);assert.equal(select.parentNode,finder);select.onchange();assert.equal(changed,1);h.context.window.IslandTools.attachBuildingFinder(select);assert.equal(finder.querySelectorAll('select').length,1);
});
test('player can claim and reveal five rewards, and an admin can edit all card option rows',async()=>{
 const h=harness();await h.context.window.FreePack.open();let opening=h.body.querySelector('.reward-opening');assert.equal(opening.open,true);assert.equal(h.claims,0);
 await opening.querySelector('.reward-opening-details').click();const box=h.body.querySelector('.free-pack-dialog');assert.equal(box.open,true);assert.equal(box.querySelector('.free-pack-claim').disabled,false);
 await box.querySelector('.free-pack-edit').click();const editor=h.body.querySelector('.free-pack-editor');assert.equal(editor.querySelectorAll('fieldset').length,5);assert.equal(editor.querySelectorAll('.free-pack-option').length,21);
 const animalRow=editor.querySelectorAll('.free-pack-option').at(-1),selectors=animalRow.querySelectorAll('select');selectors[0].value='animal';selectors[0].onchange();assert.equal(selectors[1].children.length,17);selectors[1].value='tharos';
 const name=editor.querySelector('input');name.value='Edited daily pack';await editor.querySelector('form').onsubmit({preventDefault(){}});assert.equal(h.saved.name,'Edited daily pack');assert.equal(h.saved.cards.length,5);assert.equal(h.saved.cards[4].options[0].kind,'animal');assert.equal(h.saved.cards[4].options[0].id,'tharos');
 await box.querySelector('.free-pack-claim').click();opening=h.body.querySelector('.reward-opening');await opening.querySelector('.reward-opening-pack').click();assert.equal(h.claims,1);h.flush();assert.equal(opening.querySelectorAll('.reward-pack-card').length,5);
 for(let i=0;i<5;i++){opening.onclick({target:opening});opening.onclick({target:opening});assert.equal(h.timers.size,1);h.flush();assert.equal(opening.querySelectorAll('.reward-pack-card').length,4-i);}
 assert.equal(opening.open,false);assert.equal(h.claims,1);

});

test('Stable renders owned animals and opens their book information, then returns to the island',async()=>{
 const h=harness();let shown,returned=0;h.context.CreatureBook={openCreature:id=>shown=id};
 h.context.fetch=async()=>({ok:true,json:async()=>({total:2,animals:[{id:'tharos',name:'Tharos',species:'Veyrin',poster:'assets/creatures/tharos-poster.png',count:2}]})});
 vm.runInContext(fs.readFileSync('public/stable.js','utf8'),h.context);await h.context.window.Stable.open(()=>returned++);
 const box=h.body.querySelector('.stable-dialog');assert.equal(box.open,true);assert.equal(box.querySelector('.stable-total').textContent,'2 animals in your Stable');assert.equal(box.querySelectorAll('.stable-animal').length,1);
 box.querySelector('.stable-animal').querySelector('button').click();assert.equal(shown,'tharos');box.querySelector('.stable-header').querySelector('button').click();assert.equal(returned,1);assert.equal(box.open,false);
});

test('opening retries failed requests, supports reduced motion, and keeps collection bonuses as separate cards',async()=>{
 const h=harness();h.context.matchMedia=()=>({matches:true});let attempts=0,done;
 const opening=h.context.window.RewardOpening.play({name:'Test pack',open:async()=>{if(++attempts===1)throw Error('Offline');return {cardId:'Bronze_jan.png',packBonus:5,rubyBonus:2};},onClose:completed=>done=completed});
 await opening.querySelector('.reward-opening-pack').click();assert.equal(opening.dataset.phase,'ready');assert.ok(opening.querySelector('.reward-opening-status').textContent.includes('Offline'));
 await opening.querySelector('.reward-opening-pack').click();h.flush();assert.equal(opening.querySelectorAll('.reward-pack-card').length,3);
 for(let i=0;i<3;i++){opening.onclick({target:opening});h.flush();}assert.equal(done,true);assert.equal(attempts,2);assert.equal(h.timers.size,0);
});

test('themed collection packs use the shared opening and preserve completion callbacks',async()=>{
 const h=harness();vm.runInContext(fs.readFileSync('public/pack-cinema.js','utf8'),h.context);let completed;
 assert.equal(h.context.window.playSpecialPackOpening({packName:'Aurora pack'},'aurora',{open:async()=>({cardId:'Bronze_jan.png'}),onClose:done=>completed=done}),true);
 const opening=h.body.querySelector('.reward-opening');assert.equal(opening.dataset.theme,'aurora');await opening.querySelector('.reward-opening-pack').click();h.flush();opening.onclick({target:opening});h.flush();assert.equal(completed,true);
});
