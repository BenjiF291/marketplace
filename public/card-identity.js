(function (root) {
  const packageId = filename => /^[a-z0-9_-]+_([a-f0-9]{64})\.png$/.exec(filename)?.[1];
  const cardId = filename => packageId(filename) ?? filename;
  const imageExtension = /\.(?:png|jpe?g|webp|gif)$/i;

  function ownedBaseId(item) {
    if (item.packId || (item.itemType && item.itemType !== 'card')) return '';
    if (item.upgrade?.baseCardId) return cardId(item.upgrade.baseCardId);
    let filename;
    try { filename = decodeURIComponent(item.imageUrl?.split(/[?#]/, 1)[0].split(/[\/\\]/).pop() ?? ''); }
    catch { /* Fall back to the stored identity. */ }
    if (imageExtension.test(filename ?? '')) return cardId(filename);
    const id = item.upgrade?.variantId || item.cardId;
    return typeof id === 'string' ? cardId(id.replace(/~(?:epic|legendary)$/, '')) : '';
  }

  const identity = { cardId, packageId, ownedBaseId };
  if (typeof module !== 'undefined') module.exports = identity;
  else root.CardIdentity = identity;
})(typeof window === 'undefined' ? globalThis : window);
