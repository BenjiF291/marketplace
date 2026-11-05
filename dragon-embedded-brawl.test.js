const test=require('node:test'),assert=require('node:assert/strict');let T,prepareEmbeddedClips,EmbeddedDragonAnimationPlayer;
test.before(async()=>{T=await import('./public/vendor/three/three.module.js');({prepareEmbeddedClips,EmbeddedDragonAnimationPlayer}=await import('./public/dragon-embedded-brawl.js'));});
test('embedded root cleanup removes duplicate travel/elevation without modifying source clips',()=>{
 const torso=new T.Bone();torso.name='Torso';torso.position.set(0,.9,.35);const original=new T.AnimationClip('fly',1,[new T.VectorKeyframeTrack('Torso.position',[0,.5,1],[0,1.32,.35,.3,1.338,.85,.6,1.32,1.35]),new T.QuaternionKeyframeTrack('Torso.quaternion',[0,1],[0,0,0,1,0,0,0,1])]);
 const before=Array.from(original.tracks[0].values),result=prepareEmbeddedClips([original],torso),values=Array.from(result.clips[0].tracks[0].values);assert.deepEqual(Array.from(original.tracks[0].values),before);assert.ok(Math.abs(values[1]-.9)<1e-6);assert.ok(Math.abs(values[4]-.918)<1e-6);assert.equal(values[0],0);assert.equal(values[3],0);assert.ok(Math.abs(values[5]-.35)<1e-6);assert.deepEqual(Array.from(result.clips[0].tracks[1].values),Array.from(original.tracks[1].values));assert.ok(Math.abs(result.report[0].removedVerticalOffset-.42)<1e-6);
});
test('imported player seeks only supplied clips and returns to embedded idle',()=>{
 const root=new T.Group(),bone=new T.Bone();bone.name='Torso';root.add(bone);const clips=['idle','walk','run','fly'].map((name,i)=>new T.AnimationClip(name,1,[new T.QuaternionKeyframeTrack('Torso.quaternion',[0,1],[0,0,0,1,...new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),i*.2).toArray()])])),mixer=new T.AnimationMixer(root),idle=mixer.clipAction(clips[0]).play(),moves=require('./public/creature-brawl-catalog').creatures.find(c=>c.id==='dragon').moves,player=new EmbeddedDragonAnimationPlayer(clips,moves,mixer,idle);
 player.preview('run');mixer.update(.25);assert.equal(player.previewAction.getClip(),clips[2]);player.travel(.5);assert.equal(player.active.getClip(),clips[3]);for(const move of moves){player.attack(move.id,.54);assert.equal(player.active.getClip(),clips[0]);}player.hit(.5);assert.equal(player.active.getClip(),clips[0]);player.reset();assert.equal(player.active,null);assert.equal(idle.isRunning(),true);assert.equal(player.set.actions.get(moves[2].id).delivery,'wave');player.dispose();
});

test('ground locomotion retains the authored crouch instead of raising the paws',()=>{
 const torso=new T.Bone();torso.name='Torso';torso.position.set(0,.9,.35);const walk=new T.AnimationClip('walk',1,[new T.VectorKeyframeTrack('Torso.position',[0,1],[0,.79,.35,0,.794,.35])]);const result=prepareEmbeddedClips([walk],torso);assert.ok(Math.abs(result.clips[0].tracks[0].values[1]-.79)<1e-6);assert.equal(result.report[0].removedVerticalOffset,0);
});

test('embedded dragon opt-in is restricted to loopback development hosts',async()=>{
 const {embeddedDragonEnabled}=await import('./public/dragon-embedded-brawl.js');const original=globalThis.location;
 try{for(const [hostname,search,expected] of [['localhost','?brawlDragonRig=embedded',true],['127.0.0.1','?brawlDragonRig=embedded',true],['localhost','',false],['game.example','?brawlDragonRig=embedded',false]]){globalThis.location={hostname,search};assert.equal(embeddedDragonEnabled(),expected);}}finally{if(original===undefined)delete globalThis.location;else globalThis.location=original;}
});
