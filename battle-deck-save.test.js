const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
test('rapid selection changes save serially and finish with the latest deck', async () => {
  const source = fs.readFileSync('public/app.js','utf8');
  const code = source.slice(source.indexOf('let battleDeckSaveTask'), source.indexOf('/* ------------------ SAVED BATTLE DECKS'));
  const calls = [], releases = [];
  const context = vm.createContext({battleMatchId:'m',selectedBattleCards:new Set(['a']),battleMatch:{status:'setup'},battleDeckSavePending:false,
    API_URL:'',currentUserId:'u',document:{getElementById:()=>({value:'#123456'})},updateBattleBudget(){},alert(message){throw Error(message);},
    fetch: (url, options) => new Promise(resolve => { calls.push(JSON.parse(options.body)); releases.push(() => resolve({ok:true,json:async()=>({status:'setup'})})); }) });
  vm.runInContext(code, context);
  const first = vm.runInContext('saveBattleDeck()',context);
  context.selectedBattleCards = new Set(['a','b']);
  const second = vm.runInContext('saveBattleDeck()',context);
  assert.equal(calls.length,1);
  releases.shift()(); await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls[1].cardIds,['a','b']);
  releases.shift()(); assert.equal(await first,true); assert.equal(await second,true);
  assert.equal(context.battleDeckSavePending,false);
});
