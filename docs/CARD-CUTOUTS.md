# Collectible card display cutouts

`public/card-cutouts.js` applies SVG masks to known collectible PNGs in `/images/`, including images added or changed after navigation. Masks align with `object-fit: contain`; they do not modify the source URL, image pixels, or colors. White details enclosed inside the card remain visible. Unrelated images are ignored.

Generate or refresh the masks after adding or replacing local card images:

```powershell
./scripts/generate-card-masks.ps1
```

The generator reads PNGs and writes `public/assets/card-masks/*.svg` plus `public/card-mask-files.js`. Outside-connected transparent and neutral off-white pixels are separated from the artwork. A small silhouette cleanup removes isolated matte debris and one-pixel connections to border noise; the main card is then traced as a continuous outline, avoiding scanline seams. Interior colors and white lettering stay in the original image. Existing transparent cards without white surrounds need no generated mask. The manifest stores both source and generated-mask hashes. Mask URLs use the mask hash, so a regenerated outline refreshes browser caches even when its source PNG has not changed.

Deploy the manifest, masks, display script, and stylesheet together. Run `node --test --test-isolation=none card-cutouts.test.js` to verify source hashes, preservation of the central artwork and protected interior pixels, and handling of dynamically displayed card images.
