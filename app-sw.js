// Worker instalowanej aplikacji. Nie obsługuje powiadomień push.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
