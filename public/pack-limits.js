(function () {
  const limits = { MAX_PACK_CARDS: 500 };
  if (typeof module !== 'undefined' && module.exports) module.exports = limits;
  else window.PackLimits = limits;
})();
