const test = require('node:test');
const assert = require('node:assert/strict');
const {sortCardsByTier} = require('./card-order');
test('normal cards, battle cards and packs follow configured tier order; unassigned items last', () => {
 const tiers = [{order:5,cards:['gold.png'],packs:['goldpack']},{order:1,cards:['bronze.png']}];
 const cards = [{name:'A Gold',imageUrl:'/images/gold.png'},{name:'Z Bronze',imageUrl:'/images/bronze.png'},{name:'B Battle',linkedCardImage:'bronze.png'},{name:'Unknown'},{name:'Gold pack',itemType:'pack',packId:'goldpack'}];
 assert.deepEqual(sortCardsByTier(cards,tiers).map(c=>c.name),['B Battle','Z Bronze','A Gold','Gold pack','Unknown']);
});
