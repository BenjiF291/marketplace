/* Rarest first; unnamed rarities go last. Names break rarity ties. */
(function(root){
 const ranks={unique:0,legendary:1,epic:2,rare:3,common:4};
 function compare(a,b,mode='rarity',reverse=false,ownedFirst=false){
  if(ownedFirst){const ownedDifference=Number(b.owned===true)-Number(a.owned===true);if(ownedDifference)return ownedDifference;}
  const direction=reverse?-1:1;
  if(mode==='rarity'){const aRank=ranks[a.rarity],bRank=ranks[b.rarity];if(aRank===undefined&&bRank!==undefined)return 1;if(bRank===undefined&&aRank!==undefined)return -1;const difference=(aRank??5)-(bRank??5);if(difference)return difference*direction;}
  return (a.name.localeCompare(b.name,'en',{sensitivity:'base',numeric:true})||a.id.localeCompare(b.id))*direction;
 }
 const api={compare};if(typeof module!=='undefined')module.exports=api;else root.CreatureOrder=api;
})(typeof window==='undefined'?globalThis:window);
