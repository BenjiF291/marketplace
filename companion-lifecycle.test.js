const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness(){
 let intersect,resolveModel,loads=0,disposed=0,frames=0,cancelled=0;const listeners={};
 const host={dataset:{species:'fox'},isConnected:true,append(){},getClientRects:()=>[{}]};
 const context={console,Map,matchMedia:()=>({matches:false,addEventListener(){}}),
  IntersectionObserver:class{constructor(fn){intersect=fn;}observe(){}unobserve(){}disconnect(){}},
  MutationObserver:class{observe(){}disconnect(){}},requestAnimationFrame:()=>++frames,cancelAnimationFrame(){cancelled++;},
  document:{body:{},hidden:false,querySelector:()=>null,querySelectorAll:()=>[host],addEventListener(){},createElement:()=>({setAttribute(){},getContext:()=>({})})},window:{addEventListener(name,fn){listeners[name]=fn;}},
  createFox:()=>{loads++;return new Promise(resolve=>resolveModel=resolve);}};
 let source=fs.readFileSync('public/companion-3d.js','utf8').replace(/^import .*;\r?\n/gm,'');
 source+='\nsetup=()=>{renderer={};};';
 vm.createContext(context);vm.runInContext(source,context);
 return {context,host,frames:()=>frames,cancelled:()=>cancelled,event:(name,detail)=>listeners[name]({detail}),loads:()=>loads,disposed:()=>disposed,intersect:visible=>intersect([{target:host,isIntersecting:visible}]),
  finish:()=>resolveModel({root:{},dispose(){disposed++;}})};
}
test('hidden portraits defer model loading and repeated visibility events share the pending load',async()=>{
 const h=harness();assert.equal(h.loads(),0);h.intersect(false);assert.equal(h.loads(),0);
 h.intersect(true);h.intersect(true);assert.equal(h.loads(),1);h.finish();
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(h.context.window.companion3D.entries.get(h.host).model);
});
test('models that finish after a screen is removed are disposed without mounting',async()=>{
 const h=harness();h.intersect(true);h.host.isConnected=false;
 vm.runInContext('scan()',h.context);h.finish();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.disposed(),1);assert.equal(h.context.window.companion3D.entries.size,0);
});

test('opening Brawl pauses the shared hidden portrait loop and closing resumes it',()=>{
 const h=harness(),before=h.frames();h.event('creature-brawl-visibility',true);assert.ok(h.cancelled()>0);vm.runInContext('wake()',h.context);assert.equal(h.frames(),before);h.event('creature-brawl-visibility',false);assert.equal(h.frames(),before+1);
});
