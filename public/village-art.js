/* Painted island and a shared transparent atlas; no game engine or render loop. */
(() => {
 const atlas='assets/village/buildings-painted.png';
 const cells={townhall:0,archive:1,market:2,forge:3,arena:4,wheel:5,blacksmith:6,pets:7,cabinet:8,dye:9,compressor:10,vault:11,vip:12};
 function building(kind,level=0,locked=false){
  const cell=locked?13:kind==='forge'&&level>=8?15:kind==='forge'&&level>=4?14:cells[kind]??1;
  const x=cell%4*256,row=Math.floor(cell/4);
  // Hand-tuned atlas frames exclude tall finials from the following row.
  const y=cell===12?736:cell===14?744:cell===15?730:row*256;
  const height=row===2?216:row===3?1024-y:256;
  return `<svg class="village-painted-building" viewBox="${x} ${y} 256 ${height}" aria-hidden="true" data-art-cell="${cell}"><image href="${atlas}" width="1024" height="1024" preserveAspectRatio="none"/>${!locked&&kind==='forge'&&level>=5?`<circle class="village-floating-gem" cx="${x+128}" cy="${y+93}" r="15" fill="#bfffff" opacity=".12"/>`:''}</svg>`;
 }
 function terrain(){
  return `<svg class="village-terrain" viewBox="0 0 1440 1000" aria-hidden="true"><image href="assets/village/island-painted.png" width="1440" height="1000" preserveAspectRatio="none"/><g class="village-water-glints" fill="none" stroke="#e5fff9" stroke-width="1.5" stroke-linecap="round" opacity=".5"><path d="m1160 847 20-2m-35 9 11-1M118 745l16-3m-4 8 22-3M1073 956l26-4M1234 87l28-3"/></g><g class="village-fireflies" fill="#fff4ae"><circle cx="424" cy="576" r="1.5"/><circle cx="890" cy="590" r="1.4"/><circle cx="1030" cy="428" r="1.5"/><circle cx="373" cy="339" r="1.2"/></g></svg>`;
 }
 function house(){return `<svg class="village-house-art" viewBox="0 0 180 180" aria-hidden="true"><defs><linearGradient id="cottage-wall" x2="1" y2="1"><stop stop-color="#e9d4a1"/><stop offset="1" stop-color="#b09362"/></linearGradient></defs><ellipse cx="90" cy="151" rx="72" ry="17" fill="#203d34" opacity=".22"/><path d="M32 87 94 53l54 35v58l-60 20-56-28Z" fill="url(#cottage-wall)" stroke="#67543b" stroke-width="3"/><path d="m88 96 60-8v58l-60 20Z" fill="#aa8b60"/><path d="m17 88 64-62 83 48-74 34Z" fill="#704534" stroke="#49372d" stroke-width="4"/><path d="m81 26 9 82 74-34Z" fill="#935636"/><path d="m34 76 55 27m-41-41 39 22m-24-37 23 12m10-14 49 28m-48-13 30 18" stroke="#c68b53" stroke-width="3"/><path d="M120 50V21h17v37" fill="#97846b" stroke="#5c5142" stroke-width="3"/><path d="M116 20h24v8h-24" fill="#bcaa84"/><path d="M53 105q13-16 25 0v46l-25-9Z" fill="#574235" stroke="#d5b273" stroke-width="3"/><circle cx="72" cy="124" r="3" fill="#f5d783"/><path d="m102 109 25-8v24l-25 9Z" fill="#ffc56b" stroke="#61462e" stroke-width="4"/><path d="m114 106v23m-12-9 25-7" stroke="#805d39" stroke-width="3"/><path d="M33 103v32m57-29v57m48-63v47" stroke="#705035" stroke-width="5"/><path d="m98 140 35-11v9l-35 11Z" fill="#634c35"/><g fill="#557b45"><circle cx="101" cy="137" r="7"/><circle cx="113" cy="133" r="8"/><circle cx="126" cy="130" r="7"/></g><g fill="#e89d7c"><circle cx="102" cy="133" r="3"/><circle cx="114" cy="129" r="3"/><circle cx="127" cy="127" r="3"/></g><path d="m51 146 27 8-11 13-29-10Z" fill="#bdb29a" stroke="#827561"/><g fill="#567748"><circle cx="32" cy="145" r="12"/><circle cx="145" cy="150" r="13"/></g></svg>`;}
 window.VillageArt={building,terrain,house};
})();
