let practiceGame = null;
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
  loadTrophyPath(); loadPracticePool();
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
  if (!practiceSelection.size) practiceSelection = new Set(practiceCards.slice(0,6).map(card=>card.battleCardId));
  document.getElementById('practiceNote').textContent = cards.length >= 6 ? 'Using your last loaded battle inventory. Choose six cards. The computer gets a randomized deck matched to the selected difficulty.' : 'Using six free training cards. Load six owned battle cards online to practice with your own deck.';
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
    button.onclick = () => { if(practiceSelection.has(card.battleCardId))practiceSelection.delete(card.battleCardId); else if(practiceSelection.size<6)practiceSelection.add(card.battleCardId);renderPracticePicker(); };
    list.appendChild(button);
  }
  document.getElementById('practiceStart').disabled = practiceSelection.size !== 6;
  document.getElementById('practiceCount').textContent = `${practiceSelection.size}/6 cards selected`;
}
async function startPracticeBattle() {
  if (practiceSelection.size !== 6) return;
  const button=document.getElementById('practiceStart');button.disabled=true;
  const difficulty=document.getElementById('practiceDifficulty').value;
  const turn=document.getElementById('practiceFirst').value;
  try {
    let session=null,generated,initial;
    const ranked=document.getElementById('practiceRanked').checked;
    if(ranked){
      session=await resourceRequest('/computer-battles/start',{cardIds:[...practiceSelection],difficulty,first:turn});initial=session.initial;
      generated=session;
    } else {
      const deck=practiceCards.filter(card=>practiceSelection.has(card.battleCardId)).map(card=>({...card}));
      generated=PracticeEngine.computerDeck(practicePool.length>=6?practicePool:practiceCards,deck,difficulty);
      const board=Array(16).fill(null);board[5]={name:'Starter',top:5,right:5,bottom:5,left:5,averageScore:5,ownerId:'starter',color:'#8a8f98'};
      initial={board,player:deck,computer:generated.deck,turn};
    }
    if(practiceWorker)practiceWorker.terminate();practiceGeneration++;
    practiceGame={...initial,selected:null,finished:false,difficulty,seed:session?.seed??Math.floor(Math.random()*2147483647),sessionId:session?.id||null,computerTurn:0,moves:[],strength:{target:generated.target,average:generated.average,playerAverage:generated.playerAverage}, trophyMessage:''};
    persistPractice();document.getElementById('practiceSetup').hidden=true;document.getElementById('practiceArena').hidden=false;
    renderPracticeBattle();loadTrophyPath();if(turn==='computer')runPracticeComputer();
  } catch(error){document.getElementById('practiceNote').textContent=error.message+' Trophy battles need a connection to start. Uncheck Earn trophies for local practice.';}
  finally {button.disabled=false;}
}
function stopPracticeBattle() {
  if(practiceGame?.sessionId && practiceGame.finished && !practiceGame.trophiesSaved) {finishPracticeTrophies();return;}
  if(practiceGame?.sessionId && !practiceGame.finished && !confirm('Leave this trophy battle? Starting your next trophy battle counts this one as a loss.')) return;
  practiceGeneration++; if(practiceWorker)practiceWorker.terminate(); practiceWorker=null;practiceGame=null;persistPractice();
  document.getElementById('practiceSetup').hidden=false;document.getElementById('practiceArena').hidden=true;loadPracticeSetup();
}
function renderPracticeBattle() {
  const game=practiceGame; if(!game)return;
  const board=document.getElementById('practiceBoard');board.replaceChildren();
  game.board.forEach((card,cell)=>{
    const button=document.createElement('button');button.type='button';button.className='battle-board-cell';
    button.disabled=game.finished || game.turn!=='player' || game.selected===null || !!card;
    if(card){button.innerHTML=safePracticeMarkup({...card,tierColors:{backgroundColor:card.color}});button.setAttribute('aria-label',`${card.name}, ${card.ownerId}`);}else button.textContent='+';
    button.onclick=()=>practicePlace(cell);board.appendChild(button);
  });
  const hand=document.getElementById('practiceHand');hand.replaceChildren();
  game.player.forEach((card,index)=>{const button=document.createElement('button');button.type='button';button.className='battle-hand-card';button.innerHTML=safePracticeMarkup(card);button.disabled=game.finished||game.turn!=='player';button.classList.toggle('is-active',game.selected===index);button.onclick=()=>{game.selected=index;renderPracticeBattle();};hand.appendChild(button);});
  const mine=game.board.filter(card=>card?.ownerId==='player').length;
  const theirs=game.board.filter(card=>card?.ownerId==='computer').length;
  const status=game.finished ? (mine>theirs?'You win!':mine<theirs?'Computer wins.':'Draw!') : game.turn==='computer'?'Computer is considering your best reply...':'Your turn: select a card and an empty space.';
  document.getElementById('practiceStatus').textContent=`${status} You: ${mine} / Computer: ${theirs}. ${game.difficulty.toUpperCase()} - deck averages: you ${Number(game.strength.playerAverage).toFixed(1)}, computer ${Number(game.strength.average).toFixed(1)} (target ${Number(game.strength.target).toFixed(1)}). ${game.trophyMessage||''}`;
}
function practicePlace(cell) {
  const game=practiceGame;if(!game||game.finished||game.turn!=='player'||game.selected===null||game.board[cell])return;
  game.moves.push({cardIndex:game.selected,cell});
  game.board=PracticeEngine.play(game.board,game.player[game.selected],cell,'player');game.player.splice(game.selected,1);game.selected=null;
  game.finished=!game.player.length&&!game.computer.length;game.turn=game.computer.length?'computer':'player';persistPractice();renderPracticeBattle();if(game.finished)finishPracticeTrophies();if(!game.finished&&game.turn==='computer')runPracticeComputer();
}
function runPracticeComputer() {
  const game=practiceGame;const generation=practiceGeneration;
  const visibleAt=Date.now()+3000+Math.floor(Math.random()*2001);
  const apply=move=>{if(generation!==practiceGeneration||practiceGame!==game||game.turn!=='computer')return;
    if(!move){game.finished=true;renderPracticeBattle();return;}
    game.computerTurn++;
    game.board=PracticeEngine.play(game.board,game.computer[move.cardIndex],move.cell,'computer');game.computer.splice(move.cardIndex,1);
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
  game.trophiesSaved=true;game.trophyMessage=`${result.delta>=0?'+':''}${result.delta} trophies. Total: ${result.trophies}.`;loadTrophyPath();
 }catch(error){game.trophyMessage='Result saved locally. Reconnect and click Sync trophy result.';}
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
