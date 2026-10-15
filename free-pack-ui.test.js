const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const rules=require('./free-pack');
function harness(){
 const ids=new Map(),nodes=[];
 class Node{constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.dataset={};this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.listeners={};this.className='';this.style={setProperty:(k,v)=>{this.style[k]=v;}};this.isConnected=true;this.classList={add:name=>this.className+=' '+name};nodes.push(this);}
 focus(){}set innerHTML(value){this._html=value;this.children=[];for(const cls of ['reward-wrapper-name','reward-wrapper-face','reward-wrapper-brand','reward-wrapper-caption'])if(value.includes('class="'+cls+'"')){const node=new Node('span');node.className=cls;this.append(node);}}get innerHTML(){return this._html;}
 set id(value){this._id=value;ids.set(value,this);}get id(){return this._id;}setAttribute(k,v){this.attributes[k]=v;}append(...children){for(const c of children){if(c.parentNode)c.parentNode.children=c.parentNode.children.filter(n=>n!==c);c.parentNode=this;this.children.push(c);}}replaceChildren(...children){this.children=[];this.append(...children);}remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.isConnected=false;}addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}showModal(){this.open=true;}close(){this.open=false;for(const fn of this.listeners.close||[])fn();}click(){if(!this.disabled)return this.onclick?.({target:this,stopPropagation(){}});}
 matches(selector){return selector.startsWith('.')?this.className.split(' ').includes(selector.slice(1)):selector==='button:not(:disabled)'?this.tag==='button'&&!this.disabled:this.tag===selector;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}querySelectorAll(selector){return this.children.flatMap(c=>[...(c.matches(selector)?[c]:[]),...c.querySelectorAll(selector)]);}}
 const body=new Node('body'),storage=new Map(),config=rules.defaults(),catalog={animal:require('./public/stable-animals').animals,gem:[{id:'bronze',name:'Ruby'},{id:'rare-bronze',name:'Garnet'}],boost:[{id:'skip',name:'Skip'},{id:'leap',name:'Leap'}]};let saved,claims=0;
 const timers=new Map();let timerId=0;
 const context={console,structuredClone,setTimeout:(fn)=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),matchMedia:()=>({matches:false}),Date,Math,Number,Object,Array,JSON,crypto:{randomUUID:()=> 'preview-claim'},currentUserId:'u',API_URL:'',resourceHeaders:()=>({}),loadUsers(){},loadInventory(){},setInterval:()=>1,clearInterval(){},
 localStorage:{getItem:key=>storage.get(key),setItem:(key,v)=>storage.set(key,v),removeItem:key=>storage.delete(key)},Event:class{},window:{addEventListener(){},dispatchEvent(){}},
 document:{body,hidden:false,createElement:tag=>new Node(tag),createElementNS:(ns,tag)=>new Node(tag),getElementById:id=>ids.get(id),querySelector:selector=>selector==='#villageMap[open]'?{}:body.querySelector(selector)},
 Option:function(text,value){const n=new Node('option');n.textContent=text;n.value=value;return n;},
 fetch:async(url,options)=>{let data;if(url==='/free-pack')data={config,serverNow:Date.now(),nextAt:0,canClaim:true,canEdit:true};else if(url==='/free-pack/claim'){claims++;data={requestId:'preview-claim',name:config.name,nextAt:Date.now()+25200000,rewards:rules.draw(config,()=>0).map(r=>({...r,label:rules.label(r,catalog)}))};}else if(options.method==='PUT'){saved=JSON.parse(options.body);data={config:saved};}else data={config,catalog};return {ok:true,json:async()=>data};}};
 context.window.StableAnimals=require('./public/stable-animals');vm.createContext(context);vm.runInContext(fs.readFileSync('public/reward-card-art.js','utf8'),context);context.RewardCardArt=context.window.RewardCardArt;vm.runInContext(fs.readFileSync('public/reward-opening.js','utf8'),context);vm.runInContext(fs.readFileSync('public/reward-gallery.js','utf8'),context);vm.runInContext(fs.readFileSync('public/free-pack.js','utf8'),context);vm.runInContext(fs.readFileSync('public/island-tools.js','utf8'),context);
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
 await box.querySelector('.free-pack-claim').click();opening=h.body.querySelector('.reward-opening');await opening.querySelector('.reward-opening-pack').click();assert.equal(h.claims,1);h.flush();assert.equal(opening.querySelectorAll('.reward-pack-card').length,5);assert.ok(opening.querySelectorAll('.reward-card-amount').every(n=>/^\d+$/.test(n.textContent)));assert.equal(opening.querySelector('.reward-card-group'),null);
 for(let i=0;i<5;i++){opening.onclick({target:opening});if(i<4){const next=opening.querySelectorAll('.reward-pack-card')[1];assert.equal(next.dataset.depth,'0');assert.equal(next.attributes['aria-hidden'],'false');}opening.onclick({target:opening});assert.equal(h.timers.size,1);h.flush();assert.equal(opening.querySelectorAll('.reward-pack-card').length,4-i);}
 assert.equal(opening.open,false);assert.equal(h.claims,1);

});

