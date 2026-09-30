/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop Zero-Trust End-to-End Encryption (E2EE) Layer
 * AES-256-GCM authenticated encryption per chunk with 12-byte unique IV
 * & ECDH P-256 key agreement for Radar discovery or Out-of-band URL hash for QR.
 */

export interface E2EESessionKey {
  key: CryptoKey;
  rawKeyBytes: Uint8Array;
  keyId: string;
}

/**
 * 1. Generates 256-bit random symmetric key for Out-Of-Band QR Code sharing.
 * The key is embedded ONLY into window.location.hash (#key=...)
 * Ensuring 0 bytes ever reach the signaling server or Vercel.
 */
export async function generateQrEntropyKey(): Promise<E2EESessionKey> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const keyHex = Array.from(raw).map((b) => b.toString(16).padStart(2, '0')).join('');
  return {
    key,
    rawKeyBytes: raw,
    keyId: keyHex
  };
}

/**
 * Import a 256-bit raw hex key from QR hash fragment
 */
export async function importKeyFromHex(hexKey: string): Promise<CryptoKey> {
  const cleanHex = hexKey.replace(/^#key=/, '').replace(/^key=/, '').trim();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 2. ECDH P-256 Key Exchange for Radar Wi-Fi Mesh Peers
 */
export async function generateEcdhKeyPair(): Promise<{
  keyPair: CryptoKeyPair;
  publicKeyBase64: string;
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
  const rawPub = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const pubBase64 = btoa(String.fromCharCode(...new Uint8Array(rawPub)));
  return { keyPair, publicKeyBase64: pubBase64 };
}

export async function deriveSharedSessionKey(
  myPrivateKey: CryptoKey,
  peerPublicKeyBase64: string
): Promise<CryptoKey> {
  const binaryDer = Uint8Array.from(atob(peerPublicKeyBase64), (c) => c.charCodeAt(0));
  const peerPubKey = await crypto.subtle.importKey(
    'raw',
    binaryDer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: peerPubKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 3. Per-Chunk Frame Encryption (AES-GCM-256)
 * Output packet format:
 * [ 12-byte IV ] + [ Encrypted Ciphertext + 16-byte GCM Auth Tag ]
 */
export async function encryptChunkPayload(
  payload: ArrayBuffer,
  key: CryptoKey
): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    payload
  );

  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return combined.buffer;
}

/**
 * 4. Per-Chunk Frame Decryption & Tamper Verification
 * Automatically throws error and rejects chunk if auth tag fails
 */
export async function decryptChunkPayload(
  packet: ArrayBuffer,
  key: CryptoKey
): Promise<ArrayBuffer> {
  if (packet.byteLength < 28) { // 12-byte IV + 16-byte tag min
    throw new Error('Malformed encrypted chunk packet: too short');
  }
  const iv = new Uint8Array(packet, 0, 12);
  const ciphertext = new Uint8Array(packet, 12);

  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    ciphertext
  );
}
