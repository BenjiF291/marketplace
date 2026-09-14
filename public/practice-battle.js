let practiceGame = null;
let practiceSelection = new Set();
let practiceCards = [];
let practiceWorker = null;
let practiceGeneration = 0;
const practiceCacheKey = `practice-cards:${currentUserId}`;
function rememberPracticeCards(cards) {
  try { localStorage.setItem(practiceCacheKey, JSON.stringify(cards)); } catch (error) { console.warn('Practice cache unavailable', error); }
}
function practiceStarterCards() {
  return [[8,3,5,4],[4,8,3,5],[5,4,8,3],[3,5,4,8],[6,6,4,4],[4,4,6,6]].map((sides,index) => ({ battleCardId:`training-${index}`, name:`Training ${index+1}`, top:sides[0],right:sides[1],bottom:sides[2],left:sides[3],averageScore:5 }));
}
function loadPracticeSetup() {
  if (practiceGame) return;
  let cached = [];
  try { cached = JSON.parse(localStorage.getItem(practiceCacheKey) || '[]'); } catch (_) {}
  const cards = battleInventoryCache.length ? battleInventoryCache : Array.isArray(cached) ? cached : [];
  practiceCards = cards.length >= 6 ? cards : practiceStarterCards();
  const valid = new Set(practiceCards.map(card => card.battleCardId));
  practiceSelection = new Set([...practiceSelection].filter(id => valid.has(id)));
  if (!practiceSelection.size) practiceSelection = new Set(practiceCards.slice(0,6).map(card=>card.battleCardId));
  document.getElementById('practiceNote').textContent = cards.length >= 6 ? 'Using your last loaded battle inventory. Choose six cards. The computer uses the same six cards for a fair match.' : 'Using six free training cards. Load six owned battle cards online to practice with your own deck.';
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
function startPracticeBattle() {
  if (practiceSelection.size !== 6) return;
  if(practiceWorker)practiceWorker.terminate();
  practiceGeneration++;
  const deck = practiceCards.filter(card=>practiceSelection.has(card.battleCardId)).map(card=>({...card}));
  const board = Array(16).fill(null);
  board[5] = {name:'Starter',top:5,right:5,bottom:5,left:5,averageScore:5,ownerId:'starter',playedBy:'starter',color:'#8a8f98'};
  const turn = document.getElementById('practiceFirst').value;
  practiceGame = {board, player:deck.map(card=>({...card})), computer:deck.map(card=>({...card})), turn, selected:null, finished:false};
  document.getElementById('practiceSetup').hidden=true;
  document.getElementById('practiceArena').hidden=false;
  renderPracticeBattle(); if(turn==='computer')runPracticeComputer();
}
function stopPracticeBattle() {
  practiceGeneration++; if(practiceWorker)practiceWorker.terminate(); practiceWorker=null;practiceGame=null;
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
  document.getElementById('practiceStatus').textContent=`${status} You: ${mine} / Computer: ${theirs}.`;
}
function practicePlace(cell) {
  const game=practiceGame;if(!game||game.finished||game.turn!=='player'||game.selected===null||game.board[cell])return;
  game.board=PracticeEngine.play(game.board,game.player[game.selected],cell,'player');game.player.splice(game.selected,1);game.selected=null;
  game.finished=!game.player.length&&!game.computer.length;game.turn=game.computer.length?'computer':'player';renderPracticeBattle();if(!game.finished&&game.turn==='computer')runPracticeComputer();
}
function runPracticeComputer() {
  const game=practiceGame;const generation=practiceGeneration;
  const apply=move=>{if(generation!==practiceGeneration||practiceGame!==game||game.turn!=='computer')return;
    if(!move){game.finished=true;renderPracticeBattle();return;}
    game.board=PracticeEngine.play(game.board,game.computer[move.cardIndex],move.cell,'computer');game.computer.splice(move.cardIndex,1);
    game.finished=!game.player.length&&!game.computer.length;game.turn=game.player.length?'player':'computer';renderPracticeBattle();if(!game.finished&&game.turn==='computer')runPracticeComputer();};
  const fallback=()=>setTimeout(()=>{if(generation===practiceGeneration)apply(PracticeEngine.chooseMove(game.board,game.computer,game.player));},150);
  try {
    const worker=new Worker('practice-worker.js');
    practiceWorker=worker;
    worker.onmessage=event=>{worker.terminate();if(practiceWorker===worker)practiceWorker=null;apply(event.data);};
    worker.onerror=()=>{worker.terminate();if(practiceWorker===worker)practiceWorker=null;fallback();};
    worker.postMessage({board:game.board,hand:game.computer,opponentHand:game.player});
  } catch (_) {fallback();}
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('practice-sw.js').catch(error=>console.warn('Offline page cache unavailable',error));
