function validateBattleCard(card) {
  if (!card || typeof card !== 'object') {
    return { valid: false, error: 'Card data is required' };
  }

  const cleanName = typeof card.name === 'string' ? card.name.trim() : '';
  const averageScore = Number(card.averageScore);
  const sides = {
    top: Number(card.top),
    right: Number(card.right),
    bottom: Number(card.bottom),
    left: Number(card.left)
  };

  const linkedCardImage = typeof card.linkedCardImage === 'string' ? card.linkedCardImage.trim() : '';

  if (!cleanName) {
    return { valid: false, error: 'Card name is required' };
  }

  if (!Number.isFinite(averageScore) || averageScore < 0) {
    return { valid: false, error: 'Average score must be a non-negative number' };
  }

  for (const sideName of ['top', 'right', 'bottom', 'left']) {
    if (!Number.isFinite(sides[sideName]) || sides[sideName] < 0 || sides[sideName] > 10) {
      return { valid: false, error: `${sideName} attack value must be between 0 and 10` };
    }
  }

  if (!linkedCardImage) {
    return { valid: false, error: 'Select a normal card to link this battle card to' };
  }

  return {
    valid: true,
    normalized: {
      name: cleanName,
      averageScore,
      top: Math.trunc(sides.top),
      right: Math.trunc(sides.right),
      bottom: Math.trunc(sides.bottom),
      left: Math.trunc(sides.left),
      linkedCardImage
    }
  };
}

module.exports = {
  validateBattleCard
};
