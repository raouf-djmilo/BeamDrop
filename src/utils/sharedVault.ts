// Helper utility to read files passed into BeamDrop via Android Share Sheet (Web Share Target)

const DB_NAME = 'beamdrop_share_vault';
const STORE_NAME = 'shared_items';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface SharedPayload {
  files: File[];
  title?: string;
  text?: string;
  url?: string;
}

export async function consumeSharedPayload(): Promise<SharedPayload | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get('latest_share');

      getReq.onsuccess = () => {
        const result = getReq.result;
        if (!result) {
          resolve(null);
          return;
        }

        // Clean up from database so it's not reused
        store.delete('latest_share');

        const files: File[] = [];
        if (Array.isArray(result.files)) {
          for (const item of result.files) {
            if (item instanceof File) {
              files.push(item);
            } else if (item instanceof Blob) {
              const name = (item as any).name || `shared_media_${Date.now()}`;
              files.push(new File([item], name, { type: item.type }));
            }
          }
        }

        // If text or url was shared without files, create a shared text file
        if (files.length === 0 && (result.text || result.url)) {
          const content = [result.title, result.text, result.url].filter(Boolean).join('\n');
          files.push(new File([content], 'shared_content.txt', { type: 'text/plain' }));
        }

        resolve({
          files,
          title: result.title,
          text: result.text,
          url: result.url
        });
      };

      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    console.warn('Could not consume shared payload:', err);
    return null;
  }
}
