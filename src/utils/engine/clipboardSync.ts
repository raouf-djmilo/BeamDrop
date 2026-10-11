/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop Universal Continuous Clipboard Sync Engine
 * Real-time bidirectional clipboard mirroring between PC and Phone
 * with cryptographic deduplication and loop protection.
 */

import { computeSha256Digest } from './crypto';

export interface ClipboardSyncEvent {
  text: string;
  senderPeerId: string;
  senderName: string;
  timestamp: number;
  autoCopied: boolean;
  hash: string;
}

const CLIPBOARD_SYNC_ENABLED_KEY = 'beamdrop_clipboard_sync_enabled';
let lastSyncedHash: string = '';
let lastSyncedTimestamp: number = 0;

/**
 * Check if continuous clipboard sync is globally active
 */
export function isClipboardSyncEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const val = localStorage.getItem(CLIPBOARD_SYNC_ENABLED_KEY);
    return val === null ? true : val === 'true'; // Default true for instant productivity
  } catch (_) {
    return true;
  }
}

/**
 * Toggle continuous clipboard sync globally
 */
export function setClipboardSyncEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLIPBOARD_SYNC_ENABLED_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent('beamdrop:clipboard_sync_toggled', { detail: { enabled } }));
  } catch (_) {}
}

/**
 * Write text to system clipboard safely
 */
export async function writeToSystemClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // When document is not focused, clipboard.writeText may throw NotAllowedError
    return false;
  }
}

/**
 * Read text from system clipboard if permissions allow
 */
export async function readFromSystemClipboard(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.readText) {
    return null;
  }
  try {
    if (document.hasFocus()) {
      return await navigator.clipboard.readText();
    }
  } catch (_) {}
  return null;
}

/**
 * Process incoming clipboard payload from peer
 */
export async function handleIncomingClipboardSync(payload: {
  text: string;
  senderPeerId: string;
  senderName?: string;
  timestamp?: number;
}): Promise<ClipboardSyncEvent | null> {
  if (!payload || !payload.text || !payload.text.trim()) return null;
  if (!isClipboardSyncEnabled()) return null;

  const text = payload.text;
  let hash = '';
  try {
    hash = await computeSha256Digest(text);
  } catch (_) {
    hash = String(text.length) + '_' + text.slice(0, 16);
  }

  // Deduplication check: Ignore echo or repeated transmissions within 3 seconds
  const now = Date.now();
  if (hash === lastSyncedHash && now - lastSyncedTimestamp < 4000) {
    return null;
  }

  lastSyncedHash = hash;
  lastSyncedTimestamp = now;

  // Attempt auto-write to system clipboard if window has focus
  let autoCopied = false;
  try {
    autoCopied = await writeToSystemClipboard(text);
  } catch (_) {
    autoCopied = false;
  }

  const syncEvent: ClipboardSyncEvent = {
    text,
    senderPeerId: payload.senderPeerId,
    senderName: payload.senderName || 'Paired Device',
    timestamp: payload.timestamp || now,
    autoCopied,
    hash
  };

  // Dispatch toast event to UI
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('beamdrop:clipboard_synced', { detail: syncEvent }));
  }

  return syncEvent;
}

/**
 * Prepare and record outgoing clipboard item before sending to avoid mirror loop
 */
export async function registerOutgoingClipboardSync(text: string): Promise<string> {
  let hash = '';
  try {
    hash = await computeSha256Digest(text);
  } catch (_) {
    hash = String(text.length) + '_' + text.slice(0, 16);
  }
  lastSyncedHash = hash;
  lastSyncedTimestamp = Date.now();
  return hash;
}

/**
 * Subscribe to incoming clipboard sync events
 */
export function listenToClipboardSync(callback: (event: ClipboardSyncEvent) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent)?.detail as ClipboardSyncEvent;
    if (detail) callback(detail);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('beamdrop:clipboard_synced', handler);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('beamdrop:clipboard_synced', handler);
    }
  };
}
