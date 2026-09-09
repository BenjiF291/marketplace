// Check if user is logged in
const userId = localStorage.getItem('userId');
const username = localStorage.getItem('username');

if (!userId) {
  window.location.href = 'login.html';
}

let currentUserId = userId;

// Determine API URL based on environment
const API_URL = 'https://marketplace-aw8b.onrender.com';  // Production Render URL

let isServerOnline = true;
let currentView = 'marketplace';
let spinCountdownInterval = null;
let vipCountdownInterval = null;
let isSpinning = false;
let wheelRotation = 0;
const wheelSegments = [8, 10, 12, 16, 20, 24];
let selectedItemForListing = null; // Track selected item for listing
let currentUserIsAdmin = false;
let availableCardImages = [];
let savedPacks = [];
let inventorySellMode = false;
let tradeSessionId = null;
let tradePollInterval = null;
let presenceInterval = null;
let tradeInventoryItems = [];

function clampBattleToothCount(value) {
  const numeric = Number(value) || 0;
  return Math.min(10, Math.max(0, Math.trunc(numeric)));
}

function buildBattleCardMarkup(card, { small = false } = {}) {
  const name = String(card?.name || 'Card preview');
  const average = Number(card?.averageScore ?? 0);
  const top = clampBattleToothCount(card?.top ?? 0);
  const right = clampBattleToothCount(card?.right ?? 0);
  const bottom = clampBattleToothCount(card?.bottom ?? 0);
  const left = clampBattleToothCount(card?.left ?? 0);

  const makeTeeth = (count, side) => {
    const teeth = [];
    for (let i = 0; i < count; i += 1) {
      teeth.push(`<span class="battle-tooth battle-tooth-${side}"></span>`);
    }
    return teeth.join('');
  };

  return `
    <div class="battle-card-display ${small ? 'battle-card-display-small' : ''}">
      <span class="battle-side-number battle-side-number-top">${top}</span>
      <div class="battle-teeth battle-teeth-top">${makeTeeth(top, 'top')}</div>

      <span class="battle-side-number battle-side-number-right">${right}</span>
      <div class="battle-teeth battle-teeth-right">${makeTeeth(right, 'right')}</div>

      <span class="battle-side-number battle-side-number-bottom">${bottom}</span>
      <div class="battle-teeth battle-teeth-bottom">${makeTeeth(bottom, 'bottom')}</div>

      <span class="battle-side-number battle-side-number-left">${left}</span>
      <div class="battle-teeth battle-teeth-left">${makeTeeth(left, 'left')}</div>

      <div class="battle-card-inner">
        <div class="battle-card-average">${Number.isFinite(average) ? average : 0}</div>
        <div class="battle-card-name">${name}</div>
      </div>
    </div>
  `;
}

function updateBattleCardPreview() {
  const preview = document.getElementById('battleCardVisualPreview');
  if (!preview) return;

  const card = {
    name: document.getElementById('battleCardName')?.value || 'Card preview',
    averageScore: Number(document.getElementById('battleCardAverageScore')?.value || 0),
    top: document.getElementById('battleCardTop')?.value || 0,
    right: document.getElementById('battleCardRight')?.value || 0,
    bottom: document.getElementById('battleCardBottom')?.value || 0,
    left: document.getElementById('battleCardLeft')?.value || 0
  };

  preview.innerHTML = buildBattleCardMarkup(card, { small: false });
}

function bindBattleCardPreviewInputs() {
  const ids = ['battleCardName', 'battleCardAverageScore', 'battleCardTop', 'battleCardRight', 'battleCardBottom', 'battleCardLeft'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateBattleCardPreview);
      el.addEventListener('change', updateBattleCardPreview);
    }
  });
}

