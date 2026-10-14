/* Every companion uses its supplied textured 3D model and continuous rig. */
(() => {
 let rendererModule;
 const kinds=new Set(['fox','snail','dragon']);
 window.companionArt=id=>{
  const kind=String(id).split(':')[1];if(!kinds.has(kind))return '';
  rendererModule??=import('./companion-3d.js?v=brugar-species1').catch(error=>console.error('Companion renderer failed to load:',error));
  return `<span class="companion-illustration companion-3d-art" data-species="${kind}" data-${kind}-3d aria-hidden="true"><img class="fox-model-poster" src="assets/companions/${kind}-meshy-poster.png" alt=""></span>`;
 };
})();
