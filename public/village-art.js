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
 window.VillageArt={building,terrain};
})();
