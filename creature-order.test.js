const test=require('node:test'),assert=require('node:assert/strict');
const {compare}=require('./public/creature-order');
test('default creature order is rarest first, alphabetical within a rarity, and unassigned last',()=>{
 const cards=[{id:'z',name:'Zebra',rarity:'rare'},{id:'a',name:'Aeri',rarity:'rare'},{id:'c',name:'Common',rarity:'common'},{id:'u',name:'Unique',rarity:'unique'},{id:'l',name:'Legendary',rarity:'legendary'},{id:'e',name:'Epic',rarity:'epic'},{id:'n',name:'Absent',rarity:''}];
 assert.deepEqual([...cards].sort(compare).map(c=>c.id),['u','l','e','a','z','c','n']);
 assert.deepEqual([...cards].sort((a,b)=>compare(a,b,'alphabetical')).map(c=>c.id),['n','a','c','e','l','u','z']);
 assert.deepEqual([...cards].sort((a,b)=>compare(a,b,'alphabetical')).sort((a,b)=>compare(a,b)).map(c=>c.id),['u','l','e','a','z','c','n']);
});