async function createBattleCard() {
  if (!currentUserIsAdmin) {
    alert('Only admins can create battle cards.');
    return;
  }

  const payload = {
    name: document.getElementById('battleCardName').value,
    averageScore: document.getElementById('battleCardAverageScore').value,
    top: document.getElementById('battleCardTop').value,
    right: document.getElementById('battleCardRight').value,
    bottom: document.getElementById('battleCardBottom').value,
    left: document.getElementById('battleCardLeft').value,
    linkedCardImage: document.getElementById('battleLinkedCardSelect').value
  };

  try {
    const res = await fetch(`${API_URL}/admin/battle-cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': currentUserId
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || 'Could not create battle card');
    }

    const result = await res.json();
    alert(`Battle card created: ${result.card.name}`);
    document.getElementById('battleCardName').value = '';
    document.getElementById('battleCardAverageScore').value = '';
    document.getElementById('battleCardTop').value = '0';
    document.getElementById('battleCardRight').value = '0';
    document.getElementById('battleCardBottom').value = '0';
    document.getElementById('battleCardLeft').value = '0';
    if (document.getElementById('battleLinkedCardSelect')) document.getElementById('battleLinkedCardSelect').value = '';
    updateBattleCardPreview();
    loadBattleCards();
    loadBattleInventory();
  } catch (error) {
    console.error('Battle card creation failed:', error);
    alert(error.message || 'Battle card creation failed');
  }
}

async function deleteBattleCard(cardId) {
  if (!cardId) return;
  const confirmed = window.confirm('Delete this battle card?');
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_URL}/admin/battle-cards/${cardId}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': currentUserId }
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || 'Delete failed');
    }
    loadBattleCards();
    loadBattleInventory();
  } catch (error) {
    console.error('Delete battle card error:', error);
    alert(error.message || 'Could not delete battle card');
  }
}

async function loadBattleCards() {
  try {
    const res = await fetch(`${API_URL}/battle-cards`);
    if (!res.ok) return;
    const cards = await res.json();
    const list = document.getElementById('battleCardList');
    if (!list) return;
    list.innerHTML = '';

    if (!Array.isArray(cards) || cards.length === 0) {
      list.innerHTML = '<li>No battle cards created yet.</li>';
      return;
    }

    cards.forEach(card => {
      const item = document.createElement('li');
      item.className = 'battle-card-item';

      const visualWrap = document.createElement('div');
      visualWrap.innerHTML = buildBattleCardMarkup(card, { small: true });

      const meta = document.createElement('div');
      meta.className = 'battle-card-meta';
      meta.innerHTML = `
        <strong>${card.name}</strong><br>
        <small>Linked: ${card.linkedCardImage || 'Unassigned'}</small><br>
        <small>Top ${card.top} / Right ${card.right} / Bottom ${card.bottom} / Left ${card.left}</small>
      `;

      const actionWrap = document.createElement('div');
      actionWrap.className = 'battle-card-item-actions';
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.onclick = () => deleteBattleCard(card.id);
      actionWrap.appendChild(deleteBtn);

      item.appendChild(visualWrap);
      item.appendChild(meta);
      item.appendChild(actionWrap);
      list.appendChild(item);
    });
  } catch (error) {
    console.error('Error loading battle cards:', error);
  }
}

function logout() {
  stopTradePolling();
  if (presenceInterval) clearInterval(presenceInterval);
  localStorage.removeItem('userId');
  localStorage.removeItem('username');
  window.location.href = 'login.html';
}

async function sendPresenceHeartbeat() {
  try {
    await fetch(`${API_URL}/presence/heartbeat`, {
      method: 'POST',
      headers: { 'X-User-Id': currentUserId }
    });
  } catch (error) {
    console.error('Presence heartbeat error:', error);
  }
}

function stopTradePolling() {
  if (tradePollInterval) {
    clearInterval(tradePollInterval);
    tradePollInterval = null;
  }
}

function tradeFetch(path, options = {}) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUserId, ...(options.headers || {}) }
  });
}

async function loadTradeOnlineUsers() {
  const list = document.getElementById('tradeOnlineUsers');
  if (!list) return;
  try {
    const [response, sessionsResponse] = await Promise.all([
      tradeFetch('/trade/online-users'),
      tradeFetch('/trade/sessions')
    ]);
    if (!response.ok || !sessionsResponse.ok) throw new Error(await response.text());
    const users = await response.json();
    const sessions = await sessionsResponse.json();
    const incomingSession = sessions.find(session => session.id !== tradeSessionId);
    if (incomingSession) {
      tradeSessionId = incomingSession.id;
      await loadTradeInventoryChoices();
      await loadTradeSession();
      startTradePolling();
      return;
    }
    list.innerHTML = '';
    if (!users.length) {
      list.textContent = 'No other users are online right now.';
      return;
    }
    users.forEach(user => {
      const row = document.createElement('div');
      row.className = 'trade-online-user';
      const name = document.createElement('strong');
      name.textContent = user.username;
      const button = document.createElement('button');
      button.className = 'btn btn-primary';
      button.textContent = 'Invite';
      button.onclick = () => startTrade(user.id);
      row.append(name, button);
      list.appendChild(row);
    });
  } catch (error) {
    console.error('Trade users error:', error);
    list.textContent = 'Could not load online users.';
  }
}

async function loadTradeInventoryChoices() {
  const select = document.getElementById('tradeCardSelect');
  if (!select) return;
  try {
    const response = await tradeFetch('/inventory');
    if (!response.ok) throw new Error(await response.text());
    const inventory = await response.json();
    tradeInventoryItems = inventory.filter(item => ['card', 'battle-card'].includes(item.itemType));
    select.innerHTML = '<option value="">Select a card</option>';
    if (!tradeInventoryItems.length) {
      select.innerHTML = '<option value="">No cards available</option>';
      return;
    }
    tradeInventoryItems.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name || 'Card';
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Trade inventory error:', error);
    select.innerHTML = '<option value="">Could not load cards</option>';
  }
}

async function startTrade(targetUserId) {
  try {
    const response = await tradeFetch('/trade/sessions', {
      method: 'POST',
      body: JSON.stringify({ targetUserId })
    });
    if (!response.ok) throw new Error(await response.text());
    const session = await response.json();
    tradeSessionId = session.id;
    await loadTradeSession();
    startTradePolling();
  } catch (error) {
    alert(error.message || 'Could not start trade');
  }
}

function startTradePolling() {
  stopTradePolling();
  tradePollInterval = setInterval(() => {
    loadTradeSession();
    loadTradeOnlineUsers();
  }, 1500);
}

async function loadTradeSession() {
  if (!tradeSessionId) return;
  try {
    const response = await tradeFetch(`/trade/sessions/${tradeSessionId}`);
    if (!response.ok) throw new Error(await response.text());
    const session = await response.json();
    renderTradeSession(session);
    if (session.status !== 'open') stopTradePolling();
  } catch (error) {
    console.error('Trade session error:', error);
  }
}

function renderTradeSession(session) {
  const room = document.getElementById('tradeRoom');
  const lobby = document.getElementById('tradeLobby');
  const status = document.getElementById('tradeStatus');
  if (!room || !lobby) return;
  room.hidden = false;
  lobby.hidden = true;
  const partnerId = session.participantIds.find(id => id !== currentUserId);
  const partnerName = session.participants[partnerId]?.username || 'other user';
  document.getElementById('tradePartnerName').textContent = partnerName;
  document.getElementById('tradeOtherName').textContent = partnerName;
  const ownOffer = session.offers[currentUserId] || { money: 0, itemIds: [] };
  const otherOffer = session.offers[partnerId] || { money: 0, itemIds: [] };
  document.getElementById('tradeOwnMoney').textContent = `${ownOffer.money || 0} Footy`;
  const ownCards = document.getElementById('tradeOwnCards');
  ownCards.innerHTML = '';
  (ownOffer.items || []).forEach(item => {
    const entry = document.createElement('li');
    entry.textContent = item.name || 'Card';
    ownCards.appendChild(entry);
  });
  if (!ownOffer.items?.length) ownCards.innerHTML = '<li>No cards offered</li>';
  document.getElementById('tradeOtherMoney').textContent = `${otherOffer.money || 0} Footy`;
  const otherCards = document.getElementById('tradeOtherCards');
  otherCards.innerHTML = '';
  (otherOffer.items || []).forEach(item => {
    const entry = document.createElement('li');
    entry.textContent = item.name || 'Card';
    otherCards.appendChild(entry);
  });
  if (!otherOffer.items?.length) otherCards.innerHTML = '<li>No cards offered</li>';
  const ownAgreed = session.agreed?.[currentUserId] === true;
  const otherAgreed = session.agreed?.[partnerId] === true;
  const ownAgreement = document.getElementById('tradeOwnAgreement');
  ownAgreement.textContent = ownAgreed ? 'Agreed' : 'Not agreed';
  ownAgreement.classList.toggle('is-agreed', ownAgreed);
  document.getElementById('tradeAgreementStatus').textContent = session.status === 'completed'
    ? 'Trade completed.'
    : `${ownAgreed ? 'You agreed' : 'You have not agreed'} · ${otherAgreed ? `${partnerName} agreed` : `${partnerName} has not agreed`}`;
  document.getElementById('tradeAgreeButton').textContent = ownAgreed ? 'Agreed' : 'Agree';
  document.getElementById('tradeAgreeButton').disabled = ownAgreed || session.status !== 'open';
  status.textContent = session.status === 'completed' ? 'The trade completed successfully.' : 'Both users must agree before anything moves.';
  if (session.status === 'completed') finishTrade(session);
}

let tradeEditorType = null;

function openTradeOfferEditor(type) {
  tradeEditorType = type;
  const editor = document.getElementById('tradeOfferEditor');
  const moneyEditor = document.getElementById('tradeMoneyEditor');
  const cardEditor = document.getElementById('tradeCardEditor');
  document.getElementById('tradeEditorTitle').textContent = type === 'money' ? 'Offer Footy' : 'Offer Card';
  moneyEditor.hidden = type !== 'money';
  cardEditor.hidden = type !== 'card';
  if (type === 'money') document.getElementById('tradeMoneyInput').value = '0';
  if (type === 'card') document.getElementById('tradeCardSelect').value = '';
  editor.hidden = false;
}

function closeTradeOfferEditor() {
  document.getElementById('tradeOfferEditor').hidden = true;
  tradeEditorType = null;
}

async function submitTradeOfferEdit() {
  if (!tradeSessionId) return;
  try {
    const sessionResponse = await tradeFetch(`/trade/sessions/${tradeSessionId}`);
    if (!sessionResponse.ok) throw new Error(await sessionResponse.text());
    const session = await sessionResponse.json();
    const ownOffer = session.offers[currentUserId] || { money: 0, itemIds: [] };
    let money = Number(ownOffer.money) || 0;
    let itemIds = [...(ownOffer.itemIds || [])];
    if (tradeEditorType === 'money') {
      money = Number(document.getElementById('tradeMoneyInput').value);
      if (!Number.isFinite(money) || money < 0) throw new Error('Enter a valid Footy amount.');
    } else {
      const cardId = document.getElementById('tradeCardSelect').value;
      if (!cardId) throw new Error('Choose a card first.');
      if (!itemIds.includes(cardId)) itemIds.push(cardId);
    }

    const response = await tradeFetch(`/trade/sessions/${tradeSessionId}/offer`, {
      method: 'POST',
      body: JSON.stringify({ money, itemIds })
    });
    if (!response.ok) throw new Error(await response.text());
    closeTradeOfferEditor();
    await loadTradeSession();
  } catch (error) {
    alert(error.message || 'Could not update offer');
  }
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !document.getElementById('tradeOfferEditor')?.hidden) {
    closeTradeOfferEditor();
  }
});

function finishTrade(session) {
  if (!tradeSessionId) return;
  const completedSessionId = tradeSessionId;
  tradeSessionId = null;
  stopTradePolling();
  const toast = document.getElementById('tradeToast');
  toast.textContent = 'Trade completed successfully. Your cards and Footy have been exchanged.';
  toast.classList.add('is-visible');
  setTimeout(() => {
    toast.classList.remove('is-visible');
    if (currentView === 'trade' && completedSessionId) showSection('inventory');
  }, 1800);
}

async function agreeToTrade() {
  if (!tradeSessionId) return;
  try {
    const response = await tradeFetch(`/trade/sessions/${tradeSessionId}/agree`, { method: 'POST' });
    if (!response.ok) throw new Error(await response.text());
    renderTradeSession(await response.json());
    loadInventory();
    updateBalance();
  } catch (error) {
    alert(error.message || 'Could not agree to trade');
  }
}

async function cancelTrade() {
  if (!tradeSessionId) return;
  try {
    await tradeFetch(`/trade/sessions/${tradeSessionId}/cancel`, { method: 'POST' });
  } finally {
    tradeSessionId = null;
    stopTradePolling();
    document.getElementById('tradeRoom').hidden = true;
    document.getElementById('tradeLobby').hidden = false;
    document.getElementById('tradeStatus').textContent = 'Choose an online user to start a trade.';
    loadTradeOnlineUsers();
  }
}

function showSection(section) {
  currentView = section;

  if (section !== 'trade') closeTradeOfferEditor();

  const marketplaceSection = document.getElementById('marketplaceSection');
  const inventorySection = document.getElementById('inventorySection');
  const historySection = document.getElementById('historySection');
  const spinSection = document.getElementById('spinSection');
  const marketTab = document.getElementById('marketTab');
  const inventoryTab = document.getElementById('inventoryTab');
  const historyTab = document.getElementById('historyTab');
  const spinTab = document.getElementById('spinTab');
  const vipTab = document.getElementById('vipTab');
  const tradeTab = document.getElementById('tradeTab');
  const battleTab = document.getElementById('battleTab');
  const battleManagerTab = document.getElementById('battleManagerTab');
  const vipSection = document.getElementById('vipSection');
  const battleGameSection = document.getElementById('battleGameSection');
  const battleSection = document.getElementById('battleSection');
  const tradeSection = document.getElementById('tradeSection');

  if (section === 'inventory') {
    clearSpinCountdown();

    // Hide other dashboard cards so Inventory becomes the sole focus
    const userSection = document.querySelector('.user-section');
    const transferSection = document.querySelector('.transfer-section');
    const sellSection = document.querySelector('.sell-section');
    const adminCard = document.getElementById('adminSection');

    if (userSection) userSection.style.display = 'none';
    if (transferSection) transferSection.style.display = 'none';
    if (sellSection) sellSection.style.display = 'none';
    if (adminCard) adminCard.style.display = 'none';

    marketplaceSection.style.display = 'none';
    spinSection.style.display = 'none';
    if (historySection) historySection.style.display = 'none';
    inventorySection.style.display = 'block';
    if (vipSection) vipSection.style.display = 'none';
    if (battleGameSection) battleGameSection.style.display = 'none';
    if (battleSection) battleSection.style.display = 'none';
    if (tradeSection) tradeSection.style.display = 'none';

    // Mark tab active state
    marketTab.classList.remove('active');
    inventoryTab.classList.add('active');
    if (historyTab) historyTab.classList.remove('active');
    spinTab.classList.remove('active');
    if (vipTab) vipTab.classList.remove('active');
    if (battleTab) battleTab.classList.remove('active');
    if (battleManagerTab) battleManagerTab.classList.remove('active');
    if (tradeTab) tradeTab.classList.remove('active');

    // Ensure inventory scrolls into view on mobile
    inventorySection.scrollIntoView({ behavior: 'smooth' });

    loadInventory();
  } else if (section === 'history') {
    clearSpinCountdown();
    const userSection = document.querySelector('.user-section');
    const transferSection = document.querySelector('.transfer-section');
    const sellSection = document.querySelector('.sell-section');
    const adminCard = document.getElementById('adminSection');
    if (userSection) userSection.style.display = 'none';
    if (transferSection) transferSection.style.display = 'none';
    if (sellSection) sellSection.style.display = 'none';
    if (adminCard) adminCard.style.display = 'none';

    marketplaceSection.style.display = 'none';
    inventorySection.style.display = 'none';
    if (historySection) historySection.style.display = 'block';
    spinSection.style.display = 'none';
    if (vipSection) vipSection.style.display = 'none';
    if (battleGameSection) battleGameSection.style.display = 'none';
    if (battleSection) battleSection.style.display = 'none';
    if (tradeSection) tradeSection.style.display = 'none';

    marketTab.classList.remove('active');
    inventoryTab.classList.remove('active');
    if (historyTab) historyTab.classList.add('active');
    spinTab.classList.remove('active');
    if (vipTab) vipTab.classList.remove('active');
    if (battleTab) battleTab.classList.remove('active');
    if (battleManagerTab) battleManagerTab.classList.remove('active');
    if (tradeTab) tradeTab.classList.remove('active');

    if (historySection) historySection.scrollIntoView({ behavior: 'smooth' });
    loadHistory();
  } else if (section === 'spin') {
    // Focused view like Inventory: hide other dashboard cards so Spin is sole focus
    clearSpinCountdown();
    const userSection = document.querySelector('.user-section');
    const transferSection = document.querySelector('.transfer-section');
    const sellSection = document.querySelector('.sell-section');
    const adminCard = document.getElementById('adminSection');
    if (userSection) userSection.style.display = 'none';
    if (transferSection) transferSection.style.display = 'none';
    if (sellSection) sellSection.style.display = 'none';
    if (adminCard) adminCard.style.display = 'none';

    marketplaceSection.style.display = 'none';
    inventorySection.style.display = 'none';
    if (historySection) historySection.style.display = 'none';
    spinSection.style.display = 'block';
    if (vipSection) vipSection.style.display = 'none';
    if (battleGameSection) battleGameSection.style.display = 'none';
    if (battleSection) battleSection.style.display = 'none';
    if (tradeSection) tradeSection.style.display = 'none';

    marketTab.classList.remove('active');
    inventoryTab.classList.remove('active');
    if (historyTab) historyTab.classList.remove('active');
    spinTab.classList.add('active');
    if (vipTab) vipTab.classList.remove('active');
    if (battleTab) battleTab.classList.remove('active');
    if (battleManagerTab) battleManagerTab.classList.remove('active');
    if (tradeTab) tradeTab.classList.remove('active');

    // Ensure spin section scrolls into view on mobile
    spinSection.scrollIntoView({ behavior: 'smooth' });

    loadSpinInfo();
  } else if (section === 'vip') {
    // Focused view: hide other dashboard cards so VIP is sole focus
    clearSpinCountdown();
    const userSection = document.querySelector('.user-section');
    const transferSection = document.querySelector('.transfer-section');
    const sellSection = document.querySelector('.sell-section');
    const adminCard = document.getElementById('adminSection');
    if (userSection) userSection.style.display = 'none';
    if (transferSection) transferSection.style.display = 'none';
    if (sellSection) sellSection.style.display = 'none';
    if (adminCard) adminCard.style.display = 'none';

    marketplaceSection.style.display = 'none';
    inventorySection.style.display = 'none';
    if (historySection) historySection.style.display = 'none';
    spinSection.style.display = 'none';
    if (vipSection) vipSection.style.display = 'block';
    if (battleGameSection) battleGameSection.style.display = 'none';
    if (battleSection) battleSection.style.display = 'none';
    if (tradeSection) tradeSection.style.display = 'none';

    marketTab.classList.remove('active');
    inventoryTab.classList.remove('active');
    if (historyTab) historyTab.classList.remove('active');
    spinTab.classList.remove('active');
    if (vipTab) vipTab.classList.add('active');
    if (battleTab) battleTab.classList.remove('active');
    if (battleManagerTab) battleManagerTab.classList.remove('active');
    if (tradeTab) tradeTab.classList.remove('active');

    // Ensure vip section scrolls into view on mobile
    if (vipSection) vipSection.scrollIntoView({ behavior: 'smooth' });

    loadVipInfo();
  } else if (section === 'trade') {
    clearSpinCountdown();
    const userSection = document.querySelector('.user-section');
    const transferSection = document.querySelector('.transfer-section');
    const sellSection = document.querySelector('.sell-section');
    const adminCard = document.getElementById('adminSection');
    if (userSection) userSection.style.display = 'none';
    if (transferSection) transferSection.style.display = 'none';
    if (sellSection) sellSection.style.display = 'none';
    if (adminCard) adminCard.style.display = 'none';
    marketplaceSection.style.display = 'none';
    inventorySection.style.display = 'none';
    if (historySection) historySection.style.display = 'none';
    spinSection.style.display = 'none';
    if (vipSection) vipSection.style.display = 'none';
    if (battleGameSection) battleGameSection.style.display = 'none';
    if (battleSection) battleSection.style.display = 'none';
    tradeSection.style.display = 'block';
    marketTab.classList.remove('active');
    inventoryTab.classList.remove('active');
    if (historyTab) historyTab.classList.remove('active');
    spinTab.classList.remove('active');
    if (vipTab) vipTab.classList.remove('active');
    if (battleTab) battleTab.classList.remove('active');
    if (battleManagerTab) battleManagerTab.classList.remove('active');
    if (tradeTab) tradeTab.classList.add('active');
    loadTradeOnlineUsers();
    loadTradeInventoryChoices();
    if (tradeSessionId) {
      loadTradeSession();
      startTradePolling();
    }
  } else if (section === 'battle') {
    if (!currentUserIsAdmin) {
      alert('Battle is currently only available to admins.');
      return;
    }

    const userSection = document.querySelector('.user-section');
    const transferSection = document.querySelector('.transfer-section');
    const sellSection = document.querySelector('.sell-section');
    const adminCard = document.getElementById('adminSection');
    if (userSection) userSection.style.display = 'none';
    if (transferSection) transferSection.style.display = 'none';
    if (sellSection) sellSection.style.display = 'none';
    if (adminCard) adminCard.style.display = 'none';

    marketplaceSection.style.display = 'none';
    inventorySection.style.display = 'none';
    if (historySection) historySection.style.display = 'none';
    spinSection.style.display = 'none';
    if (vipSection) vipSection.style.display = 'none';
    if (battleGameSection) battleGameSection.style.display = 'block';
    if (battleSection) battleSection.style.display = 'none';
    if (tradeSection) tradeSection.style.display = 'none';

    marketTab.classList.remove('active');
    inventoryTab.classList.remove('active');
    if (historyTab) historyTab.classList.remove('active');
    spinTab.classList.remove('active');
    if (vipTab) vipTab.classList.remove('active');
    if (battleTab) battleTab.classList.add('active');
    if (battleManagerTab) battleManagerTab.classList.remove('active');
    if (tradeTab) tradeTab.classList.remove('active');

    loadBattleInventory();
  } else if (section === 'battle-manager') {
    if (!currentUserIsAdmin) {
      alert('Only admins can access BCM.');
      return;
    }

    const userSection = document.querySelector('.user-section');
    const transferSection = document.querySelector('.transfer-section');
    const sellSection = document.querySelector('.sell-section');
    const adminCard = document.getElementById('adminSection');
    if (userSection) userSection.style.display = 'none';
    if (transferSection) transferSection.style.display = 'none';
    if (sellSection) sellSection.style.display = 'none';
    if (adminCard) adminCard.style.display = 'none';

    marketplaceSection.style.display = 'none';
    inventorySection.style.display = 'none';
    if (historySection) historySection.style.display = 'none';
    spinSection.style.display = 'none';
    if (vipSection) vipSection.style.display = 'none';
    if (battleGameSection) battleGameSection.style.display = 'none';
    if (battleSection) battleSection.style.display = 'block';
    if (tradeSection) tradeSection.style.display = 'none';

    marketTab.classList.remove('active');
    inventoryTab.classList.remove('active');
    if (historyTab) historyTab.classList.remove('active');
    spinTab.classList.remove('active');
    if (vipTab) vipTab.classList.remove('active');
    if (battleTab) battleTab.classList.remove('active');
    if (battleManagerTab) battleManagerTab.classList.add('active');
    if (tradeTab) tradeTab.classList.remove('active');

    loadBattleCards();
  } else {
    clearSpinCountdown();
    // Restore dashboard cards that Inventory hid
    const userSection = document.querySelector('.user-section');
    const transferSection = document.querySelector('.transfer-section');
    const sellSection = document.querySelector('.sell-section');
    const adminCard = document.getElementById('adminSection');
    if (userSection) userSection.style.display = '';
    if (transferSection) transferSection.style.display = '';
    if (sellSection) sellSection.style.display = '';
    if (adminCard) adminCard.style.display = currentUserIsAdmin ? 'block' : 'none';

    marketplaceSection.style.display = 'block';
    inventorySection.style.display = 'none';
    if (historySection) historySection.style.display = 'none';
    spinSection.style.display = 'none';
    if (vipSection) vipSection.style.display = 'none';
    if (battleGameSection) battleGameSection.style.display = 'none';
    if (battleSection) battleSection.style.display = 'none';
    if (tradeSection) tradeSection.style.display = 'none';
    marketTab.classList.add('active');
    inventoryTab.classList.remove('active');
    if (historyTab) historyTab.classList.remove('active');
    spinTab.classList.remove('active');
    if (vipTab) vipTab.classList.remove('active');
    if (battleTab) battleTab.classList.remove('active');
    if (battleManagerTab) battleManagerTab.classList.remove('active');
    if (tradeTab) tradeTab.classList.remove('active');
  }
}

async function loadBattleInventory() {
  const list = document.getElementById('battleInventoryItems');
  if (!list) return;

  list.innerHTML = '<li>Loading battle cards...</li>';

  try {
    const res = await fetch(`${API_URL}/inventory`, {
      headers: { 'X-User-Id': currentUserId }
    });
    if (!res.ok) throw new Error('Could not load battle inventory');
    const items = await res.json();
    const battleItems = Array.isArray(items) ? items.filter(item => item.itemType === 'battle-card') : [];

    if (battleItems.length === 0) {
      list.innerHTML = '<li>No battle cards in your inventory.</li>';
      return;
    }

    list.innerHTML = '';
    battleItems.forEach(item => {
      const li = document.createElement('li');
      li.className = 'battle-inventory-entry';
      li.innerHTML = `
        <div class="battle-inventory-visual">${buildBattleCardMarkup(item, { small: true })}</div>
        <span>${item.name || 'Battle card'}</span>
      `;
      list.appendChild(li);
    });
  } catch (error) {
    console.error('Error loading battle inventory:', error);
    list.innerHTML = '<li>Could not load battle cards.</li>';
  }
}

/** Handle VIP tab display */
async function showVIP() {
  showSection('vip');
  await loadVipInfo();
}

function formatDate(value) {
  if (!value) return 'Unknown date';
  const date = parseTimestamp(value);
  if (!date || Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString();
}

function parseTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'string') return new Date(value);
  if (value._seconds) return new Date(value._seconds * 1000);
  if (value.seconds) return new Date(value.seconds * 1000);
  return new Date(value);
}

function formatCountdown(milliseconds) {
  if (milliseconds <= 0) return '00:00:00';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function renderHistoryMessage(list, message) {
  list.innerHTML = '';
  const item = document.createElement('li');
  item.className = 'history-empty';
  item.textContent = message;
  list.appendChild(item);
}

function addHistoryEntry(list, description, occurredAt) {
  const item = document.createElement('li');
  const text = document.createElement('span');
  const date = document.createElement('time');
  text.textContent = description;
  date.textContent = formatDate(occurredAt);
  item.append(text, date);
  list.appendChild(item);
}

async function loadHistory() {
  const transferList = document.getElementById('transferHistory');
  const itemList = document.getElementById('itemHistory');
  if (!transferList || !itemList) return;

  renderHistoryMessage(transferList, 'Loading transactions...');
  renderHistoryMessage(itemList, 'Loading item history...');

  try {
    const res = await fetch(`${API_URL}/history`, {
      headers: { 'X-User-Id': currentUserId }
    });
    if (!res.ok) throw new Error('Could not load history');
    const history = await res.json();

    transferList.innerHTML = '';
    if (history.transfers.length === 0) {
      renderHistoryMessage(transferList, 'No Footy transactions yet.');
    } else {
      history.transfers.forEach(transaction => {
        const description = `From ${transaction.from} to ${transaction.to}: ${transaction.amount} Footy`;
        addHistoryEntry(transferList, description, transaction.occurredAt);
      });
    }

    itemList.innerHTML = '';
    if (history.itemTrades.length === 0) {
      renderHistoryMessage(itemList, 'No item purchases or sales yet.');
    } else {
      history.itemTrades.forEach(trade => {
        const description = trade.direction === 'bought'
          ? `Bought ${trade.itemName} from ${trade.counterparty} for ${trade.amount} Footy`
          : `Sold ${trade.itemName} to ${trade.counterparty} for ${trade.amount} Footy`;
        addHistoryEntry(itemList, description, trade.occurredAt);
      });
    }
  } catch (error) {
    console.error('Error loading history:', error);
    renderHistoryMessage(transferList, 'Could not load transaction history.');
    renderHistoryMessage(itemList, 'Could not load item history.');
  }
}

function clearSpinCountdown() {
  if (spinCountdownInterval) {
    clearInterval(spinCountdownInterval);
    spinCountdownInterval = null;
  }
}

function clearVipCountdown() {
  if (vipCountdownInterval) {
    clearInterval(vipCountdownInterval);
    vipCountdownInterval = null;
  }
}

function normalizeWheelRotation() {
  wheelRotation = wheelRotation % 360;
  const wheel = document.getElementById('spinWheel');
  if (wheel) {
    wheel.style.transition = 'none';
    wheel.style.transform = `rotate(${wheelRotation}deg)`;
  }
}

function getWheelIndexForReward(amount) {
  return wheelSegments.findIndex(value => value === amount);
}

async function loadSpinInfo() {
  const statusEl = document.getElementById('spinStatus');
  const resultEl = document.getElementById('spinResult');
  resultEl.textContent = '';

  try {
    const res = await fetch(`${API_URL}/users`);
    if (!res.ok) throw new Error('Failed to retrieve user info');

    const users = await res.json();
    const user = users.find(u => u.id === currentUserId);

    if (!user) {
      statusEl.textContent = 'Unable to find user info.';
      return;
    }

    const spinButton = document.getElementById('spinButton');
    const countdownEl = document.getElementById('spinCountdown');
    clearSpinCountdown();
    countdownEl.textContent = '';

    if (user.lastSpin) {
      const lastSpinDate = parseTimestamp(user.lastSpin);
      const nextSpin = new Date(lastSpinDate.getTime() + 23 * 60 * 60 * 1000);
      const now = new Date();

      if (nextSpin > now) {
        statusEl.textContent = 'Next spin available in:';
        spinButton.disabled = true;

        const updateCountdown = () => {
          const remaining = nextSpin.getTime() - new Date().getTime();
          if (remaining <= 0) {
            clearSpinCountdown();
            statusEl.textContent = 'You can spin the wheel now!';
            countdownEl.textContent = '';
            spinButton.disabled = false;
            return;
          }
          countdownEl.textContent = formatCountdown(remaining);
        };

        updateCountdown();
        spinCountdownInterval = setInterval(updateCountdown, 1000);
        return;
      }
    }

    statusEl.textContent = 'You can spin the wheel now!';
    spinButton.disabled = false;
  } catch (error) {
    console.error('Error loading spin info:', error);
    statusEl.textContent = 'Could not load spin status.';
    const spinButton = document.getElementById('spinButton');
    if (spinButton) spinButton.disabled = true;
  }

  // Show VIP note if active
  const vipUntil = user.vipUntil ? parseTimestamp(user.vipUntil) : null;
  const vipNoteEl = document.getElementById('spinVipNote');
  if (vipNoteEl) {
    if (vipUntil && vipUntil.getTime() > new Date().getTime()) {
      vipNoteEl.textContent = `VIP active — daily reward doubled until ${vipUntil.toLocaleString()}`;
    } else {
      vipNoteEl.textContent = '';
    }
  }
}

async function spinWheel() {
  if (isSpinning) return;
  isSpinning = true;
  const spinButton = document.getElementById('spinButton');
  if (spinButton) spinButton.disabled = true;
  const resultEl = document.getElementById('spinResult');
  resultEl.textContent = '';

  try {
    const res = await fetch(`${API_URL}/spin-wheel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId })
    });

    const data = await res.json();

    if (!res.ok) {
      resultEl.textContent = data.message || data.error || 'Could not spin the wheel';
      document.getElementById('spinButton').disabled = false;
      isSpinning = false;
      return;
    }

    const amount = data.amount;
    let targetIndex = getWheelIndexForReward(amount);
    if (targetIndex < 0) {
      targetIndex = Math.floor(Math.random() * wheelSegments.length);
    }
    const spins = 6;
    const degreesPerSegment = 360 / wheelSegments.length;
    // Each slice starts at the 3 o'clock position; the pointer is at 12 o'clock.
    const pointerAngle = 270;
    const targetRotation = spins * 360 + (pointerAngle - (targetIndex * degreesPerSegment));
    wheelRotation += targetRotation;

    const wheel = document.getElementById('spinWheel');
    if (wheel) {
      wheel.style.transition = 'transform 4s cubic-bezier(0.33, 1, 0.68, 1)';
      wheel.style.transform = `rotate(${wheelRotation}deg)`;
    }

    wheel.addEventListener('transitionend', function onEnd() {
      wheel.removeEventListener('transitionend', onEnd);
      normalizeWheelRotation();
      resultEl.innerHTML = `✅ You won <strong>${amount} Footy</strong>! Your balance is now ${data.balance} Footy.`;
      document.getElementById('spinButton').disabled = false;
      isSpinning = false;
      loadUsers();
      loadInventory();
      loadSpinInfo();
    });
  } catch (error) {
    console.error('Spin error:', error);
    resultEl.textContent = 'Could not spin the wheel. Try again later.';
    const spinButton = document.getElementById('spinButton');
    if (spinButton) spinButton.disabled = false;
    isSpinning = false;
  }
}

