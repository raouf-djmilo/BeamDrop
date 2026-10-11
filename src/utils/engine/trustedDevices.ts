/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop AirDrop-Style Trusted Devices Engine
 * Manages trusted device whitelist, zero-click auto-accept permissions,
 * and persistent device identity signatures.
 */

export type DevicePlatform = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'other';

export interface TrustedDevice {
  id: string; // Persistent Peer ID or Device Fingerprint
  name: string; // Friendly name e.g. "Raouf's iPhone 15", "Studio Mac"
  platform: DevicePlatform;
  fingerprint?: string; // SHA-256 safety fingerprint
  autoAcceptFiles: boolean; // True to skip prompts and save automatically
  allowClipboardSync: boolean; // True to allow real-time clipboard mirroring
  trustedAt: number;
  lastSeen: number;
  ipHint?: string;
}

const STORAGE_KEY = 'beamdrop_trusted_devices_v1';
const DB_NAME = 'beamdrop_trusted_db';
const STORE_NAME = 'trusted_devices';

// Open or initialize IndexedDB
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getFromLocalStorage(): TrustedDevice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveToLocalStorage(devices: TrustedDevice[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  } catch (_) {}
}

const listeners = new Set<(devices: TrustedDevice[]) => void>();

function notifyListeners(devices: TrustedDevice[]): void {
  listeners.forEach((fn) => {
    try {
      fn(devices);
    } catch (_) {}
  });
}

/**
 * Fetch all registered trusted devices
 */
export async function getTrustedDevices(): Promise<TrustedDevice[]> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const result = (req.result || []) as TrustedDevice[];
        saveToLocalStorage(result);
        resolve(result);
      };
      req.onerror = () => resolve(getFromLocalStorage());
    });
  } catch (_) {
    return getFromLocalStorage();
  }
}

/**
 * Retrieve a specific trusted device by ID
 */
export async function getTrustedDevice(id: string): Promise<TrustedDevice | null> {
  if (!id) return null;
  const list = await getTrustedDevices();
  return list.find((d) => d.id === id || id.includes(d.id) || d.id.includes(id)) || null;
}

/**
 * Check if a peer is trusted
 */
export async function isDeviceTrusted(id: string): Promise<boolean> {
  const device = await getTrustedDevice(id);
  return Boolean(device);
}

/**
 * Check if incoming transfers from this peer should be auto-accepted without modal
 */
export async function shouldAutoAccept(id: string): Promise<boolean> {
  const device = await getTrustedDevice(id);
  return Boolean(device && device.autoAcceptFiles);
}

/**
 * Check if clipboard sync is allowed for this peer
 */
export async function shouldSyncClipboard(id: string): Promise<boolean> {
  const device = await getTrustedDevice(id);
  return Boolean(device && device.allowClipboardSync);
}

/**
 * Add or update a trusted device in the whitelist
 */
export async function saveTrustedDevice(device: TrustedDevice): Promise<void> {
  const cleanDevice: TrustedDevice = {
    ...device,
    lastSeen: Date.now()
  };

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(cleanDevice);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (_) {
    const list = getFromLocalStorage();
    const idx = list.findIndex((d) => d.id === cleanDevice.id);
    if (idx >= 0) list[idx] = cleanDevice;
    else list.push(cleanDevice);
    saveToLocalStorage(list);
  }

  const all = await getTrustedDevices();
  notifyListeners(all);

  // Broadcast change across tabs
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('beamdrop:trusted_devices_changed', { detail: { device: cleanDevice } }));
  }
}

/**
 * Revoke trust from a device
 */
export async function revokeTrustedDevice(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (_) {
    const list = getFromLocalStorage().filter((d) => d.id !== id);
    saveToLocalStorage(list);
  }

  const all = await getTrustedDevices();
  notifyListeners(all);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('beamdrop:trusted_devices_changed', { detail: { revokedId: id } }));
  }
}

/**
 * Update permission settings for a device (e.g. toggle autoAccept or clipboardSync)
 */
export async function updateDeviceSettings(id: string, settings: Partial<TrustedDevice>): Promise<void> {
  const existing = await getTrustedDevice(id);
  if (!existing) return;
  const updated: TrustedDevice = {
    ...existing,
    ...settings,
    lastSeen: Date.now()
  };
  await saveTrustedDevice(updated);
}

/**
 * Detect client platform from User Agent string
 */
export function detectPlatformFromUserAgent(ua?: string): DevicePlatform {
  const str = (ua || (typeof navigator !== 'undefined' ? navigator.userAgent : '')).toLowerCase();
  if (/iphone|ipad|ipod/.test(str)) return 'ios';
  if (/android/.test(str)) return 'android';
  if (/macintosh|mac os x/.test(str)) return 'macos';
  if (/windows/.test(str)) return 'windows';
  if (/linux/.test(str)) return 'linux';
  return 'other';
}

/**
 * Subscribe to trusted devices updates
 */
export function listenToTrustedDevices(callback: (devices: TrustedDevice[]) => void): () => void {
  listeners.add(callback);
  getTrustedDevices().then(callback).catch(() => {});

  const handleCustomEvent = () => {
    getTrustedDevices().then(callback).catch(() => {});
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('beamdrop:trusted_devices_changed', handleCustomEvent);
  }

  return () => {
    listeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('beamdrop:trusted_devices_changed', handleCustomEvent);
    }
  };
}
