const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const rules=require('./free-pack');
function harness(){
 const ids=new Map(),nodes=[];
 class Node{constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.dataset={};this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.listeners={};this.className='';this.isConnected=true;this.classList={add:name=>this.className+=' '+name};nodes.push(this);}
 set id(value){this._id=value;ids.set(value,this);}get id(){return this._id;}setAttribute(k,v){this.attributes[k]=v;}append(...children){for(const c of children){if(c.parentNode)c.parentNode.children=c.parentNode.children.filter(n=>n!==c);c.parentNode=this;this.children.push(c);}}replaceChildren(...children){this.children=[];this.append(...children);}remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.isConnected=false;}addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}showModal(){this.open=true;}close(){this.open=false;for(const fn of this.listeners.close||[])fn();}click(){if(!this.disabled)return this.onclick?.();}
 matches(selector){return selector.startsWith('.')?this.className.split(' ').includes(selector.slice(1)):selector==='button:not(:disabled)'?this.tag==='button'&&!this.disabled:this.tag===selector;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}querySelectorAll(selector){return this.children.flatMap(c=>[...(c.matches(selector)?[c]:[]),...c.querySelectorAll(selector)]);}}
 const body=new Node('body'),storage=new Map(),config=rules.defaults(),catalog={gem:[{id:'bronze',name:'Ruby'},{id:'rare-bronze',name:'Garnet'}],boost:[{id:'skip',name:'Skip'},{id:'leap',name:'Leap'}]};let saved,claims=0;
 const context={console,Date,Math,Number,Object,Array,JSON,crypto:{randomUUID:()=> 'preview-claim'},currentUserId:'u',API_URL:'',resourceHeaders:()=>({}),loadUsers(){},loadInventory(){},setInterval:()=>1,clearInterval(){},
 localStorage:{getItem:key=>storage.get(key),setItem:(key,v)=>storage.set(key,v),removeItem:key=>storage.delete(key)},Event:class{},window:{addEventListener(){},dispatchEvent(){}},
 document:{body,hidden:false,createElement:tag=>new Node(tag),getElementById:id=>ids.get(id),querySelector:selector=>selector==='#villageMap[open]'?{}:body.querySelector(selector)},
 Option:function(text,value){const n=new Node('option');n.textContent=text;n.value=value;return n;},
 fetch:async(url,options)=>{let data;if(url==='/free-pack')data={config,serverNow:Date.now(),nextAt:0,canClaim:true,canEdit:true};else if(url==='/free-pack/claim'){claims++;data={requestId:'preview-claim',name:config.name,nextAt:Date.now()+25200000,rewards:rules.draw(config,()=>0).map(r=>({...r,label:rules.label(r,catalog)}))};}else if(options.method==='PUT'){saved=JSON.parse(options.body);data={config:saved};}else data={config,catalog};return {ok:true,json:async()=>data};}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('public/free-pack.js','utf8'),context);vm.runInContext(fs.readFileSync('public/island-tools.js','utf8'),context);
 return {context,body,Node,ids,get claims(){return claims;},get saved(){return saved;}};
}
test('toolbar has five actions, retracts accessibly, and forwards arrange and profile actions',async()=>{
 const h=harness();const launcher=new h.Node('button');launcher.textContent='Creature book';const bar=h.context.window.IslandTools.wrap(launcher);h.body.append(bar);
 const actions=bar.querySelector('.island-tool-actions');assert.equal(actions.children.length,5);
 const toggle=bar.querySelector('.island-tools-toggle');toggle.click();assert.equal(actions.hidden,true);assert.equal(toggle.attributes['aria-expanded'],'false');toggle.click();assert.equal(actions.hidden,false);
 let arranged=0,profile=0;const source=new h.Node('button');source.id='arrangeVillageButton';source.onclick=()=>arranged++;h.context.PlayerProfile={open:()=>profile++};
 await actions.children[2].click();actions.children[3].click();assert.equal(arranged,1);assert.equal(profile,1);
});
test('player can claim and reveal five rewards, and an admin can edit all card option rows',async()=>{
 const h=harness();await h.context.window.FreePack.open();const box=h.body.querySelector('.free-pack-dialog');assert.equal(box.open,true);assert.equal(box.querySelector('.free-pack-claim').disabled,false);
 await box.querySelector('.free-pack-claim').click();assert.equal(h.claims,1);assert.equal(box.querySelector('.free-pack-card-grid').children.length,5);
 const all=box.querySelector('.free-pack-rewards').querySelectorAll('button').find(n=>n.textContent==='Reveal all');all.click();assert.ok(box.querySelector('.free-pack-card-grid').children.every(n=>n.disabled&&n.className.includes('revealed')));
 await box.querySelector('.free-pack-edit').click();const editor=h.body.querySelector('.free-pack-editor');assert.equal(editor.querySelectorAll('fieldset').length,5);assert.equal(editor.querySelectorAll('.free-pack-option').length,21);
 const name=editor.querySelector('input');name.value='Edited daily pack';await editor.querySelector('form').onsubmit({preventDefault(){}});assert.equal(h.saved.name,'Edited daily pack');assert.equal(h.saved.cards.length,5);
});