/* ------------------ VIP ------------------ */
function clearVipCountdown() {
  if (vipCountdownInterval) {
    clearInterval(vipCountdownInterval);
    vipCountdownInterval = null;
  }
}

async function loadVipInfo() {
  const statusText = document.getElementById('vipStatusText');
  const countdownEl = document.getElementById('vipCountdown');
  const buyBtn = document.getElementById('buyVipButton');

  statusText.textContent = '';
  countdownEl.textContent = '';

  try {
    const res = await fetch(`${API_URL}/users`);
    if (!res.ok) throw new Error('Failed to retrieve user info');
    const users = await res.json();
    const user = users.find(u => u.id === currentUserId);

    if (!user) {
      statusText.textContent = 'User not found';
      buyBtn.disabled = true;
      return;
    }

    const vipUntil = user.vipUntil ? parseTimestamp(user.vipUntil) : null;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    if (vipUntil && vipUntil.getTime() > new Date().getTime()) {
      const update = () => {
        const remaining = vipUntil.getTime() - new Date().getTime();
        if (remaining <= 0) {
          clearVipCountdown();
          statusText.textContent = 'You are not a VIP';
          countdownEl.textContent = '';
          document.getElementById('vipDaysLeft').textContent = '0';
          document.getElementById('vipHoursLeft').textContent = '0';
          buyBtn.textContent = 'Buy VIP';
          buyBtn.disabled = false;
          return;
        }

        const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
        const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        document.getElementById('vipDaysLeft').textContent = days;
        document.getElementById('vipHoursLeft').textContent = hours;
        countdownEl.textContent = formatCountdown(remaining);

        const canRenew = remaining <= ONE_DAY_MS;
        buyBtn.disabled = !canRenew;
        buyBtn.textContent = canRenew ? 'Extend VIP (30 days)' : 'Renew available when 1 day remains';
        statusText.textContent = `You are a VIP until ${vipUntil.toLocaleString()}`;
      };

      clearVipCountdown();
      update();
      vipCountdownInterval = setInterval(update, 1000);
    } else {
      statusText.textContent = 'You are not a VIP';
      buyBtn.textContent = 'Buy VIP';
      countdownEl.textContent = '';
      document.getElementById('vipDaysLeft').textContent = '0';
      document.getElementById('vipHoursLeft').textContent = '0';
      buyBtn.disabled = false;
    }
  } catch (error) {
    console.error('Error loading VIP info:', error);
    statusText.textContent = 'Could not load VIP status';
    if (buyBtn) buyBtn.disabled = true;
  }
}

