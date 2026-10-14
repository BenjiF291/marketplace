/* Corner tools travel with the active island dialog, alongside the book. */
(() => {
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
 window.IslandTools={wrap(launcher){
  const bar=el('nav','island-tools');bar.id='islandTools';bar.setAttribute('aria-label','Island tools');
  const toggle=el('button','island-tools-toggle','<');toggle.type='button';toggle.setAttribute('aria-label','Retract island tools');toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-controls','islandToolActions');
  const actions=el('div','island-tool-actions');actions.id='islandToolActions';
  toggle.onclick=()=>{actions.hidden=!actions.hidden;toggle.textContent=actions.hidden?'>':'<';toggle.setAttribute('aria-expanded',String(!actions.hidden));toggle.setAttribute('aria-label',actions.hidden?'Expand island tools':'Retract island tools');};
  const action=(icon,name,fn)=>{const b=el('button','island-tool-action');b.type='button';b.append(el('span','island-tool-symbol',icon),el('span','',name));b.onclick=fn;actions.append(b);return b;};
  actions.append(launcher);
  const pack=action('\u2726','Daily pack',()=>FreePack.open());pack.id='freePackLauncher';
  async function islandAction(id){try{if(!document.querySelector('#villageMap[open]'))await Island.show();const source=document.getElementById(id);if(source&&!source.hidden&&!source.disabled)source.click();}catch(error){console.error(error);}}
  action('\u2302','Arrange village',()=>islandAction('arrangeVillageButton'));
  action('\u2659','Profile',()=>PlayerProfile.open());
  action('?','Building help',()=>islandAction('villageHelpButton'));
  bar.append(toggle,actions);return bar;
 }};
})();
