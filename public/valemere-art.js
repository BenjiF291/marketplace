/* Original SVG silhouettes, with independent wing/tail joints. Replaceable visual layer. */
(() => {
 const svg=body=>`<svg viewBox="0 0 160 150" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
 const shadow='<ellipse cx="80" cy="132" rx="65" ry="13" fill="#1c3b3833"/>';
 const windowArt=(x,y)=>`<path d="M${x} ${y+18}v-12a8 8 0 0 1 16 0v12Z" fill="#efc96f" stroke="#584638" stroke-width="3"/><path d="M${x+8} ${y-2}v20m-8-10h16" stroke="#73533c" stroke-width="2"/>`;
 const sprites={
 academy:[0,0,510,480,'20,367 29,268 51,235 50,186 85,153 112,112 121,160 161,102 177,159 226,171 227,99 247,99 255,165 288,193 289,124 316,83 350,0 371,61 406,111 414,200 471,253 476,301 494,346 499,399 451,438 370,468 273,477 171,451 98,431 39,397'],
 stables:[517,90,570,389,'526,288 545,256 548,225 606,191 649,168 647,145 713,121 767,150 794,135 802,89 818,117 820,167 906,151 958,128 997,185 1033,236 1036,256 1074,289 1079,395 1006,423 926,454 812,476 708,449 620,424 564,379 530,342'],
 rescue:[1100,0,436,481,'1112,384 1138,338 1148,283 1150,230 1183,204 1194,181 1239,191 1237,146 1257,132 1270,85 1283,67 1330,83 1364,56 1373,0 1389,26 1442,35 1476,33 1525,80 1465,85 1390,61 1391,130 1422,161 1424,212 1468,206 1485,220 1504,272 1484,294 1494,319 1490,400 1453,432 1364,467 1263,478 1167,446 1116,414'],
 arena:[0,585,561,396,'4,810 25,751 27,696 47,677 79,703 106,680 143,655 184,641 199,618 201,596 233,595 235,618 260,632 346,628 416,660 457,682 475,704 493,705 502,683 530,686 530,738 555,750 552,829 524,856 501,897 430,917 370,955 303,975 211,951 146,922 68,914 26,879'],
 lab:[575,480,520,520,'578,861 605,800 624,749 641,708 665,658 716,604 716,541 735,529 736,496 753,494 752,533 772,527 795,557 817,528 859,479 879,490 901,530 924,558 930,610 959,587 980,560 1004,550 1014,570 977,605 965,645 1010,637 1023,613 1029,651 1064,690 1064,740 1081,794 1085,872 1049,949 971,976 874,995 759,971 649,946 585,901'],
 roost:[1083,478,453,499,'1094,683 1108,645 1093,606 1110,598 1140,611 1148,567 1170,558 1176,530 1198,545 1248,537 1245,506 1278,478 1300,495 1299,535 1350,539 1371,520 1382,544 1455,565 1483,606 1509,631 1518,670 1490,720 1488,867 1508,909 1485,945 1427,977 1343,965 1220,950 1130,916 1115,878 1145,735']
 };
 let spriteSerial=0;
 function painted(kind){const [x,y,w,h,points]=sprites[kind],clip='vm-sprite-'+(++spriteSerial);return `<svg viewBox="${x} ${y} ${w} ${h}" aria-hidden="true"><defs><clipPath id="${clip}"><polygon points="${points}"/></clipPath></defs><image href="assets/valemere/buildings.png" width="1536" height="1024" clip-path="url(#${clip})"/></svg>`;}
 function building(kind){
 if(sprites[kind])return painted(kind);
 if(kind==='portal')return svg(shadow+'<path d="M44 127V65Q45 12 80 12Q115 12 116 65V127" fill="none" stroke="#485856" stroke-width="21"/><path d="M46 125V66Q45 18 80 18Q113 18 113 66V125" fill="none" stroke="#c2c8aa" stroke-width="12"/><path d="M56 121V65Q56 34 80 32Q104 34 104 65V121Z" fill="#79c4bf" opacity=".7"/><path d="M63 102Q99 84 68 63Q94 47 99 65" fill="none" stroke="#e8fbe4" stroke-width="4"/><path d="M32 129h96M40 137h82" stroke="#a3aa91" stroke-width="9"/>');
 if(kind==='arena')return svg(shadow+'<ellipse cx="80" cy="103" rx="65" ry="31" fill="#86785b"/><ellipse cx="80" cy="98" rx="60" ry="28" fill="#d7b97c" stroke="#ebe0b3" stroke-width="5"/><ellipse cx="80" cy="98" rx="35" ry="16" fill="none" stroke="#aa8b5c" stroke-width="2"/><path d="M19 105V75m122 32V75M18 82q62 42 124 0M18 94q62 42 124 0" fill="none" stroke="#79593d" stroke-width="5"/><path d="M35 82V32m90 50V32" stroke="#554c37" stroke-width="4"/><path d="M36 33h28l-8 11 8 10H36m90-21h-28l8 11-8 10h28" fill="#9d6153" stroke="#d8b787" stroke-width="2"/>');
 if(kind==='roost')return svg(shadow+'<path d="M38 128 50 65m69 63-11-63M46 107h69M53 81h54" stroke="#6a503a" stroke-width="10"/><ellipse cx="80" cy="64" rx="52" ry="23" fill="#b4a377" stroke="#6a503a" stroke-width="6"/><path d="M29 57q51 23 103 0M33 69q48 24 94 0" fill="none" stroke="#ded0a2" stroke-width="4"/><path d="m32 51 16-12m62 1 17 11M55 43l8-12m30 12-5-13" stroke="#897651" stroke-width="5"/><ellipse cx="81" cy="57" rx="30" ry="10" fill="#dcc58c"/>');
 if(kind==='den')return svg(shadow+'<path d="M20 116 28 70 58 41 106 43 140 80 138 121Z" fill="#708878" stroke="#4f6356" stroke-width="4"/><path d="m28 72 29-29 45 2 25 28-47-11Z" fill="#b0b68c"/><path d="M57 126V93q0-37 27-36 29 0 29 37v33Z" fill="#354f47"/><path d="M62 128v-26q19-12 46 0v26" fill="#b99b65"/><path d="m32 111 14-16m79 14-7-25M42 60l14 9" stroke="#d4c99a" stroke-width="3"/>');
 const lab=kind==='lab',stable=kind==='stables',rescue=kind==='rescue';
 let body=shadow+`<path d="M27 69 81 45 136 68v55l-55 20-54-20Z" fill="#baac83" stroke="#62523f" stroke-width="3"/><path d="m81 79 55-11v55l-55 20Z" fill="#8d866b"/><path d="M27 69 66 28l48 9 26 33-59 18Z" fill="${lab?'#4d8883':rescue?'#a0604e':'#52746a'}" stroke="#384f48" stroke-width="4"/><path d="m31 64 50 15 52-13M42 54l39 13 43-12M53 42l28 13 34-11" fill="none" stroke="#b6c0a2" stroke-width="2"/><path d="M36 82v40m36-28v39m20-43v41m32-49v38M35 108l37 12" stroke="#70533b" stroke-width="5"/>`;
 body+=windowArt(44,86)+windowArt(103,80);
 body+='<path d="M69 137v-30q0-18 13-18t13 18v28" fill="#443f34" stroke="#d6bc8a" stroke-width="3"/>';
 if(lab)body+='<path d="M107 40V15h14v31" fill="#a0aaa0" stroke="#596f67" stroke-width="3"/><ellipse cx="114" cy="15" rx="10" ry="4" fill="#d7d8bc"/><path d="M38 118V93l7-12h9l7 12v25Z" fill="#81c6bc" stroke="#396e69" stroke-width="3"/><path d="M38 107h23" stroke="#d4f4d2" stroke-width="3"/>';
 if(stable)body+='<path d="M9 124V94m34 42v-35M9 101l34 10M9 113l34 10" stroke="#8a6c42" stroke-width="5"/><ellipse cx="121" cy="132" rx="16" ry="9" fill="#cfb068"/><path d="M110 128l19 7m-18 0 18-8" stroke="#eee0a0" stroke-width="2"/>';
 if(rescue)body+='<path d="M24 85V22" stroke="#544c35" stroke-width="4"/><path d="M26 23h28l-9 11 9 10H26" fill="#f0c477"/><circle cx="123" cy="113" r="12" fill="#b8814a" stroke="#ead2a1" stroke-width="3"/><path d="m117 113 6-6 6 6-6 6Z" fill="#f6df9b"/>';
 if(kind==='academy')body+='<path d="M69 32V13h22v23" fill="#c1b791" stroke="#585a44" stroke-width="3"/><path d="m64 14 16-12 17 12Z" fill="#48766b"/><circle cx="80" cy="22" r="5" fill="#f2d492"/>';
 return svg(body);
 }
 function aeri(){const id='aeri-'+(++spriteSerial);return svg(`<defs><linearGradient id="${id}" x2=".7" y2="1"><stop stop-color="#c4e5d6"/><stop offset=".45" stop-color="#72b5b4"/><stop offset="1" stop-color="#3e7d88"/></linearGradient><linearGradient id="${id}-wing" x2="0" y2="1"><stop stop-color="#e7edcf"/><stop offset="1" stop-color="#6aa6aa"/></linearGradient></defs>
 <g class="vm-tail" stroke="#315e65" stroke-width="1.5"><path d="M59 87Q20 102 12 73Q5 98 22 106Q39 115 66 97" fill="url(#${id})"/><path d="m13 80-8-12 14 3 4 10m0 20-9 4 13 6" fill="#d2d8ad"/></g>
 <g class="vm-wing vm-wing-back"><path d="M75 77Q60 57 38 48Q22 35 17 16Q46 19 61 35Q77 52 81 72Z" fill="#4d8790" stroke="#315e65" stroke-width="2"/><path d="m21 22 28 22m-20-12 22 19m-13-11 20 20" stroke="#9bc5b7" stroke-width="2"/></g>
 <path class="vm-leg" d="m65 104-3 16-8 5 16-1 7-20m22-2 4 16-3 8 11-5-1-18" fill="#558994" stroke="#315e65" stroke-width="2"/>
 <path d="M44 88Q45 66 73 63Q91 66 100 58Q107 34 126 38Q143 40 147 53L138 58Q145 76 128 84L105 87Q99 112 73 110Q45 109 44 88Z" fill="url(#${id})" stroke="#315e65" stroke-width="2"/>
 <path d="M95 84Q101 99 84 108Q106 105 112 87Q131 83 136 76Q117 80 112 72Z" fill="#d3dec0"/><path d="M109 42 105 27 120 37 124 22 132 38" fill="#d6dabc" stroke="#477d80" stroke-width="1.5"/>
 <path d="M122 51q10-8 16 0" fill="#f2f0cd"/><ellipse cx="130" cy="50" rx="4" ry="5" fill="#223e48"/><circle cx="131" cy="48" r="1.4" fill="white"/><path d="m134 66 5-2m-22 5q7 7 14 3" fill="none" stroke="#487575" stroke-width="1.5"/><circle cx="117" cy="60" r="3" fill="#abcfc0"/>
 <g class="vm-wing vm-wing-front"><path d="M73 83Q61 58 72 35Q88 11 117 10Q106 28 99 38L111 31Q103 51 90 60L100 57Q91 77 73 83Z" fill="url(#${id}-wing)" stroke="#315e65" stroke-width="2"/><path d="M75 77Q76 46 105 21M78 65l20-27M79 51l13-23M83 70l11-12" stroke="#609496" stroke-width="1.5" fill="none"/><path d="M67 77q9-13 15-3l-3 8-9 5Z" fill="#7db9b4"/></g>
 <path d="m47 86 9-3m-6 10 10-3m25 7 10-5" stroke="#99c9bb" stroke-width="2"/>`);}
 function creature(id){if(id==='aeri')return aeri();const c=ValemereConfig.creatures[id],air=c.motion!=='ground',horse=id==='saelis',heavy=id==='brakk';
 const tails=horse?'<path d="M42 89Q3 46 14 105M42 93Q0 81 11 124M43 95Q16 120 28 136"/>':'<path d="M46 90Q13 117 10 73Q23 94 53 82"/>';
 return svg(`<g class="vm-tail" fill="none" stroke="${c.color}" stroke-width="${horse?7:12}" stroke-linecap="round">${tails}</g>`+
 (air?`<g class="vm-wing vm-wing-back"><path d="M80 76Q80 24 28 12L34 43 52 42 54 59Z" fill="#3e787e" stroke="#314e54" stroke-width="2"/></g>`:'')+
 `<g fill="${c.color}" stroke="#394c49" stroke-width="2.5"><path class="vm-leg" d="m51 98-4 29h13l8-30m30 0 3 30h13l-4-32"/><ellipse cx="78" cy="87" rx="${heavy?43:horse?33:32}" ry="${heavy?30:22}"/><path d="${horse?'M92 82 98 40 121 32 135 51 115 65 113 91Z':'M91 82Q91 43 118 45L142 62 137 78 113 84Z'}"/><path d="m102 48-4-22 18 16m7 0 12-16-2 27"/></g>`+
 (id==='kael'?'<path d="m51 72-14-3 7 12-14 5 13 10-5 12 17-2m44-45-8-11-2 18-11-7 1 13" fill="#eee0b7"/>':'')+
 `<path d="M110 61q8-7 15 1" stroke="#f5edd3" stroke-width="4" fill="none"/><circle cx="119" cy="61" r="3.5" fill="#203738"/><path d="m127 76 7-2" stroke="#394c49" stroke-width="2"/>`+
 (air?`<g class="vm-wing vm-wing-front"><path d="M75 79Q61 36 111 11L109 37 98 34 97 52 84 53 86 72Z" fill="${horse?'#dee0df':'#b1dad0'}" stroke="#3f7476" stroke-width="2.5"/></g>`:'')+
 (id==='virex'?'<path d="m61 70 8 15m9-18 8 15m8-12 6 12" stroke="#34564b" stroke-width="5"/>':''));
 }
 window.ValemereArt={building,creature};
})();
