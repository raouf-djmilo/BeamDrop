/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop Resumable Binary Framing Protocol & State Checkpointing
 * 
 * Strict 32-Byte Binary Frame Header:
 * [ 16-byte FileUUID (ASCII/Raw) ]
 * [ 4-byte ChunkIndex (Uint32)    ]
 * [ 4-byte TotalChunks (Uint32)   ]
 * [ 4-byte PayloadLength (Uint32) ]
 * [ 4-byte Checksum / Flags       ] (Uint32)
 * Followed by Payload (Binary data or Encrypted chunk).
 */

export const FRAME_HEADER_SIZE = 32;

export interface BinaryFrameMeta {
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  payloadLength: number;
  flags: number;
}

/**
 * Encodes a 32-byte binary header with payload
 */
export function encodeBinaryFrame(
  fileId: string,
  chunkIndex: number,
  totalChunks: number,
  payload: ArrayBuffer,
  flags: number = 0
): ArrayBuffer {
  const totalLength = FRAME_HEADER_SIZE + payload.byteLength;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  // 1. Write 16-byte FileUUID
  const encoder = new TextEncoder();
  const fileIdBytes = encoder.encode(fileId.padEnd(16, ' ')).slice(0, 16);
  uint8.set(fileIdBytes, 0);

  // 2. Write 4-byte ChunkIndex
  view.setUint32(16, chunkIndex, false); // Big Endian

  // 3. Write 4-byte TotalChunks
  view.setUint32(20, totalChunks, false);

  // 4. Write 4-byte PayloadLength
  view.setUint32(24, payload.byteLength, false);

  // 5. Write 4-byte Flags (e.g. 1 = encrypted, 0 = raw)
  view.setUint32(28, flags, false);

  // 6. Write Payload
  uint8.set(new Uint8Array(payload), FRAME_HEADER_SIZE);

  return buffer;
}

/**
 * Decodes a 32-byte binary header and extracts payload slice
 */
export function decodeBinaryFrame(frameBuffer: ArrayBuffer): {
  meta: BinaryFrameMeta;
  payload: ArrayBuffer;
} {
  if (frameBuffer.byteLength < FRAME_HEADER_SIZE) {
    throw new Error('Frame is smaller than 32-byte header');
  }

  const view = new DataView(frameBuffer);
  const uint8 = new Uint8Array(frameBuffer);

  // 1. Read FileUUID
  const decoder = new TextDecoder();
  const fileId = decoder.decode(uint8.subarray(0, 16)).trim();

  // 2. Read integers
  const chunkIndex = view.getUint32(16, false);
  const totalChunks = view.getUint32(20, false);
  const payloadLength = view.getUint32(24, false);
  const flags = view.getUint32(28, false);

  const payload = frameBuffer.slice(FRAME_HEADER_SIZE, FRAME_HEADER_SIZE + payloadLength);

  return {
    meta: {
      fileId,
      chunkIndex,
      totalChunks,
      payloadLength,
      flags
    },
    payload
  };
}

/**
 * IndexedDB Checkpointing for Resumable Bitmask State
 */
const DB_NAME = 'beamdrop_checkpoints';
const STORE_NAME = 'transfer_bitmaps';

function openCheckpointDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'fileId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveTransferCheckpoint(
  fileId: string,
  fileName: string,
  fileSize: number,
  totalChunks: number,
  receivedChunksSet: Set<number>
): Promise<void> {
  try {
    const db = await openCheckpointDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const serialized = Array.from(receivedChunksSet);
    store.put({
      fileId,
      fileName,
      fileSize,
      totalChunks,
      receivedIndices: serialized,
      updatedAt: Date.now()
    });
  } catch (e) {
    console.debug('Failed to write checkpoint to IDB:', e);
  }
}

export async function getTransferCheckpoint(fileId: string): Promise<{
  fileId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  receivedIndices: number[];
} | null> {
  try {
    const db = await openCheckpointDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve) => {
      const req = store.get(fileId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

export async function clearTransferCheckpoint(fileId: string): Promise<void> {
  try {
    const db = await openCheckpointDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(fileId);
  } catch (e) {}
}
