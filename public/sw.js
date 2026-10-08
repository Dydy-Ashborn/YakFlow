// YAKFLOW_SW_OFF_V1 : l'ancien service worker renvoyait la page du studio quand un téléchargement de clip échouait
// (des « clips » de 265 Ko qui ne se lisent pas). Celui-ci ne fait plus rien : il vide ses caches et se désinstalle.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url).catch(() => {});
})()));