async function buyVip() {
  const buyBtn = document.getElementById('buyVipButton');
  buyBtn.disabled = true;
  try {
    const res = await fetch(`${API_URL}/buy-vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUserId }
    });

    if (!res.ok) {
      const msg = await res.text();
      alert(msg || 'Could not purchase VIP');
      buyBtn.disabled = false;
      return;
    }

    const data = await res.json();
    alert(`✅ VIP active until ${new Date(data.vipUntil).toLocaleString()}`);
    updateBalance();
    loadUsers();
    loadVipInfo();
  } catch (error) {
    console.error('Buy VIP error:', error);
    alert('Could not purchase VIP right now');
    buyBtn.disabled = false;
  }
}

// Check if server is online on page load
async function checkServerStatus() {
  try {
    const res = await fetch(`${API_URL}/items`, { method: 'GET' });
    isServerOnline = res.ok;
  } catch (error) {
    console.error('Status check failed:', error);
    isServerOnline = false;
  }
}

function showMarketClosed(message = 'The marketplace server is currently offline. Please try again later.') {
  const marketSection = document.getElementById('marketplaceSection');
  if (marketSection) {
    marketSection.innerHTML = `
      <h2>🛍️ Marketplace</h2>
      <div style="padding: 20px; background: #ffebee; border-radius: 8px; color: #c62828; text-align: center;">
        <h3>🔒 Market is Closed</h3>
        <p>${message}</p>
      </div>
    `;
  }
}

function showTransferError() {
  const allButtons = document.querySelectorAll('button');
  allButtons.forEach(btn => {
    if (btn.textContent === 'Send Transfer') {
      btn.disabled = true;
    }
  });
}

async function loadPlannedMarketplaceListings() {
  if (!currentUserIsAdmin) return;
  try {
    const res = await fetch(`${API_URL}/admin/market-listings/planned`, {
      headers: { 'X-User-Id': currentUserId }
    });
    if (!res.ok) return;
    const listings = await res.json();
    const list = document.getElementById('plannedMarketplaceListings');
    if (!list) return;
    list.innerHTML = '';

    if (!Array.isArray(listings) || listings.length === 0) {
      list.innerHTML = '<li>No planned listings yet.</li>';
      return;
    }

    listings.forEach(entry => {
      const item = document.createElement('li');
      const scheduledText = entry.scheduledAt ? new Date(entry.scheduledAt).toLocaleString() : 'No scheduled time';
      const expiresText = entry.expiresAt ? ` · expires ${new Date(entry.expiresAt).toLocaleString()}` : '';
      item.textContent = `${entry.itemType.toUpperCase()} · ${entry.productName || entry.productId} · ${entry.status} · ${scheduledText}${expiresText}`;
      list.appendChild(item);
    });
  } catch (error) {
    console.error('Error loading planned marketplace listings:', error);
  }
}

/* ------------------ LOAD USERS ------------------ */
async function loadUsers() {
  // Display current logged in user
  document.getElementById('currentUsername').textContent = `👤 ${username}`;

  try {
    const res = await fetch(`${API_URL}/users`);
    if (!res.ok) throw new Error('Server offline');
    const users = await res.json();
    const user = users.find(u => u.id === currentUserId);

    currentUserIsAdmin = !!(user && user.isAdmin === true);
    const adminSection = document.getElementById('adminSection');
    if (adminSection) {
      adminSection.style.display = currentUserIsAdmin ? 'block' : 'none';
    }

    const battleTab = document.getElementById('battleTab');
    const battleManagerTab = document.getElementById('battleManagerTab');
    if (battleTab) battleTab.style.display = currentUserIsAdmin ? 'inline-flex' : 'none';
    if (battleManagerTab) battleManagerTab.style.display = currentUserIsAdmin ? 'inline-flex' : 'none';

    if (currentUserIsAdmin) {
      bindBattleCardPreviewInputs();
      updateBattleCardPreview();
      populateGrantControls(users);
      populateAdminAccountViewer(users);
      loadCardOptions();
      loadPacks();
      loadAscendTierConfig();
      loadPlannedMarketplaceListings();
      loadBattleCards();
    }

    populateTransferRecipients(users);

    // Update current user display with the applicable role badges.
    const currentUsernameEl = document.getElementById('currentUsername');
    if (currentUsernameEl) {
      const vipUntil = user && user.vipUntil ? parseTimestamp(user.vipUntil) : null;
      const isVip = vipUntil && vipUntil.getTime() > Date.now();
      currentUsernameEl.innerHTML = `👤 ${username}${currentUserIsAdmin ? ' <span class="admin-badge">ADMIN</span>' : ''}${isVip ? ' <span class="vip-badge">VIP</span>' : ''}`;
    }
  } catch (error) {
    console.error('Error loading user role:', error);
  }

  updateBalance();
}

/* ------------------ BALANCE ------------------ */
async function updateBalance() {
  if (!isServerOnline) return;
  
  try {
    const res = await fetch(`${API_URL}/users`);
    if (!res.ok) throw new Error('Server offline');
    const users = await res.json();

    const user = users.find(u => u.id === currentUserId); // Direct string comparison

    const balanceEl = document.getElementById('balance');

    if (!user) {
      balanceEl.textContent = "User not found";
      return;
    }

    balanceEl.textContent = `Balance: ${user.balance} Footy`;
  } catch (error) {
    console.error('Error updating balance:', error);
    isServerOnline = false;
    const balanceEl = document.getElementById('balance');
    if (balanceEl) {
      balanceEl.textContent = "Balance unavailable";
    }
  }
}

function populateGrantControls(users) {
  const userSelect = document.getElementById('grantUserSelect');
  const packUserSelect = document.getElementById('grantPackUserSelect');
  if (!userSelect || !packUserSelect) return;

  [userSelect, packUserSelect].forEach(select => { select.innerHTML = ''; });
  [userSelect, packUserSelect].forEach(select => {
    const allOption = document.createElement('option');
    allOption.value = '__all__';
    allOption.textContent = 'All users';
    select.appendChild(allOption);
  });
  users.forEach(user => {
    [userSelect, packUserSelect].forEach(select => {
      const option = document.createElement('option');
      option.value = user.username;
      option.textContent = user.username + (user.isAdmin ? ' (admin)' : '');
      select.appendChild(option);
    });
  });
}

function populateTransferRecipients(users) {
  const recipientSelect = document.getElementById('toId');
  if (!recipientSelect) return;

  const selectedUsername = recipientSelect.value;
  recipientSelect.innerHTML = '<option value="" disabled>Select a user</option>';

  users
    .filter(user => user.id !== currentUserId)
    .sort((a, b) => a.username.localeCompare(b.username))
    .forEach(user => {
      const option = document.createElement('option');
      option.value = user.username;
      option.textContent = user.username;
      recipientSelect.appendChild(option);
    });

  if ([...recipientSelect.options].some(option => option.value === selectedUsername)) {
    recipientSelect.value = selectedUsername;
  }
}

function populateAdminAccountViewer(users) {
  const accountSelect = document.getElementById('adminAccountSelect');
  if (!accountSelect) return;

  const selectedUserId = accountSelect.value;
  accountSelect.innerHTML = '<option value="" disabled>Select a user</option>';

  users
    .slice()
    .sort((a, b) => a.username.localeCompare(b.username))
    .forEach(user => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = user.username;
      accountSelect.appendChild(option);
    });

  if ([...accountSelect.options].some(option => option.value === selectedUserId)) {
    accountSelect.value = selectedUserId;
  }
}

function formatAdminDate(value) {
  if (!value) return 'Never logged in';
  const date = parseTimestamp(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

async function viewAdminAccount() {
  if (!currentUserIsAdmin) return;

  const accountSelect = document.getElementById('adminAccountSelect');
  const details = document.getElementById('adminAccountDetails');
  const inventoryList = document.getElementById('adminAccountInventory');
  const selectedUserId = accountSelect && accountSelect.value;
  if (!selectedUserId || !details || !inventoryList) return;

  details.hidden = false;
  document.getElementById('adminAccountBalance').textContent = 'Loading...';
  document.getElementById('adminAccountLastOnline').textContent = 'Loading...';
  document.getElementById('adminAccountVip').textContent = 'Loading...';
  inventoryList.textContent = 'Loading inventory...';

  try {
    const usersResponse = await fetch(`${API_URL}/users`);
    if (!usersResponse.ok) throw new Error('Could not load account');
    const users = await usersResponse.json();
    const account = users.find(user => user.id === selectedUserId);
    if (!account) throw new Error('Account not found');

    const vipUntil = account.vipUntil ? parseTimestamp(account.vipUntil) : null;
    const hasVip = vipUntil && vipUntil.getTime() > Date.now();
    document.getElementById('adminAccountBalance').textContent = `${account.balance || 0} Footy`;
    document.getElementById('adminAccountLastOnline').textContent = formatAdminDate(account.lastOnline);
    document.getElementById('adminAccountVip').textContent = hasVip ? `Active until ${vipUntil.toLocaleString()}` : 'Not VIP';

    const inventoryResponse = await fetch(`${API_URL}/inventory?buyerId=${encodeURIComponent(selectedUserId)}`, {
      headers: { 'X-User-Id': currentUserId }
    });
    if (!inventoryResponse.ok) throw new Error('Could not load inventory');
    const inventory = await inventoryResponse.json();
    inventory.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));

    inventoryList.innerHTML = '';
    if (inventory.length === 0) {
      inventoryList.textContent = 'Inventory empty';
      return;
    }

    inventory.forEach(item => {
      const itemElement = document.createElement('li');
      itemElement.textContent = item.name || 'Unnamed item';
      inventoryList.appendChild(itemElement);
    });
  } catch (error) {
    console.error('Error loading admin account:', error);
    inventoryList.textContent = 'Could not load account details.';
  }
}

async function loadCardOptions() {
  try {
    const res = await fetch(`${API_URL}/card-images`);
    if (!res.ok) throw new Error('Could not load card list');
    availableCardImages = await res.json();

    const cardSelect = document.getElementById('grantCardSelect');
    if (cardSelect) {
      cardSelect.innerHTML = '';
      availableCardImages.forEach(filename => {
        const option = document.createElement('option');
        option.value = filename;
        option.textContent = filename;
        cardSelect.appendChild(option);
      });
    }

    const battleLinkedCardSelect = document.getElementById('battleLinkedCardSelect');
    if (battleLinkedCardSelect) {
      battleLinkedCardSelect.innerHTML = '<option value="">Select a normal card</option>';
      availableCardImages.forEach(filename => {
        const option = document.createElement('option');
        option.value = filename;
        option.textContent = filename;
        battleLinkedCardSelect.appendChild(option);
      });
    }

    renderPackCardPicker();
    populateDirectListingProducts();
    updateGrantCardPreview();
    updateBattleCardPreview();
  } catch (error) {
    console.error('Error loading card images:', error);
  }
}

function renderPackCardPicker() {
  const picker = document.getElementById('packCardPicker');
  if (!picker) return;
  picker.innerHTML = '';

  availableCardImages.forEach(filename => {
    const label = document.createElement('label');
    label.className = 'pack-card-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = filename;
    checkbox.setAttribute('aria-label', `Include ${filename}`);
    const image = document.createElement('img');
    image.src = `/images/${filename}`;
    image.alt = filename;
    const caption = document.createElement('span');
    caption.textContent = filename;
    label.append(checkbox, image, caption);
    picker.appendChild(label);
  });
}

async function loadPacks() {
  if (!currentUserIsAdmin) return;
  try {
    const res = await fetch(`${API_URL}/packs`, { headers: { 'X-User-Id': currentUserId } });
    if (!res.ok) throw new Error(await res.text());
    savedPacks = await res.json();

    const select = document.getElementById('grantPackSelect');
    const editorSelect = document.getElementById('packEditorSelect');
    const list = document.getElementById('savedPacks');
    if (!select || !editorSelect || !list) return;
    select.innerHTML = '';
    editorSelect.innerHTML = '<option value="">Create a new pack</option>';
    list.innerHTML = '';
    if (savedPacks.length === 0) {
      const option = document.createElement('option');
      option.textContent = 'No saved packs yet';
      option.value = '';
      select.appendChild(option);
      return;
    }
    savedPacks.forEach(pack => {
      const option = document.createElement('option');
      option.value = pack.id;
      option.textContent = `${pack.name} (${pack.cardIds.length} cards)`;
      select.appendChild(option);

      if (pack.createdBy === currentUserId) {
        const editorOption = document.createElement('option');
        editorOption.value = pack.id;
        editorOption.textContent = `${pack.name} (${pack.cardIds.length} cards)`;
        editorSelect.appendChild(editorOption);
      }

      const item = document.createElement('li');
      item.textContent = `${pack.name}: ${pack.cardIds.length} possible card${pack.cardIds.length === 1 ? '' : 's'}`;
      list.appendChild(item);
    });
    populateDirectListingProducts();
  } catch (error) {
    console.error('Error loading packs:', error);
  }
}

function populateDirectListingProducts() {
  const typeSelect = document.getElementById('marketListingType');
  const productSelect = document.getElementById('marketListingProduct');
  if (!typeSelect || !productSelect) return;
  const type = typeSelect.value;
  productSelect.innerHTML = '';
  const products = type === 'card'
    ? availableCardImages.map(filename => ({ id: filename, label: filename }))
    : savedPacks.map(pack => ({ id: pack.id, label: `${pack.name} (${pack.cardIds.length} cards)` }));
  if (products.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = type === 'card' ? 'No cards available' : 'No saved packs available';
    productSelect.appendChild(option);
    return;
  }
  products.forEach(product => {
    const option = document.createElement('option');
    option.value = product.id;
    option.textContent = product.label;
    productSelect.appendChild(option);
  });
}

async function createDirectMarketplaceListing() {
  const itemType = document.getElementById('marketListingType').value;
  const productId = document.getElementById('marketListingProduct').value;
  const price = Number(document.getElementById('marketListingPrice').value);
  const quantity = Number(document.getElementById('marketListingQuantity').value);
  const perUserLimit = Number(document.getElementById('marketListingPerUserLimit').value);
  const scheduledAt = document.getElementById('marketListingScheduledAt').value;
  const expiresAt = document.getElementById('marketListingExpiresAt').value;

  if (!productId || !price || !Number.isInteger(quantity) || quantity < 1 || !Number.isInteger(perUserLimit) || perUserLimit < 0 || perUserLimit > quantity) {
    return alert('Choose an item and enter a valid price, stock amount, and per-user maximum');
  }

  if (scheduledAt && expiresAt && new Date(expiresAt).getTime() <= new Date(scheduledAt).getTime()) {
    return alert('Expiration time must be after the scheduled start time.');
  }

  try {
    const res = await fetch(`${API_URL}/admin/market-listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUserId },
      body: JSON.stringify({ itemType, productId, price, quantity, perUserLimit, scheduledAt: scheduledAt || null, expiresAt: expiresAt || null })
    });
    if (!res.ok) return alert(await res.text());
    document.getElementById('marketListingPrice').value = '';
    document.getElementById('marketListingQuantity').value = '1';
    document.getElementById('marketListingPerUserLimit').value = '0';
    document.getElementById('marketListingScheduledAt').value = '';
    document.getElementById('marketListingExpiresAt').value = '';
    const result = await res.json();
    alert(result.scheduled ? 'Marketplace listing scheduled' : 'Marketplace listing posted');
    loadItems();
    loadPlannedMarketplaceListings();
  } catch (error) {
    console.error('Error creating marketplace listing:', error);
    alert('Could not post marketplace listing');
  }
}

