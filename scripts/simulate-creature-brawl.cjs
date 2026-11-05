const fs=require('node:fs'),path=require('node:path'),E=require('../public/creature-brawl-engine'),S=require('../creature-brawl-service'),C=S.catalog;
const report={rulesVersion:C.VERSION,method:'Each roster entry leads a three-class team against every other leader. Identical grade 1 stats; alternating deterministic priority. Same species can appear twice only as distinct instances.',battles:0,wins:0,draws:0,averageActivations:0,leaders:[]};
const helpers=['rill-species','brugar-species'];
for(let a=0;a<C.creatures.length;a++){const line={kind:C.creatures[a].id,wins:0,losses:0,draws:0};for(let b=0;b<C.creatures.length;b++){
 const team=(kind,side)=>[kind,...helpers].map((kind,i)=>S.unit({id:side+i,kind}));let state=E.create('sim',[team(C.creatures[a].id,'p'),team(C.creatures[b].id,'e')],{priority:(a+b)%2}),limit=0;
 while(state.phase!=='FINISHED'&&limit++<100)state=E.act(state,E.choose(state));if(state.phase!=='FINISHED')throw Error('Simulation did not finish');report.battles++;report.averageActivations+=state.completed;if(state.winner===null){line.draws++;report.draws++;}else if(state.winner===0){line.wins++;report.wins++;}else line.losses++;
 }report.leaders.push(line);}
report.averageActivations=Math.round(report.averageActivations/report.battles*10)/10;report.drawRate=Math.round(report.draws/report.battles*1000)/10;report.leaders.sort((a,b)=>b.wins-a.wins||a.losses-b.losses);fs.mkdirSync(path.resolve('output'),{recursive:true});fs.writeFileSync(path.resolve('output/creature-brawl-balance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
