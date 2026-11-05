const test=require('node:test'),assert=require('node:assert/strict');
const money=require('./public/currency-format'),packs=require('./free-pack');
test('currency values and labels use whole gems and two Footy decimals',()=>{
 for(const currency of ['bronze','rare-bronze','silver','gold','ultra']){
  assert.equal(money.format(12.49,currency),'12');assert.equal(money.format(12.5,currency),'13');
 }
 assert.equal(money.format(12,'Footy'),'12.00');assert.equal(money.format(1.005),'1.01');
 assert.equal(money.format(.1+.2),'0.30');assert.equal(money.percent(17.654321),'17.65%');
 assert.equal(money.percent(50),'50.00%');assert.equal(money.percent(.001),'0.00%');
});
test('pack settlement stores rounded currency amounts, including legacy fractional rewards',()=>{
 const update=packs.apply({balance:10.111,gems:{bronze:5}},[{kind:'gem',id:'bronze',amount:1.6},{kind:'footy',amount:.126}]);
 assert.equal(update.gems.bronze,7);assert.equal(update.balance,10.24);
});
