/* Equal-grade substitution tournament: identical support creatures, both starting priorities. */
const fs=require('node:fs'),C=require('../public/creature-brawl-catalog'),S=require('../creature-brawl-service'),E=require('../public/creature-brawl-engine');
const rows=C.creatures.map(c=>({id:c.id,wins:0,losses:0,draws:0}));let games=0,turns=0;
for(let a=0;a<20;a++)for(let b=a+1;b<20;b++)for(let sample=0;sample<2;sample++)for(let priority=0;priority<2;priority++){
 const support=sample?[3,11]:[8,15],teams=[a,b].map((n,side)=>[n,...support].map((index,slot)=>S.unit({kind:C.creatures[index].id,id:side+'-'+slot,grade:1})));
 let s=E.create('balance',teams,{priority});while(s.phase!=='FINISHED'){s=E.act(s,E.choose(s));s.events=[];}
 games++;turns+=s.completed;if(s.winner===null){rows[a].draws++;rows[b].draws++;}else {rows[s.winner===0?a:b].wins++;rows[s.winner===0?b:a].losses++;}
}
for(const r of rows)r.score=Number(((r.wins+r.draws*.5)/(r.wins+r.losses+r.draws)).toFixed(3));
const report={games,meanTurns:turns/games,rows};fs.writeFileSync('output/ability-balance-report.json',JSON.stringify(report,null,2)+'\n');console.table(rows);console.log(games+' matches; mean '+report.meanTurns.toFixed(1)+' activations');
