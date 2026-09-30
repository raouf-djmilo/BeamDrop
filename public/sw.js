// BeamDrop Service Worker
// Enables Web Share Target API for Android Native Share Sheet (Photos, Videos, Files)
// Allows P2P transfers directly from Android Gallery & Files into BeamDrop

const DB_NAME = 'beamdrop_share_vault';
const STORE_NAME = 'shared_items';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSharedPayload(payload) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id: 'latest_share', timestamp: Date.now(), ...payload });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept Web Share Target POST request from Android Share Sheet
  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const files = formData.getAll('media') || [];
        const title = formData.get('title') || '';
        const text = formData.get('text') || '';
        const sharedUrl = formData.get('url') || '';

        // Store received files/text in IndexedDB for the client page to consume
        await saveSharedPayload({
          files: files,
          title: title,
          text: text,
          url: sharedUrl
        });

        // Redirect to scanner portal with flag
        return Response.redirect('/?mode=scan&from=android_share', 303);
      } catch (err) {
        console.error('Service Worker Share Target Error:', err);
        return Response.redirect('/?mode=scan&error=share_failed', 303);
      }
    })());
    return;
  }

  // Standard fetch pass-through
  event.respondWith(fetch(event.request));
});
