self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const title = data.title || "AIU Market";
    const options = {
      body: data.body || "",
      icon: data.icon || "/favicon.png",
      badge: data.badge || "/favicon.png",
      data: {
        linkTo: data.linkTo || "/notifications",
      },
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    console.error("Push notification error:", error);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const linkTo = event.notification.data?.linkTo || "/notifications";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(linkTo);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(linkTo);
      }
    })
  );
});