function loadPackForEditing() {
  const packId = document.getElementById('packEditorSelect').value;
  const nameInput = document.getElementById('packName');
  const colorInput = document.getElementById('packColor');
  const saveButton = document.getElementById('savePackButton');
  const pack = savedPacks.find(candidate => candidate.id === packId);

  document.querySelectorAll('#packCardPicker input').forEach(input => {
    input.checked = !!pack && pack.cardIds.includes(input.value);
  });
  nameInput.value = pack ? pack.name : '';
  colorInput.value = pack ? (pack.color || '#667eea') : '#667eea';
  saveButton.textContent = pack ? 'Save Pack Changes' : 'Save New Pack';
}

async function savePack() {
  const nameInput = document.getElementById('packName');
  const color = document.getElementById('packColor').value;
  const cardIds = [...document.querySelectorAll('#packCardPicker input:checked')].map(input => input.value);
  const packId = document.getElementById('packEditorSelect').value;
  const name = nameInput && nameInput.value.trim();
  if (!name) return alert('Enter a pack name');
  if (cardIds.length === 0) return alert('Choose at least one card for the pack');

  try {
    const res = await fetch(packId ? `${API_URL}/packs/${encodeURIComponent(packId)}` : `${API_URL}/packs`, {
      method: packId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUserId },
      body: JSON.stringify({ name, cardIds, color })
    });
    if (!res.ok) return alert(await res.text());
    await loadPacks();
    document.getElementById('packEditorSelect').value = packId || '';
    loadPackForEditing();
    alert(packId ? 'Pack updated' : 'Pack saved');
  } catch (error) {
    console.error('Error saving pack:', error);
    alert('Could not save pack');
  }
}

