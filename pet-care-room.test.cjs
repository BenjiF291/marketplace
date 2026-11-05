const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('pet station reports the actual pixel direction and distance of walking',()=>{
 let frame;const room={clientWidth:480,clientHeight:960},dialog={open:true};
 const node={dataset:{},style:{setProperty(){}},classList:{contains:()=>false},isConnected:true,parentElement:room,querySelectorAll:()=>[],append(){},addEventListener(){},closest:()=>dialog,matches:()=>false};
 const person={style:{setProperty(){}},addEventListener(){}};
 const context={window:{addEventListener(){}},document:{hidden:false,createElement:()=>({setAttribute(){},classList:{add(){},remove(){}}})},matchMedia:()=>({matches:false}),innerHeight:1000,innerWidth:600,performance:{now:()=>0},requestAnimationFrame:fn=>frame=fn,Math};
 vm.runInNewContext(fs.readFileSync('public/pet-care-room.js','utf8'),context);
 context.window.PetCareRoom.attach('pet:fox',node,person,0);
 context.window.PetCareRoom.interact('pet:fox','eat');frame(40);
 const dx=30*480/100,dy=32*960/100;
 assert.ok(Math.abs(Number(node.dataset.heading)-Math.atan2(dx,dy))<1e-10);
 const x=parseFloat(node.style.left),y=parseFloat(node.style.top);
 assert.ok(Math.abs(Number(node.dataset.walkDistance)-Math.hypot((x-48)*4.8,(y-37)*9.6))<1e-10);
 assert.equal(node.dataset.activity,'walk');
});
test('renderer uses station headings and does not mirror the 3D view',()=>{
 const code=fs.readFileSync('public/companion-3d.js','utf8');
 assert.match(code,/movingPet=island\|\|host.closest\('\.care-animal'\)/);
 assert.match(code,/Number\(movingPet.dataset.heading\)/);
 assert.match(code,/Number\(movingPet.dataset.walkDistance\)/);
 assert.match(fs.readFileSync('public/village.css','utf8'),/\.care-animal \.companion-3d-art\{transform:none\}/);
});
