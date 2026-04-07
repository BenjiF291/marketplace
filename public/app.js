// Check if user is logged in
const userId = localStorage.getItem('userId');
const username = localStorage.getItem('username');

if (!userId) {
  window.location.href = 'login.html';
}

let currentUserId = userId;

// Determine API URL based on environment
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'  // Local development
  : 'https://marketplace-aw8b.onrender.com';  // Production Render URL

let isServerOnline = true;
let currentView = 'marketplace';

function logout() {
  localStorage.removeItem('userId');
  localStorage.removeItem('username');
  window.location.href = 'login.html';
}

function showSection(section) {
  currentView = section;

  const marketplaceSection = document.getElementById('marketplaceSection');
  const inventorySection = document.getElementById('inventorySection');
  const marketTab = document.getElementById('marketTab');
  const inventoryTab = document.getElementById('inventoryTab');

  if (section === 'inventory') {
    marketplaceSection.style.display = 'none';
    inventorySection.style.display = 'block';
    marketTab.classList.remove('active');
    inventoryTab.classList.add('active');
    loadInventory();
  } else {
    marketplaceSection.style.display = 'block';
    inventorySection.style.display = 'none';
    marketTab.classList.add('active');
    inventoryTab.classList.remove('active');
  }
}

function formatDate(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  return date.toLocaleString();
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

    balanceEl.textContent = `Balance: ${user.balance} coins`;
  } catch (error) {
    console.error('Error updating balance:', error);
    isServerOnline = false;
    const balanceEl = document.getElementById('balance');
    if (balanceEl) {
      balanceEl.textContent = "Balance unavailable";
    }
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
      
      const itemInfo = document.createElement('span');
      itemInfo.className = 'item-info';
      itemInfo.textContent = item.name;

      const itemPrice = document.createElement('span');
      itemPrice.className = 'item-price';
      itemPrice.textContent = `${item.price} coins`;

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

/* ------------------ ADD ITEM ------------------ */
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

/* ------------------ INVENTORY ------------------ */
async function loadInventory() {
  if (!isServerOnline) return;

  try {
    const res = await fetch(`${API_URL}/inventory?buyerId=${currentUserId}`);
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

      const itemInfo = document.createElement('span');
      itemInfo.className = 'item-info';
      itemInfo.textContent = item.name;

      const details = document.createElement('span');
      details.className = 'item-price';
      details.textContent = `${item.price} coins · Purchased ${formatDate(item.purchasedAt)}`;

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
