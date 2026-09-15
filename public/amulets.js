let amuletState = null;
let amuletPending = false;
let amuletUnlockTimer = null;
const resourceHeaders = () => ({ 'Content-Type': 'application/json', 'X-User-Id': currentUserId, 'Authorization': `Bearer ${localStorage.getItem('sessionToken') || ''}` });
function amuletNode(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
async function resourceRequest(url, body) {
  const response = await fetch(`${API_URL}${url}`, body === undefined ? { headers: resourceHeaders() } : { method: 'POST', headers: resourceHeaders(), body: JSON.stringify(body) });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
function amuletTile(entry) {
  const tile = amuletNode('article', undefined, 'amulet-tile');
  const icon = gemIcon(entry.gemKey);
  icon.classList.add('amulet-pendant');
  tile.append(icon, amuletNode('h4', entry.name), amuletNode('p', entry.description));
  return tile;
}
async function loadAmulets() {
  document.getElementById('amuletStatus').textContent = 'Loading amulets...';
  try {
    amuletState = await resourceRequest('/amulets');
    clearTimeout(amuletUnlockTimer);
    const nextRemoval = amuletState.slots.filter(slot => slot && slot.removableAt > amuletState.serverNow).map(slot => slot.removableAt);
    if (nextRemoval.length) amuletUnlockTimer = setTimeout(() => { if (currentView === 'amulets') loadAmulets(); }, Math.min(...nextRemoval) - amuletState.serverNow + 1000);
    const select = document.getElementById('amuletTier');
    const previous = select.value;
    select.replaceChildren();
    const gems = new Map(amuletState.catalog.map(entry => [entry.gemKey, entry.gemName]));
    for (const [key, name] of gems) { const option = amuletNode('option', name); option.value = key; select.appendChild(option); }
    if (gems.has(previous)) select.value = previous;
    renderAmulets();
    document.getElementById('amuletStatus').textContent = '';
  } catch (error) { document.getElementById('amuletStatus').textContent = error.message; }
}
function renderAmulets() {
  if (!amuletState) return;
  const slots = document.getElementById('amuletSlots');
  const owned = document.getElementById('amuletOwned');
  const shop = document.getElementById('amuletShop');
  slots.replaceChildren(); owned.replaceChildren(); shop.replaceChildren();
  for (let index = 0; index < amuletState.slotCount; index++) {
    const slot = amuletState.slots[index];
    const tile = slot ? amuletTile(slot) : amuletNode('article', undefined, 'amulet-tile amulet-empty');
    tile.prepend(amuletNode('small', `SLOT ${index + 1}`));
    if (slot) {
      const available = amuletState.isAdmin || amuletState.serverNow >= slot.removableAt;
      tile.appendChild(amuletNode('p', available ? 'Ready to remove' : `Removable ${new Date(slot.removableAt).toLocaleString()}`));
      const button = amuletNode('button', 'Remove to inventory', 'btn btn-primary');
      button.disabled = amuletPending || !available;
      button.onclick = () => amuletAction('remove', { slot: index });
      tile.appendChild(button);
    } else {
      tile.appendChild(amuletNode('h4', 'Empty slot'));
      const select = amuletNode('select');
      select.setAttribute('aria-label', `Amulet for slot ${index + 1}`);
      for (const entry of amuletState.catalog.filter(entry => amuletState.owned[entry.id] > 0)) {
        const option = amuletNode('option', `${entry.name} (${amuletState.owned[entry.id]})`); option.value = entry.id; select.appendChild(option);
      }
      const button = amuletNode('button', 'Equip for at least 5 days', 'btn btn-primary');
      button.disabled = amuletPending || !select.options.length;
      button.onclick = () => amuletAction('equip', { slot: index, amuletId: select.value });
      tile.append(select, button);
    }
    slots.appendChild(tile);
  }
  const unlock = document.getElementById('unlockAmuletSlot');
  unlock.disabled = amuletPending || amuletState.slotCount >= 5 || amuletState.balance < amuletState.slotPrices[amuletState.slotCount];
  unlock.textContent = amuletState.slotCount >= 5 ? 'All five slots unlocked' : `Unlock slot ${amuletState.slotCount + 1} - ${amuletState.slotPrices[amuletState.slotCount]} Footy`;
  for (const entry of amuletState.catalog.filter(entry => amuletState.owned[entry.id] > 0)) {
    const tile = amuletTile(entry); tile.appendChild(amuletNode('strong', `${amuletState.owned[entry.id]} in inventory`)); owned.appendChild(tile);
  }
  if (!owned.children.length) owned.textContent = 'Your unequipped amulets will appear here.';
  const key = document.getElementById('amuletTier').value;
  const entries = amuletState.catalog.filter(entry => entry.gemKey === key);
  document.getElementById('amuletWallet').textContent = `${amuletState.gems[key] || 0} ${entries[0]?.gemName || 'gems'} available / ${amuletState.balance} Footy`;
  for (const entry of entries) {
    const tile = amuletTile(entry);
    const price = Math.ceil(entry.price * (1 - (amuletState.effects.gemshop || 0) / 100));
    const button = amuletNode('button', `Buy - ${price} ${entry.gemName}`, 'btn btn-primary');
    button.disabled = amuletPending || (amuletState.gems[key] || 0) < price;
    button.onclick = () => amuletAction('buy', { amuletId: entry.id });
    tile.appendChild(button); shop.appendChild(tile);
  }
}
async function amuletAction(action, body) {
  if (amuletPending) return;
  amuletPending = true; renderAmulets();
  let message;
  try {
    await resourceRequest(`/amulets/${action}`, body);
    message = { buy: 'Amulet added to your inventory.', equip: 'Amulet equipped. Its power is now active.', remove: 'Amulet returned to your inventory.', unlock: 'New amulet slot unlocked.' }[action];
  } catch (error) { message = error.message; }
  finally {
    amuletPending = false;
    await loadAmulets(); await updateBalance();
    document.getElementById('amuletStatus').textContent = message;
  }
}
async function loadAmuletViewer() {
  const container = document.getElementById('adminAmuletViewer');
  container.textContent = 'Loading catalog...';
  try {
    const data = await resourceRequest('/amulets');
    container.replaceChildren();
    for (const entry of data.catalog) {
      const tile = amuletTile(entry);
      tile.append(amuletNode('strong', `${entry.price} ${entry.gemName}`), amuletNode('small', `${entry.tierName} / ${entry.power}`));
      container.appendChild(tile);
    }
  } catch (error) { container.textContent = error.message; }
}
async function loadGrantHub() {
  const status = document.getElementById('grantResourceStatus');
  try {
    const [response, data] = await Promise.all([fetch(`${API_URL}/users`), resourceRequest('/amulets'), loadAdminGemOptions()]);
    if (!response.ok) throw new Error('Could not load players');
    const users = await response.json();
    const select = document.getElementById('grantResourceUser');
    const previous = select.value;
    select.replaceChildren();
    for (const user of users) { const option = amuletNode('option', user.username); option.value = user.id; select.appendChild(option); }
    if (users.some(user => user.id === previous)) select.value = previous;
    const amulets = document.getElementById('grantAmuletSelect'); amulets.replaceChildren();
    for (const entry of data.catalog) { const option = amuletNode('option', entry.name); option.value = entry.id; amulets.appendChild(option); }
  } catch (error) { status.textContent = error.message; }
}
async function grantResource(kind, button) {
  if (button.disabled) return;
  const select = document.getElementById('grantResourceUser');
  const userId = select.value;
  const name = select.selectedOptions[0]?.textContent;
  const quantity = Number(document.getElementById(kind === 'footy' ? 'grantFootyQuantity' : 'grantAmuletQuantity').value);
  const status = document.getElementById('grantResourceStatus');
  button.disabled = true;
  try {
    await resourceRequest('/admin/grant-resource', { userId, kind, quantity, amuletId: document.getElementById('grantAmuletSelect').value });
    status.textContent = `Granted ${quantity} ${kind === 'footy' ? 'Footy' : 'amulets'} to ${name}.`;
    await updateBalance();
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
}
async function loadCurrencyOptions() {
  try {
    const data = await resourceRequest('/gem-converter');
    for (const id of ['itemCurrency', 'marketListingCurrency']) {
      const select = document.getElementById(id); const previous = select.value;
      select.replaceChildren();
      const footy = amuletNode('option', 'Footy'); footy.value = 'footy'; select.appendChild(footy);
      for (const gem of data.recipes) { const option = amuletNode('option', gem.gemName); option.value = gem.gemKey; select.appendChild(option); }
      if ([...select.options].some(option => option.value === previous)) select.value = previous;
    }
  } catch (error) { console.error('Could not load gem currencies', error); }
}
loadCurrencyOptions();

async function loadAmuletVipPrice() {
  try {
    const data = await resourceRequest('/amulets');
    document.getElementById('vipPrice').textContent = data.vipPrice;
    document.getElementById('vipAmuletNote').textContent = data.vipDays > 30 ? `Your amulet extends this purchase to ${data.vipDays} days.` : '';
  } catch (error) { console.error('Could not load VIP amulet price', error); }
}
