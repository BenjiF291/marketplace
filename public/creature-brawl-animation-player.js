import {conditionCombatSkin} from './creature-brawl-skin.js?v=1';
import {buildCombatAnimations} from './creature-brawl-attacks.js?v=skin2';

// The event consumer seeks the clip to contact BEFORE revealing server results.
// Seeking also makes 2x, reduced motion, background tabs and cancellation deterministic.
export class CombatAnimationPlayer{
 constructor(model,kind,moves,mixer,idle,sourceClips=[]){this.mixer=mixer;this.idle=idle;conditionCombatSkin(model);this.set=buildCombatAnimations(model,kind,moves);this.active=null;if(this.set.idle){idle.stop();this.idle=mixer.clipAction(this.set.idle).play();}}
 use(clip){if(this.active?.getClip()!==clip){this.active?.stop();this.idle.enabled=false;this.active=this.mixer.clipAction(clip);this.active.reset().play();this.active.paused=true;}return this.active;}
 seek(clip,seconds){const action=this.use(clip);action.time=Math.max(0,Math.min(clip.duration,seconds));this.mixer.update(0);}
 attack(moveId,progress){const spec=this.set.actions.get(moveId);if(!spec)throw Error('Unknown animated move '+moveId);this.seek(spec.clip,progress*spec.duration);return spec;}
 travel(seconds,progress,cycles=2,returning=false){if(this.set.takeoff&&Number.isFinite(progress)){if(!returning&&progress<.22)this.seek(this.set.takeoff,progress/.22*this.set.takeoff.duration);else if(returning&&progress>.76)this.seek(this.set.landing,(progress-.76)/.24*this.set.landing.duration);else{const t=returning?progress/.76:(progress-.22)/.78;this.seek(this.set.travel,((Math.max(0,t)*cycles)%1)*this.set.travel.duration);}return;}this.seek(this.set.travel,((seconds%this.set.travel.duration)+this.set.travel.duration)%this.set.travel.duration);}
 hit(progress){this.seek(this.set.hit,progress*this.set.hit.duration);}
 reset(){this.active?.stop();this.active=null;this.idle.enabled=true;this.idle.play();this.mixer.update(0);}
 dispose(){this.active?.stop();for(const clip of [this.set.travel,this.set.hit,this.set.idle,this.set.takeoff,this.set.landing,...[...this.set.actions.values()].map(s=>s.clip)])if(clip)this.mixer.uncacheClip(clip);this.active=null;}
}
