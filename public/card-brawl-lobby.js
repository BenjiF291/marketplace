/* Card Brawl presentation: preserve the existing pickers, invites and match handlers. */
(() => {
 const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text)n.textContent=text;return n;},section=$('battleGameSection'),setup=$('practiceSetup'),practice=$('practiceBattle');if(!section||!setup)return;
 section.classList.add('skystones-lobby');section.querySelector('h2').textContent='Card Brawl';
 const button=(text,action,cls)=>{const b=el('button',cls,text);b.type='button';b.onclick=action;return b;};
 function modal(title,cls){const d=el('dialog','sk-dialog '+cls),header=el('header','sk-dialog-header'),heading=el('h2','',title);heading.id=cls+'Title';d.setAttribute('aria-labelledby',heading.id);header.append(heading,button('Close',()=>d.close(),'sk-close'));d.append(header);document.body.append(d);return d;}
 const deck=modal('Choose your deck','sk-deck-dialog'),deckIntro=el('div','sk-deck-intro');deckIntro.append($('practiceCount'),$('practiceNote'));deck.append(deckIntro,$('practicePicker'));
 const deckFooter=el('footer','sk-deck-footer');deckFooter.append(el('span','','Choose six cards · At most one special'),button('Use this deck',()=>deck.close(),'sk-primary'));deck.append(deckFooter);
 const friends=modal('Challenge a friend','sk-friend-dialog');for(const id of ['battleMatchLobby','battleSetupPanel','battleDeckPanel','battleBoardPanel'])friends.append($(id));
 const hub=el('section','sk-hub'),eyebrow=el('p','sk-eyebrow','THE SKYSTONES ARENA'),title=el('h3','sk-hub-title','Make your next move'),board=el('div','sk-hub-board');
 function tile(label,subtitle,action,cls){const b=button('',action,'sk-hub-tile '+cls),fan=el('span','sk-card-fan');for(let i=0;i<3;i++){const c=el('span','sk-fan-card');c.style.setProperty('--fan',i-1);c.append(el('span','',String([7,9,6][i])),el('small','','SKYSTONES'));fan.append(c);}b.append(fan,el('strong','',label),el('small','',subtitle));return b;}
 const left=tile('My deck','Choose your six cards',()=>{if(!practiceGame)loadPracticeSetup();deck.showModal();},'sk-my-deck'),right=tile('Challenge a friend','Invite a player to the table',()=>{loadBattleOpponents();friends.showModal();},'sk-friend');
 const center=el('div','sk-hub-center'),crest=el('div','sk-arena-crest');crest.append(el('span','','SKILL & STRATEGY'),el('strong','','Card Brawl'),el('small','','Six cards. One winning hand.'));const start=$('practiceStart');start.classList.add('sk-battle-button');start.textContent='BATTLE';
 const modeLabel=el('label','sk-mode-label','Battle mode');modeLabel.append($('practiceMode'));center.append(crest,start,el('p','sk-battle-caption','Play against Bob'),modeLabel,$('practiceTraining'));
 board.append(left,center,right);const preview=el('div','sk-selected-preview');preview.setAttribute('aria-label','Your selected deck');hub.append(eyebrow,title,board,preview);
 setup.querySelector('label[for=practiceMode]')?.remove();const guide=el('details','sk-guide');guide.append(el('summary','','How to play'));for(const node of [...setup.children])if(node!==hub)guide.append(node);setup.append(hub,guide);
 // Put rules and progression below the arena instead of above the primary actions.
 const rules=el('details','sk-guide');rules.append(el('summary','','Ranked rules & skill progress'));for(const n of [...practice.children])if(n!==practice.querySelector('summary')&&n!==setup&&n!==$('practiceArena'))rules.append(n);practice.append(rules);
 function refresh(){preview.replaceChildren();for(const card of practiceCards.filter(c=>practiceSelection.has(c.battleCardId))){const item=el('div','sk-preview-card');item.innerHTML=safePracticeMarkup(card);preview.append(item);}left.querySelector(':scope > small').textContent=$('practiceCount').textContent||'Choose your six cards';}
 new MutationObserver(refresh).observe($('practicePicker'),{childList:true});refresh();
 // An incoming invitation or existing friend match opens the original duel controls.
 new MutationObserver(()=>{if(!$('battleSetupPanel').hidden&&section.style.display!=='none'&&!friends.open)friends.showModal();}).observe($('battleSetupPanel'),{attributes:true,attributeFilter:['hidden']});
 new MutationObserver(()=>{if(section.style.display!=='none'&&!practice.open)practice.open=true;}).observe(section,{attributes:true,attributeFilter:['style']});
 window.CardBrawlLobby={openDeck:()=>deck.showModal(),openFriends:()=>friends.showModal()};
})();
