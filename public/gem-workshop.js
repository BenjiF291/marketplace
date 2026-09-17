let workshopState = null;
let workshopBusy = false;
async function loadGemWorkshop() {
  try {
    workshopState = await resourceRequest('/gem-workshop');
    if (!document.body.classList.contains('dye-mode')) applyGemTheme(workshopState.theme);
    renderGemWorkshop();
  } catch (error) { document.getElementById('gemWorkshopStatus').textContent = error.message; }
}
function workshopOptions(id, choices) {
  const select = document.getElementById(id); const previous = select.value;
  select.replaceChildren();
  for (const [value, text] of choices) { const option = amuletNode('option', text); option.value = value; select.appendChild(option); }
  if (choices.some(([value]) => value === previous)) select.value = previous;
}
function renderGemWorkshop() {
  const data = workshopState;
  const craft = document.getElementById('craftCompressor');
  craft.textContent = data.compressor ? 'Compressor crafted' : 'Craft compressor';
  craft.disabled = workshopBusy || data.compressor || (data.gems['rare-silver'] || 0) < 10 || (data.gems.gold || 0) < 5 || (data.gems['rare-gold'] || 0) < 2;
  workshopOptions('compressGem', data.tiers.slice(0, -1).filter(gem => data.gems[gem.gemKey] > 0).map(gem => [gem.gemKey, `${gem.gemName} (${data.gems[gem.gemKey]})`]));
  const palette = document.getElementById('gemDyePalette'); palette.replaceChildren();
  for (const gem of data.tiers.filter(gem => data.gems[gem.gemKey] > 0 || (data.dyes[gem.gemKey] || 0) > 0)) {
    const tile = amuletNode('div', undefined, 'gem-balance-tile');

    tile.append(gemIcon(gem.gemKey), amuletNode('strong', gem.gemName), amuletNode('small', `${data.gems[gem.gemKey] || 0} gems / ${data.dyes[gem.gemKey] || 0} dyes`));
    const button = amuletNode('button', `Craft ${workshopState.dyeYield||5} dyes - 1 gem`, 'btn btn-primary');
    button.disabled = workshopBusy || !(data.gems[gem.gemKey] >= 1);
    button.onclick = () => workshopAction('craft-dye', { gemKey: gem.gemKey });
    tile.appendChild(button); palette.appendChild(tile);
  }
  if (!palette.children.length) palette.textContent = 'Collect gems to craft dyes.';
  updateCompressionQuote();
}
function maxCompression() {
  document.getElementById('compressQuantity').value = Math.floor((workshopState?.gems[document.getElementById('compressGem').value] || 0) / 4);
  updateCompressionQuote();
}
function updateCompressionQuote() {
  if (!workshopState) return;
  const key = document.getElementById('compressGem').value;
  const index = workshopState.tiers.findIndex(gem => gem.gemKey === key);
  const next = index >= 0 ? workshopState.tiers[index + 1] : null;
  const count = Number(document.getElementById('compressQuantity').value);
  const valid = Number.isSafeInteger(count) && count > 0 && Number.isSafeInteger(count * 4);
  document.getElementById('compressionQuote').textContent = next && valid ? `${count * 4} ${workshopState.tiers[index].gemName} ? ${count} ${next.gemName}` : 'Choose a source gem and positive whole output quantity.';
  document.getElementById('compressGems').disabled = workshopBusy || !workshopState.compressor || !next || !valid || (workshopState.gems[key] || 0) < count * 4;
}
async function workshopAction(action, body) {
  if (workshopBusy || !workshopState) return;
  workshopBusy = true; renderGemWorkshop();
  let message;
  try {
    await resourceRequest(`/gem-workshop/${action}`, body);
    message = { craft: 'Gem compressor crafted!', compress: 'Gems compressed!', 'craft-dye': 'Dyes crafted for 1 gem, including equipped amulet bonuses.', dye: 'Interface colors saved.' }[action];
  } catch (error) { message = error.message; }
  finally {
    workshopBusy = false;
    await loadGemWorkshop();
    if (document.getElementById('gemConverter').open) await loadGemConverter();
    document.getElementById('gemWorkshopStatus').textContent = message;
  }
}
function applyGemTheme(theme) {
  // Only these explicit interface variables are styled; artwork never inherits them.
  const areas = ['background', 'header', 'panels', 'navigation', 'buttons', 'success', 'borders', 'inputs', 'balance', 'converter', 'machine', 'amulets', 'slots', 'notices'];
  for (const area of areas) {
    if (theme[area]) {
      document.body.setAttribute(`data-dye-${area}`, '');
      document.body.style.setProperty(`--dye-${area}`, GemColors.color(theme[area]));
    } else {
      document.body.removeAttribute(`data-dye-${area}`);
      document.body.style.removeProperty(`--dye-${area}`);
    }
  }
}
loadGemWorkshop();
