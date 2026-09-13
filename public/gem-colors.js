(function(root) {
  const standard = { bronze: '#ef4266', 'rare-bronze': '#ab3457', silver: '#adcdea', 'rare-silver': '#71e3d1', gold: '#ffbe35', 'rare-gold': '#28cb8d', platinum: '#4487ff', lightning: '#bb75ff', ultra: '#d2f6ff' };
  function color(key) {
    if (standard[key]) return standard[key];
    let hash = 2166136261;
    for (const char of String(key || 'unknown')) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    return `hsl(${hash % 360} ${(65 + (hash >>> 9) % 25)}% ${(48 + (hash >>> 17) % 18)}%)`;
  }
  const api = { color };
  if (typeof module !== 'undefined') module.exports = api;
  else root.GemColors = api;
})(typeof window !== 'undefined' ? window : globalThis);
