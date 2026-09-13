let dyeSession = null;
let dyeSaving = false;
let dyeHover = null;
const dyeTargets = [
  ['#gemStatus, #amuletStatus, #gemWorkshopStatus, #spinResult', 'notices'],
  ['.amulet-empty', 'slots'], ['.gem-machine', 'machine'], ['.balance-display', 'balance'],
  ['.input-field', 'inputs'], ['.btn-primary', 'buttons'], ['.btn-success', 'success'],
  ['.gem-converter', 'converter'], ['#amuletSection', 'amulets'], ['.tab-group', 'navigation'],
  ['.header', 'header'], ['.main-grid > section.card', 'panels']
];
function dyeChanges() {
  const changes = {};
  for (const area of Object.keys(dyeSession.data.areas)) {
    if ((dyeSession.preview[area] || '') !== (dyeSession.original[area] || '')) changes[area] = dyeSession.preview[area] || '';
  }
  return changes;
}
function dyeCosts(changes) {
  const costs = {};
  for (const key of Object.values(changes)) if (key) costs[key] = (costs[key] || 0) + 1;
  return costs;
}
async function toggleDyeMode() {
  if (dyeSaving) return;
  if (dyeSession) return confirmDyeMode();
  const button = document.getElementById('dyeModeButton');
  button.disabled = true;
  try {
    const data = await resourceRequest('/gem-workshop');
    dyeSession = { data, original: { ...data.theme }, preview: { ...data.theme }, selected: data.tiers.find(gem => data.dyes[gem.gemKey] > 0)?.gemKey || '' };
    document.body.classList.add('dye-mode');
    document.getElementById('dyeTray').hidden = false;
    document.getElementById('cancelDyeButton').hidden = false;
    button.textContent = 'Confirm';
    renderDyeTray();
  } catch (error) { alert(error.message); }
  finally { button.disabled = false; }
}
function selectDyeColor(key) {
  if (!dyeSession || dyeSaving) return;
  dyeSession.selected = key; renderDyeTray();
}
function renderDyeTray(note = '') {
  if (!dyeSession) return;
  const costs = dyeCosts(dyeChanges());
  const container = document.getElementById('dyeTrayColors'); container.replaceChildren();
  for (const gem of dyeSession.data.tiers.filter(gem => dyeSession.data.dyes[gem.gemKey] > 0)) {
    const button = amuletNode('button', undefined, 'dye-swatch');
    button.setAttribute('aria-pressed', String(dyeSession.selected === gem.gemKey));
    button.append(gemIcon(gem.gemKey), amuletNode('span', `${gem.gemName}: ${dyeSession.data.dyes[gem.gemKey] - (costs[gem.gemKey] || 0)} left`));
    button.disabled = dyeSaving;
    button.onclick = () => selectDyeColor(gem.gemKey); container.appendChild(button);
  }
  if (!container.children.length) container.textContent = 'No dyes yet. Craft them in My Inventory > Gem Workshop.';
  const total = Object.values(costs).reduce((a, b) => a + b, 0);
  const selected = dyeSession.data.tiers.find(gem => gem.gemKey === dyeSession.selected)?.gemName || 'Eraser';
  document.getElementById('dyeModeStatus').textContent = `${selected} selected. ${Object.keys(dyeChanges()).length} changed areas / ${total} dyes on confirm. ${note}`;
}
function previewDyeArea(area) {
  if (!dyeSession || dyeSaving) return;
  const previous = { ...dyeSession.preview };
  if (dyeSession.selected) dyeSession.preview[area] = dyeSession.selected; else delete dyeSession.preview[area];
  const costs = dyeCosts(dyeChanges());
  if (Object.entries(costs).some(([key, count]) => count > (dyeSession.data.dyes[key] || 0))) {
    dyeSession.preview = previous; renderDyeTray('Not enough dye for another area. Recolor or erase an existing preview.'); return;
  }
  applyGemTheme(dyeSession.preview);
  renderDyeTray(`Previewing ${dyeSession.data.areas[area]}.`);
}
function resetDyePreview() {
  if (!dyeSession || dyeSaving) return;
  dyeSession.preview = {}; applyGemTheme({}); renderDyeTray('Reset previewed; confirm to save or cancel to restore.');
}
function closeDyeMode() {
  dyeSession = null;
  document.body.classList.remove('dye-mode');
  document.getElementById('dyeTray').hidden = true;
  document.getElementById('cancelDyeButton').hidden = true;
  document.getElementById('dyeModeButton').textContent = 'Dye';
  if (dyeHover) dyeHover.classList.remove('dye-hover');
}
function cancelDyeMode() {
  if (!dyeSession || dyeSaving) return;
  applyGemTheme(dyeSession.original); closeDyeMode();
}
async function confirmDyeMode() {
  dyeSaving = true;
  document.getElementById('dyeModeButton').disabled = true;
  document.getElementById('cancelDyeButton').disabled = true;
  renderDyeTray('Saving...');
  try {
    await resourceRequest('/gem-workshop/confirm-dyes', { changes: dyeChanges(), originalTheme: dyeSession.original });
    applyGemTheme(dyeSession.preview);
    closeDyeMode();
    await loadGemWorkshop();
  } catch (error) { renderDyeTray(error.message + ' Your preview is still open.'); }
  finally {
    dyeSaving = false;
    document.getElementById('dyeModeButton').disabled = false;
    document.getElementById('cancelDyeButton').disabled = false;
    if (dyeSession) renderDyeTray(document.getElementById('dyeModeStatus').textContent);
  }
}
function findDyeTarget(target) {
  if (target.closest('#dyeTray, #dyeHeaderControls, .tab-button, summary')) return null;
  if (target.closest('.battle-card-display, .item-image, .opening-pack, .pack-inventory-icon, .gem-icon, .battle-card, .battle-cell, .opened-card-image')) return null;
  for (const [selector, area] of dyeTargets) {
    const node = target.closest(selector);
    if (node) {
      if (area === 'panels') {
        const rect = node.getBoundingClientRect();
        // Panel interiors dye the panel; the visible border is separately paintable.
        return { node, area, rect };
      }
      return { node, area };
    }
  }
  return target === document.body || target.classList.contains('container') || target.classList.contains('main-grid') ? { node: document.body, area: 'background' } : null;
}
document.addEventListener('click', event => {
  if (!dyeSession || event.target.closest('#dyeTray, #dyeHeaderControls, .tab-button, summary')) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (dyeSaving) return;
  const target = findDyeTarget(event.target);
  if (!target) return;
  const r = target.rect;
  const border = r && (event.clientX - r.left < 8 || r.right - event.clientX < 8 || event.clientY - r.top < 8 || r.bottom - event.clientY < 8);
  previewDyeArea(border ? 'borders' : target.area);
}, true);
document.addEventListener('pointermove', event => {
  if (dyeHover) dyeHover.classList.remove('dye-hover');
  if (!dyeSession || dyeSaving) return;
  const target = findDyeTarget(event.target);
  dyeHover = target?.node;
  if (dyeHover && dyeHover !== document.body) dyeHover.classList.add('dye-hover');
});
