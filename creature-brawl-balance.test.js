const test=require('node:test'),assert=require('node:assert/strict');
const C=require('./public/creature-brawl-catalog'),E=require('./public/creature-brawl-engine'),S=require('./creature-brawl-service');

test('every creature uses the free/basic, class special, signature special budget',()=>{
 const classes=new Map();
 for(const c of C.creatures){
  const [basic,role,signature]=c.moves;
  assert.equal(basic.cost,0);assert.deepEqual(basic.effects,[{type:'damage',power:1}]);
  assert.equal(role.cost,c.role==='Protector'?3:2);
  const shape={...role,id:'role'};
  if(classes.has(c.role))assert.deepEqual(shape,classes.get(c.role));else classes.set(c.role,shape);
  assert.ok(signature.cost>=3&&signature.cost<=4);
  for(const move of c.moves)for(const effect of move.effects){
   if(effect.type==='status'){assert.ok(effect.duration<=2);assert.ok(effect.magnitude<=.3);}
   if(effect.type==='heal')assert.ok(effect.ratio<=.24);
   if(effect.type==='shield')assert.ok(effect.ratio<=.22);
  }
 }
});

test('every creature has an individual stat identity within a bounded class budget',()=>{
 const budgets={Swift:463,Cunning:471,Furious:508,Protector:468};
 assert.equal(new Set(C.creatures.map(c=>JSON.stringify(c.base))).size,C.creatures.length);
 for(const c of C.creatures){const value=S.power(S.unit({kind:c.id,id:c.id,grade:1}));assert.ok(value/budgets[c.role]>.82&&value/budgets[c.role]<1.18,c.name+' has a bounded class budget');}
 const highest=[...C.creatures].sort((a,b)=>b.base.hp-a.base.hp).slice(0,2);assert.deepEqual(highest.map(c=>c.id),['brugar-species','brugar']);
 const protectors=C.creatures.filter(c=>c.role==='Protector');assert.equal(new Set(protectors.map(c=>c.base.hp)).size,protectors.length);
 assert.ok(C.creatures.find(c=>c.id==='trusk').base.atk>C.creatures.find(c=>c.id==='brugar-species').base.atk);
});

test('signature previews resolve at every grade without damaging allies or healing enemies',()=>{
 for(const grade of [1,5,10])for(const creature of C.creatures){
  const team=side=>[creature.id,'rill-species','brugar-species'].map((kind,i)=>S.unit({kind,id:side+'-'+i,grade}));
  const s=E.create('kit',[team(0),team(1)]);s.actorId='0-0';s.phase='AWAITING_ACTION';s.ap=[5,5];
  s.units.forEach(u=>u.hp=Math.round(u.maxHP*.65));
  for(const move of s.units[0].moves){const valid=E.legal(s,move.id);assert.equal(valid.reason,'');const preview=E.preview(s,move.id,valid.targets[0]);
   for(const result of preview.targets){assert.ok(Number.isFinite(result.hp));if(result.id.startsWith('0-'))assert.equal(result.damage,0);else assert.equal(result.heal,0);}
  }
 }
});

test('Kael is Cunning and Nightfall weakens and slows only enemies',()=>{
 const kael=C.creatures.find(c=>c.id==='veyrin');assert.equal(kael.role,'Cunning');assert.equal(C.creatures.find(c=>c.id==='tharos').role,'Furious');
 assert.equal(kael.moves[0].name,'Dusk Fang');assert.ok(kael.moves[1].effects.some(e=>e.status==='defDown'));
 const signature=kael.moves[2];assert.equal(signature.id,'nightfall');assert.equal(signature.cost,4);
 const team=side=>['veyrin','rill-species','brugar-species'].map((kind,i)=>S.unit({kind,id:side+'-'+i,grade:1}));const state=E.create('shadow',[team(0),team(1)]);state.actorId='0-0';state.phase='AWAITING_ACTION';state.ap=[5,5];
 const preview=E.preview(state,'nightfall','1-0');
 for(const id of ['1-0','1-1','1-2'])for(const status of ['atkDown','spdDown']){const event=preview.events.find(e=>e.id===id&&e.status===status);assert.ok(event);assert.equal(event.magnitude,.2);assert.equal(event.remaining,2);}
 assert.ok(preview.targets.every(t=>t.id.startsWith('1-')));assert.equal(state.units[3].statuses.atkDown,undefined);
});
