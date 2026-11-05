(function(root){
 const footy=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
 const amount=(n,currency='footy')=>String(currency).toLowerCase()==='footy'?footy(n):Math.round(Number(n));
 const format=(n,currency='footy')=>amount(n,currency).toFixed(String(currency).toLowerCase()==='footy'?2:0);
 const percent=n=>Number(n).toFixed(2)+'%';
 const api={footy,amount,format,percent};
 if(typeof module!=='undefined')module.exports=api;else root.CurrencyFormat=api;
})(typeof window==='undefined'?globalThis:window);
