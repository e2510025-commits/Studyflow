const CACHE_NAME = "studyflow-pwa-v2";
const PUBLIC_ASSETS = ["/manifest.webmanifest", "/logo.png", "/favicon.png"];
const OFFLINE_PAGE = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>StudyFlow — オフライン</title><body style="font:16px/1.8 system-ui,sans-serif;padding:32px;max-width:560px;margin:auto;color:#202124;background:#fafafa"><h1>接続を確認してください</h1><p>現在、StudyFlowに接続できません。通信が戻ったらページを再読み込みしてください。</p><button onclick="location.reload()" style="min-height:44px;padding:10px 20px;font:inherit">再読み込み</button></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PUBLIC_ASSETS))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("studyflow-pwa-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => new Response(OFFLINE_PAGE, {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      }))
    );
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Cache only public, versioned assets. Never cache auth/API responses,
  // personalized pages, or Next.js navigation/prefetch payloads.
  if (!url.pathname.startsWith("/_next/static/") && !PUBLIC_ASSETS.includes(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => undefined);
          return response;
        })
        .catch(() => undefined);
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = (event.notification && event.notification.data && event.notification.data.url) || "/announcements";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
        return undefined;
      })
  );
});
