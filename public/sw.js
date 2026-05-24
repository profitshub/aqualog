self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "AquaLog", {
      body:  data.body  ?? "Time to submit your readings.",
      icon:  "/icon-192.png",
      badge: "/icon-192.png",
      tag:   "aqualog-reminder",
      renotify: true,
      data: { url: data.url ?? "/log" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/log";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      return clients.openWindow(target);
    })
  );
});
