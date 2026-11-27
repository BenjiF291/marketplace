const test=require('node:test'),assert=require('node:assert/strict'),E=require('./public/creature-brawl-engine'),C=require('./public/creature-brawl-catalog'),S=require('./creature-brawl-service');
const basic={id:'basic',name:'Strike',cost:0,target:'enemy',effects:[{type:'damage',power:1}]};
function fighter(id,role='Furious',spd=100){return {id,kind:'fox',species:'fox',name:id,role,stats:{hp:1000,atk:100,def:0,spd,specialPower:1},moves:[structuredClone(basic),{id:'buff',name:'Buff',cost:1,target:'self',effects:[{type:'status',status:'atkUp',duration:2,magnitude:.3}]},{id:'area',name:'Area',cost:2,target:'enemies',effects:[{type:'damage',power:1}]}]};}
function state(config={}){return E.create('m',[[fighter('p0'),fighter('p1'),fighter('p2')],[fighter('e0'),fighter('e1'),fighter('e2')]],{priority:0,config});}
function nextFor(s,id){s=structuredClone(s);s.phase='START_ACTIVATION';s.actorId=null;s.units.forEach(u=>{if(u.hp>0)u.next=s.clock+(u.id===id?1:100);});return E.advance(s);}
test('roster has all real creature assets, exactly three legal moves, and balanced named variants',()=>{
 assert.equal(C.creatures.length,require('./public/stable-animals').animals.length);for(const c of C.creatures){assert.equal(c.moves.length,3);assert.equal(c.moves[0].cost,0);assert.equal(c.moves[0].effects[0].power,1);assert.ok(require('node:fs').existsSync('public/'+c.poster));}const named=C.creatures.find(c=>c.id==='rill'),species=C.creatures.find(c=>c.id==='rill-species');assert.ok(named.base.hp<species.base.hp&&named.base.spd>species.base.spd);
});
test('speed scheduler repeats fast actors, has reproducible team priority and immutable timeline',()=>{
 let s=state();assert.equal(s.actorId,'p0');assert.equal(E.create('m',[[fighter('p0'),fighter('p1'),fighter('p2')],[fighter('e0'),fighter('e1'),fighter('e2')]],{priority:1}).actorId,'e0');s.units.find(u=>u.id==='p0').stats.spd=200;const before=JSON.stringify(s),timeline=E.timeline(s,8);assert.equal(timeline.length,8);assert.equal(JSON.stringify(s),before);assert.ok(timeline.filter(t=>t.id==='p0').length>=2);
});
test('AP starts at zero then grants one at first activation, caps at five, and Surge doubles income',()=>{
 let s=state({surgeAt:1});assert.deepEqual(s.ap,[1,0]);s.ap=[5,5];s=E.act(s,{moveId:'basic',targetId:'e0'});assert.ok(s.ap.every(n=>n===5));assert.equal(s.surge,true);const t=nextFor({...s,ap:[0,0]},'p0');assert.equal(t.ap[0],2);
});
test('stunned activations skip without AP, recover with immunity, and remain in timeline',()=>{
 let s=state();s.ap=[0,0];s=structuredClone(s);s.phase='START_ACTIVATION';s.actorId=null;s.units.forEach(u=>u.next=u.id==='p0'?1:u.id==='e0'?2:100);E.addStatus(s,s.units[0],'stun',1);assert.equal(E.addStatus(s,s.units[0],'stun',1),false);const rail=E.timeline(s);assert.equal(rail[0].id,'p0');assert.equal(rail[0].skipped,true);s=E.advance(s);assert.deepEqual(s.ap,[0,1]);assert.ok(s.units[0].statuses.stunImmune);assert.equal(E.addStatus(s,s.units[0],'stun',1),false);s=nextFor(s,'p0');s=E.act(s,{moveId:'basic',targetId:'e0'});assert.equal(s.units[0].statuses.stunImmune,undefined);assert.equal(E.addStatus(s,s.units[0],'stun',1),true);
});
test('exact class multipliers and damage previews match the committed action',()=>{
 assert.equal(E.advantage('Protector','Cunning'),1.25);assert.equal(E.advantage('Cunning','Protector'),.8);assert.equal(E.advantage('Protector','Swift'),1);let s=state();s.units[0].role='Protector';s.units[3].role='Cunning';const before=JSON.stringify(s),preview=E.preview(s,'basic','e0');assert.equal(preview.targets[0].damage,125);assert.equal(JSON.stringify(s),before);s=E.act(s,{moveId:'basic',targetId:'e0'});assert.equal(s.units[3].hp,875);
});
test('damage preview includes shield absorption even when no HP is lost',()=>{
 let s=state();s.units[3].shield=200;const p=E.preview(s,'basic','e0');assert.equal(p.targets[0].damage,0);assert.equal(p.targets[0].shieldDamage,100);s=E.act(s,{moveId:'basic',targetId:'e0'});assert.equal(s.units[3].hp,1000);assert.equal(s.units[3].shield,100);
});
test('defence, ignore-defence, special power and independent multi-hit rounding are explicit',()=>{
 let s=state();s.ap[0]=5;s.units[3].stats.def=100;s.units[0].stats.specialPower=1.2;s.units[0].moves[2]={id:'area',cost:2,target:'enemy',effects:[{type:'damage',power:.72,hits:2,ignoreDef:.5}]};const p=E.preview(s,'area','e0');assert.equal(p.targets[0].damage,116);assert.equal(p.events.filter(e=>e.type==='damage').length,2);
});
test('AoE resolves every action-start target in slot order and grants KO compensation',()=>{
 let s=state();s.ap=[2,0];s.units.filter(u=>u.team===1).forEach(u=>u.hp=20);const result=E.act(s,{moveId:'area',targetId:'e0'});assert.equal(result.winner,0);assert.equal(result.ap[1],3);assert.deepEqual(result.events.filter(e=>e.type==='defeat').map(e=>e.id),['e0','e1','e2']);assert.ok(E.timeline(result).length===0);
});
test('self buffs last the stated future activations, up/down slots use strongest and do not add',()=>{
 let s=state();s=E.act(s,{moveId:'buff',targetId:'p0'});assert.equal(s.units[0].statuses.atkUp.remaining,2);E.addStatus(s,s.units[0],'atkUp',1,.1);E.addStatus(s,s.units[0],'atkDown',2,.2);assert.equal(E.effective(s.units[0],'atk'),104);s=nextFor(s,'p0');s=E.act(s,{moveId:'basic',targetId:'e0'});assert.equal(s.units[0].statuses.atkUp.remaining,1);s=nextFor(s,'p0');s=E.act(s,{moveId:'basic',targetId:'e0'});assert.equal(s.units[0].statuses.atkUp,undefined);
});
test('Burn has two start ticks, respects shields, and a fatal start grants only KO AP',()=>{
 let s=state();E.addStatus(s,s.units[0],'burn',2);s.units[0].shield=30;s=nextFor(s,'p0');assert.equal(s.units[0].hp,980);assert.equal(s.units[0].shield,0);s=E.act(s,{moveId:'basic',targetId:'e0'});assert.equal(s.units[0].hp,930);s=E.act(s,{moveId:'basic',targetId:'e0'});assert.equal(s.units[0].statuses.burn,undefined);
 s=state();s.units[0].hp=1;E.addStatus(s,s.units[0],'burn',2);s.ap=[0,0];s=nextFor(s,'p0');assert.equal(s.units[0].hp,0);const fatal=s.events.find(e=>e.type==='defeat'&&e.id==='p0').activation;assert.equal(s.events.filter(e=>e.type==='ap'&&e.team===0&&e.activation===fatal).length,1);assert.notEqual(s.actorId,'p0');assert.ok(E.timeline(s).every(t=>t.id!=='p0'));
});
test('speed changes rescale remaining time, clamp at 30, and restore on expiry',()=>{
 const s=state(),u=s.units[3];u.next=s.clock+10;E.addStatus(s,u,'spdDown',2,.5);assert.equal(u.next,s.clock+20);E.addStatus(s,u,'spdUp',2,.2);assert.ok(Math.abs(u.next-(s.clock+10/.6))<1e-9);E.addStatus(s,u,'spdDown',2,.99);assert.equal(E.effective(u,'spd'),30);E.cleanse(s,u);assert.equal(E.effective(u,'spd'),120);
});
test('taunt targets newest living taunter, Bind blocks AP but not basic, and cleanse uses priority',()=>{
 let s=state();E.addStatus(s,s.units[3],'taunt',2);s.activationId++;E.addStatus(s,s.units[4],'taunt',2);assert.deepEqual(E.legal(s,'basic').targets,['e1']);E.addStatus(s,s.units[0],'bind',1);assert.equal(E.legal(s,'basic').reason,'');assert.match(E.legal(s,'buff').reason,/Bound/);E.addStatus(s,s.units[0],'burn',2);E.addStatus(s,s.units[0],'stun',1);E.cleanse(s,s.units[0]);assert.equal(s.units[0].statuses.stun,undefined);assert.ok(s.units[0].statuses.bind);E.cleanse(s,s.units[0]);assert.equal(s.units[0].statuses.bind,undefined);assert.ok(s.units[0].statuses.burn);
});
test('shields cap at 40%, keep the greater remaining pool, expire, and do not resurrect',()=>{
 let s=state();s.units[0].moves[1]={id:'buff',cost:1,target:'ally',effects:[{type:'shield',ratio:.8}]};s=E.act(s,{moveId:'buff',targetId:'p1'});assert.equal(s.units[1].shield,400);s.units[2].hp=0;assert.equal(E.legal(s,'basic').targets.includes('p2'),false);s=nextFor(s,'p0');assert.throws(()=>E.act(s,{moveId:'buff',targetId:'p2'}),/valid living/);s=nextFor(s,'p1');s=E.act(s,{moveId:'basic',targetId:'e0'});s=nextFor(s,'p1');s=E.act(s,{moveId:'basic',targetId:'e0'});assert.equal(s.units[1].shield,0);
});
test('draw limit, illegal actions and deterministic AI do not mutate the source',()=>{
 const s=state({drawAt:1}),before=JSON.stringify(s);assert.throws(()=>E.act(s,{moveId:'area',targetId:'e0'}),/Needs/);assert.equal(JSON.stringify(s),before);assert.deepEqual(E.choose(s),E.choose(s));const end=E.act(s,{moveId:'basic',targetId:'e0'});assert.equal(end.phase,'FINISHED');assert.equal(end.winner,null);assert.equal(end.reason,'activation-limit');
});
test('support does not use class advantage and speed restores after affected-actor expiry',()=>{
 let s=state();s.units[0].role='Protector';s.units[1].role='Cunning';s.units[1].hp=500;s.units[0].moves[1]={id:'buff',cost:1,target:'ally',effects:[{type:'heal',ratio:.2},{type:'shield',ratio:.3}]};const p=E.preview(s,'buff','p1');assert.equal(p.targets[0].heal,200);assert.equal(p.targets[0].shieldGain,300);
 E.addStatus(s,s.units[3],'spdUp',1,.5);s=nextFor(s,'e0');s=E.act(s,{moveId:'basic',targetId:'p0'});assert.equal(s.units[3].statuses.spdUp,undefined);assert.equal(E.effective(s.units[3],'spd'),100);
});
test('opponents match player grade and apply only the chosen difficulty multiplier to native creature stats',()=>{
 const team=['rill-species','veyrin','snail'].map((kind,i)=>S.unit({kind,id:'p'+i,grade:i+2}));
 for(const difficulty of C.config.difficulties)for(let stage=0;stage<5;stage++){
  const opponents=S.opponent(team,difficulty.id,stage,1);
  assert.equal(opponents.length,3);
  assert.equal(new Set(opponents.map(unit=>unit.kind)).size,3);
  for(const unit of opponents){
   assert.equal(unit.grade,3);
   const native=S.unit({kind:unit.kind,id:unit.id,grade:3}).stats;
   const expected={...native};
   for(const key of ['hp','atk','def'])expected[key]=Math.round(native[key]*difficulty.scale);
   assert.deepEqual(unit.stats,expected);
  }
 }
});
