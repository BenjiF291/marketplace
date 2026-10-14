# Collectible card display cutouts

`public/card-cutouts.js` applies SVG masks to known collectible PNGs in `/images/`, including images added or changed after navigation. Masks align with `object-fit: contain`; they do not modify the source URL, image pixels, or colors. White details enclosed inside the card remain visible. Unrelated images are ignored.

Generate or refresh the masks after adding or replacing local card images:

```powershell
./scripts/generate-card-masks.ps1
```

The generator reads PNGs and writes `public/assets/card-masks/*.svg` plus `public/card-mask-files.js`. Only transparent pixels and near-white pixels (all RGB channels at least 254) connected to an outer edge are excluded. Gray and colored antialiased edges are retained. Existing transparent cards without white surrounds need no generated mask. Source hashes are included in mask URLs to refresh caches when source artwork changes.

Deploy the manifest, masks, display script, and stylesheet together. Run `node --test --test-isolation=none card-cutouts.test.js` to verify source hashes, preservation of every colored artwork pixel, and handling of dynamically displayed card images.
