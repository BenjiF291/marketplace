/* Card Creator collectible layouts, shared with the Marketplace canvas renderer. */
(() => {
const textEffects = {
  ultraRating: { fill: "#262626", outline: "#fff", outlineWidth: 6731 / 12700, shadow: ["#5b9bd5", 2.12, 2.12] },
  blueRating: { fill: "#4472c4", shadow: ["rgba(110, 116, 122, .57)", 0, 2, 3] },
  peachRating: { fill: "#f7caac", outline: "#ed7d31", outlineWidth: 11112 / 12700 },
  goldRating: { fill: "#ffc000", gradient: ["#ffe378", "#ca8e17"], shadow: ["#805a0f", 0, .9] },
  specialSilver: { fill: "#a5a5a5", gradient: ["#c4c4c4", "#747474"], shadow: ["#686868", .95, 1] },
  specialGold: { fill: "#ffc000", gradient: ["#ffe15b", "#c89a00"], shadow: ["#a7771b", .8, 1] },
  silverBevel: { fill: "#a5a5a5", gradient: ["#d2d2d2", "#858585"], shadow: ["#383838", 0, .9] }
};

const textDefaults = { name: textEffects.goldRating, stats: textEffects.silverBevel };
const portraitEffects = { border: ["#656565", "#333", "#171717"], borderWidth: 5, shadow: true };
const wordTypeface = "Calibri, 'Segoe UI', sans-serif";

const compactStatRows = [
  "Pow: {pow}  Ama: {ama}", "Size: {size}  Rang: {rang}", "Loy: {loy} Acu: {acu}"
];

const artworkLayouts = {
  // Normal layouts calibrated to the owner's reference pictures.
  // Rating [left, baseline, size], name [centre, baseline, width, highlight].
  // Stats [centre, first baseline, width, highlight], or [left centre, right centre, baseline, width].
  "image19.png": referenceLayout([202.5, 287.25], [18, 65.5, 26, "peachRating"],
    [103, 159, 158, "#800080"], [104.5, 204, 151, "#800080"],
    [64, 73, 76, 68], { noPictureDefault: true }),
  "image12.png": referenceLayout([229.4888, 320.915], [28.5, 74, 26, "peachRating"],
    [118.5, 168.5, 155, "#800080"], [118, 208, 160, "#800080"],
    [78, 85, 75, 68], { noPictureDefault: true, flipBackground: true }),
  "image20.png": referenceLayout([213.1, 321.8], [29, 85.5, 26, "peachRating"],
    [106.5, 188.5, 155, "#00ffff"], [107.5, 211.5, 151, "#d3d3d3"],
    [70, 86, 75, 75], { noPictureDefault: true }),
  "image22.jpeg": referenceLayout([174.5, 261.75], [9.5, 62, 26, "peachRating"],
    [105, 143.5, 125, "#00ffff"], [104, 176, 127, "#d3d3d3"],
    [58, 62, 65, 54], { noPictureDefault: true }),
  "image18.jpeg": referenceLayout([192, 291.3], [10, 76, 26, "peachRating"],
    [92, 177, 152, "#ffff00"], [92, 204, 151],
    [62, 71, 67, 62], { noPictureDefault: true }),
  "image17.png": referenceLayout([210.9, 320.25], [12.5, 71, 26, "peachRating"],
    [120.5, 207, 143, "#ffff00"], [82, 158, 238.5, 72],
    [61, 78, 75, 76], { noPictureDefault: true }),
  "image7.png": referenceLayout([245.25, 342.8438], [38, 78, 22, "blueRating"],
    [129, 207, 165], [69, 177, 231, 94],
    [94, 47, 77, 136], { portraitAsset: "image10.jpeg" }),
  "image1.png": referenceLayout([250.5, 316.95], [22.5, 84, 22, "ultraRating"],
    [128, 186.5, 160, "#0000ff"], [69, 181, 213, 96],
    [81, 54, 104, 108], { portraitAsset: "image11.jpeg", photoTurn: Math.PI / 2,
      photoCrop: { left: .19964, top: .214, right: .45079, bottom: .33774 } }),
  "image2.png": {
    width: 3190875 / 12700,
    height: 4505960 / 12700,
    frame: { x: 1021715 / 12700, y: 931545 / 12700, width: 1300480 / 12700, height: 1267460 / 12700 },
    rotation: 3153889 / 60000 * Math.PI / 180,
    crop: { top: .24837, right: .06568, bottom: .23965 },
    portraitEffects,
    rating: { x: 46.875, baseline: 89, size: 22, maxWidth: 80, effects: textEffects.ultraRating },
    name: { x: 124.7, baseline: 220, size: 18, maxWidth: 128, effects: textDefaults.name },
    stats: { left: 75, right: 184, baseline: 247, lineHeight: 19.5, size: 16, maxWidth: 98, effects: textDefaults.stats }
  },
  "image13.jpeg": referenceLayout([261, 364.4659], [45, 86.5, 22, "ultraRating"],
    [127.5, 207.5, 173, "#008000"], [132, 237.5, 159],
    [108, 75.5, 86, 114], { portraitAsset: "image16.jpeg", photoTurn: -Math.PI / 2 }),
  // Special layouts calibrated to the reference artwork and original Word photo crops.
  "image25.jpeg": referenceLayout([229.2, 343.85], [38, 95, 36, "specialSilver"],
    [114.5, 201, 161], [75.5, 159, 226.5, 77],
    [80.5, 79, 90.75, 104.95], { portraitAsset: "image24.jpg",
      photoCrop: { left: .32834, top: .19436, right: .25332, bottom: .53351 },
      statPlaceholders: { size: "--" } }),
  "image28.jpeg": referenceLayout([216, 324], [37.5, 88, 36, "specialSilver"],
    [111, 184.5, 179], [67, 156, 211, 79],
    [88, 57, 66.45, 99.05], { portraitAsset: "image30.jpeg", photoTurn: Math.PI / 2,
      photoCrop: { left: .2857, top: .48225, right: .40203, bottom: .23852 },
      statPlaceholders: { ama: "--", rang: "--", loy: "--" } }),
  "image31.jpeg": referenceLayout([193.5, 318.15], [14, 79, 36, "specialSilver"],
    [92.5, 163, 165], [51, 131, 199, 76],
    [69.5, 42, 84, 99], { portraitAsset: "image32.jpg",
      photoCrop: { left: .28427, top: .24675, right: .32265, bottom: .49269 },
      backgroundCrop: { left: .34177, right: .34388 } }),
  "image34.jpeg": referenceLayout([235.5, 328.8], [33.5, 86.5, 36, "specialSilver"],
    [120, 206, 177], [72, 165.5, 228, 86],
    [82.5, 60.5, 104.4, 115.75], { portraitAsset: "image35.jpeg", photoTurn: Math.PI / 2,
      photoCrop: { left: .27832, top: .28131, right: .35922, bottom: .28256 } }),
  "image37.png": referenceLayout([192.75, 279.75], [13, 67, 36, "specialSilver"],
    [113.7, 149, 129, "#0000ff"], [79.5, 140, 186, 66],
    [68, 29.5, 70.4, 92.5], { portraitAsset: "image39.jpeg", photoTurn: Math.PI / 2,
      photoCrop: { left: .23348, top: .30115, right: .40936, bottom: .33649 },
      backgroundCrop: { top: .03907, bottom: .05029 } }),
  "image40.png": referenceLayout([199.75, 294.2], [33.5, 61, 36, "specialGold"],
    [100, 177, 161], [70.5, 130.5, 204.5, 57],
    [61.5, 57, 108.3, 85.3], { portraitAsset: "image42.jpeg",
      photoCrop: { left: .12966, top: .18374, right: .1396, bottom: .24397 } })
};

function wordTextBox([x, baseline, size, maxWidth, align, effect]) {
  return { x, baseline, size, maxWidth, align, family: wordTypeface, effects: textEffects[effect] };
}

function referenceLayout([width, height], [x, baseline, size, effect],
  [nameX, nameBaseline, nameWidth, nameColor], stats, [photoX, photoY, photoWidth, photoHeight], options) {
  // Column layouts supply a numeric fourth value. Compact layouts supply a highlight or omit it.
  const columns = typeof stats[3] === "number";
  const [first, second, third, fourth] = stats;
  const statGeometry = columns
    ? { left: first, right: second, baseline: third, maxWidth: fourth }
    : { x: first, baseline: second, maxWidth: third, rows: compactStatRows,
        align: "center", highlight: fourth && { color: fourth, padding: .6, above: 15.5, below: 4.5 } };
  return {
    width, height, ...options,
    rating: { ...wordTextBox([x, baseline, size, 80, "left", effect]),
      weight: size >= 26 ? "normal" : "bold",
      effects: effect === "peachRating"
        ? { ...textEffects.peachRating, outline: "#ff701a", outlineWidth: 1.35 } : textEffects[effect] },
    name: { ...wordTextBox([nameX, nameBaseline, 18, nameWidth, "center", "goldRating"]),
      weight: "normal", letterSpacing: .45,
      effects: { ...textDefaults.name, shadow: ["#805a0f", 0, .45] },
      highlight: nameColor && { color: nameColor, padding: .6, above: 17.5, below: 5.5 } },
    stats: { ...statGeometry, family: wordTypeface, size: 16, weight: "normal", letterSpacing: .15,
      effects: { ...textDefaults.stats, shadow: ["#383838", 0, .55] }, lineHeight: 19.7 },
    frame: { x: photoX, y: photoY, width: photoWidth, height: photoHeight },
    portraitEffects
  };
}
window.CollectibleCardLayouts = artworkLayouts;
})();
