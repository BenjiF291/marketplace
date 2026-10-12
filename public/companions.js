/* Rig v5: attached cutouts share a torso transform and explicit joint anchors. */
(() => {
 const image=(kind,part,x,y,w,h)=>`<image href="assets/companions/${kind}/${part}.webp?v=rig5" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
 const joint=(cls,x,y,content)=>`<g class="${cls}" style="transform-box:view-box;transform-origin:${x}px ${y}px">${content}</g>`;
 const rigs={
  fox:{body:[91,111,119,108],head:[87,69,105,97],tail:[158,150,105,75],left:[101,48,36,46],right:[143,50,33,45],pawLeft:[103,159,37,65],pawRight:[156,161,37,64],crest:[145,85,10,14],neck:[131,150]},
  dragon:{body:[96,119,120,97],head:[102,76,126,115],tail:[178,131,99,83],left:[13,65,115,132],right:[183,66,110,132],pawLeft:[101,169,49,62],pawRight:[161,169,50,62],crest:[108,46,68,57],neck:[149,152]},
  snail:{body:[33,145,231,80],head:[50,158,48,54],tail:[96,76,137,139],left:[51,126,21,52],right:[75,127,21,52],pawLeft:[43,181,21,17],pawRight:[69,184,19,16],crest:[150,76,18,25],neck:[74,187]}
 };
 function draw(kind){
  const r=rigs[kind],part=(name,box)=>image(kind,name,...box);
  const tailAnchor=kind==='fox'?[184,174]:kind==='dragon'?[199,187]:[162,205];
  const tail=joint(kind==='snail'?'companion-shell':'companion-tail',...tailAnchor,part('tail',r.tail));
  const wings=kind==='dragon'?joint('companion-wing wing-left',120,159,part('left',r.left))+joint('companion-wing wing-right',184,160,part('right',r.right)):'';
  const earAnchors=kind==='fox'?[[130,84],[151,83]]:[[66,174],[86,175]];
  const ears=kind==='dragon'?'':joint('companion-ear',...earAnchors[0],part('left',r.left))+joint('companion-ear companion-ear-right',...earAnchors[1],part('right',r.right));
  const lids=kind==='fox'?'<g class="companion-eyelids"><path d="M140 96q8-3 14 4l-2 4q-8 0-12-4Z" fill="#ac6834"/><path d="M172 96q4-2 6 2l-1 5-5-1Z" fill="#ac6834"/></g>':kind==='dragon'?'<g class="companion-eyelids"><path d="M168 108q6-1 11 5l-3 5q-8-2-9-6Z" fill="#467f83"/></g>':'';
  const head=joint('companion-head',...r.neck,ears+part('head',r.head)+lids+(kind==='snail'?'':part('crest',r.crest)));
  const paws=joint('companion-paw care-paw-left',r.pawLeft[0]+20,r.pawLeft[1]+8,part('paw-left',r.pawLeft))+joint('companion-paw care-paw-right',r.pawRight[0]+20,r.pawRight[1]+8,part('paw-right',r.pawRight));
  // Everything attached to the torso shares breathing motion. Separate joints
  // animate inside it, so wings, tail and shell cannot drift away from the body.
  const torso=part('body',r.body);
  const layers=kind==='snail'?torso+tail+paws+head:wings+tail+torso+paws+head;
  return joint('companion-body',150,220,layers);
 }
 window.companionArt=id=>{
  const kind=String(id).split(':')[1];if(!rigs[kind])return '';
  return `<svg class="companion-illustration companion-textured" data-species="${kind}" data-rig="5" viewBox="0 0 300 245" aria-hidden="true" focusable="false"><ellipse cx="151" cy="225" rx="88" ry="9" fill="#182722" opacity=".18"/><g class="companion-character"><g transform="translate(0 ${kind==='dragon'?-7:0})">${draw(kind)}</g></g><g class="companion-hearts" fill="#ff698d"><path d="M96 53c-19-17-27 5 0 21 28-19 18-37 0-21Z"/><path d="M218 25c-14-12-20 4 0 17 20-14 13-27 0-17Z"/></g></svg>`;
 };
})();
