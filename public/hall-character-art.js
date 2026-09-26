/* Layered character art: appearance changes never require new raster assets. */
(() => {
 let serial=0;
 HallArt.avatar=value=>{
  const c=HallWorld.character(value),id='hall-avatar-'+serial++;
  const hair={short:'M23 33Q17 9 39 10q25-1 20 28l-8-15-13-3-12 15Z',long:'M22 27Q20 8 39 9q25 0 22 24l6 34-13-8-2-33-24 2-3 34-12 5Z',curly:'M21 30Q12 21 21 17q-1-11 12-10 9-9 17 0 15-2 15 12 9 8-3 18l-7-10-24-2-7 12Z',braids:'M23 31Q18 9 40 9q24 0 20 23l-8-10-12-5-13 12Z M23 29l-4 38 7 2 4-35M54 29l3 39 7-2-6-36Z',ponytail:'M24 30Q18 9 41 10q22-1 20 23l-9-12-14-4-11 15Z M57 19q19-6 14 14l-4 25-9-6 4-23Z',shaved:'M24 26q0-16 17-16 17 0 17 16l-7-10-20 1Z'}[c.style];
  return `<svg viewBox="0 0 80 120" aria-hidden="true"><defs><linearGradient id="${id}"><stop stop-color="${c.coat}"/><stop offset="1" stop-color="#25323b"/></linearGradient></defs>
  <ellipse cx="40" cy="111" rx="28" ry="7" fill="#100e0d" opacity=".28"/>
  ${c.cape!=='none'?`<path d="M22 44 12 ${c.cape==='long'?105:83}q28 13 57-1L58 44Z" fill="${c.coat}" stroke="#212126" stroke-width="2"/><path d="m24 50-4 40m36-40 5 40" fill="none" stroke="${c.trim}" opacity=".5" stroke-width="2"/>`:''}
  <g class="hall-avatar-legs"><path d="M26 79h14l-2 26-13 1Zm16 0h14l1 27-14-1Z" fill="${c.pants}" stroke="#222732" stroke-width="1.5"/><path d="M25 96h14v14l-3 4H17q-2-5 7-8Zm18 0h14v10q10 3 9 8H46l-3-4Z" fill="#503c2e" stroke="#2a2623" stroke-width="1.5"/><path d="M25 99h13m7 0h11" stroke="${c.trim}" stroke-width="2"/></g>
  <path d="M23 48Q40 36 57 48l7 34q-24 12-48 0Z" fill="url(#${id})" stroke="#2c2c2b" stroke-width="1.5"/>
  <g class="hall-avatar-arms"><path d="M22 51 13 73l-1 10q3 6 8 1l2-10 9-20M58 51l9 22 1 10q-3 6-8 1l-2-10-9-20" fill="${c.skin}" stroke="#694a3a"/><path d="m22 47-9 21 11 5 10-24m23-2 10 21-11 5-10-24" fill="${c.coat}" stroke="#302f2c" stroke-width="1.5"/><path d="m15 65 10 5m31 0 10-5" stroke="${c.trim}" stroke-width="3"/></g>
  ${c.outfit==='armour'?`<path d="m25 47 15 7 15-7 4 22-19 7-19-7Z" fill="#9eaeb0" stroke="#3f525b" stroke-width="2"/><path d="M40 54v20m-15-18 15 5 16-5" stroke="#e4e8dc" fill="none" stroke-width="2"/><path d="m18 48 11-6 3 9-17 7m47-10-11-6-3 9 17 7" fill="#7f989f" stroke="${c.trim}" stroke-width="2"/>`:c.outfit==='coat'?`<path d="m28 46 10 8-9 28-10-1m32-35-10 8 10 28 10-1" fill="${c.coat}" stroke="${c.trim}" stroke-width="2"/>`:`<path d="m29 45 11 10 11-10M40 56v21" fill="none" stroke="${c.trim}" stroke-width="2"/><path d="M36 59h8m-8 6h8" stroke="#f4deb2" stroke-width="1.5"/>`}
  <path d="m20 75 20 4 20-4v6l-20 4-20-4Z" fill="#493426"/><rect x="35" y="77" width="10" height="8" rx="1" fill="${c.trim}"/><rect x="38" y="79" width="4" height="4" fill="#5b4b34"/>
  ${c.accessory==='satchel'?'<path d="m26 44 27 38" stroke="#8a5b38" stroke-width="5"/><path d="M50 77h17v19H48Z" fill="#986b3c" stroke="#493828" stroke-width="2"/><path d="M50 80h15v7H50Z" fill="#be945a"/><circle cx="58" cy="86" r="2" fill="#e5c477"/>':c.accessory==='pendant'?`<path d="m29 46 11 19 11-19" fill="none" stroke="${c.trim}" stroke-width="2"/><path d="m40 62 5 7-5 7-5-7Z" fill="#72d2cd" stroke="${c.trim}"/>`:''}
  <path d="M34 35h12v14l-6 6-6-6Z" fill="${c.skin}" stroke="#98644a"/>
  ${c.style==='long'?`<path d="M22 22h37l7 43-12-5-27 0-11 6Z" fill="${c.hair}"/>`:''}
  <ellipse cx="23" cy="30" rx="4" ry="6" fill="${c.skin}"/><ellipse cx="57" cy="30" rx="4" ry="6" fill="${c.skin}"/>
  <path d="M23 24Q23 9 40 9q18 0 18 16l-3 13q-4 10-15 12-11-2-15-12Z" fill="${c.skin}" stroke="#714e3a"/><path d="M25 27q-1 14 15 20 12-4 15-10-4 14-15 13-14-4-15-23Z" fill="#6a382c" opacity=".14"/>
  <path d="m27 25 8-2m10 0 8 2" stroke="${c.hair}" stroke-width="2.5" stroke-linecap="round"/>
  <g class="hall-avatar-eyes"><ellipse cx="31" cy="29" rx="4" ry="3" fill="#fff6dd"/><ellipse cx="49" cy="29" rx="4" ry="3" fill="#fff6dd"/><circle cx="32" cy="29" r="2.4" fill="${c.eyes}"/><circle cx="48" cy="29" r="2.4" fill="${c.eyes}"/><circle cx="32" cy="29" r="1.2"/><circle cx="48" cy="29" r="1.2"/><circle cx="32.5" cy="28" r=".7" fill="white"/><circle cx="48.5" cy="28" r=".7" fill="white"/></g>
  <path d="m40 29-2 6 4 1m-8 5q6 4 12-1" fill="none" stroke="#9a624b" stroke-width="1.4" stroke-linecap="round"/>
  <path d="${hair}" fill="${c.hair}" stroke="#332d28"/>
  ${c.style!=='shaved'?'<path d="M28 20q6-8 16-7m-13 9q8-7 15-6" fill="none" stroke="#fff" opacity=".18" stroke-width="2"/>':''}
  ${c.beard!=='none'?`<path d="M27 37q13 9 27 0l-3 ${c.beard==='full'?17:8}-11 6-11-6Z" fill="${c.hair}"/><path d="M34 41q6 3 12 0" fill="none" stroke="${c.skin}" stroke-width="1.5"/>`:''}
  ${c.headwear==='cap'?`<path d="M22 20Q22-2 43 5q16 2 16 15Z" fill="${c.coat}" stroke="${c.trim}" stroke-width="2"/><path d="M20 20q20-6 43 0" stroke="${c.trim}" stroke-width="5" fill="none"/>`:c.headwear==='circlet'?`<path d="M24 19q16 7 33 0" fill="none" stroke="${c.trim}" stroke-width="3"/><path d="m40 19 4 4-4 5-4-5Z" fill="#b2e5dc" stroke="${c.trim}"/>`:c.headwear==='goggles'?`<path d="M22 19h36" stroke="#865e3b" stroke-width="4"/><g fill="#98c4ce" stroke="${c.trim}" stroke-width="2"><circle cx="32" cy="19" r="5"/><circle cx="48" cy="19" r="5"/></g>`:''}
  ${c.accessory==='scarf'?`<path d="M28 45q12 9 25 0v8l-9 4 4 15-8 4-6-21-6-3Z" fill="${c.trim}" stroke="#785943"/>`:''}</svg>`;
 };
 const ids=['relic:rose','relic:moon','relic:crown','relic:books','relic:fern','relic:pennant','relic:skystones','relic:dragon'];
 HallArt.decor=id=>{const cell=ids.indexOf(id);return cell<0?'':`<svg viewBox="${cell%4*256} ${Math.floor(cell/4)*256} 256 256" aria-hidden="true" style="overflow:hidden"><image href="assets/village/collectibles-painted.png" width="1024" height="512" preserveAspectRatio="none"/></svg>`;};
 HallArt.room=()=>'<svg class="hall-room-art" viewBox="0 0 900 620" aria-hidden="true"><image href="assets/village/town-hall-painted.png" width="900" height="620" preserveAspectRatio="none"/></svg>';
})();
