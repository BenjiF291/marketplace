/* Corner tools travel with the active island dialog, alongside the book. */
(() => {
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
 // Small, engraved island objects share parchment, verdigris and antique brass.
 const art={
  benBal:`<rect x="10" y="10" width="64" height="76" rx="9" fill="#b79658" stroke="#785b36" stroke-width="2"/><rect x="15" y="15" width="54" height="66" rx="5" fill="#365e51" stroke="#e6cc91"/><path d="M21 22h42v52H21zM21 48h42M31 22v9h22v-9M31 74v-9h22v9" fill="none" stroke="#e6cc91" stroke-width="1.5"/><circle cx="42" cy="48" r="8" fill="none" stroke="#e6cc91" stroke-width="1.5"/><circle cx="42" cy="48" r="2" fill="#f4dfac"/>`,
  pack:`<defs><linearGradient id="toolPack" x2="1" y2="1"><stop stop-color="#6e9274"/><stop offset="1" stop-color="#254f46"/></linearGradient></defs><path d="m13 21 46-10 8 64-45 13Z" fill="#b79863" stroke="#745a35"/><path d="m23 14 45 4-4 67-45-5Z" fill="url(#toolPack)" stroke="#795c35" stroke-width="2"/><path d="m24 21 38 3-3 51-38-3Z" fill="none" stroke="#d8be84"/><path d="m24 12 45 4-1 9-45-4Zm-5 65 45 5-1 8-45-5Z" fill="#d8bd84" stroke="#8c7047"/><path d="m42 30 13 18-14 18-12-19Z" fill="#a8c7a1" stroke="#e8d29e"/><path d="m42 30-1 36m-12-19 26 1" fill="none" stroke="#557e6a"/><path d="m58 43 5 6-6 7-5-7Z" fill="#bd6956" stroke="#efd5a2"/><path d="m30 19 5 1m5 0 5 1m5 0 5 1m-28 62 5 1m5 0 5 1m5 0 5 1" stroke="#80643d"/>`,
  village:`<path d="m11 35 17-9 22 5 23-10-3 60-22 8-21-5-17 6Z" fill="#dbc18c" stroke="#8c7047" stroke-width="1.5"/><path d="m28 27-1 57m23-53-2 58" stroke="#a38b5f"/><path d="m17 75 12-13 12 5 19-21 6 2" fill="none" stroke="#718f78" stroke-width="3" stroke-dasharray="4 3"/><path d="m25 43 19-17 20 17Z" fill="#a46348" stroke="#76543a"/><path d="M30 43h29v22H30Z" fill="#e6d2a3" stroke="#876b43"/><path d="M41 51h9v14h-9Z" fill="#496d58"/><path d="M52 39V27h6v14" fill="#a17d50" stroke="#795d3c"/><path d="m59 19 12-7 4 6-12 7-5 1Z" fill="#6e8971" stroke="#526c53"/><path d="m58 26-2 5 6-3" fill="#896345"/>`,
  profile:`<path d="m26 69-5 22 17-7 9 8 5-24" fill="#a66b50" stroke="#7a573a"/><ellipse cx="43" cy="43" rx="29" ry="35" fill="#b79658" stroke="#785b36" stroke-width="2"/><ellipse cx="43" cy="43" rx="24" ry="29" fill="#365e51" stroke="#e6cc91"/><path d="M25 64q1-16 18-17 18 1 19 17l-7 6H32Z" fill="#c7ac77"/><path d="m36 48 7 8 7-8-2-6H38Z" fill="#ddc597"/><ellipse cx="43" cy="34" rx="10" ry="13" fill="#e5d0a2"/><path d="M33 34q-4-18 10-18 14 1 10 18l-4-10-10 3Z" fill="#72563c"/><path d="m43 8 3 5-3 4-3-4Zm0 62 3 4-3 4-3-4Z" fill="#f4dfac"/>`,
  help:`<path d="M25 13h38q10 0 10 8t-10 8H25l-6 38h39q11 0 11 10t-11 10H18q-11 0-11-10l10-53q-7-11 8-11Z" fill="#dfc592" stroke="#947445" stroke-width="1.6"/><path d="M25 13q-8 7 1 15m-7 39q-9 10 0 19m39-19q-9 9 0 19" fill="none" stroke="#ae8b55"/><path d="m29 34 28 1m-31 29 29 1" stroke="#b69a6b"/><path d="M34 45q0-9 9-9t9 8q0 5-9 9v4" fill="none" stroke="#486e58" stroke-width="4" stroke-linecap="round"/><circle cx="43" cy="63" r="2.4" fill="#486e58"/>`,
  finder:`<path d="m12 32 17-8 22 7 21-9-3 57-21 9-21-7-17 7Z" fill="#dfc693" stroke="#927344" stroke-width="1.5"/><path d="m29 25-2 55m24-49-3 56m-30-15 18-12 11 4 16-14" fill="none" stroke="#a28c60"/><circle cx="44" cy="43" r="24" fill="#bb9b60" stroke="#795d37" stroke-width="2"/><circle cx="44" cy="43" r="19" fill="#f0dfb5" stroke="#876b41"/><path d="m44 22 4 15 15 6-16 4-3 17-5-16-16-5 16-5Z" fill="#71907a"/><path d="m44 28 4 15-4 15-4-15Z" fill="#a9654c"/><circle cx="44" cy="43" r="3" fill="#e8cc8e" stroke="#896940"/>`
 };

 let iconId=0,finder,packReady=false,achievementCount=0,updatePackReady;
 const icon=name=>{const suffix=++iconId;return `<svg viewBox="0 0 84 96" aria-hidden="true" focusable="false">${art[name].replace(/tool[A-Z][a-zA-Z]*/g,id=>id+'-'+suffix)}</svg>`;};
 function attachBuildingFinder(select){if(!finder||!select)return;if(select.parentNode!==finder)finder.append(select);finder.hidden=false;}
 window.IslandTools={attachBuildingFinder,setAchievementCount(count){achievementCount=Math.max(0,Math.floor(Number(count)||0));updatePackReady?.();},setPackReady(ready){packReady=!!ready;updatePackReady?.();},wrap(launcher){
  const bar=el('nav','island-tools');bar.id='islandTools';bar.setAttribute('aria-label','Island tools');
  const toggle=el('button','island-tools-toggle','>');toggle.type='button';toggle.setAttribute('aria-label','Expand island tools');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','islandToolActions');
  toggle.textContent='';const arrow=el('span','island-tools-arrow','>');toggle.append(arrow);
  const actions=el('div','island-tool-actions');actions.id='islandToolActions';actions.hidden=true;
  toggle.onclick=()=>{actions.hidden=!actions.hidden;arrow.textContent=actions.hidden?'>':'<';toggle.setAttribute('aria-expanded',String(!actions.hidden));toggle.setAttribute('aria-label',actions.hidden?'Expand island tools':'Retract island tools');updatePackReady?.();};
  const action=(picture,name,fn)=>{const b=el('button','island-tool-action');b.type='button';b.setAttribute('aria-label',name);const visual=el('span','island-tool-art');visual.innerHTML=icon(picture);b.append(visual,el('span','island-tool-label',name));b.onclick=fn;actions.append(b);return b;};
  actions.append(launcher);
  const pack=action('pack','Pack shop',()=>window.PackShop.open());pack.id='freePackLauncher';
  const benBal=action('benBal','BEN-BAL',()=>window.BenBal.open());benBal.setAttribute('aria-haspopup','dialog');benBal.setAttribute('aria-controls','benBal');
  const seal=()=>{const badge=el('span','island-pack-seal','1');badge.setAttribute('aria-hidden','true');return badge;};const packSeal=seal(),collapsedSeal=seal();pack.append(packSeal);toggle.append(collapsedSeal);

  async function islandAction(id){try{if(!document.querySelector('#villageMap[open]'))await Island.show();const source=document.getElementById(id);if(source&&!source.hidden&&!source.disabled)source.click();}catch(error){console.error(error);}}
  action('village','Arrange village',()=>islandAction('arrangeVillageButton'));
  const profile=action('profile','Profile',()=>PlayerProfile.open()),profileSeal=seal();profile.append(profileSeal);
  updatePackReady=()=>{const total=Number(packReady)+achievementCount;packSeal.hidden=!packReady;profileSeal.hidden=!achievementCount;profileSeal.textContent=String(achievementCount);collapsedSeal.textContent=String(total);collapsedSeal.hidden=!total||!actions.hidden;pack.dataset.ready=String(packReady);pack.setAttribute('aria-label',packReady?'Pack shop: free daily pack ready':'Pack shop');profile.setAttribute('aria-label',achievementCount?`Profile: ${achievementCount} unseen achievements`:'Profile');toggle.setAttribute('aria-label',(actions.hidden?'Expand island tools':'Retract island tools')+(total?` - ${total} notifications`:''));};updatePackReady();
  action('help','Building help',()=>islandAction('villageHelpButton'));
  const guide=action('help','Player guide',()=>window.PlayerGuide.open());guide.id='playerGuideLauncher';guide.setAttribute('aria-haspopup','dialog');
  if(window.FishyEvents)action('pack','Events',()=>window.FishyEvents.player()).setAttribute('aria-haspopup','dialog');
  finder=el('label','island-tool-action island-building-finder');finder.hidden=true;const finderArt=el('span','island-tool-art');finderArt.innerHTML=icon('finder');finder.append(finderArt,el('span','island-tool-label','Find a building'));actions.append(finder);attachBuildingFinder(document.getElementById('villageBuildingFinder'));
  window.addEventListener('island-ready',()=>attachBuildingFinder(document.getElementById('villageBuildingFinder')));
  bar.append(toggle,actions);return bar;
 }};
})();
