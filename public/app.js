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

function logout() {
  localStorage.removeItem('userId');
  localStorage.removeItem('username');
  window.location.href = 'login.html';
}

function showSection(section) {
  currentView = section;

  const marketplaceSection = document.getElementById('marketplaceSection');
  const inventorySection = document.getElementById('inventorySection');
  const historySection = document.getElementById('historySection');
  const spinSection = document.getElementById('spinSection');
  const marketTab = document.getElementById('marketTab');
  const inventoryTab = document.getElementById('inventoryTab');
  const historyTab = document.getElementById('historyTab');
  const spinTab = document.getElementById('spinTab');
  const vipTab = document.getElementById('vipTab');
  const vipSection = document.getElementById('vipSection');

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

    // Mark tab active state
    marketTab.classList.remove('active');
    inventoryTab.classList.add('active');
    if (historyTab) historyTab.classList.remove('active');
    spinTab.classList.remove('active');
    if (vipTab) vipTab.classList.remove('active');

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

    marketTab.classList.remove('active');
    inventoryTab.classList.remove('active');
    if (historyTab) historyTab.classList.add('active');
    spinTab.classList.remove('active');
    if (vipTab) vipTab.classList.remove('active');

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

    marketTab.classList.remove('active');
    inventoryTab.classList.remove('active');
    if (historyTab) historyTab.classList.remove('active');
    spinTab.classList.add('active');
    if (vipTab) vipTab.classList.remove('active');

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

    marketTab.classList.remove('active');
    inventoryTab.classList.remove('active');
    if (historyTab) historyTab.classList.remove('active');
    spinTab.classList.remove('active');
    if (vipTab) vipTab.classList.add('active');

    // Ensure vip section scrolls into view on mobile
    if (vipSection) vipSection.scrollIntoView({ behavior: 'smooth' });

    loadVipInfo();
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
    marketTab.classList.add('active');
    inventoryTab.classList.remove('active');
    if (historyTab) historyTab.classList.remove('active');
    spinTab.classList.remove('active');
    if (vipTab) vipTab.classList.remove('active');
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

    if (currentUserIsAdmin) {
      populateGrantControls(users);
      populateAdminAccountViewer(users);
      loadCardOptions();
      loadPacks();
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
    if (!cardSelect) return;

    cardSelect.innerHTML = '';
    availableCardImages.forEach(filename => {
      const option = document.createElement('option');
      option.value = filename;
      option.textContent = filename;
      cardSelect.appendChild(option);
    });

    renderPackCardPicker();
    populateDirectListingProducts();
    updateGrantCardPreview();
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
  if (!productId || !price || !Number.isInteger(quantity) || quantity < 1 || !Number.isInteger(perUserLimit) || perUserLimit < 0 || perUserLimit > quantity) {
    return alert('Choose an item and enter a valid price, stock amount, and per-user maximum');
  }
  try {
    const res = await fetch(`${API_URL}/admin/market-listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUserId },
      body: JSON.stringify({ itemType, productId, price, quantity, perUserLimit })
    });
    if (!res.ok) return alert(await res.text());
    document.getElementById('marketListingPrice').value = '';
    document.getElementById('marketListingQuantity').value = '1';
    document.getElementById('marketListingPerUserLimit').value = '0';
    alert('Marketplace listing posted');
    loadItems();
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
async function loadInventory() {
  if (!isServerOnline) return;

  try {
    const res = await fetch(`${API_URL}/inventory`, {
      headers: {
        'X-User-Id': currentUserId
      }
    });
    if (!res.ok) throw new Error('Server offline');

    const inventoryItems = await res.json();
    const list = document.getElementById('inventoryItems');
    list.innerHTML = '';

    if (inventoryItems.length === 0) {
      list.innerHTML = `<li style="background:#fff4e8; border-left-color:#ffb74d;">Inventory empty</li>`;
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

      list.appendChild(li);
    });
  } catch (error) {
    console.error('Error loading inventory:', error);
    const list = document.getElementById('inventoryItems');
    list.innerHTML = `
      <li style="background:#fff4e8; border-left-color:#ffb74d;">
        Could not load inventory right now. Please switch back to Marketplace or try again later.
      </li>
    `;
  }
}

/* ------------------ INIT ------------------ */
checkServerStatus();
loadUsers();
loadItems();
// Inventory loads only when the tab is selected, to avoid closing the market from inventory fetch issues
