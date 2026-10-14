const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root={StableAnimals:require('./public/stable-animals')};vm.runInNewContext(fs.readFileSync('public/reward-card-art.js','utf8'),{window:root});const art=root.RewardCardArt;
test('every configured reward type has a named amount card and illustration',()=>{
 for(const [kind,id] of [['gem','bronze'],['gem','rare-bronze'],['footy',''],['boost','skip'],['boost','leap'],['animal','tharos'],['rubyItem','fuel'],['rubyItem','outfit:mariner'],['amulet','road:champion'],['pack','ruby-pack'],['card','Bronze_jan.png']]){
  const card=art.describe({kind,id,amount:7,label:'7 Reward name'});assert.equal(card.name,'Reward name');assert.equal(card.amount,7);assert.ok(card.group);assert.ok(card.art.startsWith('<svg'));
 }
 assert.equal(art.describe({kind:'animal',id:'tharos',amount:2}).image,'assets/creatures/tharos-poster.png');
 assert.equal(art.describe({kind:'rubyItem',id:'pet:fox',amount:1}).image,'assets/companions/fox-meshy-poster.png');
 assert.equal(art.describe({kind:'card',id:'Bronze_jan.png',amount:1}).name,'Bronze jan');
});
test('regular collection openings include separate Footy and Ruby bonus cards',()=>{
 const rewards=art.normalize({cardId:'Bronze_jan.png',packBonus:5,rubyBonus:2});assert.equal(rewards.length,3);assert.equal(rewards[0].kind,'card');assert.equal(rewards[1].kind,'footy');assert.equal(rewards[1].amount,5);assert.equal(rewards[2].id,'bronze');assert.equal(rewards[2].amount,2);
 const original=[{kind:'animal',id:'tharos',amount:2}];assert.equal(art.normalize({rewards:original}),original);
});

test('admin samples cover each distinct catalogue reward once, sorted by category then name',()=>{
 const catalog={gem:[{id:'ruby',name:'Ruby'},{id:'garnet',name:'Garnet'},{id:'ruby',name:'Ruby'}],animal:[{id:'tharos',name:'Tharos'},{id:'aeri',name:'Aeri'}],pack:[{id:'p',name:'Pack'}],card:[{id:'B.png',name:'Bronze_jan.png'}],rubyItem:[{id:'fuel',name:'Fuel'}],amulet:[{id:'a',name:'Amulet'}],boost:[{id:'skip',name:'Skip'}]};
 const groups=art.samples(catalog);assert.deepEqual(Array.from(groups,g=>g.kind),['gem','footy','boost','animal','rubyItem','amulet','card','pack']);assert.deepEqual(Array.from(groups[0].rewards,r=>r.id),['garnet','ruby']);assert.deepEqual(Array.from(groups[3].rewards,r=>r.id),['aeri','tharos']);
 const rewards=groups.flatMap(g=>g.rewards);assert.equal(rewards.length,10);assert.ok(rewards.every(r=>r.amount===1));assert.equal(new Set(rewards.map(r=>r.kind+'/'+r.id)).size,10);assert.equal(groups[6].rewards[0].label,'1 Bronze jan');
});

test('every creature has a padded frame inside its poster dimensions',()=>{
 for(const animal of root.StableAnimals.animals){const info=art.describe({kind:'animal',id:animal.id,amount:1}),f=info.imageFrame;assert.ok(f,animal.id);assert.ok(f.x>=0&&f.y>=0&&f.width>0&&f.height>0);assert.ok(f.x+f.width<=f.imageWidth&&f.y+f.height<=f.imageHeight);assert.ok(f.width<f.imageWidth,animal.id);}
 assert.ok(art.describe({kind:'rubyItem',id:'pet:fox',amount:1}).imageFrame);assert.equal(art.describe({kind:'gem',id:'bronze',amount:5}).imageFrame,null);
});

test('compasses, collector tags, meals and wheel retries have distinct item artwork',()=>{
 const ids=['compass:common','compass:uncommon','compass:rare','compass:ultra','compass:mythical','compass:legendary','profile:ember','profile:royal','food','food:trail','food:feast','retry'];
 const illustrations=ids.map(id=>art.describe({kind:'rubyItem',id,amount:1}).art);assert.equal(new Set(illustrations).size,ids.length);assert.ok(illustrations.every(svg=>!svg.includes('M91 38h58v23H91Z')));
 assert.ok(illustrations[0].includes('>N</text>'));assert.ok(illustrations.at(-1).includes('m183 101 16 22 19-22'));
});
test('amulet gem colors come from their tier key, including gallery examples',()=>{
 const palette={bronze:'#cf504d','rare-bronze':'#a44465',silver:'#8cbcb9','rare-silver':'#b9aed0',gold:'#e5b34f','rare-gold':'#53ad83',platinum:'#658ac1',lightning:'#a178c0',ultra:'#a9d9e5'};
 for(const [gemKey,color] of Object.entries(palette)){const reward={kind:'amulet',id:'random-tier:v2:0:fortune',gemKey,amount:1};assert.ok(art.describe(reward).art.includes('fill="'+color+'"'),gemKey);}
 const samples=art.samples({amulet:[{id:'gold-tier:v2:0:fortune',name:'Gold Fortune',gemKey:'gold'}]});assert.equal(samples.find(g=>g.kind==='amulet').rewards[0].gemKey,'gold');
});
test('collectible atlas sprites are clipped to exactly their own cell',()=>{
 const context={HallArt:{},HallWorld:{}};vm.runInNewContext(fs.readFileSync('public/hall-character-art.js','utf8'),context);const ids=['relic:rose','relic:moon','relic:crown','relic:books','relic:fern','relic:pennant','relic:skystones','relic:dragon'],clips=new Set();
 ids.forEach((id,index)=>{const svg=context.HallArt.decor(id),x=index%4*256,y=Math.floor(index/4)*256;assert.ok(svg.includes('<rect x="'+x+'" y="'+y+'" width="256" height="256"/>'));const clip=svg.match(/<clipPath id="([^"]+)"/)[1];assert.ok(svg.includes('clip-path="url(#'+clip+')"'));clips.add(clip);});assert.equal(clips.size,8);
});
