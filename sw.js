const CACHE = 'meryos-v7';
const FILES = ['./', './index.html', './style.css', './cloud.js', './app.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))), clients.claim()])));
self.addEventListener('fetch', event => event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request))));
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Meryoş Tracker';
  const options = { body: data.body || 'Çalışma programını kontrol et.', icon: './icon.svg', badge: './icon.svg', data: { url: data.url || './' }, tag: data.tag || 'meryos-reminder', renotify: true };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const open = windows.find(client => client.url.includes(self.location.origin));
    return open ? open.focus() : clients.openWindow(event.notification.data?.url || './');
  }));
});
