/* Footy Studio: a reversible presentation layer over the existing game screens. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const originalShow = window.showSection;
  const grid = document.querySelector('.main-grid');
  const originalHeader = document.querySelector('.header');
  const controls = $('dyeHeaderControls');
  const controlsHome = document.createComment('Original header controls');
  controls.before(controlsHome);
  const preferenceKey = `footy-ui:${currentUserId}`;
  const originalHeadings=Array.from(grid.querySelectorAll(':scope > section > h2, .inventory-header-row > h2')).map(node=>({node,text:node.textContent}));
  const icons = {
    home:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
    play:'m5 4 15 8-15 8Z',
    cards:'M5 3h14v18H5ZM2 6v13m20-13v13M9 8h6m-6 4h6m-6 4h3',
    gem:'m3 8 4-5h10l4 5-9 13ZM3 8h18M7 3l5 18 5-18',
    amulet:'M8 3 12 8l4-5M12 8l6 6-6 7-6-7Z',
    market:'M3 9h18l-2-6H5ZM5 9v12h14V9M9 21v-7h6v7',
    wallet:'M4 5h15v15H4ZM4 5V3h12m-1 8h6v5h-6Z',
    sun:'M12 3v2m0 14v2M3 12h2m14 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    star:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',
    tools:'M4 4h6v6H4Zm10 0h6v6h-6ZM4 14h6v6H4Zm10 0h6v6h-6Z',
    search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6',
    arrow:'M4 12h16m-6-6 6 6-6 6',
    menu:'M4 6h16M4 12h16M4 18h16',
    close:'m6 6 12 12M6 18 18 6',
    plus:'M12 4v16M4 12h16'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${(icons[name]||icons.cards).split('|').map(d=>`<path d="${d}"/>`).join('')}</svg>`;
  const routes = {
    home:{title:'Your club, your way.',label:'Overview',group:'Your club',icon:'home',description:'A little competition. A growing collection. What will you do today?'},
    battle:{title:'The arena',label:'Brawl & battles',group:'Play',icon:'play',legacy:'battle',description:'Take on Bob, climb your Skill Level, or challenge another player.'},
    spin:{title:'A little bonus, every 7 hours.',label:'Spin the wheel',group:'Play',icon:'sun',legacy:'spin',description:'Give the wheel a spin and put a little more Footy in your pocket.'},
    inventory:{title:'Your collection',label:'Cards & packs',group:'Collect',icon:'cards',legacy:'inventory',description:'Every card has a place. Browse, open packs, sell, or ascend your favourites.'},
    workshop:{title:'The gem workshop',label:'Gems & crafting',group:'Collect',icon:'gem',legacy:'inventory',description:'Turn cards into gems, compress your collection, and craft a new look.'},
    amulets:{title:'A little extra power.',label:'Amulets',group:'Collect',icon:'amulet',legacy:'amulets',description:'Find your combination. Equip amulets, explore powers, and unlock more slots.'},
    marketplace:{title:'Find your next favourite.',label:'Marketplace',group:'Trade',icon:'market',legacy:'marketplace',description:'Discover cards and packs listed by the community.'},
    sell:{title:'Make room for something new.',label:'Sell an item',group:'Trade',icon:'plus',legacy:'marketplace',description:'Choose something from your inventory and set your asking price.'},
    wallet:{title:'Your Footy, at a glance.',label:'Wallet & activity',group:'Your club',icon:'wallet',legacy:'history',description:'Send Footy to a friend and keep track of your recent activity.'},
    vip:{title:'More from every day.',label:'VIP membership',group:'Your club',icon:'star',legacy:'vip',description:'Explore your membership benefits and manage your VIP status.'},
    admin:{title:'Behind the scenes.',label:'Admin workspace',group:'Manage',icon:'tools',admin:true,legacy:'marketplace',description:'All your management tools in one dedicated workspace.'},
    'battle-manager':{title:'Battle card studio',label:'Battle card editor',group:'Manage',icon:'cards',admin:true,legacy:'battle-manager',description:'Create, inspect, and refine your battle card collection.'}
  };
  let enabled=false, routing=false, active='home', drawer=false;
  let lastFocus=null;
  const mobileQuery=window.matchMedia('(max-width:800px)');
  const switcher = document.createElement('button');
  switcher.type='button';switcher.id='uiVersionToggle';switcher.className='btn';switcher.dataset.uiControl='';
  switcher.addEventListener('click',()=>setMode(!enabled));controls.prepend(switcher);
  const shell = document.createElement('div');shell.id='studioShell';shell.className='studio-only';
  shell.innerHTML=`
    <a class="studio-skip" href="#studioPageTitle">Skip to content</a>
    <aside class="studio-sidebar" id="studioSidebar" aria-label="Main navigation">
      <button class="studio-brand" data-ui-nav="home" aria-label="Footy home"><span class="studio-mark">f<span>.</span></span><span>footy<span class="studio-brand-sub">THE COLLECTOR'S CLUB</span></span></button>
      <button class="studio-drawer-close" data-ui-control="close-menu" aria-label="Close navigation">${icon('close')}</button>
      <button class="studio-mobile-search" data-ui-control="search">${icon('search')} Find a page or tool</button><nav id="studioNav"></nav>
      <div class="studio-sidebar-end"><span class="studio-small-label">MAKE IT YOURS</span><p>A club built around<br>your collection.</p><button data-ui-nav="workshop">Explore the workshop ${icon('arrow')}</button></div>
    </aside>
    <button class="studio-scrim" data-ui-control="close-menu" aria-label="Close navigation" hidden></button>
    <header class="studio-topbar header" id="studioTopbar">
      <button class="studio-menu-button" data-ui-control="menu" aria-controls="studioSidebar" aria-expanded="false" aria-label="Open navigation">${icon('menu')}</button>
      <div class="studio-breadcrumb"><span>FOOTY CLUB</span><b id="studioBreadcrumb">Overview</b></div>
      <button class="studio-search-button" data-ui-control="search">${icon('search')}<span>Where would you like to go?</span><kbd>Ctrl K</kbd></button>
      <button class="studio-balance" data-ui-nav="wallet" aria-label="Open wallet"><span class="studio-coin">F</span><span id="studioBalance">...</span></button>
      <div id="studioControls"></div>
    </header>
    <nav class="studio-mobile-nav" aria-label="Quick navigation">${[['home','home','Home'],['battle','play','Play'],['inventory','cards','Collect'],['marketplace','market','Market']].map(([r,i,l])=>`<button data-ui-nav="${r}">${icon(i)}<span>${l}</span></button>`).join('')}<button data-ui-control="menu">${icon('menu')}<span>More</span></button></nav>
    <dialog id="studioSearch" aria-labelledby="studioSearchTitle"><div class="studio-search-head"><h2 id="studioSearchTitle">Find your way</h2><button data-ui-control="close-search" aria-label="Close search">${icon('close')}</button></div><label for="studioSearchInput">Search pages and tools</label><input id="studioSearchInput" type="search" placeholder="Try gems, grants, battle..." autocomplete="off"><div id="studioSearchResults"></div></dialog>`;
  document.body.prepend(shell);
  const pageHeader=document.createElement('div');pageHeader.className='studio-page-heading studio-only';
  pageHeader.innerHTML='<p class="studio-eyebrow" id="studioPageGroup">YOUR CLUB</p><h1 id="studioPageTitle" tabindex="-1">Your club, your way.</h1><p id="studioPageDescription"></p>';
  grid.before(pageHeader);
  const home=document.createElement('section');home.id='studioHome';home.className='card studio-home studio-only';
  home.innerHTML=`<div class="studio-hero"><div><p class="studio-eyebrow">YOUR NEXT CHAPTER</p><h2>Build your collection.<br>Find your edge.</h2><p>Take your best cards into the arena.<br>There's always another move to make.</p><button class="btn btn-primary" data-ui-nav="battle">Play against Bob ${icon('arrow')}</button><span class="studio-hero-note">Ranked Brawl · Five games to find your level</span></div><div class="studio-hero-art" aria-hidden="true"><div class="studio-orbit"></div><div class="studio-art-card back">${icon('gem')}</div><div class="studio-art-card front"><span>FOOTY CLUB</span>${icon('star')}<strong>PLAY YOUR<br>OWN GAME.</strong><span>COLLECT / COMPETE / CREATE</span></div><span class="studio-art-spark">+</span></div></div>
    <div class="studio-section-heading"><div><p class="studio-eyebrow">PICK YOUR NEXT MOVE</p><h2>A place for every part of your game.</h2></div></div>
    <div class="studio-launch-grid">${[
      ['inventory','Your collection','Cards, packs, and your next ascension.','View collection'],
      ['marketplace','The marketplace','Find a new favourite. Or list one of yours.','Browse the market'],
      ['spin','Your next spin','A moment of luck. A little extra Footy.','Visit the wheel'],
      ['workshop','Make something new','Convert gems, craft dyes, and make it yours.','Open workshop']
    ].map(([r,t,d,a],i)=>`<button class="studio-launch studio-launch-${i}" data-ui-nav="${r}"><span class="studio-launch-icon">${icon(routes[r].icon)}</span><h3>${t}</h3><p>${d}</p><span class="studio-launch-link">${a} ${icon('arrow')}</span></button>`).join('')}</div>
    <div class="studio-bottom-note"><span class="studio-note-icon">${icon('amulet')}</span><div><h3>Small charms. Big possibilities.</h3><p>Explore amulets and find the powers that fit your play style.</p></div><button class="btn" data-ui-nav="amulets">Explore amulets ${icon('arrow')}</button></div>`;
  const dailyFeature=document.createElement('section');dailyFeature.id='dailyPackFeature';dailyFeature.className='daily-pack-feature';
  home.querySelector('.studio-hero').after(dailyFeature);
  grid.prepend(home);
  renderDailyPackFeature(window.dailyMarketplaceItems||[]);
  const workshop=document.createElement('section');workshop.id='studioWorkshop';workshop.className='card studio-only';grid.append(workshop);
  const gemNodes=Array.from($('inventorySection').querySelectorAll(':scope > details.gem-converter'));
  const gemHomes=gemNodes.map(node=>{const marker=document.createComment('Original crafting position');node.before(marker);return marker;});
  const navGroups=[['Discover',['home']],['Play',['battle','spin']],['Collect',['inventory','workshop','amulets']],['Trade',['marketplace','sell','wallet']],['Your club',['vip']],['Manage',['admin','battle-manager']]];
  $('studioNav').innerHTML=navGroups.map(([group,links])=>`<div class="studio-nav-group" ${group==='Manage'?'data-admin-nav hidden':''}><p>${group}</p>${links.map(key=>`<button data-ui-nav="${key}">${icon(routes[key].icon)}<span>${routes[key].label}</span>${key==='battle'?'<span class="studio-nav-tag">BOB</span>':''}</button>`).join('')}</div>`).join('');
  // Existing details and actions stay intact; these shortcuts just open their tools.
  const adminShortcuts=document.createElement('div');adminShortcuts.className='studio-admin-shortcuts studio-only';
  Array.from($('adminSection').querySelectorAll(':scope > details')).forEach((details,index)=>{
    const button=document.createElement('button');button.type='button';button.dataset.uiControl='admin-tool';
    button.innerHTML=`<span>${String(index+1).padStart(2,'0')}</span>`;
    const label=document.createElement('strong');label.textContent=details.querySelector('summary').textContent;button.append(label);
    button.addEventListener('click',()=>{details.open=true;const summary=details.querySelector('summary');if(summary.onclick)summary.onclick();details.scrollIntoView({behavior:'smooth',block:'start'});summary.focus();});adminShortcuts.append(button);
  });
  $('adminSection').querySelector('h2').after(adminShortcuts);
  // Move the existing battle sections through display only, never recreate a game.
  const battleTabs=document.createElement('div');battleTabs.className='studio-battle-tabs studio-only';
  battleTabs.innerHTML='<button data-ui-control="bob" aria-pressed="true">Play against Bob</button><button data-ui-control="duel" aria-pressed="false">Challenge a player</button>';
  $('battleGameSection').querySelector('h2').after(battleTabs);
  $('battleGameSection').dataset.studioBattle='bob';
  const trophyDetails=$('trophyPath').closest('details');trophyDetails.classList.add('studio-trophy-details');
  function makeFilter(section,listId,placeholder){
    const toolbar=document.createElement('div');toolbar.className='studio-filter studio-only';
    toolbar.innerHTML=`<label for="studioFilter-${listId}">${icon('search')}<input id="studioFilter-${listId}" type="search" placeholder="${placeholder}" autocomplete="off"></label><span id="studioCount-${listId}" role="status"></span>`;
    const list=$(listId);list.before(toolbar);
    const empty=document.createElement('p');empty.className='studio-filter-empty studio-only';empty.hidden=true;list.after(empty);
    const apply=()=>{if(!enabled){Array.from(list.children).forEach(row=>row.classList.remove('studio-filtered'));return;}
      const query=toolbar.querySelector('input').value.toLowerCase().trim();let count=0;
      Array.from(list.children).forEach(row=>{const match=!query||row.textContent.toLowerCase().includes(query)||Array.from(row.querySelectorAll('img')).some(img=>img.alt.toLowerCase().includes(query));row.classList.toggle('studio-filtered',!match);if(match)count++;});
      $(`studioCount-${listId}`).textContent=query?`${count} matches`:'';
      empty.hidden=!(query&&count===0);empty.textContent='Nothing matches that search. Try a different name.';
    };
    toolbar.querySelector('input').addEventListener('input',apply);
    new MutationObserver(apply).observe(list,{childList:true});return apply;
  }
  const filters=[makeFilter('marketplace','items','Search cards and packs...'),makeFilter('inventory','inventoryItems','Search your collection...')];
  function renderSearch(){
    const query=$('studioSearchInput').value.toLowerCase().trim();const result=$('studioSearchResults');result.replaceChildren();
    Object.entries(routes).filter(([key,r])=>(!r.admin||currentUserIsAdmin)&&`${key} ${r.label} ${r.description} ${key==='admin'?'grant grants users packs accounts tiers':''}`.toLowerCase().includes(query)).forEach(([key,r])=>{
      const button=document.createElement('button');button.type='button';button.dataset.uiNav=key;button.innerHTML=`${icon(r.icon)}<span>${r.label}<small>${r.group}</small></span>${icon('arrow')}`;result.append(button);
    });
    if(!result.children.length)result.textContent='No matching page. Try cards, gems, or wallet.';
  }
  function closeDrawer(){drawer=false;$('studioSidebar').inert=mobileQuery.matches;document.body.classList.remove('studio-menu-open');document.querySelector('.studio-scrim').hidden=true;document.querySelector('.studio-menu-button').setAttribute('aria-expanded','false');$('studioSidebar').removeAttribute('role');$('studioSidebar').removeAttribute('aria-modal');}
  function toggleDrawer(){if(drawer){closeDrawer();return;}drawer=true;$('studioSidebar').inert=false;lastFocus=document.activeElement;document.body.classList.add('studio-menu-open');document.querySelector('.studio-scrim').hidden=false;document.querySelector('.studio-menu-button').setAttribute('aria-expanded','true');$('studioSidebar').setAttribute('role','dialog');$('studioSidebar').setAttribute('aria-modal','true');$('studioSidebar').querySelector('button').focus();}
  function updateAdmin(){document.querySelectorAll('[data-admin-nav]').forEach(node=>node.hidden=!currentUserIsAdmin);if(enabled&&routes[active]?.admin&&!currentUserIsAdmin)navigate('home',false);}
  const panelMap={home:[home],marketplace:[$('marketplaceSection')],inventory:[$('inventorySection')],workshop:[workshop],amulets:[$('amuletSection')],battle:[$('battleGameSection')],spin:[$('spinSection')],wallet:[document.querySelector('.user-section'),document.querySelector('.transfer-section'),$('historySection')],sell:[document.querySelector('.sell-section')],vip:[$('vipSection')],admin:[$('adminSection')],'battle-manager':[$('battleSection')]};
  function navigate(route,push=true){
    route=route==='history'?'wallet':route;
    if(!routes[route]||(routes[route].admin&&!currentUserIsAdmin))route='home';
    active=route;
    routing=true;
    try{originalShow(routes[route].legacy||'inventory');}finally{routing=false;}
    // CSS keeps asynchronous legacy role loads from reopening panels on other pages.
    grid.querySelectorAll(':scope > section').forEach(section=>section.classList.toggle('studio-visible',panelMap[route].includes(section)));
    $('studioPageTitle').textContent=routes[route].title;$('studioPageGroup').textContent=routes[route].group;
    $('studioPageDescription').textContent=routes[route].description;$('studioBreadcrumb').textContent=routes[route].label;
    document.querySelectorAll('[data-ui-nav]').forEach(button=>{const selected=button.dataset.uiNav===route;button.classList.toggle('is-current',selected);if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
    document.body.dataset.studioPage=route;
    if(route==='battle'&&$('battleGameSection').dataset.studioBattle==='bob'&&!$('practiceBattle').open)$('practiceBattle').open=true;
    if(route==='workshop'&&!gemNodes[0].open)gemNodes[0].open=true;
    if(push&&location.hash!==`#/${route}`)history.pushState({studio:route},'',`#/`+route);
    closeDrawer();if($('studioSearch').open)$('studioSearch').close();
    // Override the old section scroll: every destination starts at its heading.
    window.scrollTo({top:0,behavior:'instant'});
    filters.forEach(apply=>apply());
    if(push)$('studioPageTitle').focus({preventScroll:true});
  }
  window.showSection=function(section){if(enabled&&!routing)return navigate(section);return originalShow(section);};
  function setMode(next,initial=false){
    enabled=next;originalHeadings.forEach(({node,text})=>{node.textContent=enabled?text.replace(/^[^\p{L}\p{N}]+/u,'').replace(/^BCM$/,'Battle cards'):text;});document.body.classList.toggle('studio-ui',enabled);
    switcher.textContent=enabled?'Classic UI':'Try new UI';switcher.setAttribute('aria-label',enabled?'Switch to the classic interface':'Switch to the new interface');
    closeDrawer();
    if(enabled){$('studioControls').append(controls);gemNodes.forEach(node=>workshop.append(node));updateAdmin();navigate(initial?(location.hash.startsWith('#/')?location.hash.slice(2):'home'):active,false);}
    else{controlsHome.after(controls);gemNodes.forEach((node,i)=>gemHomes[i].after(node));routing=true;try{originalShow(routes[active]?.legacy||'marketplace');}finally{routing=false;}filters.forEach(apply=>apply());}
    if(!initial){try{localStorage.setItem(preferenceKey,enabled?'studio':'classic');localStorage.setItem('footy-ui-default',enabled?'studio':'classic');}catch(_){}history.replaceState(null,'',enabled?`#/${active}`:location.pathname+location.search);}
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest('[data-ui-nav]');if(link&&enabled){navigate(link.dataset.uiNav);return;}
    const control=event.target.closest('[data-ui-control]');if(!control)return;
    switch(control.dataset.uiControl){
      case 'menu':toggleDrawer();break;
      case 'close-menu':closeDrawer();lastFocus?.focus();break;
      case 'search':closeDrawer();renderSearch();$('studioSearch').showModal();$('studioSearchInput').focus();break;
      case 'close-search':$('studioSearch').close();break;
      case 'bob':case 'duel':$('battleGameSection').dataset.studioBattle=control.dataset.uiControl;battleTabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===control)));if(control.dataset.uiControl==='bob')$('practiceBattle').open=true;break;
    }
  });
  $('studioSearchInput').addEventListener('input',renderSearch);
  $('studioSearchInput').addEventListener('keydown',event=>{if(event.key==='Enter')$('studioSearchResults').querySelector('button')?.click();});
  $('studioSearch').addEventListener('click',event=>{if(event.target===$('studioSearch')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
  document.addEventListener('keydown',event=>{
    if(!enabled)return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();renderSearch();if(!$('studioSearch').open)$('studioSearch').showModal();$('studioSearchInput').focus();}
    if(event.key==='Escape'&&drawer){closeDrawer();lastFocus?.focus();}
    if(event.key==='Tab'&&drawer){const buttons=Array.from($('studioSidebar').querySelectorAll('button')).filter(b=>b.offsetParent!==null);const first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  });
  mobileQuery.addEventListener('change',()=>closeDrawer());
  window.addEventListener('popstate',()=>{if(enabled)navigate(location.hash.replace('#/','')||'home',false);});
  window.addEventListener('footy-role-changed',updateAdmin);
  const syncBalance=()=>{$('studioBalance').textContent=$('balance').textContent.replace(/^.*?([\d,.]+).*$/,'$1');};
  new MutationObserver(syncBalance).observe($('balance'),{childList:true,subtree:true,characterData:true});syncBalance();
  let preferred='studio';try{preferred=localStorage.getItem(preferenceKey)||localStorage.getItem('footy-ui-default')||'studio';}catch(_){}
  setMode(preferred!=='classic',true);
  window.footyStudio={navigate,setMode,get enabled(){return enabled;}};
  const preview=document.createElement('dialog');
  preview.className='studio-card-preview';
  preview.setAttribute('aria-label','Enlarged card');
  preview.innerHTML='<button type="button" class="btn">Close</button><img alt="">';
  document.body.append(preview);
  preview.querySelector('button').onclick=()=>preview.close();
  preview.onclick=event=>{if(event.target===preview)preview.close();};
  const showCard=image=>{if(!enabled||document.body.classList.contains('dye-mode'))return;const large=preview.querySelector('img');large.src=image.src;large.alt=image.alt;preview.showModal();};
  $('inventoryItems').addEventListener('click',event=>{if(event.target.matches('img.item-image'))showCard(event.target);});
  $('inventoryItems').addEventListener('keydown',event=>{if(event.target.matches('img.item-image')&&['Enter',' '].includes(event.key)){event.preventDefault();showCard(event.target);}});
  const prepareImages=()=>{$('inventoryItems').querySelectorAll('img.item-image').forEach(image=>{image.tabIndex=0;image.setAttribute('role','button');image.setAttribute('aria-label',`Enlarge ${image.alt}`);});};
  new MutationObserver(prepareImages).observe($('inventoryItems'),{childList:true});prepareImages();
})();
