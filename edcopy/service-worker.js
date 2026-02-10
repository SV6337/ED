// Minimal service worker to avoid 404s; no caching for now.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Ready
});

self.addEventListener('fetch', (event) => {
  // Passthrough
});