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
let selectedItemForListing = null; // Track selected item for listing
let currentUserIsAdmin = false;
let availableCardImages = [];

function logout() {
  localStorage.removeItem('userId');
  localStorage.removeItem('username');
  window.location.href = 'login.html';
}

function showSection(section) {
  currentView = section;

  const marketplaceSection = document.getElementById('marketplaceSection');
  const inventorySection = document.getElementById('inventorySection');
  const spinSection = document.getElementById('spinSection');
  const marketTab = document.getElementById('marketTab');
  const inventoryTab = document.getElementById('inventoryTab');
  const spinTab = document.getElementById('spinTab');

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
    inventorySection.style.display = 'block';

    // Mark tab active state
    marketTab.classList.remove('active');
    inventoryTab.classList.add('active');
    spinTab.classList.remove('active');

    // Ensure inventory scrolls into view on mobile
    inventorySection.scrollIntoView({ behavior: 'smooth' });

    loadInventory();
  } else if (section === 'spin') {
    marketplaceSection.style.display = 'none';
    inventorySection.style.display = 'none';
    spinSection.style.display = 'block';
    marketTab.classList.remove('active');
    inventoryTab.classList.remove('active');
    spinTab.classList.add('active');
    loadSpinInfo();
  } else {
    clearSpinCountdown();
    marketplaceSection.style.display = 'block';
    inventorySection.style.display = 'none';
    spinSection.style.display = 'none';
    marketTab.classList.add('active');
    inventoryTab.classList.remove('active');
    spinTab.classList.remove('active');
  }
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

function clearSpinCountdown() {
  if (spinCountdownInterval) {
    clearInterval(spinCountdownInterval);
    spinCountdownInterval = null;
  }
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
      const nextSpin = new Date(lastSpinDate.getTime() + 24 * 60 * 60 * 1000);
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
}

async function spinWheel() {
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
      return;
    }

    resultEl.innerHTML = `✅ You won <strong>${data.amount} Footy</strong>! Your balance is now ${data.balance} Footy.`;
    loadUsers();
    loadInventory();
    loadSpinInfo();
  } catch (error) {
    console.error('Spin error:', error);
    resultEl.textContent = 'Could not spin the wheel. Try again later.';
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
      loadCardOptions();
    }

    // Update current user display with admin badge when applicable
    const currentUsernameEl = document.getElementById('currentUsername');
    if (currentUsernameEl) {
      if (currentUserIsAdmin) {
        currentUsernameEl.innerHTML = `👤 ${username} <span class="admin-badge">ADMIN</span>`;
      } else {
        currentUsernameEl.textContent = `👤 ${username}`;
      }
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
  if (!userSelect) return;

  userSelect.innerHTML = '';
  users.forEach(user => {
    const option = document.createElement('option');
    option.value = user.username;
    option.textContent = user.username + (user.isAdmin ? ' (admin)' : '');
    userSelect.appendChild(option);
  });
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

    updateGrantCardPreview();
  } catch (error) {
    console.error('Error loading card images:', error);
  }
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
    alert(`✅ Granted ${data.granted} card(s) to ${username}`);
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
    alert("Enter valid username and amount");
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
      itemInfo.textContent = item.name;

      const itemPrice = document.createElement('span');
      itemPrice.className = 'item-price';
      itemPrice.textContent = `${item.price} Footy`;

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
      list.innerHTML = `<li style="background:#fff4e8; border-left-color:#ffb74d;">You have not bought any items yet.</li>`;
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
      list.innerHTML = `<li style="background:#fff4e8; border-left-color:#ffb74d;">You have not bought any items yet.</li>`;
      return;
    }

    inventoryItems.forEach(item => {
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
      itemInfo.textContent = item.name;

      const details = document.createElement('span');
      details.className = 'item-price';
      details.textContent = `${item.price} Footy · Purchased ${formatDate(item.purchasedAt)}`;

      li.appendChild(itemInfo);
      li.appendChild(details);
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
