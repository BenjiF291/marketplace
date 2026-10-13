/* 96 motion-compensated poses per animal; six original poses define the loop. */
(() => {
 let foxModule;
 const kinds=new Set(['fox','snail','dragon']);
 window.companionArt=id=>{
  const kind=String(id).split(':')[1];if(!kinds.has(kind))return '';
  if(kind==='fox'){foxModule??=import('./companion-3d.js?v=meshy2').catch(error=>console.error('Fox renderer failed to load:',error));return `<span class="companion-illustration companion-3d-art" data-species="fox" data-fox-3d aria-hidden="true"><img class="fox-model-poster" src="assets/companions/fox-meshy-poster.png" alt=""></span>`;}
  return `<svg class="companion-illustration companion-animated" data-species="${kind}" data-rig="7" viewBox="0 0 300 245" aria-hidden="true" focusable="false"><ellipse cx="150" cy="216" rx="91" ry="8" fill="#182722" opacity=".14"/><g class="companion-character"><g class="companion-body"><svg class="companion-frame" x="27.5" y="0" width="245" height="245" viewBox="0 0 256 256" overflow="hidden"><image class="companion-film" href="assets/companions/${kind}-smooth-v7.webp" x="0" y="0" width="2048" height="3072"/></svg></g></g><g class="companion-hearts" fill="#ff698d"><path d="M96 53c-19-17-27 5 0 21 28-19 18-37 0-21Z"/><path d="M218 25c-14-12-20 4 0 17 20-14 13-27 0-17Z"/></g></svg>`;
 };
})();
