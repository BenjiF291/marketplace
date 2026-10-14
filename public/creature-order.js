/* Rarest first; unnamed rarities go last. Names break rarity ties. */
(function(root){
 const ranks={unique:0,legendary:1,epic:2,rare:3,common:4};
 function compare(a,b,mode='rarity'){
  if(mode==='rarity'){const difference=(ranks[a.rarity]??5)-(ranks[b.rarity]??5);if(difference)return difference;}
  return a.name.localeCompare(b.name,'en',{sensitivity:'base',numeric:true})||a.id.localeCompare(b.id);
 }
 const api={compare};if(typeof module!=='undefined')module.exports=api;else root.CreatureOrder=api;
})(typeof window==='undefined'?globalThis:window);