async function loadAscendTierConfig() {
  if (!currentUserIsAdmin) return;
  try {
    const res = await fetch(`${API_URL}/ascend-tier-config`, { headers: { 'X-User-Id': currentUserId } });
    if (!res.ok) throw new Error(await res.text());
    const tiers = await res.json();
    const container = document.getElementById('ascendTierConfig');
    if (!container) return;
    container.innerHTML = '';

    if (!Array.isArray(tiers) || tiers.length === 0) {
      container.innerHTML = '<p class="pack-help">No ascend tiers created yet.</p>';
      return;
    }

    tiers.sort((a, b) => Number(a.order) - Number(b.order));

    tiers.forEach(tier => {
      const card = document.createElement('div');
      card.className = 'ascend-tier-card';

      const header = document.createElement('div');
      header.className = 'ascend-tier-header';
      const title = document.createElement('strong');
      title.textContent = `${tier.name}${Number(tier.sellPrice) > 0 ? ` · Sell ${tier.sellPrice} Footy` : ' · No sell price'}`;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger';
      deleteBtn.textContent = 'Delete tier';
      deleteBtn.onclick = async () => {
        const confirmDelete = window.confirm(`Delete the ${tier.name} tier?`);
        if (!confirmDelete) return;
        const delRes = await fetch(`${API_URL}/ascend-tier-config/${encodeURIComponent(tier.id)}`, {
          method: 'DELETE',
          headers: { 'X-User-Id': currentUserId }
        });
        if (!delRes.ok) return alert(await delRes.text());
        loadAscendTierConfig();
      };
      header.append(title, deleteBtn);

      const layout = document.createElement('div');
      layout.className = 'ascend-tier-layout';

      const cardColumn = document.createElement('div');
      cardColumn.innerHTML = '<strong>Cards</strong>';
      const cardList = document.createElement('ul');
      cardList.className = 'ascend-tier-list';
      (tier.cards || []).forEach(fileName => {
        const item = document.createElement('li');
        const label = document.createElement('span');
        label.textContent = fileName;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Remove';
        remove.onclick = async () => {
          const res = await fetch(`${API_URL}/ascend-tier-assignment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUserId },
            body: JSON.stringify({ tierId: tier.id, type: 'card', value: fileName, action: 'remove' })
          });
          if (!res.ok) return alert(await res.text());
          loadAscendTierConfig();
        };
        item.append(label, remove);
        cardList.appendChild(item);
      });
      if ((tier.cards || []).length === 0) {
        const empty = document.createElement('li');
        empty.textContent = 'No cards assigned';
        cardList.appendChild(empty);
      }

      const packColumn = document.createElement('div');
      packColumn.innerHTML = '<strong>Packs</strong>';
      const packList = document.createElement('ul');
      packList.className = 'ascend-tier-list';
      const packIds = Array.isArray(tier.packs) ? tier.packs : [];
      packIds.forEach(packId => {
        const pack = savedPacks.find(entry => entry.id === packId);
        const item = document.createElement('li');
        const label = document.createElement('span');
        label.textContent = pack ? pack.name : packId;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Remove';
        remove.onclick = async () => {
          const res = await fetch(`${API_URL}/ascend-tier-assignment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUserId },
            body: JSON.stringify({ tierId: tier.id, type: 'pack', value: packId, action: 'remove' })
          });
          if (!res.ok) return alert(await res.text());
          loadAscendTierConfig();
        };
        item.append(label, remove);
        packList.appendChild(item);
      });
      if (packIds.length === 0) {
        const empty = document.createElement('li');
        empty.textContent = 'No packs assigned';
        packList.appendChild(empty);
      }

      cardColumn.appendChild(cardList);
      packColumn.appendChild(packList);

      const priceRow = document.createElement('div');
      priceRow.className = 'ascend-tier-actions';
      const priceInput = document.createElement('input');
      priceInput.type = 'number';
      priceInput.min = '0';
      priceInput.step = '1';
      priceInput.value = Number(tier.sellPrice) || 0;
      priceInput.placeholder = 'Sell price';
      const savePriceBtn = document.createElement('button');
      savePriceBtn.className = 'btn btn-primary';
      savePriceBtn.textContent = 'Save sell price';
      savePriceBtn.onclick = async () => {
        const sellPrice = Number(priceInput.value);
        if (!Number.isFinite(sellPrice) || sellPrice < 0) return alert('Enter a valid non-negative sell price');
        const res = await fetch(`${API_URL}/ascend-tier-config/${encodeURIComponent(tier.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUserId },
          body: JSON.stringify({ name: tier.name, order: Number(tier.order), sellPrice })
        });
        if (!res.ok) return alert(await res.text());
        loadAscendTierConfig();
      };
      priceRow.append(priceInput, savePriceBtn);

      const actions = document.createElement('div');
      actions.className = 'ascend-tier-actions';
      const cardSelect = document.createElement('select');
      cardSelect.innerHTML = '<option value="">Add card…</option>';
      availableCardImages.forEach(filename => {
        const option = document.createElement('option');
        option.value = filename;
        option.textContent = filename;
        cardSelect.appendChild(option);
      });
      const addCardBtn = document.createElement('button');
      addCardBtn.className = 'btn btn-primary';
      addCardBtn.textContent = 'Add card';
      addCardBtn.onclick = async () => {
        if (!cardSelect.value) return alert('Choose a card');
        const res = await fetch(`${API_URL}/ascend-tier-assignment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUserId },
          body: JSON.stringify({ tierId: tier.id, type: 'card', value: cardSelect.value, action: 'add' })
        });
        if (!res.ok) return alert(await res.text());
        loadAscendTierConfig();
      };

      const packSelect = document.createElement('select');
      packSelect.innerHTML = '<option value="">Add pack…</option>';
      savedPacks.forEach(pack => {
        const option = document.createElement('option');
        option.value = pack.id;
        option.textContent = pack.name;
        packSelect.appendChild(option);
      });
      const addPackBtn = document.createElement('button');
      addPackBtn.className = 'btn btn-primary';
      addPackBtn.textContent = 'Add pack';
      addPackBtn.onclick = async () => {
        if (!packSelect.value) return alert('Choose a pack');
        const res = await fetch(`${API_URL}/ascend-tier-assignment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUserId },
          body: JSON.stringify({ tierId: tier.id, type: 'pack', value: packSelect.value, action: 'add' })
        });
        if (!res.ok) return alert(await res.text());
        loadAscendTierConfig();
      };

      actions.append(cardSelect, addCardBtn, packSelect, addPackBtn);
      card.append(header, priceRow, layout, actions);
      layout.append(cardColumn, packColumn);
      container.appendChild(card);
    });
  } catch (error) {
    console.error('Error loading ascend tier config:', error);
    const container = document.getElementById('ascendTierConfig');
    if (container) container.innerHTML = '<p class="pack-help">Could not load ascend tiers.</p>';
  }
}

async function createAscendTier() {
  const name = document.getElementById('newAscendTierName').value.trim();
  const order = Number(document.getElementById('newAscendTierOrder').value);
  const sellPrice = Number(document.getElementById('newAscendTierSellPrice').value);
  if (!name) return alert('Enter a tier name');
  try {
    const res = await fetch(`${API_URL}/ascend-tier-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUserId },
      body: JSON.stringify({ name, order, sellPrice: Number.isFinite(sellPrice) ? sellPrice : 0 })
    });
    if (!res.ok) return alert(await res.text());
    document.getElementById('newAscendTierName').value = '';
    document.getElementById('newAscendTierOrder').value = String((Number(document.getElementById('newAscendTierOrder').value) || 0) + 1);
    document.getElementById('newAscendTierSellPrice').value = '0';
    loadAscendTierConfig();
  } catch (error) {
    console.error('Error creating ascend tier:', error);
    alert('Could not create tier');
  }
}

