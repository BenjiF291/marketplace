/* Painted island and a shared transparent atlas; no game engine or render loop. */
(() => {
 const atlas='assets/village/buildings-painted.png';
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
 let spriteId=0;
 function building(kind,level=0,locked=false){
  const cell=locked?13:kind==='forge'&&level>=8?15:kind==='forge'&&level>=4?14:cells[kind]??1;
  const [x,y,w,h,points]=frames[cell],id='building-cutout-'+(++spriteId);
  // A nested, explicitly clipped frame prevents SVG letterboxing from showing other cells.
  return `<svg class="village-painted-building" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMax meet" aria-hidden="true" data-art-cell="${cell}"><defs><clipPath id="${id}" clipPathUnits="userSpaceOnUse"><polygon points="${points}"/></clipPath></defs><g transform="translate(${-x} ${-y})"><image clip-path="url(#${id})" href="${atlas}" width="1024" height="1024" preserveAspectRatio="none"/></g></svg>`;
 }
 function terrain(){
  return `<svg class="village-terrain" viewBox="0 0 1440 1000" aria-hidden="true"><image href="assets/village/island-painted.png" width="1440" height="1000" preserveAspectRatio="none"/><g class="village-water-glints" fill="none" stroke="#e5fff9" stroke-width="1.5" stroke-linecap="round" opacity=".5"><path d="m1160 847 20-2m-35 9 11-1M118 745l16-3m-4 8 22-3M1073 956l26-4M1234 87l28-3"/></g><g class="village-fireflies" fill="#fff4ae"><circle cx="424" cy="576" r="1.5"/><circle cx="890" cy="590" r="1.4"/><circle cx="1030" cy="428" r="1.5"/><circle cx="373" cy="339" r="1.2"/></g></svg>`;
 }
 function house(){return `<svg class="village-house-art" viewBox="0 0 180 180" aria-hidden="true"><defs><linearGradient id="cottage-wall" x2="1" y2="1"><stop stop-color="#e9d4a1"/><stop offset="1" stop-color="#b09362"/></linearGradient></defs><ellipse cx="90" cy="151" rx="72" ry="17" fill="#203d34" opacity=".22"/><path d="M32 87 94 53l54 35v58l-60 20-56-28Z" fill="url(#cottage-wall)" stroke="#67543b" stroke-width="3"/><path d="m88 96 60-8v58l-60 20Z" fill="#aa8b60"/><path d="m17 88 64-62 83 48-74 34Z" fill="#704534" stroke="#49372d" stroke-width="4"/><path d="m81 26 9 82 74-34Z" fill="#935636"/><path d="m34 76 55 27m-41-41 39 22m-24-37 23 12m10-14 49 28m-48-13 30 18" stroke="#c68b53" stroke-width="3"/><path d="M120 50V21h17v37" fill="#97846b" stroke="#5c5142" stroke-width="3"/><path d="M116 20h24v8h-24" fill="#bcaa84"/><path d="M53 105q13-16 25 0v46l-25-9Z" fill="#574235" stroke="#d5b273" stroke-width="3"/><circle cx="72" cy="124" r="3" fill="#f5d783"/><path d="m102 109 25-8v24l-25 9Z" fill="#ffc56b" stroke="#61462e" stroke-width="4"/><path d="m114 106v23m-12-9 25-7" stroke="#805d39" stroke-width="3"/><path d="M33 103v32m57-29v57m48-63v47" stroke="#705035" stroke-width="5"/><path d="m98 140 35-11v9l-35 11Z" fill="#634c35"/><g fill="#557b45"><circle cx="101" cy="137" r="7"/><circle cx="113" cy="133" r="8"/><circle cx="126" cy="130" r="7"/></g><g fill="#e89d7c"><circle cx="102" cy="133" r="3"/><circle cx="114" cy="129" r="3"/><circle cx="127" cy="127" r="3"/></g><path d="m51 146 27 8-11 13-29-10Z" fill="#bdb29a" stroke="#827561"/><g fill="#567748"><circle cx="32" cy="145" r="12"/><circle cx="145" cy="150" r="13"/></g></svg>`;}
 window.VillageArt={building,terrain,house};
})();
