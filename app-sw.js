// Worker instalowanej aplikacji i powiadomień push.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

/* Powiadomienia systemowe dla zainstalowanej aplikacji. */
self.addEventListener('push', event => {
  let message = {};
  try {
    message = event.data?.json() || {};
  } catch {}
  const tag = typeof message.tag === 'string' ? message.tag : '';
  const text = String(message.title || '');
  const simpleTitle = tag.startsWith('comment-') || /komentarz/i.test(text) ? 'Dodano komentarz do zgłoszenia' : tag.startsWith('new-') || /nowe zgłoszenie/i.test(text) ? 'Nowe zgłoszenie' : 'Zaktualizowano zgłoszenie';
  const ticketId = typeof message.ticketId === 'string' ? message.ticketId : '';
  const url = new URL('./index.html', self.registration.scope);
  if (ticketId) url.searchParams.set('ticket', ticketId);
  event.waitUntil(self.registration.showNotification(simpleTitle, {
    body: '',
    badge: new URL('./icon-transparent-192.png', self.registration.scope).href,
    tag: typeof message.tag === 'string' ? message.tag : undefined,
    data: {
      url: url.href
    }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || new URL('./index.html', self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    const existing = windows.find(client => client.url.startsWith(self.registration.scope));
    if (existing) {
      await existing.navigate(target);
      return existing.focus();
    }
    return clients.openWindow(target);
  })());
});