async function grantPackToUser() {
  const packId = document.getElementById('grantPackSelect').value;
  const username = document.getElementById('grantPackUserSelect').value;
  const quantity = Number(document.getElementById('grantPackQuantity').value);
  if (!packId || !username || !Number.isInteger(quantity) || quantity < 1) return alert('Select a pack, user, and valid quantity');

  try {
    const res = await fetch(`${API_URL}/grant-pack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUserId },
      body: JSON.stringify({ packId, username, quantity })
    });
    if (!res.ok) return alert(await res.text());
    alert(`Granted ${quantity} pack(s) to ${username === '__all__' ? 'all users' : username}`);
    if (username === '__all__' || username === localStorage.getItem('username')) loadInventory();
  } catch (error) {
    console.error('Error granting pack:', error);
    alert('Could not grant pack');
  }
}

async function openPack(itemId) {
  try {
    const res = await fetch(`${API_URL}/open-pack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUserId },
      body: JSON.stringify({ itemId })
    });
    if (!res.ok) return alert(await res.text());
    const result = await res.json();
    showPackOpeningAnimation(result);
    loadInventory();
  } catch (error) {
    console.error('Error opening pack:', error);
    alert('Could not open pack');
  }
}

function showPackOpeningAnimation(result) {
  const overlay = document.getElementById('packOpeningOverlay');
  const pack = document.getElementById('openingPack');
  const card = document.getElementById('openedCardImage');
  const name = document.getElementById('openedCardName');
  if (!overlay || !pack || !card || !name) return;

  overlay.hidden = false;
  pack.className = 'opening-pack';
  card.className = 'opened-card-image';
  name.className = 'opened-card-name';
  card.src = result.imageUrl;
  card.alt = result.cardId;
  name.textContent = `${result.cardId} — click to continue`;
  pack.style.setProperty('--pack-color', result.packColor || '#667eea');

  requestAnimationFrame(() => {
    pack.classList.add('is-opening');
  });
  window.setTimeout(() => {
    pack.classList.add('is-gone');
    card.classList.add('is-revealed');
    name.classList.add('is-revealed');
  }, 750);
}

function dismissPackOpening() {
  document.getElementById('packOpeningOverlay').hidden = true;
}

function updateGrantCardPreview() {
  const cardSelect = document.getElementById('grantCardSelect');
  const preview = document.getElementById('grantCardPreview');
  const previewImage = document.getElementById('grantCardPreviewImage');
  const previewText = document.getElementById('grantCardPreviewText');

  if (!cardSelect || !preview || !previewImage || !previewText) return;

  const selected = cardSelect.value;
  if (!selected) {
    preview.style.display = 'none';
    return;
  }

  preview.style.display = 'flex';
  previewImage.src = `/images/${selected}`;
  previewText.textContent = `Selected card: ${selected}`;
}

async function grantItemToUser() {
  const userSelect = document.getElementById('grantUserSelect');
  const cardSelect = document.getElementById('grantCardSelect');
  const quantityInput = document.getElementById('grantQuantity');

  if (!userSelect || !cardSelect || !quantityInput) return;

  const username = userSelect.value;
  const cardId = cardSelect.value;
  const quantity = Number(quantityInput.value);

  if (!username) {
    alert('Select a user');
    return;
  }

  if (!cardId) {
    alert('Select a card');
    return;
  }

  if (!quantity || quantity <= 0) {
    alert('Enter a valid quantity');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/grant-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': currentUserId
      },
      body: JSON.stringify({ username, cardId, quantity })
    });

    if (!res.ok) {
      const msg = await res.text();
      alert(msg);
      return;
    }

    const data = await res.json();
    alert(`Granted ${data.granted} card(s) to ${username === '__all__' ? 'all users' : username}`);
    if (username === '__all__' || username === localStorage.getItem('username')) loadInventory();
  } catch (error) {
    console.error('Grant item error:', error);
    alert('Unable to grant cards right now');
  }
}

/* ------------------ TRANSFER ------------------ */
async function transfer() {
  if (!isServerOnline) {
    alert("🔒 Market is closed. The marketplace server is currently offline. Please try again later.");
    return;
  }
  
  const toUsername = document.getElementById('toId').value.trim();
  const amount = Number(document.getElementById('amount').value);

  if (!toUsername || !amount) {
    alert("Select a user and enter a valid amount");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromId: currentUserId,
        toUsername: toUsername,
        amount: amount
      })
    });

    if (!res.ok) {
      const msg = await res.text();
      alert(msg);
    } else {
      alert("✅ Transfer complete!");
    }

    updateBalance();
  } catch (error) {
    console.error('Transfer error:', error);
    isServerOnline = false;
    alert("🔒 Market is closed. The marketplace server is currently offline. Please try again later.");
    showMarketClosed();
  }
}

/* ------------------ MARKETPLACE ------------------ */
async function loadItems() {
  if (!isServerOnline) return;
  
  try {
    const res = await fetch(`${API_URL}/items`);
    if (!res.ok) throw new Error('Server offline');
    const items = await res.json();

    const list = document.getElementById('items');
    list.innerHTML = "";

    items.forEach(item => {
      if (item.sold) return;

      const li = document.createElement('li');

      if (item.imageUrl) {
        const image = document.createElement('img');
        image.className = 'item-image';
        image.src = item.imageUrl;
        image.alt = item.name;
        li.appendChild(image);
      }

      const itemInfo = document.createElement('span');
      itemInfo.className = 'item-info';
      itemInfo.textContent = item.limitOnePerUser ? `${item.name} (one per user)` : item.name;

      const itemPrice = document.createElement('span');
      itemPrice.className = 'item-price';
      itemPrice.textContent = `${item.price} Footy${item.stock > 1 ? ` · ${item.stock} left` : ''}${item.perUserLimit ? ` · max ${item.perUserLimit}/user` : ''}`;

      const isOwner = String(item.sellerId) === String(currentUserId);

      const btn = document.createElement('button');

      if (isOwner) {
        btn.textContent = "Delete";
        btn.className = "btn btn-danger";

        btn.onclick = async () => {
          try {
            const res = await fetch(`${API_URL}/delete-item`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                itemId: item.id,
                userId: currentUserId
              })
            });

            if (!res.ok) {
              const msg = await res.text();
              alert(msg);
            } else {
              alert("✅ Item deleted!");
            }

            loadItems();
          } catch (error) {
            console.error('Delete error:', error);
            alert("🔒 Market is closed. The marketplace server is currently offline.");
            isServerOnline = false;
            showMarketClosed();
          }
        };

      } else {
        btn.textContent = "Buy";
        btn.className = "btn btn-success";

        btn.onclick = async () => {
          try {
            const res = await fetch(`${API_URL}/buy`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                itemId: item.id,
                buyerId: currentUserId
              })
            });

            if (!res.ok) {
              const msg = await res.text();
              alert(msg);
            } else {
              alert("✅ Purchase successful!");
            }

            loadItems();
            loadInventory();
            updateBalance();
          } catch (error) {
            console.error('Buy error:', error);
            alert("🔒 Market is closed. The marketplace server is currently offline.");
            isServerOnline = false;
            showMarketClosed();
          }
        };
      }

      li.appendChild(itemInfo);
      li.appendChild(itemPrice);
      li.appendChild(btn);
      list.appendChild(li);
    });
  } catch (error) {
    console.error('Error loading items:', error);
    isServerOnline = false;
    showMarketClosed('Could not load marketplace items. Please refresh or try again later.');
  }
}

/* ------------------ ADD ITEM (Original for direct listings) ------------------ */
async function addItem() {
  if (!isServerOnline) {
    alert("🔒 Market is closed. The marketplace server is currently offline. Please try again later.");
    return;
  }
  
  const name = document.getElementById('itemName').value.trim();
  const price = Number(document.getElementById('itemPrice').value);

  if (!name || !price) {
    alert("Enter valid item name and price");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        price,
        sellerId: currentUserId
      })
    });

    if (!res.ok) {
      const msg = await res.text();
      alert(msg);
    } else {
      alert("✅ Item listed!");
      document.getElementById('itemName').value = '';
      document.getElementById('itemPrice').value = '';
    }

    loadItems();
  } catch (error) {
    console.error('Add item error:', error);
    isServerOnline = false;
    alert("🔒 Market is closed. The marketplace server is currently offline. Please try again later.");
    showMarketClosed();
  }
}

async function updateItemImage() {
  const itemId = document.getElementById('adminItemId').value.trim();
  const imageUrl = document.getElementById('adminImageUrl').value.trim();

  if (!itemId) {
    alert('Enter the item ID');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/items/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': currentUserId
      },
      body: JSON.stringify({ itemId, imageUrl })
    });

    if (!res.ok) {
      const msg = await res.text();
      alert(msg);
    } else {
      alert('✅ Image updated');
      document.getElementById('adminImageUrl').value = '';
      document.getElementById('adminItemId').value = '';
      loadItems();
      loadInventory();
    }
  } catch (error) {
    console.error('Admin update image error:', error);
    alert('Could not update image');
  }
}

async function clearItemImage() {
  const itemId = document.getElementById('adminItemId').value.trim();

  if (!itemId) {
    alert('Enter the item ID');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/items/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': currentUserId
      },
      body: JSON.stringify({ itemId, imageUrl: '' })
    });

    if (!res.ok) {
      const msg = await res.text();
      alert(msg);
    } else {
      alert('✅ Image removed');
      document.getElementById('adminImageUrl').value = '';
      document.getElementById('adminItemId').value = '';
      loadItems();
      loadInventory();
    }
  } catch (error) {
    console.error('Admin clear image error:', error);
    alert('Could not remove image');
  }
}

/* ------------------ LISTING MODAL FUNCTIONS ------------------ */
async function openListingModal() {
  if (!isServerOnline) {
    alert("🔒 Market is closed. The marketplace server is currently offline. Please try again later.");
    return;
  }

  const modal = document.getElementById('listingModal');
  modal.style.display = 'flex';

  try {
    const res = await fetch(`${API_URL}/inventory`, {
      headers: {
        'X-User-Id': currentUserId
      }
    });
    
    if (!res.ok) throw new Error('Server offline');

    const inventoryItems = await res.json();
    const list = document.getElementById('inventoryForListing');
    list.innerHTML = '';

    if (inventoryItems.length === 0) {
      list.innerHTML = `<li style="background:#fff4e8; border-left-color:#ffb74d;">Inventory empty</li>`;
      return;
    }

    inventoryItems.forEach(item => {
      const li = document.createElement('li');
      li.style.cursor = 'pointer';
      li.onclick = () => selectItemForListing(item, li);

      if (item.imageUrl) {
        const image = document.createElement('img');
        image.className = 'item-image';
        image.src = item.imageUrl;
        image.alt = item.name;
        li.appendChild(image);
      }

      const itemInfo = document.createElement('span');
      itemInfo.className = 'item-info';
      itemInfo.textContent = item.name;

      const details = document.createElement('span');
      details.className = 'item-price';
      details.textContent = `Purchased ${formatDate(item.purchasedAt)}`;

      li.appendChild(itemInfo);
      li.appendChild(details);
      list.appendChild(li);
    });
  } catch (error) {
    console.error('Error loading inventory for listing:', error);
    alert('Error loading inventory');
  }
}

