let practiceGame = null;
let practiceTimedBusy=false;
let practiceSelection = new Set();
let practiceCards = [];
let practiceWorker = null;
let practiceGeneration = 0;
const practiceCacheKey = `practice-cards:${currentUserId}`;
function rememberPracticeCards(cards) {
  try { localStorage.setItem(practiceCacheKey, JSON.stringify(cards)); } catch (error) { console.warn('Practice cache unavailable', error); }
}
function practiceStarterCards() { return PracticeEngine.trainingCards(); }
let practicePool = [];
const practiceSaveKey = `computer-battle:${currentUserId}`;
function persistPractice() { try { if(practiceGame)localStorage.setItem(practiceSaveKey,JSON.stringify(practiceGame));else localStorage.removeItem(practiceSaveKey); }catch(_){} }
async function loadPracticePool() {
  try { practicePool=await resourceRequest('/battle-cards');localStorage.setItem(`computer-pool:${currentUserId}`,JSON.stringify(practicePool)); }catch(_){try{practicePool=JSON.parse(localStorage.getItem(`computer-pool:${currentUserId}`)||'[]');}catch(_){} }
}
function loadPracticeSetup() {
  loadTrophyPath(); loadPracticePool(); loadBrawlSkill();
  if (practiceGame) return;
  try { const saved=JSON.parse(localStorage.getItem(practiceSaveKey)||'null');
    if(saved && Array.isArray(saved.board) && Array.isArray(saved.moves)) {practiceGame=saved;document.getElementById('practiceSetup').hidden=true;document.getElementById('practiceArena').hidden=false;renderPracticeBattle();if(saved.finished)finishPracticeTrophies();else if(saved.turn==='computer')runPracticeComputer();return;}
  } catch(_){}
  let cached = [];
  try { cached = JSON.parse(localStorage.getItem(practiceCacheKey) || '[]'); } catch (_) {}
  const cards = battleInventoryCache.length ? battleInventoryCache : Array.isArray(cached) ? cached : [];
  practiceCards = cards.length >= 6 ? cards : practiceStarterCards();
  const valid = new Set(practiceCards.map(card => card.battleCardId));
  practiceSelection = new Set([...practiceSelection].filter(id => valid.has(id)));
  if (!practiceSelection.size) { const initial=[];for(const card of practiceCards)if(initial.length<6&&PracticeEngine.validSpecials([...initial,card]))initial.push(card);practiceSelection=new Set(initial.map(card=>card.battleCardId)); }
  document.getElementById('practiceNote').textContent = cards.length >= 6 ? 'Using your last loaded battle inventory. Choose six cards, at most one special. Bob uses mostly your inventory plus up to two outside cards, matched by side strength. Ranked Brawl adapts to your Skill Level.' : 'Using six free starter cards. Load six owned battle cards online to battle with your own deck.';
  renderPracticePicker();
}
function safePracticeMarkup(card) {
  const name = String(card.name || 'Card').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  return buildBattleCardMarkup({...card,name}, {small:true});
}
function renderPracticePicker() {
  const list = document.getElementById('practicePicker'); list.replaceChildren();
  for (const card of practiceCards) {
    const button = document.createElement('button'); button.type='button'; button.className='battle-hand-card';
    button.classList.toggle('is-active', practiceSelection.has(card.battleCardId));
    button.setAttribute('aria-pressed', String(practiceSelection.has(card.battleCardId)));
    button.innerHTML = safePracticeMarkup(card);
    button.onclick = () => { if(practiceSelection.has(card.battleCardId))practiceSelection.delete(card.battleCardId); else if(practiceSelection.size<6){if(!PracticeEngine.validSpecials([...practiceCards.filter(c=>practiceSelection.has(c.battleCardId)),card])){document.getElementById('practiceNote').textContent='Only one special card is allowed per deck.';return;}practiceSelection.add(card.battleCardId);}renderPracticePicker(); };
    list.appendChild(button);
  }
  document.getElementById('practiceStart').disabled = practiceSelection.size !== 6;
  document.getElementById('practiceCount').textContent = `${practiceSelection.size}/6 cards selected`;
}
async function startPracticeBattle() {
  if (practiceSelection.size !== 6) return;
  if(!PracticeEngine.validSpecials(practiceCards.filter(card=>practiceSelection.has(card.battleCardId)))){document.getElementById('practiceNote').textContent='Only one special card is allowed per deck.';return;}
  const button=document.getElementById('practiceStart');button.disabled=true;
  let difficulty=document.getElementById('practiceDifficulty').value;
  try {
    let session=null,generated,initial;
    const ranked=document.getElementById('practiceMode').value==='skill';
    if(ranked){
      session=await resourceRequest('/computer-battles/start',{cardIds:[...practiceSelection],mode:'skill'});initial=session.initial;difficulty=session.difficulty;if(session.profile)renderBrawlSkill(session.profile);else await loadBrawlSkill();
      generated=session;
    } else {
      const deck=practiceCards.filter(card=>practiceSelection.has(card.battleCardId)).map(card=>({...card}));
      generated=PracticeEngine.rankedDeck(practicePool,practiceCards,deck);
      const board=Array(16).fill(null);board[5]=PracticeEngine.starterCard(practicePool,[...deck,...generated.deck]);
      initial={board,player:deck,computer:generated.deck,turn:PracticeEngine.startingPlayer(deck,generated.deck)};
    }
    if(practiceWorker)practiceWorker.terminate();practiceGeneration++;
    practiceGame={...initial,first:initial.turn,selected:null,finished:false,difficulty,mode:ranked?'skill':'training',skillResult:null,forfeitedSkill:session?.forfeitedSkill||null,seed:session?.seed??Math.floor(Math.random()*2147483647),sessionId:session?.id||null,computerTurn:0,moves:[],strength:{target:generated.target,average:generated.average,playerAverage:generated.playerAverage}, trophyMessage:''};
    if(session?.live) {practiceGame.timed=true;practiceGame.live=session.live;Object.assign(practiceGame,session.live);}
    else if(!ranked&&[...initial.player,...initial.computer].some(card=>PracticeEngine.ability(card)==='mirror-interrupt')){practiceGame.timed=true;practiceGame.live=BrawlTurns.create(initial,difficulty,practiceGame.seed);Object.assign(practiceGame,practiceGame.live);}
    persistPractice();document.getElementById('practiceSetup').hidden=true;document.getElementById('practiceArena').hidden=false;
    renderPracticeBattle();loadTrophyPath();if(initial.turn==='computer')runPracticeComputer();
  } catch(error){document.getElementById('practiceNote').textContent=error.message+' Ranked Brawl needs a connection and a current login. Choose Training to play without progression.';}
  finally {button.disabled=false;}
}
function stopPracticeBattle() {
  if(practiceGame?.sessionId && practiceGame.finished && !practiceGame.trophiesSaved) {finishPracticeTrophies();return;}
  if(practiceGame?.sessionId && !practiceGame.finished && !confirm('Leave this ranked Brawl? Starting your next ranked Brawl counts this one as a loss and lowers your Skill Level.')) return;
  practiceGeneration++; if(practiceWorker)practiceWorker.terminate(); practiceWorker=null;practiceGame=null;persistPractice();
  document.getElementById('practiceSetup').hidden=false;document.getElementById('practiceArena').hidden=true;loadPracticeSetup();
}
function renderPracticeBattle() {
  const game=practiceGame; if(!game)return;
  const board=document.getElementById('practiceBoard');board.replaceChildren();
  game.board.forEach((card,cell)=>{
    const button=document.createElement('button');button.type='button';button.className='battle-board-cell';
    const canInterrupt=game.timed&&game.turn==='computer'&&Date.now()-game.turnStartedAt>=15000&&!game.interruptsUsed?.player&&game.selected!==null&&PracticeEngine.ability(game.player[game.selected])==='mirror-interrupt';
    button.disabled=game.finished || (game.turn!=='player'&&!canInterrupt) || game.selected===null || !PracticeEngine.placementOptions(game.board,game.player[game.selected]).some(options=>PracticeEngine.canPlace(game.board,game.player[game.selected],cell,options));
    if(card){const frame=document.createElement('div');frame.className='battle-board-card';frame.innerHTML=safePracticeMarkup({...card,tierColors:{backgroundColor:card.color}});button.appendChild(frame);button.setAttribute('aria-label',`${card.name}, ${card.ownerId==='computer'?'Bob':card.ownerId==='player'?'You':'Starter'}`);}else button.textContent='+';
    button.onclick=()=>practicePlace(cell);board.appendChild(button);
  });
  animateBattleBoard(board,game.board,game.sessionId||game.seed);
  const hand=document.getElementById('practiceHand');hand.replaceChildren();
  game.player.forEach((card,index)=>{const button=document.createElement('button');button.type='button';button.className='battle-hand-card';button.innerHTML=safePracticeMarkup(card);button.disabled=game.finished||(game.turn!=='player'&&!(game.timed&&PracticeEngine.ability(card)==='mirror-interrupt'&&!game.interruptsUsed?.player));button.classList.toggle('is-active',game.selected===index);button.onclick=()=>{game.selected=index;renderPracticeBattle();};hand.appendChild(button);});
  const mine=game.board.filter(card=>card?.ownerId==='player').length;
  const theirs=game.board.filter(card=>card?.ownerId==='computer').length;
  const status=game.finished ? (mine>theirs?'You win!':mine<theirs?'Bob wins.':'Draw!') : game.turn==='computer'?'Bob is thinking...':'Your turn: select a card and an empty space.';
  document.getElementById('brawlSyncResult').hidden=!game.sessionId||!game.finished||game.trophiesSaved;
  const skillResult=document.getElementById('brawlSkillResult');
  skillResult.textContent=game.skillResult?formatBrawlSkillResult(game.skillResult):game.mode==='training'?'Training: Skill Level and rewards are unchanged.':game.forfeitedSkill?`Previous Brawl: ${formatBrawlSkillResult(game.forfeitedSkill)}`:'';
  renderBrawlMoveReviews(game.moveReviews||[]);
  const timerHint=game.timed&&!game.finished?` Timed ability active: ${Math.max(0,15-Math.floor((Date.now()-game.turnStartedAt)/1000))}s until an interrupt can be used.`:'';
  document.getElementById('practiceStatus').textContent=`${status} You: ${mine} / Bob: ${theirs}. ${game.mode==='skill'?'RANKED':game.mode==='training'?'TRAINING':String(game.difficulty).toUpperCase()} - deck averages: you ${Number(game.strength.playerAverage).toFixed(1)}, Bob ${Number(game.strength.average).toFixed(1)} ${game.first?`- ${game.first==='player'?'You':'Bob'} started.`:'.'} ${game.trophyMessage||''}${timerHint}`;
}
async function practicePlace(cell) {
  const game=practiceGame;if(!game||game.finished||(!game.timed&&game.turn!=='player')||game.selected===null)return;
  const selected=game.selected,revision=game.events?.length;
  const options=await chooseBattleOptions(game.board,game.player[selected]);if(!options||practiceGame!==game||game.selected!==selected||game.events?.length!==revision||(!game.timed&&game.turn!=='player'))return;
  if(!PracticeEngine.canPlace(game.board,game.player[selected],cell,options)){document.getElementById('practiceStatus').textContent='That ability cannot use this occupied space. Choose another space.';return;}
  if(game.timed){await updateTimedPractice({type:'place',cardIndex:game.selected,cell,options,revision:game.events.length});return;}
  game.moves.push({cardIndex:game.selected,cell,options});
  game.board=PracticeEngine.play(game.board,game.player[game.selected],cell,'player',undefined,options);game.player.splice(game.selected,1);game.selected=null;
  game.finished=!game.player.length&&!game.computer.length;game.turn=game.computer.length?'computer':'player';persistPractice();renderPracticeBattle();if(game.finished)finishPracticeTrophies();if(!game.finished&&game.turn==='computer')runPracticeComputer();
}
function runPracticeComputer() {
  if(practiceGame?.timed)return;
  const game=practiceGame;const generation=practiceGeneration;
  const visibleAt=Date.now()+3000+Math.floor(Math.random()*2001);
  const apply=move=>{if(generation!==practiceGeneration||practiceGame!==game||game.turn!=='computer')return;
    if(!move){game.finished=true;renderPracticeBattle();return;}
    game.computerTurn++;
    game.board=PracticeEngine.play(game.board,game.computer[move.cardIndex],move.cell,'computer',undefined,move.options);game.computer.splice(move.cardIndex,1);
    game.finished=!game.player.length&&!game.computer.length;game.turn=game.player.length?'player':'computer';persistPractice();renderPracticeBattle();if(game.finished)finishPracticeTrophies();if(!game.finished&&game.turn==='computer')runPracticeComputer();};
  const reveal=move=>setTimeout(()=>apply(move),Math.max(0,visibleAt-Date.now()));
  const fallback=()=>setTimeout(()=>{if(generation===practiceGeneration)reveal(PracticeEngine.chooseMove(game.board,game.computer,game.player,game.difficulty,PracticeEngine.seeded(game.seed+game.computerTurn)));},150);
  try {
    const worker=new Worker('practice-worker.js');
    practiceWorker=worker;
    worker.onmessage=event=>{worker.terminate();if(practiceWorker===worker)practiceWorker=null;reveal(event.data);};
    worker.onerror=()=>{worker.terminate();if(practiceWorker===worker)practiceWorker=null;fallback();};
    worker.postMessage({board:game.board,hand:game.computer,opponentHand:game.player,difficulty:game.difficulty,seed:game.seed+game.computerTurn});
  } catch (_) {fallback();}
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('practice-sw.js').catch(error=>console.warn('Offline page cache unavailable',error));

let trophySaving=false;
async function finishPracticeTrophies(){
 const game=practiceGame;if(!game||!game.finished||!game.sessionId||game.trophiesSaved||trophySaving)return;
 trophySaving=true;game.trophyMessage='Saving trophy result...';renderPracticeBattle();
 try {
  const result=await resourceRequest('/computer-battles/finish',{id:game.sessionId,moves:game.moves});
  game.trophiesSaved=true;game.skillResult=result.skill||null;game.moveReviews=result.moveReviews||[];if(result.profile)renderBrawlSkill(result.profile);game.trophyMessage=`${result.delta>=0?'+':''}${result.delta} trophies. Total: ${result.trophies}.${result.footy?` Booster: +${result.footy} Footy.`:''}${result.ruby?` +${result.ruby} Ruby.`:''}`;loadTrophyPath();updateBalance();
 }catch(error){game.trophyMessage=`Result saved locally. ${error.message} Reconnect and click Sync Brawl result.`;}
 finally{trophySaving=false;persistPractice();renderPracticeBattle();}
}
async function loadTrophyPath(){
 const container=document.getElementById('trophyPath');
 try{
  const data=await resourceRequest('/trophies');container.replaceChildren();
  document.getElementById('trophyTotal').textContent=`${data.trophies} trophies / best: ${data.peak}`;
  const names={bronze:'Ruby','rare-bronze':'Garnet',silver:'Moonstone','rare-silver':'Opal',gold:'Citrine','rare-gold':'Emerald',platinum:'Sapphire',lightning:'Amethyst',ultra:'Diamond'};
  for(const reward of data.path){
   const tile=amuletNode('article',undefined,'amulet-tile');tile.append(amuletNode('h4',`${reward.at} trophies`),amuletNode('p',`${reward.footy} Footy${Object.entries(reward.gems).map(([key,n])=>` + ${n} ${names[key]||key}`).join('')}`));
   const button=amuletNode('button',data.claimed.includes(reward.at)?'Claimed':data.peak>=reward.at?'Claim reward':`${reward.at-data.peak} to unlock`,'btn btn-primary');
   button.disabled=data.claimed.includes(reward.at)||data.peak<reward.at;
   button.onclick=async()=>{button.disabled=true;try{await resourceRequest('/trophies/claim',{at:reward.at});await loadTrophyPath();updateBalance();}catch(error){alert(error.message);button.disabled=false;}};
   tile.appendChild(button);container.appendChild(tile);
  }
 }catch(error){document.getElementById('trophyTotal').textContent='Connect to view trophies and claim rewards.';}
}
window.addEventListener('online',()=>{finishPracticeTrophies();loadTrophyPath();});

function updateBrawlMode() {
  document.getElementById('practiceTraining').hidden=document.getElementById('practiceMode').value!=='training';
}
function formatBrawlSkillResult(result) {
  return result.placement?result.explanation:`Skill Level: ${result.before} \u2192 ${result.after} (${result.delta>=0?'+':''}${result.delta}). ${result.explanation}`;
}
function renderBrawlMoveReviews(reviews) {
  document.getElementById('brawlMoveReview').hidden=!reviews.length;
  const list=document.getElementById('brawlMoveReviews');list.replaceChildren();
  const square=cell=>`row ${Math.floor(cell/4)+1}, column ${cell%4+1}`;
  for(const move of reviews){
    const row=amuletNode('article',undefined,'amulet-tile');
    row.appendChild(amuletNode('h4',`Move ${move.turn}: ${move.card} at ${square(move.cell)}`));
    row.appendChild(amuletNode('p',move.quality===null?'Equivalent choices; excluded from the quality average.':`Estimated quality: ${move.quality}%. ${move.quality===100?'One of the best assessed moves.':`Best assessed alternative: ${move.bestCard} at ${square(move.bestCell)}.`}`));
    if(move.reply)row.appendChild(amuletNode('p',`Possible reply: ${move.reply.card} at ${square(move.reply.cell)}.${move.followup?` Your follow-up: ${move.followup.card} at ${square(move.followup.cell)}.`:''}`));
    list.appendChild(row);
  }
}
function renderBrawlSkill(data) {
  const describe=entry=>`${entry.name}: ${[entry.footy?`+${entry.footy} Footy`:null,entry.ruby?`+${entry.ruby} Ruby`:null,entry.trophyPercent?`+${entry.trophyPercent}% trophies`:null].filter(Boolean).join(', ')||'no bonuses'} per ranked win`;
  document.getElementById('brawlSkillLevel').textContent=data.placed?`Skill Level: ${data.skillLevel} / 1000`:`Placement games: ${data.placementsCompleted} / ${data.placementsRequired}`;
  const progress=document.getElementById('brawlSkillProgress');
  progress.setAttribute('aria-label',data.placed?'Progress to next skill milestone':'Placement games completed');
  progress.max=data.placed?(data.next?data.next.at-data.booster.at:1000):data.placementsRequired;
  progress.value=data.placed?(data.next?data.skillLevel-data.booster.at:1000):data.placementsCompleted;
  document.getElementById('brawlSkillNext').textContent=!data.placed?'Finish five ranked games to establish your starting Skill Level.':data.next?`${data.next.at-data.skillLevel} skill to ${describe(data.next)} (level ${data.next.at}).`:'Maximum Skill Level reached!';
  document.getElementById('brawlSkillBooster').textContent=data.placed?`Active booster: ${describe(data.booster)}.`:'Skill boosters become available after placement. Base trophies still apply.';
  const list=document.getElementById('brawlMilestones');list.replaceChildren();
  for(const entry of data.milestones)list.appendChild(amuletNode('p',`${entry.at} - ${describe(entry)}${!data.placed?' - After placement':entry.at===data.booster.at?' - Active':entry.at>data.skillLevel?' - Locked':' - Replaced by your stronger booster'}`));
}
async function loadBrawlSkill() {
  try { renderBrawlSkill(await resourceRequest('/brawl/skill')); }
  catch(error) { document.getElementById('brawlSkillLevel').textContent=error.message; }
}

async function updateTimedPractice(action={}) {
  const game=practiceGame;if(!game?.timed||game.finished||practiceTimedBusy)return;
  practiceTimedBusy=true;
  try {
    const result=game.sessionId?await resourceRequest('/computer-battles/turn',{id:game.sessionId,action}):{live:BrawlTurns.advance(game.live,action)};
    if(practiceGame!==game)return;
    const changed=game.events.length!==result.live.events.length;
    game.live=result.live;Object.assign(game,result.live);if(changed)game.selected=null;
    persistPractice();renderPracticeBattle();if(game.finished)finishPracticeTrophies();
  }catch(error){if(practiceGame===game)document.getElementById('practiceStatus').textContent=error.message;}
  finally{practiceTimedBusy=false;}
}
setInterval(()=>{if(practiceGame?.timed&&!practiceGame.finished)updateTimedPractice();},1000);
