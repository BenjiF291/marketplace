const express = require('express');
module.exports = function configureHttp(app, publicDirectory) {
app.use(require('compression')({ threshold: 1024 }));
app.use(express.json());
app.use(express.static(publicDirectory, {
  etag: true,
  setHeaders(res, file) {
    // Code and HTML revalidate on deployment; heavy assets can be reused for an hour.
    if (/\.webmanifest$/i.test(file)) res.setHeader('Content-Type', 'application/manifest+json');
    const asset = /\.(?:glb|gltf|bin|png|jpe?g|webp|avif|svg|woff2?)$/i.test(file);
    res.setHeader('Cache-Control', asset ? 'public, max-age=3600' : 'public, max-age=0, must-revalidate');
  }
}));
// Player responses must never enter a shared CDN/browser cache.
app.use((req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
};
