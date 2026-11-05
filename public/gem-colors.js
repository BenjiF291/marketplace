(function(root) {
  const standard = { bronze: '#ef4266', 'rare-bronze': '#ab3457', silver: '#adcdea', 'rare-silver': '#71e3d1', gold: '#ffbe35', 'rare-gold': '#28cb8d', platinum: '#4487ff', lightning: '#bb75ff', ultra: '#d2f6ff' };
  function color(key) {
    if (standard[key]) return standard[key];
    let hash = 2166136261;
    for (const char of String(key || 'unknown')) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    return `hsl(${hash % 360} ${(65 + (hash >>> 9) % 25)}% ${(48 + (hash >>> 17) % 18)}%)`;
  }
  function dyePalette(key) {
    const value=color(key);let rgb;
    if(value.startsWith('#'))rgb=[1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
    else {const [h,s,l]=value.match(/[\d.]+/g).map(Number),a=s/100*Math.min(l/100,1-l/100);rgb=[0,8,4].map(n=>{const k=(n+h/30)%12;return Math.round(255*(l/100-a*Math.max(-1,Math.min(k-3,9-k,1))));});}
    const hex=channels=>'#'+channels.map(n=>Math.round(n).toString(16).padStart(2,'0')).join('');
    const luminance=channels=>channels.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
    const ink=channels=>{const l=luminance(channels),dark=luminance([23,26,34]);return (l+.05)/(dark+.05)>=1.05/(l+.05)?'#171a22':'#ffffff';};
    const surface=rgb.map(n=>n*.68+255*.32),deep=rgb.map(n=>n*.82);
    return {ink:ink(rgb),surface:hex(surface),surfaceInk:ink(surface),deep:hex(deep)};
  }
  const api = { color, dyePalette };
  if (typeof module !== 'undefined') module.exports = api;
  else root.GemColors = api;
})(typeof window !== 'undefined' ? window : globalThis);
