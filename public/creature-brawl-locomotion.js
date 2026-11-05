// Presentation distances/heights are relative to the actor's rendered height.
export const locomotion={
 velkris:{mode:'scuttle',lift:.008,stride:.80,pace:4.8},
 fox:{mode:'sprint',lift:.008,stride:1.05,pace:5.5},
 snail:{mode:'crawl',lift:.012,stride:.65,pace:3.0},
 dragon:{mode:'flight',lift:.45,stride:1.4,pace:5.0},
 rill:{mode:'flight',lift:.32,stride:1.6,pace:5.4},
 'rill-species':{mode:'flight',lift:.28,stride:1.5,pace:5.2},
 brugar:{mode:'sprint',lift:.006,stride:.90,pace:4.1},
 'brugar-species':{mode:'sprint',lift:.006,stride:.85,pace:3.9},
 krynn:{mode:'sprint',lift:.008,stride:1.6,pace:5.8},
 'krynn-species':{mode:'sprint',lift:.008,stride:1.5,pace:5.5},
 fenra:{mode:'flight',lift:.36,stride:1.7,pace:4.8},
 'fenra-species':{mode:'flight',lift:.32,stride:1.6,pace:4.6},
 veyrin:{mode:'sprint',lift:.008,stride:1.7,pace:5.0},
 tharos:{mode:'sprint',lift:.008,stride:1.6,pace:4.4},
 talren:{mode:'sprint',lift:.008,stride:1.2,pace:5.4},
 'northern-talren':{mode:'sprint',lift:.008,stride:1.15,pace:4.9},
 'defender-talren':{mode:'sprint',lift:.006,stride:1.05,pace:4.4},
 'defender-rill':{mode:'flight',lift:.25,stride:1.4,pace:4.9},
 kanji:{mode:'sprint',lift:.008,stride:2.0,pace:5.8},
 trusk:{mode:'sprint',lift:.006,stride:1.05,pace:4.3}
};
const clamp=t=>Math.max(0,Math.min(1,t)),ease=t=>{t=clamp(t);return t*t*(3-2*t);};
export function planTravel(kind,distance,height){
 const profile=locomotion[kind];if(!profile)throw Error('Missing locomotion '+kind);
 const rill=['rill','rill-species','defender-rill'].includes(kind);if(rill){const duration=Math.max(1050,Math.min(1700,distance/Math.max(.2,height*2.8)*1000));return {...profile,distance,height,duration,cycles:Math.max(1,Math.round(duration*.78/720))};}
 const airborne=profile.mode==='flight';
 const cycles=Math.max(airborne?2:1,Math.min(airborne?3:5,Math.ceil(distance/Math.max(.3,height*profile.stride))));
 return {...profile,distance,height,cycles,duration:Math.max(airborne?650:440,Math.min(1100,distance/Math.max(.2,height*profile.pace)*1000))};
}
export function sampleTravel(plan,progress){
 const t=clamp(progress),moving=ease((t-.12)/.76),envelope=Math.sin(Math.PI*t)**2,mode=plan.mode;
 let along=moving,lift=0,pitch=0,phase=t*plan.cycles;
 if(mode==='flight'){
  // Take off once, maintain altitude with wingbeats, then land once.
  lift=ease(t/.20)*(1-ease((t-.80)/.20))*plan.lift*plan.height;
  pitch=-envelope*.06;phase=moving*plan.cycles;
 }else if(mode==='sprint'||mode==='scuttle'){
  phase=moving*plan.cycles;lift=Math.sin(phase*Math.PI*2)**2*plan.lift*plan.height*envelope;pitch=-envelope*(mode==='scuttle'?.025:.08);
 }else{
  // A snail advances as its foot contracts, with a subtle shell sway.
  phase=moving*plan.cycles;along=moving-Math.sin(phase*Math.PI*2)/(plan.cycles*Math.PI*2)*.24;lift=Math.sin(phase*Math.PI*2)**2*plan.lift*plan.height;
 }
 return {along,lift,pitch,phase,envelope};
}
