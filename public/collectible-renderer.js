/* Card Creator text drawing, adapted to consume Marketplace card data. */
(() => {
function textFont(size, family = "Calibri, 'Segoe UI', sans-serif", weight = "bold") {
  return weight + " " + size + "px " + family;
}

function drawText(ctx, text, { x, baseline, size, maxWidth = Infinity, effects, align = "center",
  family, weight, letterSpacing = 0, highlight }) {
  ctx.font = textFont(size, family, weight);
  ctx.letterSpacing = letterSpacing + "px";
  const measured = ctx.measureText(text).width;
  if (measured > maxWidth) {
    const scale = maxWidth / measured;
    ctx.font = textFont(size * scale, family, weight);
    ctx.letterSpacing = letterSpacing * scale + "px";
  }
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";

  if (highlight && text.trim()) {
    const { color, padding = 0, above, below, offsetX = 0, offsetY = 0, opacity = 1 } = highlight;
    const width = ctx.measureText(text).width;
    const left = align === "center" ? x - width / 2 : x;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillRect(left - padding + offsetX, baseline - above + offsetY, width + 2 * padding, above + below);
    ctx.restore();
  }

  const { fill, outline, outlineWidth, shadow, gradient } = effects;
  if (shadow) {
    const [color, offsetX, offsetY, blur] = shadow;
    ctx.fillStyle = color;
    if (blur) ctx.filter = "blur(" + blur * ctx.getTransform().a + "px)";
    ctx.fillText(text, x + offsetX, baseline + offsetY);
    if (blur) ctx.filter = "none";
  }
  if (outline) {
    // Build the outline with the same antialiased glyphs as the face.
    const radius = outlineWidth / 2;
    ctx.fillStyle = outline;
    for (let step = 0; step < 8; step++) {
      const angle = step * Math.PI / 4;
      ctx.fillText(text, x + radius * Math.cos(angle), baseline + radius * Math.sin(angle));
    }
  }
  ctx.fillStyle = fill;
  if (gradient) {
    const face = ctx.createLinearGradient(0, baseline - size * .7, 0, baseline);
    face.addColorStop(0, gradient[0]);
    face.addColorStop(.5, fill);
    face.addColorStop(1, gradient[1]);
    ctx.fillStyle = face;
  }
  ctx.fillText(text, x, baseline);
}

const records = new Map();
const artwork = new Map();
function loadBackground(id) {
  if (!artwork.has(id)) {
    const image = new Image();
    image.src = 'assets/ben-bal/' + id;
    artwork.set(id, image.decode().then(() => image).catch(error => {
      artwork.delete(id);
      throw error;
    }));
  }
  return artwork.get(id);
}

async function render(image, upgrade, suppliedCard) {
  const id = window.CardData?.identifierFromImage(image.src);
  if (!id && !suppliedCard) return null;
  if (!suppliedCard && !records.has(id)) {
    records.set(id, window.CardData.getCardData(id).catch(error => {
      records.delete(id);
      throw error;
    }));
  }
  const card = suppliedCard ?? await records.get(id);
  const templateId = card?.collectible?.templateId;
  const template = window.CollectibleCardLayouts[templateId];
  if (!template) return null;
  const background = await loadBackground(templateId);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(image.naturalWidth, 880);
  canvas.height = Math.round(canvas.width * image.naturalHeight / image.naturalWidth);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(canvas.width / template.width, 0, 0, canvas.height / template.height, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  const { left = 0, top = 0, right = 0, bottom = 0 } = template.backgroundCrop || {};
  ctx.save();
  if (template.flipBackground) {
    ctx.translate(template.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(background, left * background.naturalWidth, top * background.naturalHeight,
    (1 - left - right) * background.naturalWidth, (1 - top - bottom) * background.naturalHeight,
    0, 0, template.width, template.height);
  ctx.restore();

  const stats = upgrade.effectiveStats;
  const overall = upgrade.currentOverall ?? window.BenBalCard.upgradedOverall(
    upgrade.baseOverall ?? card.overall, upgrade.baseStats ?? card.stats, stats);
  drawText(ctx, card.name, template.name);
  drawText(ctx, String(overall), template.rating);
  const layout = template.stats;
  if (layout.rows) {
    layout.rows.forEach((row, index) => drawText(ctx, row.replace(/\{(\w+)\}/g, (_, key) => stats[key]), {
      ...layout, baseline: layout.baseline + index * layout.lineHeight
    }));
  } else {
    window.BenBalCard.statKeys.forEach((key, index) => {
      const label = key[0].toUpperCase() + key.slice(1);
      drawText(ctx, label + ': ' + stats[key], { ...layout, x: index % 2 ? layout.right : layout.left,
        baseline: layout.baseline + Math.floor(index / 2) * layout.lineHeight });
    });
  }
  const accessible = [
    image.alt || card.name, 'Overall ' + overall,
    ...window.BenBalCard.statKeys.map(key => key.toUpperCase() + ' ' + stats[key])
  ].join(', ');
  return { canvas, accessible };
}

window.CollectibleCardRenderer = { render };
})();
