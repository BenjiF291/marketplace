window.CardData = (() => {
  function identifierFromImage(imageUrl) {
    if (!imageUrl) return null;
    try {
      const url = new URL(imageUrl, window.location.href);
      if (!['http:', 'https:'].includes(url.protocol) ||
          ![window.location.origin, new URL(API_URL).origin].includes(url.origin)) return null;
      const match = /^\/images\/([^/]+)$/.exec(url.pathname);
      if (!match) return null;
      const filename = decodeURIComponent(match[1]);
      return /^[^/\\]+\.(?:png|jpe?g|webp|gif)$/i.test(filename) ? filename : null;
    } catch {
      return null;
    }
  }

  async function getCardData(cardIdentifier, { signal, mode } = {}) {
    const query = new URLSearchParams({ card: cardIdentifier });
    if (mode) query.set('mode', mode);
    const response = await fetch(API_URL + '/card-data?' + query, { signal });
    if (response.status === 404) return null;
    if (!response.ok) throw Error('Card statistics could not be loaded.');
    return response.json();
  }

  return { getCardData, identifierFromImage };
})();
