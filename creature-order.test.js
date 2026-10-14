const test=require('node:test'),assert=require('node:assert/strict');
const {compare}=require('./public/creature-order');
test('default creature order is rarest first, alphabetical within a rarity, and unassigned last',()=>{
 const cards=[{id:'z',name:'Zebra',rarity:'rare'},{id:'a',name:'Aeri',rarity:'rare'},{id:'c',name:'Common',rarity:'common'},{id:'u',name:'Unique',rarity:'unique'},{id:'l',name:'Legendary',rarity:'legendary'},{id:'e',name:'Epic',rarity:'epic'},{id:'n',name:'Absent',rarity:''}];
 assert.deepEqual([...cards].sort(compare).map(c=>c.id),['u','l','e','a','z','c','n']);
 assert.deepEqual([...cards].sort((a,b)=>compare(a,b,'alphabetical')).map(c=>c.id),['n','a','c','e','l','u','z']);
 assert.deepEqual([...cards].sort((a,b)=>compare(a,b,'alphabetical')).sort((a,b)=>compare(a,b)).map(c=>c.id),['u','l','e','a','z','c','n']);
});

test('reversing works for names and rarity while unassigned rarity remains last',()=>{
 const cards=[{id:'a',name:'Aeri',rarity:'rare'},{id:'z',name:'Zebra',rarity:'rare'},{id:'u',name:'Unique',rarity:'unique'},{id:'c',name:'Common',rarity:'common'},{id:'n',name:'No rarity',rarity:''}];
 assert.deepEqual([...cards].sort((a,b)=>compare(a,b,'alphabetical',true)).map(c=>c.id),['z','u','n','c','a']);
 assert.deepEqual([...cards].sort((a,b)=>compare(a,b,'rarity',true)).map(c=>c.id),['c','z','a','u','n']);
});
test('owned priority groups creatures without hiding others and respects both directions',()=>{
 const cards=[{id:'u',name:'Unique',rarity:'unique',owned:false},{id:'a',name:'Aeri',rarity:'rare',owned:true},{id:'z',name:'Zebra',rarity:'common',owned:true},{id:'n',name:'No rarity',rarity:'',owned:false}];
 assert.deepEqual([...cards].sort((a,b)=>compare(a,b,'rarity',false,true)).map(c=>c.id),['a','z','u','n']);
 assert.deepEqual([...cards].sort((a,b)=>compare(a,b,'rarity',true,true)).map(c=>c.id),['z','a','u','n']);
 assert.deepEqual([...cards].sort((a,b)=>compare(a,b,'alphabetical',false,true)).map(c=>c.id),['a','z','n','u']);
 assert.deepEqual([...cards].sort((a,b)=>compare(a,b,'alphabetical',true,true)).map(c=>c.id),['z','a','u','n']);
 assert.deepEqual([...cards].sort((a,b)=>compare(a,b,'rarity',false,false)).map(c=>c.id),['u','a','z','n']);
});