function closeListingModal() {
  const modal = document.getElementById('listingModal');
  modal.style.display = 'none';
}

function selectItemForListing(item, liElement) {
  selectedItemForListing = item;

  // Update selected visual feedback
  const allItems = document.getElementById('inventoryForListing').querySelectorAll('li');
  allItems.forEach(li => li.classList.remove('selected'));
  liElement.classList.add('selected');

  // Show selected item in the form
  const display = document.getElementById('selectedItemDisplay');
  const nameElement = document.getElementById('selectedItemName');
  display.style.display = 'block';
  nameElement.textContent = item.name;

  // Close the modal
  closeListingModal();
  
  // Focus on price input
  setTimeout(() => {
    document.getElementById('itemPrice').focus();
  }, 100);
}

async function listSelectedItem() {
  if (!isServerOnline) {
    alert("🔒 Market is closed. The marketplace server is currently offline. Please try again later.");
    return;
  }

  if (!selectedItemForListing) {
    alert('Please select an item from your inventory');
    return;
  }

  const price = Number(document.getElementById('itemPrice').value);

  if (!price || price <= 0) {
    alert('Enter a valid price');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: selectedItemForListing.name,
        price,
        sellerId: currentUserId,
        sourceItemId: selectedItemForListing.id,
        imageUrl: selectedItemForListing.imageUrl || null
      })
    });

    if (!res.ok) {
      const msg = await res.text();
      alert(msg);
    } else {
      alert("✅ Item listed!");
      document.getElementById('itemPrice').value = '';
      document.getElementById('limitOnePerUser').checked = false;
      document.getElementById('selectedItemDisplay').style.display = 'none';
      selectedItemForListing = null;
    }

    loadItems();
  } catch (error) {
    console.error('Add item error:', error);
    isServerOnline = false;
    alert("🔒 Market is closed. The marketplace server is currently offline. Please try again later.");
    showMarketClosed();
  }
}

/* ------------------ INVENTORY ------------------ */
function updateInventorySellModeButton() {
  const sellModeButton = document.getElementById('inventorySellModeToggle');
  if (!sellModeButton) return;
  sellModeButton.textContent = `Sell Mode: ${inventorySellMode ? 'On' : 'Off'}`;
  sellModeButton.classList.toggle('btn-warning', !inventorySellMode);
  sellModeButton.classList.toggle('btn-success', inventorySellMode);
}

function toggleInventorySellMode() {
  inventorySellMode = !inventorySellMode;
  updateInventorySellModeButton();
  loadInventory();
}

async function loadInventory() {
  if (!isServerOnline) return;

  try {
    const [inventoryRes, tiersRes] = await Promise.all([
      fetch(`${API_URL}/inventory`, {
        headers: { 'X-User-Id': currentUserId }
      }),
      fetch(`${API_URL}/ascend-tier-config`, {
        headers: { 'X-User-Id': currentUserId }
      })
    ]);
    if (!inventoryRes.ok) throw new Error('Server offline');
    if (!tiersRes.ok) throw new Error('Could not load tier prices');

    const inventoryItems = await inventoryRes.json();
    const tiers = await tiersRes.json();
    const sellPriceByCard = {};

    (Array.isArray(tiers) ? tiers : []).forEach(tier => {
      (tier.cards || []).forEach(fileName => {
        const normalized = String(fileName).split('/').pop();
        const price = Number(tier.sellPrice);
        if (normalized && Number.isFinite(price) && price > 0) {
          sellPriceByCard[normalized] = price;
        }
      });
    });

    inventoryItems.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
    const list = document.getElementById('inventoryItems');
    list.innerHTML = '';

    if (inventoryItems.length === 0) {
      list.innerHTML = `<li style="background:#fff4e8; border-left-color:#ffb74d;">Inventory empty</li>`;
      updateInventorySellModeButton();
      return;
    }

    inventoryItems.forEach(item => {
      const li = document.createElement('li');
      if (item.itemType === 'pack') {
        const packIcon = document.createElement('div');
        packIcon.className = 'pack-inventory-icon';
        packIcon.textContent = 'PACK';
        packIcon.style.setProperty('--pack-color', item.packColor || '#667eea');
        const packName = document.createElement('span');
        packName.className = 'item-info';
        packName.textContent = item.name;
        const openButton = document.createElement('button');
        openButton.className = 'btn btn-success';
        openButton.textContent = 'Open Pack';
        openButton.onclick = () => openPack(item.id);
        li.append(packIcon, packName, openButton);
        list.appendChild(li);
        return;
      }
      // Only show thumbnail in inventory view (no name, price, or purchase date)
      if (item.imageUrl) {
        const image = document.createElement('img');
        image.className = 'item-image';
        image.src = item.imageUrl;
        image.alt = item.name || 'Inventory item';
        li.appendChild(image);
      } else {
        // Fallback: small placeholder box to keep layout consistent
        const placeholder = document.createElement('div');
        placeholder.style.width = '100px';
        placeholder.style.height = '100px';
        placeholder.style.background = '#f0f0f0';
        placeholder.style.borderRadius = '8px';
        li.appendChild(placeholder);
      }

      const cardKey = item.imageUrl ? item.imageUrl.split('/').pop() : '';
      const sellPrice = cardKey ? Number(sellPriceByCard[cardKey]) : 0;
      if (inventorySellMode && sellPrice > 0) {
        const sellButton = document.createElement('button');
        sellButton.className = 'btn btn-warning';
        sellButton.textContent = `Sell: ${sellPrice}`;
        sellButton.onclick = async () => {
          const confirmed = window.confirm(`Sell this card back to its tier for ${sellPrice} Footy?`);
          if (!confirmed) return;
          try {
            const res = await fetch(`${API_URL}/sell-tier-card`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUserId },
              body: JSON.stringify({ itemId: item.id })
            });
            if (!res.ok) return alert(await res.text());
            const result = await res.json();
            alert(`✅ Sold for ${result.amount} Footy`);
            loadInventory();
            updateBalance();
          } catch (error) {
            console.error('Sell card error:', error);
            alert('Could not sell this card right now.');
          }
        };
        li.appendChild(sellButton);
      }

      list.appendChild(li);
    });

    updateInventorySellModeButton();
  } catch (error) {
    console.error('Error loading inventory:', error);
    const list = document.getElementById('inventoryItems');
    list.innerHTML = `
      <li style="background:#fff4e8; border-left-color:#ffb74d;">
        Could not load inventory right now. Please switch back to Marketplace or try again later.
      </li>
    `;
    updateInventorySellModeButton();
  }
}

function getCardKeyFromItem(item) {
  if (!item) return '';
  if (item.imageUrl) {
    const basename = item.imageUrl.split('/').pop();
    return basename || '';
  }
  return String(item.name || '').trim();
}

function getCardGroupKey(item) {
  const fileName = getCardKeyFromItem(item);
  if (!fileName) return '';

  if (typeof window !== 'undefined' && window.AscendUtils && typeof window.AscendUtils.canonicalizeCardKey === 'function') {
    const canonical = window.AscendUtils.canonicalizeCardKey(fileName);
    if (canonical) return canonical;
  }

  return fileName;
}

async function openAscendMenu() {
  try {
    const [inventoryRes, tiersRes] = await Promise.all([
      fetch(`${API_URL}/inventory`, { headers: { 'X-User-Id': currentUserId } }),
      fetch(`${API_URL}/ascend-tier-config`, { headers: { 'X-User-Id': currentUserId } })
    ]);
    if (!inventoryRes.ok) throw new Error('Could not load inventory');
    if (!tiersRes.ok) throw new Error('Could not load tier config');

    const inventory = await inventoryRes.json();
    const tiers = await tiersRes.json();
    const grouped = new Map();

    inventory.forEach(item => {
      if (item.itemType === 'pack' || !item.imageUrl) return;
      const cardFile = item.imageUrl.split('/').pop();
      const tier = Array.isArray(tiers) ? tiers.find(entry => (entry.cards || []).includes(cardFile)) : null;
      if (!tier) return;

      const existing = grouped.get(cardFile) || { key: cardFile, tierName: tier.name, items: [] };
      existing.items.push(item);
      grouped.set(cardFile, existing);
    });

    const eligible = [...grouped.values()]
      .map(({ key, tierName, items }) => {
        const tierIndex = tiers.findIndex(entry => entry.name === tierName);
        const nextTier = tierIndex >= 0 && tierIndex < tiers.length - 1 ? tiers[tierIndex + 1] : null;
        if (!nextTier || items.length < 3) return null;

        const packChoices = Array.isArray(nextTier.packs) ? nextTier.packs : [];
        if (packChoices.length === 0) return null;

        return {
          key,
          label: key,
          count: items.length,
          imageUrl: items[0].imageUrl || `/images/${key}`,
          nextTierName: nextTier.name,
          packChoices
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.key.localeCompare(b.key));

    const list = document.getElementById('ascendOptions');
    if (!list) return;

    list.innerHTML = '';
    if (eligible.length === 0) {
      const emptyState = document.createElement('p');
      emptyState.textContent = 'You need 3 copies of a card assigned to a tier and a configured next-tier pack.';
      list.appendChild(emptyState);
      const modal = document.getElementById('ascendModal');
      if (modal) modal.hidden = false;
      return;
    }

    eligible.forEach(entry => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'ascend-option';
      option.innerHTML = `
        <img src="${entry.imageUrl}" alt="${entry.label}">
        <h4>${entry.label}</h4>
        <p>${entry.count} copies · to ${entry.nextTierName}</p>
      `;
      option.addEventListener('click', () => confirmAscend(entry));
      list.appendChild(option);
    });

    const modal = document.getElementById('ascendModal');
    if (modal) modal.hidden = false;
  } catch (error) {
    console.error('Error opening ascend menu:', error);
    alert('Could not load the ascend menu right now.');
  }
}

function closeAscendModal() {
  const modal = document.getElementById('ascendModal');
  if (modal) modal.hidden = true;
}

async function confirmAscend(entry) {
  if (!entry) return;
  const yes = window.confirm(`Use 3 copies of ${entry.key} to receive a pack from ${entry.nextTierName}?`);
  if (!yes) return;

  try {
    const res = await fetch(`${API_URL}/ascend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': currentUserId
      },
      body: JSON.stringify({ cardKey: entry.key })
    });

    const text = await res.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch (error) {
      payload = {};
    }

    if (!res.ok) {
      throw new Error(payload.error || text || 'Ascend failed');
    }

    closeAscendModal();
    alert(`✅ Ascended ${entry.key} and received ${payload.packName || 'a next-tier pack'}!`);
    loadInventory();
  } catch (error) {
    console.error('Ascend error:', error);
    alert(error.message || 'Could not ascend this card.');
  }
}

/* ------------------ INIT ------------------ */
checkServerStatus();
loadUsers();
loadItems();
sendPresenceHeartbeat();
presenceInterval = setInterval(sendPresenceHeartbeat, 10000);
// Inventory loads only when the tab is selected, to avoid closing the market from inventory fetch issues
