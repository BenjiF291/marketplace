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
