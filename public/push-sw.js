/* Service Worker for Web Push Notifications — works even when the tab is closed or in the background */

// Activate immediately on install, skip waiting for old service worker
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Claim all clients so new service worker takes over immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming push events — this fires even when all tabs are closed
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    // If JSON parsing fails, try plain text
    data = { title: "AIU Market", body: event.data.text() };
  }

  const title = data.title || "AIU Market";
  const options = {
    body: data.body || "",
    icon: data.icon || "/favicon.png",
    badge: data.badge || "/favicon.png",
    tag: data.id || "aiu-notification",
    renotify: true,
    requireInteraction: false,
    data: {
      linkTo: data.linkTo || "/notifications",
      id: data.id,
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click — open the app or focus an existing tab
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const linkTo = event.notification.data?.linkTo || "/notifications";
  const urlToOpen = new URL(linkTo, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus an existing tab on the same origin
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // No existing tab — open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close (optional — for analytics or cleanup)
self.addEventListener("notificationclose", (event) => {
  // Could be used to track dismissed notifications
});

// Keep the service worker alive during push — handle fetch for offline capability
self.addEventListener("fetch", (event) => {
  // Pass through all requests — we only need this SW for push notifications
  return;
});