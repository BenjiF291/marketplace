const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),catalog=require('./public/creature-brawl-catalog');
test('icon guide covers every persistent status used by creature abilities plus shield and stun immunity',()=>{
 const window={};vm.runInNewContext(fs.readFileSync('public/creature-brawl-status-icons.js','utf8'),{window});const defs=window.CBStatusIcons.defs;
 const used=new Set(catalog.creatures.flatMap(c=>c.moves.flatMap(m=>m.effects.filter(e=>e.type==='status').map(e=>e.status))));used.add('shield');used.add('stunImmune');
 for(const key of used){assert.ok(defs[key],key);assert.ok(defs[key][0]&&defs[key][3]);assert.ok(['buff','debuff'].includes(defs[key][1]));}
 assert.equal(Object.keys(defs).length,12);assert.equal(defs.atkUp[1],'buff');assert.equal(defs.atkDown[1],'debuff');assert.equal(defs.burn[1],'debuff');
});

test('power badges include every distinct effect in order, including healing, cleanse and shields',()=>{
 const window={},document={createElement:()=>({dataset:{},children:[],setAttribute(){},append(n){this.children.push(n)}})};vm.runInNewContext(fs.readFileSync('public/creature-brawl-status-icons.js','utf8'),{window,document});
 const rill=catalog.creatures.find(c=>c.id==='rill-species');assert.deepEqual(window.CBStatusIcons.powerEffects(rill.moves[2]).children.map(n=>n.dataset.effect),['heal','cleanse','shield']);
 const kael=catalog.creatures.find(c=>c.id==='veyrin');assert.deepEqual(window.CBStatusIcons.powerEffects(kael.moves[2]).children.map(n=>n.dataset.effect),['atkDown','spdDown']);
 assert.equal(window.CBStatusIcons.powerEffects(rill.moves[0]).children.length,0);
});
