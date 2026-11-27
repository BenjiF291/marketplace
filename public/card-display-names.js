(function (root) {
  const filenames = new Map();
  const rarities = new Map();
  const imageExtension = /\.(?:png|jpe?g|webp|gif)$/i;
  const identifier = /(?:[\da-f]{20,}|[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})(?:\.{3}|…)?$/i;
  const tier = /^(?:zz\d+[ _-]+)?(?:rare[ _-]+(?:bronze|silver|gold)|low(?:[ _-]+pointers)?|bronze|silver|gold|platinum|lightning|lightling|ultra|super|fighter|mirror|mini|genius|genious|motm)[ _-]+/i;
  const particles = new Set(['van', 'der', 'den', 'de', 'ten', 'ter', 'von', 'del', 'da', 'di']);
  let pending;

  function key(value) {
    const leaf = String(value ?? '').trim().split(/[?#]/, 1)[0].split(/[/\\]/).pop();
    try { return decodeURIComponent(leaf ?? ''); } catch { return leaf ?? ''; }
  }

  function fallback(reference) {
    const stem = key(reference).replace(/^Card\s+(?=\S)/i, '').replace(imageExtension, '');
    const clean = stem.replace(new RegExp('(?:^|[_\\s-])' + identifier.source, 'i'), '').replace(tier, '');
    if (!/[\p{L}]/u.test(clean) || identifier.test(clean)) return 'Collection card';
    return clean.split(/[_\s-]+/).filter(Boolean).map((word, index) =>
      index && particles.has(word.toLowerCase()) ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  function name(reference, supplied) {
    const ref = key(reference);
    const metadata = filenames.get(ref) ?? filenames.get(ref.replace(imageExtension, ''));
    if (metadata) return metadata;
    const label = typeof supplied === 'string' ? supplied.trim() : '';
    const plain = label.replace(/^Card\s+/i, '');
    const normalize = value => value.replace(imageExtension, '').replace(/[_\s-]+/g, ' ').toLowerCase();
    const looksInternal = imageExtension.test(label) || /[/\\]/.test(label) || identifier.test(label) ||
      (ref && normalize(plain) === normalize(ref) && (tier.test(ref) || /^Card\s/i.test(label)));
    if (label && !looksInternal) return label;
    return fallback(ref && !identifier.test(ref.replace(imageExtension, '')) ? ref : label || ref);
  }

  function item(entry) {
    const image = entry?.imageUrl;
    const ref = typeof image === 'string' && /(?:^|\/)images\//i.test(image) ? image : entry?.cardId;
    const legacyCard = ref || imageExtension.test(entry?.name ?? '') || /^Card\s/i.test(entry?.name ?? '') && identifier.test(entry.name);
    return entry?.itemType === 'card' || (!entry?.packId && !entry?.itemType && legacyCard)
      ? name(ref, entry.name)
      : entry?.name;
  }

  function load() {
    if (typeof API_URL === 'undefined') return Promise.resolve();
    pending ??= fetch(API_URL + '/card-display-names', { signal: AbortSignal.timeout(4000) }).then(async response => {
      if (!response.ok) throw Error('Card names unavailable.');
      for (const entry of await response.json()) {
        if (entry.tier) rarities.set(entry.filename, entry.tier);
        if (!entry.name || imageExtension.test(entry.name) || identifier.test(entry.name) || /[/\\]/.test(entry.name)) continue;
        filenames.set(entry.filename, entry.name);
        filenames.set(entry.filename.replace(imageExtension, ''), entry.name);
        filenames.set(entry.id, entry.name);
      }
    }).catch(() => { pending = undefined; });
    return pending;
  }

  const api = { name, item, load, rarity: reference => rarities.get(key(reference)) };
  if (typeof module !== 'undefined') module.exports = api;
  else root.CardDisplayNames = api;
})(typeof window === 'undefined' ? globalThis : window);
