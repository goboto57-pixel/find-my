// Minimal service worker whose only job is to show a notification when a
// web push event arrives, and focus/open the app when it's clicked. It
// deliberately does NOT do any asset caching / offline support -- that's a
// separate concern (see feature #18, offline map tiles) and mixing the two
// makes both harder to reason about and debug.

self.addEventListener('push', (event) => {
  const eventName = event.data ? event.data.text() : 'update';

  const title = eventName === 'sos' ? '🆘 FMD Server' : 'FMD Server';
  const body =
    eventName === 'sos'
      ? 'SOS triggered on this device'
      : eventName === 'geofence'
        ? 'Geofence event'
        : eventName === 'location'
          ? 'New location received'
          : eventName === 'picture'
            ? 'New photo received'
            : 'Device data updated';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: './icon.svg',
      tag: eventName === 'sos' ? undefined : 'fmd-update', // never collapse SOS notifications
      requireInteraction: eventName === 'sos',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
