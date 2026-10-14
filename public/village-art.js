/* Painted island and a shared transparent atlas; no game engine or render loop. */
(() => {
 const atlas='assets/village/buildings-painted.png';
 const refineryAnchors=[[523, 889], [523, 845], [517, 897], [530, 876], [512, 921], [514, 888], [512, 928], [511, 957], [514, 958], [513, 966]];
 const cells={townhall:0,archive:1,market:2,forge:3,arena:4,wheel:5,blacksmith:6,pets:7,cabinet:8,dye:9,compressor:10,vault:11,vip:12};
 // Individual silhouettes isolate neighbours even where atlas rows overlap.
 const frames=[
  [0,0,264,260,'8,125 30,42 105,38 143,15 154,0 181,0 217,58 235,61 242,117 262,192 255,238 160,260 57,247 6,218'],
  [266,4,246,254,'276,91 317,39 366,56 394,5 427,9 451,52 480,90 502,104 511,225 492,248 392,257 303,241 268,211'],
  [516,35,251,223,'526,123 553,78 606,35 631,46 660,77 735,72 764,129 761,220 720,246 627,258 528,225 516,185'],
  [769,10,255,247,'791,89 816,10 852,15 860,55 927,75 956,43 983,49 973,95 1007,108 1024,183 1015,242 911,256 792,240 770,217'],
  [0,262,276,249,'24,303 62,263 92,272 130,261 163,274 221,278 270,330 276,419 262,473 206,508 110,511 34,488 0,455 3,361'],
  [288,250,224,253,'294,345 337,302 369,287 384,249 400,249 414,286 478,324 506,359 511,441 495,479 433,501 342,491 293,469 293,410'],
  [513,252,255,251,'520,360 558,276 637,286 693,300 703,252 735,252 735,318 759,350 769,466 720,490 657,503 563,478 514,463'],
  [774,259,250,247,'784,372 814,307 840,284 898,305 930,264 953,258 968,281 999,341 1023,401 1015,474 941,505 848,493 777,463'],
  [0,513,260,226,'13,629 45,574 61,523 90,513 118,541 172,539 183,514 195,518 209,556 253,581 260,643 240,683 245,723 165,742 62,731 5,704'],
  [263,518,247,219,'274,632 318,526 365,544 403,540 414,519 449,519 450,546 482,584 510,608 506,713 466,735 339,733 270,710 261,677'],
  [515,510,250,230,'520,645 541,584 581,550 602,513 652,510 697,546 746,559 763,638 761,711 690,739 605,736 523,707'],
  [773,512,251,229,'783,608 826,555 873,514 904,517 924,549 970,562 1006,582 1023,624 1020,703 950,738 862,741 778,712 772,673'],
  [0,744,263,280,'18,866 74,798 111,761 130,744 160,757 165,794 220,788 246,818 245,908 263,984 230,1014 119,1024 13,987 0,963'],
  [269,781,241,243,'279,867 336,842 402,816 461,783 489,781 491,886 510,895 509,965 426,1017 358,1024 276,981 264,935'],
  [514,722,254,302,'529,845 571,802 591,746 618,744 639,777 685,795 705,727 734,722 751,741 742,799 759,845 767,975 705,1016 624,1024 515,985'],
  [774,734,250,290,'789,871 824,819 837,774 855,742 901,734 944,752 966,805 974,849 1010,833 1024,854 1011,921 1023,976 963,1017 885,1024 775,984']
 ];
 // Source-space centre of each building's ground footprint (not its roof or canvas).
 const anchors=[[132,229],[389,226],[642,231],[899,224],[139,470],[400,468],[645,472],[899,464],[130,707],[388,703],[642,703],[898,703],[132,989],[390,992],[643,989],[901,986]];
 let spriteId=0;
 function anchored(x,y,w,h,ax,ay,scale,art,cls='village-painted-building'){
  const clip='sprite-frame-'+(++spriteId);
  return `<svg class="${cls}" viewBox="0 0 80 104" aria-hidden="true" data-ground-anchor="40,92"><svg x="${40-(ax-x)*scale}" y="${92-(ay-y)*scale}" width="${w*scale}" height="${h*scale}" viewBox="${x} ${y} ${w} ${h}" style="overflow:hidden;width:${w*scale}px;height:${h*scale}px"><defs><clipPath id="${clip}" clipPathUnits="userSpaceOnUse"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#${clip})">${art}</g></svg></svg>`;
 }

 function building(kind,level=0,locked=false){
  if(kind==='stable')return `<svg class="village-painted-building" viewBox="0 0 80 104" aria-hidden="true" data-ground-anchor="40,92"><ellipse cx="40" cy="91" rx="37" ry="9" fill="#234531" opacity=".25"/><path d="M8 50 40 29 73 49V87L40 98 8 86Z" fill="#bb8a51" stroke="#60432b" stroke-width="1.5"/><path d="M40 29 73 49V87L40 98Z" fill="#93683e"/><path d="M3 50 39 19 78 48 72 55 39 31 9 57Z" fill="#48684e" stroke="#344c39" stroke-width="2"/><path d="M10 48 39 25 69 47M15 43 40 23 65 43M25 38 39 28 56 39" fill="none" stroke="#799273" stroke-width="1.5"/><path d="M15 62 36 56V94L15 87Z" fill="#513c29"/><path d="M18 67 33 63V91L18 86Z" fill="#856041"/><path d="m18 68 15 20m0-24-15 21" stroke="#c19c67" stroke-width="2"/><path d="M47 57 63 62V76L47 73Z" fill="#253f35" stroke="#d7b77e" stroke-width="2"/><path d="m55 60 0 14m-8-7 16 4" stroke="#d7b77e"/><path d="m11 57 27-8m8 29 24 8M9 83l29 10m5-9 29 9" stroke="#e1b879" stroke-width="2"/><path d="M28 39h24v12H28Z" fill="#e8ce91" stroke="#654a2b"/><path d="m35 47 5-5 5 5m-8 0v-3h6v3" fill="none" stroke="#675036" stroke-width="1.5"/><path d="m3 88 12 2m51 1 11-3" stroke="#6e8b48" stroke-width="4" stroke-linecap="round"/></svg>`;

  if(kind==='compressor'&&!locked){const tier=Math.max(0,Math.min(9,Math.trunc(level)||0)),size=tier===9?142:90+tier*4;return anchored(0,0,1024,1024,...refineryAnchors[tier],size/1024,`<image href="assets/village/refinery/tier-${tier}.png" width="1024" height="1024"/>`);}
  if(kind==='timebank'&&!locked)return anchored(0,0,1024,1024,512,865,80/1024,`<image href="assets/village/time-bank-painted.png" width="1024" height="1024"/>`);
  if(kind==='jobs'&&!locked)return anchored(0,0,1024,1024,512,865,80/1024,`<image href="assets/village/job-station-painted.png" width="1024" height="1024"/>`);
  if(kind==='petstation')return anchored(0,0,1024,1024,512,850,80/1024,`<image href="assets/village/pet-station-painted.png" width="1024" height="1024"/>`);
  if(kind==='farmhouse')return anchored(0,0,1024,1024,512,850,80/1024,`<image href="assets/village/farmhouse-painted.png" width="1024" height="1024"/>`);
  const cell=locked?13:kind==='forge'&&level>=8?15:kind==='forge'&&level>=4?14:cells[kind]??1;
  const [x,y,w,h,points]=frames[cell],id='building-cutout-'+(++spriteId);
  const [ax,ay]=anchors[cell];
  return anchored(x,y,w,h,ax,ay,Math.min(80/w,100/h),`<defs><clipPath id="${id}" clipPathUnits="userSpaceOnUse"><polygon points="${points}"/></clipPath></defs><image clip-path="url(#${id})" href="${atlas}" width="1024" height="1024" preserveAspectRatio="none"/>`);

 }
 function terrain(){
  return `<svg class="village-terrain" viewBox="0 0 1440 1000" aria-hidden="true"><image href="assets/village/island-painted.png" width="1440" height="1000" preserveAspectRatio="none"/><g class="village-water-glints" fill="none" stroke="#e5fff9" stroke-width="1.5" stroke-linecap="round" opacity=".5"><path d="m1160 847 20-2m-35 9 11-1M118 745l16-3m-4 8 22-3M1073 956l26-4M1234 87l28-3"/></g><g class="village-fireflies" fill="#fff4ae"><circle cx="424" cy="576" r="1.5"/><circle cx="890" cy="590" r="1.4"/><circle cx="1030" cy="428" r="1.5"/><circle cx="373" cy="339" r="1.2"/></g></svg>`;
 }
 function homestead(cell){const x=cell%2*627,y=Math.floor(cell/2)*627,anchors=[[315,505],[945,505],[317,1120],[940,1110]],[ax,ay]=anchors[cell];return anchored(x,y,627,627,ax,ay,(cell===3?100:80)/627,`<image href="assets/village/homes-mines.png" width="1254" height="1254"/>`,'village-house-art');}

 function house(tier=1){return homestead(Math.max(0,Math.min(2,tier-1)));}
 function mine(){return homestead(3);}
 window.VillageArt={building,terrain,house,mine};
})();
