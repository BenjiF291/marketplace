/* Textured animal companions: each joint is a separate local cutout. */
(() => {
 const image=(kind,part,x,y,w,h)=>`<image href="assets/companions/${kind}/${part}.webp" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
 const joint=(cls,x,y,content)=>`<g class="${cls}" style="transform-box:view-box;transform-origin:${x}px ${y}px">${content}</g>`;
 const rigs={
  fox:{body:[87,115,119,100],head:[67,75,132,91],tail:[164,84,112,133],left:[88,37,54,66],right:[147,42,53,63],pawLeft:[95,161,40,63],pawRight:[149,163,41,62],crest:[132,83,13,19],neck:[132,149]},
  dragon:{body:[96,119,120,97],head:[100,62,123,132],tail:[178,131,99,83],left:[13,65,115,132],right:[183,66,110,132],pawLeft:[101,169,49,62],pawRight:[161,169,50,62],crest:[103,35,75,66],neck:[149,152]},
  snail:{body:[38,166,229,58],head:[41,146,67,55],tail:[96,76,137,139],left:[47,101,28,68],right:[75,103,28,68],pawLeft:[34,173,26,22],pawRight:[67,175,25,21],crest:[150,76,18,25],neck:[74,187]}
 };
 function draw(kind){
  const r=rigs[kind],part=(name,box)=>image(kind,name,...box);
  const tail=joint(kind==='snail'?'companion-shell':'companion-tail',kind==='snail'?125:190,kind==='snail'?183:188,part('tail',r.tail));
  const wings=kind==='dragon'?joint('companion-wing wing-left',120,159,part('left',r.left))+joint('companion-wing wing-right',184,160,part('right',r.right)):'';
  const ears=kind==='dragon'?'':joint('companion-ear',r.left[0]+r.left[2]/2,r.left[1]+r.left[3],part('left',r.left))+joint('companion-ear companion-ear-right',r.right[0]+r.right[2]/2,r.right[1]+r.right[3],part('right',r.right));
  const lids=kind==='fox'?'<g class="companion-eyelids"><path d="M134 100q8-3 13 3l-1 4q-8 1-13-4Z" fill="#ac6834"/><path d="M163 100q4-3 7 1l-1 5-6-1Z" fill="#ac6834"/><path d="m135 103 10 1m19-1 5 1" stroke="#583c28" stroke-width=".7"/></g>':kind==='dragon'?'<g class="companion-eyelids"><path d="M163 99q7-1 12 7l-4 5q-8-3-10-7Z" fill="#467f83"/><path d="m164 104 9 4" stroke="#243d37" stroke-width=".8"/></g>':'';
  const head=joint('companion-head',...r.neck,ears+part('head',r.head)+lids+part('crest',r.crest));
  const paws=joint('companion-paw care-paw-left',r.pawLeft[0]+20,r.pawLeft[1]+8,part('paw-left',r.pawLeft))+joint('companion-paw care-paw-right',r.pawRight[0]+20,r.pawRight[1]+8,part('paw-right',r.pawRight));
  const body=joint('companion-body',150,214,part('body',r.body)+paws+head);
  return wings+(kind==='snail'?body+tail:tail+body);
 }
 window.companionArt=id=>{
  const kind=String(id).split(':')[1];if(!rigs[kind])return '';
  return `<svg class="companion-illustration companion-textured" data-species="${kind}" viewBox="0 0 300 245" aria-hidden="true" focusable="false"><ellipse cx="151" cy="225" rx="88" ry="9" fill="#182722" opacity=".18"/><g class="companion-character">${draw(kind)}</g><g class="companion-hearts" fill="#ff698d"><path d="M96 53c-19-17-27 5 0 21 28-19 18-37 0-21Z"/><path d="M218 25c-14-12-20 4 0 17 20-14 13-27 0-17Z"/></g></svg>`;
 };
})();
