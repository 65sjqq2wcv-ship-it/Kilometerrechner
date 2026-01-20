const APP_VERSION = "1.24";
const CACHE_NAME = `kilometerrechner-v${APP_VERSION}`;
const STATIC_CACHE = `kilometerrechner-static-v${APP_VERSION}`;
const DYNAMIC_CACHE = `kilometerrechner-dynamic-v${APP_VERSION}`;

// Alle wichtigen Ressourcen für vollständige Offline-Funktionalität
const urlsToCache = [
  "/",
  "/index.html",
  "/styles.css", 
  "/script.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  // Google Fonts mit Fallback cachen
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
  "https://fonts.googleapis.com/icon?family=Material+Icons",
];

// Offline-Fallback Seite
const OFFLINE_PAGE = '/index.html';

// Cache-erste Strategien für statische Inhalte
const CACHE_FIRST_PATTERNS = [
  /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
  /\.(?:css|js)$/,
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
];

// ServiceWorker Installation mit robustem Error Handling
self.addEventListener("install", (event) => {
  console.log("[SW] Installing version", CACHE_NAME);
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log("[SW] Precaching static files");
        return cache.addAll(urlsToCache.map(url => new Request(url, { cache: 'reload' })));
      })
      .then(() => {
        console.log("[SW] Skip waiting - neue Version aktivieren");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("[SW] Installation failed:", error);
        // Auch bei Fehlern fortfahren
        return self.skipWaiting();
      })
  );
});

// ServiceWorker Aktivierung mit Cache-Bereinigung
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating version", CACHE_NAME);
  event.waitUntil(
    Promise.all([
      // Alte Caches löschen
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log("[SW] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Clients übernehmen
      self.clients.claim()
    ])
    .then(() => {
      console.log("[SW] Service Worker aktiviert und bereit");
    })
    .catch((error) => {
      console.error("[SW] Activation failed:", error);
    })
  );
});

// Verbessertes Fetch Handling mit vollständiger Offline-Unterstützung
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests und Chrome extensions
  if (request.method !== "GET" || url.protocol === "chrome-extension:") {
    return;
  }

  // HTML-Dokumente (App-Shell)
  if (request.destination === 'document') {
    event.respondWith(handleDocumentRequest(request));
    return;
  }

  // Statische Assets (CSS, JS, Bilder, Fonts)
  if (isStaticAsset(request.url)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  // Google Fonts spezielle Behandlung
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(handleGoogleFonts(request));
    return;
  }

  // Alle anderen Requests
  event.respondWith(handleOtherRequests(request));
});

// HTML-Dokumente: Cache first mit Netzwerk-Fallback
async function handleDocumentRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Prüfen ob Online, dann im Hintergrund aktualisieren
      if (navigator.onLine) {
        updateCacheInBackground(request);
      }
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn("[SW] Document request failed, serving cached version:", error);
    const cachedResponse = await caches.match('/index.html');
    return cachedResponse || new Response('App ist offline', { 
      status: 503, 
      statusText: 'Service Unavailable' 
    });
  }
}

// Statische Assets: Cache first
async function handleStaticAsset(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn("[SW] Static asset failed:", error);
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Ressource nicht verfügbar', { 
      status: 404 
    });
  }
}

// Google Fonts: Cache with graceful fallback
async function handleGoogleFonts(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request, {
      // Reduziertes Timeout für Fonts
      signal: AbortSignal.timeout(3000)
    });
    
    if (networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn("[SW] Google Fonts failed, using cached version:", error);
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('/* Font fallback */', {
      headers: { 'Content-Type': 'text/css' }
    });
  }
}

// Andere Requests: Stale while revalidate
async function handleOtherRequests(request) {
  try {
    const cachedResponse = await caches.match(request);
    
    const fetchPromise = fetch(request)
      .then((networkResponse) => {
        if (networkResponse.status === 200) {
          const cache = caches.open(DYNAMIC_CACHE);
          cache.then((c) => c.put(request, networkResponse.clone()));
        }
        return networkResponse;
      })
      .catch((error) => {
        console.warn("[SW] Network update failed:", error);
      });

    return cachedResponse || await fetchPromise;
  } catch (error) {
    console.error("[SW] Request failed:", error);
    return new Response('Service nicht verfügbar', { 
      status: 503 
    });
  }
}

// Cache im Hintergrund aktualisieren
async function updateCacheInBackground(request) {
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response);
    }
  } catch (error) {
    console.warn("[SW] Background update failed:", error);
  }
}

// Helper Functions
function isStaticAsset(url) {
  return CACHE_FIRST_PATTERNS.some(pattern => pattern.test(url));
}

// Offline/Online Status Management
self.addEventListener('online', () => {
  console.log('[SW] App ist wieder online');
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'ONLINE' });
    });
  });
});

self.addEventListener('offline', () => {
  console.log('[SW] App ist offline');
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'OFFLINE' });
    });
  });
});

// Background Sync für Daten-Synchronisation
self.addEventListener("sync", (event) => {
  if (event.tag === "background-sync-vehicles") {
    console.log("[SW] Background sync für Fahrzeugdaten");
    event.waitUntil(syncVehicleData());
  }
});

async function syncVehicleData() {
  try {
    // Hier könnten Sie Fahrzeugdaten mit einem Server synchronisieren
    console.log("[SW] Synchronisiere Fahrzeugdaten...");
    
    // Benachrichtigung an alle Clients senden
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'DATA_SYNCED' });
    });
  } catch (error) {
    console.error("[SW] Sync failed:", error);
  }
}

// Cleanup bei Speicher-Druck
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLAIM_CLIENTS') {
    self.clients.claim();
  }
});
