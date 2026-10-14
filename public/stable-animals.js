/* Shared reward catalogue; companion pets keep their existing inventory. */
(function(root){
 const animals=[
 ['fox','Ember Fox','Fox','assets/companions/fox-meshy-poster.png'],
 ['snail','Crystal Snail','Snail','assets/companions/snail-meshy-poster.png'],
 ['dragon','Pocket Dragon','Dragon','assets/companions/dragon-meshy-poster.png'],
 ['rill','Aeri','Rill','assets/creatures/aeri-poster.png'],
 ['brugar','Brakk','Brugar','assets/creatures/brakk-poster.png'],
 ['krynn','Virex','Krynn','assets/creatures/virex-poster.png'],
 ['fenra','Saelis','Fenra','assets/creatures/saelis-poster.png'],
 ['veyrin','Kael','Veyrin','assets/creatures/kael-poster.png'],
 ['tharos','Tharos','Veyrin','assets/creatures/tharos-poster.png'],
 ['talren','Talren','Talren','assets/creatures/talren-poster.png'],
 ['northern-talren','Northern Talren','Northern Talren','assets/creatures/northern-talren-poster.png'],
 ['defender-talren','Defender Talren','Defender Talren','assets/creatures/defender-talren-poster.png'],
 ['rill-species','Rill','Rill','assets/creatures/rill-species-poster.png'],
 ['brugar-species','Brugar','Brugar','assets/creatures/brugar-species-poster.png'],
 ['krynn-species','Krynn','Krynn','assets/creatures/krynn-species-poster.png'],
 ['fenra-species','Fenra','Fenra','assets/creatures/fenra-species-poster.png'],
 ['defender-rill','Defender Rill','Defender Rill','assets/creatures/defender-rill-poster.png']
 ].map(([id,name,species,poster])=>({id,name,species,poster,companion:['fox','snail','dragon'].includes(id)}));
 function inventory(user={}){return animals.filter(a=>!a.companion).map(a=>({...a,count:Math.max(0,Math.floor(Number(user.stableAnimals?.[a.id])||0))})).filter(a=>a.count>0);}
 const api={animals,inventory};if(typeof module!=='undefined')module.exports=api;else root.StableAnimals=api;
})(typeof window==='undefined'?globalThis:window);
