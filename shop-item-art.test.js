const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const catalog=require('./ruby-shop').CATALOG;
function art(){const context={window:{Wardrobe:require('./public/wardrobe'),StableAnimals:require('./public/stable-animals')}};vm.createContext(context);for(const file of ['reward-card-art','shop-item-art'])vm.runInContext(fs.readFileSync('public/'+file+'.js','utf8'),context);return context.window.ShopItemArt;}
test('every purchasable market item has concrete artwork without generic placeholders',()=>{
 const renderer=art();for(const item of catalog){const view=renderer.markup(item);assert.notEqual(view.family,'fallback',item.id);assert.ok(view.html||view.image,item.id);if(view.html){assert.ok(view.html.includes('<svg'),item.id);assert.ok(!/undefined|NaN/.test(view.html),item.id);}if(view.image)assert.ok(fs.existsSync('public/'+view.image),item.id);}
});
test('effects, collectibles, utilities, and ingredient illustrations are distinct',()=>{
 const renderer=art();for(const ids of [catalog.filter(i=>i.kind==='opening').map(i=>i.id),catalog.filter(i=>i.kind==='relic').map(i=>i.id),['fuel','recall','retry','food','food:trail','food:feast'],['water','carrot','corn','milk','meat']]){
  const images=ids.map(id=>renderer.markup({id,...(['water','carrot','corn','milk','meat'].includes(id)?{field:'farmIngredients'}:{})}).html.replace(/shop-material-\d+/g,'material'));assert.equal(new Set(images).size,ids.length);
 }
});

test('player-stall ingredients, dyes and amulets use their actual item families',()=>{
 const renderer=art(),items=require('./player-stall').catalog([{id:'bronze',name:'Bronze',sellPrice:10,order:0}]);
 for(const item of items){const view=renderer.markup(item);assert.notEqual(view.family,'fallback',item.key);assert.ok(view.html||view.image,item.key);}
});