test('Stable renders owned animals and opens their book information, then returns to the island',async()=>{
 const h=harness();h.context.window.companion3D={setYaw(){}};let shown,returned=0;h.context.CreatureBook={openCreature:id=>shown=id};
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

test('admin gallery shows every reward in category order and supports full-size navigation without claiming',async()=>{
 const h=harness();await h.context.window.FreePack.open();const opening=h.body.querySelector('.reward-opening');await opening.querySelector('.reward-opening-preview').click();
 const gallery=h.body.querySelector('.reward-gallery');assert.equal(gallery.open,true);assert.equal(h.claims,0);
 const sections=gallery.querySelectorAll('.reward-gallery-section');assert.deepEqual(sections.map(s=>s.querySelector('h3').textContent),['Gem currencies (2)','Footy (1)','Time boosts (2)','Animals (17)']);assert.equal(gallery.querySelectorAll('.reward-pack-card').length,22);
 assert.equal(gallery.querySelector('.reward-card-name').textContent,'Garnet');assert.ok(gallery.querySelectorAll('.reward-card-amount').every(n=>n.textContent==='1'));
 gallery.querySelector('.reward-gallery-tile').querySelector('button').click();const viewer=h.body.querySelector('.reward-card-inspector');assert.equal(viewer.querySelector('h2').textContent,'Garnet');assert.equal(viewer.querySelector('.reward-inspector-prev').disabled,true);
 viewer.querySelector('.reward-inspector-next').click();assert.equal(viewer.querySelector('h2').textContent,'Ruby');viewer.querySelector('.reward-inspector-prev').click();assert.equal(viewer.querySelector('h2').textContent,'Garnet');
 const search=gallery.querySelector('.reward-gallery-search');search.value='tharos';search.oninput();assert.equal(gallery.querySelectorAll('.reward-gallery-tile').filter(n=>!n.hidden).length,1);assert.equal(h.claims,0);assert.equal(h.timers.size,0);
});

test('creature reward cards have a rarity ribbon in the shared renderer, other rewards do not',()=>{
 const h=harness();for(const rarity of ['common','rare','epic','legendary','unique']){
  const card=h.context.window.RewardOpening.card({kind:'animal',id:'tharos',amount:1,rarity});assert.equal(card.dataset.rarity,rarity);assert.equal(card.querySelector('.reward-card-rarity-ribbon').attributes['aria-label'],rarity+' rarity');
 }
 const pet=h.context.window.RewardOpening.card({kind:'rubyItem',id:'pet:fox',amount:1,rarity:'rare'});assert.equal(pet.dataset.rarity,'rare');
 const neutral=h.context.window.RewardOpening.card({kind:'animal',id:'talren',amount:1});assert.equal(neutral.dataset.rarity,'unassigned');
 assert.equal(h.context.window.RewardOpening.card({kind:'gem',id:'bronze',amount:5}).querySelector('.reward-card-rarity-ribbon'),null);
 const groups=h.context.RewardCardArt.samples({animal:[{id:'tharos',name:'Tharos',rarity:'unique'}]});assert.equal(groups.find(g=>g.kind==='animal').rewards[0].rarity,'unique');
});

test('creature cards use tightly fitted SVG frames while collection cards keep their original images',()=>{
 const h=harness();const card=h.context.window.RewardOpening.card({kind:'animal',id:'tharos',amount:1,rarity:'unique'});const picture=card.querySelector('.reward-card-picture'),svg=picture.querySelector('svg');assert.equal(svg.attributes.viewBox,'174 148 479 400');assert.equal(svg.attributes.preserveAspectRatio,'xMidYMid meet');assert.equal(svg.querySelector('image').attributes.width,768);assert.equal(card.querySelector('.reward-card-amount').textContent,'1');assert.equal(card.querySelector('.reward-card-name').textContent,'Tharos');
 const collection=h.context.window.RewardOpening.card({kind:'card',id:'Bronze_jan.png',amount:1});assert.ok(collection.querySelector('.reward-card-picture').querySelector('img'));
});

test('admin editor adds, duplicates and removes reward cards',async()=>{
 const h=harness();await h.context.window.FreePack.open();await h.body.querySelector('.reward-opening-details').click();await h.body.querySelector('.free-pack-edit').click();
 const editor=h.body.querySelector('.free-pack-editor'),find=text=>editor.querySelectorAll('button').find(b=>b.textContent===text);
 find('Add reward card').click();assert.equal(editor.querySelectorAll('fieldset').length,6);
 find('Duplicate card').click();assert.equal(editor.querySelectorAll('fieldset').length,7);
 find('Remove card').click();assert.equal(editor.querySelectorAll('fieldset').length,6);
 await editor.querySelector('form').onsubmit({preventDefault(){}});assert.equal(h.saved.cards.length,6);
});

test('daily collage stays separate from regular pack design and reward editing',async()=>{
 const h=harness();await h.context.window.FreePack.open();const daily=h.body.querySelector('.reward-opening');assert.equal(daily.querySelectorAll('.reward-wrapper-sample').length,9);assert.equal(daily.querySelector('.reward-opening-pack').className.includes('reward-opening-pack-designed'),false);assert.equal(daily.querySelector('.reward-wrapper-brand'),null);assert.equal(daily.querySelector('.reward-wrapper-caption'),null);
 await daily.querySelector('.reward-opening-details').click();await h.body.querySelector('.free-pack-edit').click();assert.equal(h.body.querySelector('.free-pack-editor').querySelectorAll('input').some(n=>n.type==='color'),false);
 let selected;await h.context.window.FreePack.editRewards([],cards=>{selected=cards;});const editors=h.body.querySelectorAll('.free-pack-editor'),editor=editors[editors.length-1];await editor.querySelector('form').onsubmit({preventDefault(){}});assert.equal(selected.length,1);assert.equal(h.saved,undefined);
 const preview=h.context.window.RewardOpening.cover('Bronze',{base:'#a56030'});assert.equal(preview.querySelector('.pack-design-title').textContent,'Bronze');assert.equal(preview.style['--wrapper-base'],'#a56030');
});

test('pack shop displays free and paid packs and tabbed odds without buying',async()=>{
 const h=harness(),config=rules.defaults(),paid={id:'bronze',name:'Bronze',price:15,currency:'footy',cards:[{title:'Collection card',options:[{kind:'card',id:'Bronze_jan.png',min:1,max:1,chance:100}]},{title:'Rubies',options:[{kind:'gem',id:'bronze',min:5,max:15,chance:100}]}]};let buys=0;
 h.context.fetch=async(url,options)=>{if(url==='/pack-shop')return {ok:true,json:async()=>({serverNow:Date.now(),canEdit:false,catalog:{gem:[{id:'bronze',name:'Ruby'}],card:[{id:'Bronze_jan.png',name:'Jan'}]},daily:{id:'daily',daily:true,name:config.name,cards:config.cards,enabled:true,nextAt:0},packs:[paid]})};buys++;throw Error('Unexpected purchase');};
 vm.runInContext(fs.readFileSync('public/pack-shop.js','utf8'),h.context);await h.context.window.PackShop.open();const shop=h.body.querySelector('.pack-shop-dialog');assert.equal(shop.querySelectorAll('.pack-shop-tile').length,2);assert.equal(shop.querySelectorAll('.pack-shop-buy')[0].textContent,'Free');assert.equal(shop.querySelectorAll('.pack-shop-buy')[1].textContent,'15 Footy');assert.equal(shop.querySelectorAll('.reward-wrapper-sample').length,9);
 shop.querySelectorAll('.pack-shop-info')[1].click();const odds=h.body.querySelector('.pack-odds-dialog');assert.equal(odds.querySelectorAll('.pack-odds-tabs')[0].children.length,2);assert.equal(odds.querySelector('.pack-odds-percent').textContent,'100%');odds.querySelector('.pack-odds-tabs').children[1].click();assert.equal(odds.querySelector('.reward-card-amount').textContent,'5\u201315');assert.equal(odds.querySelector('.reward-card-name').textContent,'Ruby');assert.equal(buys,0);assert.equal(h.claims,0);
 odds.close();config.cards[4].options=[{kind:'gem',id:'bronze',min:1,max:1,chance:90},{kind:'gem',id:'bronze',min:2,max:2,chance:1},{kind:'gem',id:'bronze',min:3,max:3,chance:9}];
 shop.querySelectorAll('.pack-shop-info')[0].click();const dailyOdds=h.body.querySelector('.pack-odds-dialog');assert.equal(dailyOdds.querySelector('.pack-odds-tabs').children[4].attributes['aria-selected'],'true');assert.deepEqual(dailyOdds.querySelectorAll('.pack-odds-percent').map(n=>n.textContent),['1%','9%','90%']);assert.deepEqual(config.cards[4].options.map(o=>o.chance),[90,1,9]);
});

test('pack shop explains a missing backend route without displaying raw HTML',async()=>{
 const h=harness();h.context.fetch=async()=>({ok:false,status:404,text:async()=>'<html><pre>Cannot GET /pack-shop</pre></html>'});vm.runInContext(fs.readFileSync('public/pack-shop.js','utf8'),h.context);await h.context.window.PackShop.open();const shop=h.body.querySelector('.pack-shop-dialog'),message=shop.querySelector('.pack-shop-status').textContent;assert.ok(message.includes('Restart the local game server'));assert.equal(message.includes('<html>'),false);assert.ok(shop.querySelectorAll('button').some(b=>b.textContent==='Retry'));
});

test('daily pack refreshes wallets and island resources only after the last reveal or an early close',async()=>{
 const h=harness();let wallets=0,inventory=0,events=0;h.context.loadUsers=()=>wallets++;h.context.loadInventory=()=>inventory++;h.context.window.dispatchEvent=()=>events++;
 await h.context.window.FreePack.open();const opening=h.body.querySelector('.reward-opening');await opening.querySelector('.reward-opening-pack').click();h.flush();assert.equal(h.claims,1);assert.equal(wallets,0);assert.equal(inventory,0);assert.equal(events,0);
 for(let i=0;i<4;i++){opening.onclick({target:opening});h.flush();assert.equal(wallets,0);assert.equal(events,0);}
 opening.onclick({target:opening});h.flush();assert.equal(wallets,1);assert.equal(inventory,1);assert.equal(events,1);
 await h.context.window.FreePack.open();const second=h.body.querySelector('.reward-opening');await second.querySelector('.reward-opening-pack').click();h.flush();assert.equal(wallets,1);second.querySelector('.reward-opening-close').click();assert.equal(wallets,2);assert.equal(events,2);
});

test('admin can save extra rewards and copy a preset into another pack draft',async()=>{
 const h=harness(),originalFetch=h.context.fetch;let presets=[],applied;
 h.context.fetch=async(url,options)=>{if(url==='/admin/pack-reward-presets'){if(options.method==='POST'){const body=JSON.parse(options.body),preset={id:'preset-one',name:body.name,cards:body.cards};presets.push(preset);return {ok:true,json:async()=>({preset})};}return {ok:true,json:async()=>({presets})};}return originalFetch(url,options);};
 await h.context.window.FreePack.editRewards([],cards=>{applied=cards;});const editor=h.body.querySelector('.free-pack-editor'),library=editor.querySelector('.pack-reward-presets'),find=text=>editor.querySelectorAll('button').find(b=>b.textContent===text);
 library.querySelector('input').value='Small ruby bonus';await find('Save current rewards as preset').click();assert.equal(presets.length,1);assert.equal(presets[0].name,'Small ruby bonus');
 find('Add reward card').click();assert.equal(editor.querySelectorAll('fieldset').length,2);find('Replace rewards with preset').click();assert.equal(editor.querySelectorAll('fieldset').length,1);
 find('Add preset cards').click();assert.equal(editor.querySelectorAll('fieldset').length,2);await editor.querySelector('form').onsubmit({preventDefault(){}});assert.equal(applied.length,2);assert.equal(applied[0].options[0].max,5);assert.equal(presets[0].cards.length,1);assert.equal(h.saved,undefined);
});

test('regular openings reveal extras before the main card and render the awarded pack design',async()=>{
 const h=harness(),art=h.context.RewardCardArt,extra={kind:'pack',id:'bronze',packName:'Bronze',appearance:{base:'#854322',accent:'#b77b44',trim:'#ffd599'},amount:1};
 const result={cardId:'Gold_lotte.png',extraRewards:[{kind:'footy',amount:10},extra],packBonus:2,rubyBonus:1};const rewards=art.normalize(result);assert.equal(rewards.length,5);assert.equal(rewards[4].kind,'card');assert.equal(rewards[4].id,'Gold_lotte.png');assert.equal(rewards[0].kind,'footy');assert.equal(art.normalize({rewards}).at(-1).id,'Gold_lotte.png');
 const card=h.context.window.RewardOpening.card(extra);assert.equal(card.querySelector('.pack-design-title').textContent,'Bronze');assert.equal(card.querySelector('.pack-design-preview').style['--wrapper-base'],'#854322');
 const opening=h.context.window.RewardOpening.play({name:'Bronze',open:async()=>result});assert.equal(opening.querySelector('.reward-opening-next').hidden,true);await opening.querySelector('.reward-opening-pack').click();h.flush();assert.equal(opening.querySelector('.reward-opening-next').hidden,false);assert.equal(opening.querySelector('.reward-card-name').textContent,'Footy');
});

test('stable carousel switches models and rotates the active animal',async()=>{
 const h=harness();let yaw;h.context.window.companion3D={setYaw:(host,value)=>yaw=value};
 h.context.fetch=async()=>({ok:true,json:async()=>({total:2,animals:[{id:'tharos',name:'Tharos',species:'Veyrin',poster:'a.png',count:1},{id:'brugar',name:'Brakk',species:'Brugar',poster:'b.png',count:1}]})});
 vm.runInContext(fs.readFileSync('public/stable.js','utf8'),h.context);await h.context.window.Stable.open(()=>{});const stable=h.body.querySelector('.stable-dialog');assert.equal(stable.querySelectorAll('.stable-model').length,1);assert.equal(stable.querySelector('.stable-model').dataset.species,'tharos');
 const slider=stable.querySelector('.stable-rotation');slider.value='90';slider.oninput();assert.equal(yaw,Math.PI/2);stable.querySelector('.stable-next').click();assert.equal(stable.querySelector('.stable-model').dataset.species,'brugar');assert.equal(stable.querySelector('.stable-position').textContent,'2 / 2');stable.querySelector('.stable-next').click();assert.equal(stable.querySelector('.stable-model').dataset.species,'tharos');stable.querySelector('.stable-header').querySelector('button').click();assert.equal(stable.querySelector('.stable-model'),null);
});

test('regular reward editor shows the final collection pool and copies it as an editable extra',async()=>{
 const h=harness();let applied;await h.context.window.FreePack.editRewards([],cards=>applied=cards,['Bronze_jan.png','Gold_lotte.png']);const editor=h.body.querySelector('.free-pack-editor');assert.equal(editor.querySelector('.pack-main-card').querySelectorAll('.reward-pack-card').length,2);
 editor.querySelectorAll('button').find(b=>b.textContent==='Copy final card to extra rewards').click();const slots=editor.querySelectorAll('fieldset');assert.equal(slots.length,2);const rows=slots[1].querySelectorAll('.free-pack-option');assert.equal(rows.length,2);rows[0].querySelectorAll('input').at(-1).value='25';rows[1].querySelectorAll('input').at(-1).value='75';await editor.querySelector('form').onsubmit({preventDefault(){}});assert.equal(applied[1].options[0].chance,25);assert.equal(applied[1].options[1].chance,75);assert.equal(applied[1].options[1].id,'Gold_lotte.png');
});
