const CACHE_VERSION = "termomanager-pwa-v2";
const PRECACHE_URLS = [
    "./",
    "./index.html",
    "./manifest.json",
    "./icons/icon.png",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "https://unpkg.com/dexie@latest/dist/dexie.js",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2",
];

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(function (cache) {
            return Promise.allSettled(
                PRECACHE_URLS.map(function (url) {
                    const request = new Request(url, {
                        mode: url.indexOf("http") === 0 ? "cors" : "same-origin",
                        cache: "reload",
                    });
                    return fetch(request).then(function (response) {
                        if (!response || (response.status !== 0 && !response.ok)) {
                            throw new Error("Precache fallito: " + url);
                        }
                        return cache.put(url, response);
                    });
                })
            );
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys
                    .filter(function (key) { return key !== CACHE_VERSION; })
                    .map(function (key) { return caches.delete(key); })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

async function networkFirst(request) {
    const url = new URL(request.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return fetch(request);
    }
    const cache = await caches.open(CACHE_VERSION);
    try {
        const networkResponse = await fetch(request);
        if (networkResponse && (networkResponse.ok || networkResponse.status === 0)) {
            cache.put(request, networkResponse.clone()).catch(function () {});
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) return cachedResponse;
        if (request.mode === "navigate") {
            const appShell = await cache.match("./index.html");
            if (appShell) return appShell;
        }
        throw error;
    }
}

self.addEventListener("fetch", function (event) {
    if (event.request.method !== "GET") return;
    const url = new URL(event.request.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    event.respondWith(networkFirst(event.request));
});
