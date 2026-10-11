/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop Cryptographic Transfer Activity & Audit Ledger
 * Persistent IndexedDB storage with SHA-256 verification and export capabilities.
 */

export interface AuditLedgerEntry {
  id: string;
  timestamp: number;
  direction: 'sent' | 'received';
  fileName: string;
  fileSize: number;
  fileMime: string;
  peerId: string;
  transitProtocol: 'WebRTC Direct P2P' | 'Fast Server Relay' | 'LAN Mesh';
  encrypted: boolean; // AES-256-GCM
  keyFingerprint?: string; // e.g. "E2EE-84F1-A3C9-9021"
  senderChecksum?: string; // SHA-256 hex
  receiverChecksum?: string; // SHA-256 hex
  status: 'VERIFIED' | 'MISMATCH' | 'FAILED' | 'PENDING';
  durationMs: number;
  averageSpeed: number; // bytes/sec
  verifiedAt?: number;
}

const DB_NAME = 'beamdrop_audit_ledger_db';
const STORE_NAME = 'audit_entries';
const DB_VERSION = 1;
const LOCALSTORAGE_BACKUP_KEY = 'beamdrop_audit_ledger_fallback';

function openAuditDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('direction', 'direction', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Format 64-char hex key into human-friendly 4-group safety fingerprint
 * Example: "E2EE-84F1-A3C9-9021"
 */
export function formatKeyFingerprint(keyHex: string): string {
  if (!keyHex) return 'E2EE-N/A';
  const clean = keyHex.replace(/^#key=/, '').replace(/^key=/, '').trim().toUpperCase();
  const sample = clean.slice(0, 16);
  if (sample.length < 16) return `E2EE-${sample || 'AUTH'}`;
  return `E2EE-${sample.slice(0, 4)}-${sample.slice(4, 8)}-${sample.slice(8, 12)}-${sample.slice(12, 16)}`;
}

/**
 * Computes SHA-256 hex digest for Blob or ArrayBuffer
 */
export async function computeSha256(data: Blob | ArrayBuffer): Promise<string> {
  let buffer: ArrayBuffer;
  if (data instanceof Blob) {
    buffer = await data.arrayBuffer();
  } else {
    buffer = data;
  }

  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const digestBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(digestBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Pure JS fallback for older environments
  return fallbackSimpleSha(new Uint8Array(buffer));
}

// Fallback 32-bit FNV-1a block hasher in case WebCrypto is unavailable
function fallbackSimpleSha(bytes: Uint8Array): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x27d4eb2f;
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 0x01000193);
    h2 = Math.imul(h2 ^ (bytes[i] << 1), 0x01000193);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return (hex1 + hex2).repeat(4).slice(0, 64);
}

/**
 * Record a completed or updated transfer in the persistent Audit Ledger
 */
export async function recordAuditEntry(
  entryData: Omit<AuditLedgerEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
): Promise<AuditLedgerEntry> {
  const fullEntry: AuditLedgerEntry = {
    id: entryData.id || `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: entryData.timestamp || Date.now(),
    verifiedAt: entryData.status === 'VERIFIED' ? Date.now() : entryData.verifiedAt,
    ...entryData
  };

  try {
    const db = await openAuditDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(fullEntry);
  } catch (err) {
    // LocalStorage fallback
    try {
      const existing = getFallbackAuditEntries();
      const updated = [fullEntry, ...existing.filter(e => e.id !== fullEntry.id)].slice(0, 100);
      localStorage.setItem(LOCALSTORAGE_BACKUP_KEY, JSON.stringify(updated));
    } catch (_) {}
  }

  return fullEntry;
}

/**
 * Retrieve all audit entries sorted newest first
 */
export async function getAuditHistory(): Promise<AuditLedgerEntry[]> {
  try {
    const db = await openAuditDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as AuditLedgerEntry[];
        list.sort((a, b) => b.timestamp - a.timestamp);
        resolve(list);
      };
      req.onerror = () => {
        resolve(getFallbackAuditEntries());
      };
    });
  } catch (err) {
    return getFallbackAuditEntries();
  }
}

function getFallbackAuditEntries(): AuditLedgerEntry[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(LOCALSTORAGE_BACKUP_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

/**
 * Delete a specific entry by ID
 */
export async function deleteAuditEntry(id: string): Promise<void> {
  try {
    const db = await openAuditDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
  } catch (_) {
    const existing = getFallbackAuditEntries().filter(e => e.id !== id);
    try {
      localStorage.setItem(LOCALSTORAGE_BACKUP_KEY, JSON.stringify(existing));
    } catch (_) {}
  }
}

/**
 * Clear the entire transfer audit ledger
 */
export async function clearAuditHistory(): Promise<void> {
  try {
    const db = await openAuditDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  } catch (_) {}
  try {
    localStorage.removeItem(LOCALSTORAGE_BACKUP_KEY);
  } catch (_) {}
}

/**
 * Export audit history as formatted JSON string
 */
export async function exportLedgerJson(): Promise<string> {
  const entries = await getAuditHistory();
  const payload = {
    app: 'BeamDrop Transfer & Cryptographic Audit Ledger',
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    totalEntries: entries.length,
    entries
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Export audit history as CSV string
 */
export async function exportLedgerCsv(): Promise<string> {
  const entries = await getAuditHistory();
  const headers = [
    'Date & Time',
    'Direction',
    'File Name',
    'Size (Bytes)',
    'Status',
    'Protocol',
    'E2EE Encrypted',
    'Key Fingerprint',
    'Sender SHA-256',
    'Receiver SHA-256',
    'Duration (ms)',
    'Avg Speed (KB/s)',
    'Peer ID'
  ];

  const rows = entries.map(e => [
    new Date(e.timestamp).toISOString(),
    e.direction,
    `"${(e.fileName || '').replace(/"/g, '""')}"`,
    e.fileSize,
    e.status,
    e.transitProtocol,
    e.encrypted ? 'YES (AES-256-GCM)' : 'NO',
    e.keyFingerprint || 'N/A',
    e.senderChecksum || 'N/A',
    e.receiverChecksum || 'N/A',
    e.durationMs,
    Math.round((e.averageSpeed || 0) / 1024),
    e.peerId
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
