self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Agente WhatsApp", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Agente WhatsApp", {
      body: payload.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "escalacion",
      renotify: true,
      data: { url: payload.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        const existing = list.find((c) => c.url.includes(url) && "focus" in c);
        if (existing) return existing.focus();
        return clients.openWindow(url);
      })
  );
});
