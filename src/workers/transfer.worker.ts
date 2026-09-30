/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Dedicated Web Worker for Multi-Channel File Slicing, AES Encryption & Binary Framing
 * Keeps UI smooth at 60fps without freezing during multi-gigabyte transfers.
 */

self.onmessage = async (e: MessageEvent) => {
  const { action, file, chunkSize, fileId, keyBytes } = e.data;

  if (action === 'SLICE_AND_PACK') {
    try {
      const totalChunks = Math.ceil(file.size / chunkSize);
      let key: CryptoKey | null = null;

      if (keyBytes) {
        key = await crypto.subtle.importKey(
          'raw',
          keyBytes,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt']
        );
      }

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const slice = file.slice(start, end);
        let buffer = await slice.arrayBuffer();

        let isEncrypted = 0;
        if (key) {
          // Encrypt with 12-byte IV
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv, tagLength: 128 },
            key,
            buffer
          );
          const combined = new Uint8Array(12 + ciphertext.byteLength);
          combined.set(iv, 0);
          combined.set(new Uint8Array(ciphertext), 12);
          buffer = combined.buffer;
          isEncrypted = 1;
        }

        // Format 32-byte binary header
        const totalLength = 32 + buffer.byteLength;
        const frame = new ArrayBuffer(totalLength);
        const view = new DataView(frame);
        const uint8 = new Uint8Array(frame);

        // FileUUID
        const encoder = new TextEncoder();
        const idSlice = encoder.encode(fileId.padEnd(16, ' ')).slice(0, 16);
        uint8.set(idSlice, 0);

        // ChunkIndex, TotalChunks, PayloadLength, Flags
        view.setUint32(16, i, false);
        view.setUint32(20, totalChunks, false);
        view.setUint32(24, buffer.byteLength, false);
        view.setUint32(28, isEncrypted, false);

        uint8.set(new Uint8Array(buffer), 32);

        // Post chunk back with transferrable ArrayBuffer
        (self as any).postMessage(
          {
            type: 'CHUNK_READY',
            chunkIndex: i,
            totalChunks,
            frame
          },
          [frame]
        );
      }

      (self as any).postMessage({ type: 'ALL_CHUNKS_PACKED', totalChunks });
    } catch (err: any) {
      (self as any).postMessage({ type: 'WORKER_ERROR', error: err?.message || String(err) });
    }
  }
};
