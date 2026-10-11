# Implementation Plan: Next-Gen Zero-Knowledge E2EE, Cryptographic Audit Ledger & Unified PWA Engine

Upgrade the BeamDrop device-to-device transfer platform into an enterprise-grade, privacy-first transfer powerhouse featuring zero-knowledge AES-256-GCM chunk encryption, a persistent cryptographic transfer activity ledger with SHA-256 checksum audits, and a unified PWA-ready modular architecture.

---

## 1. Technical Architecture & Protocols

### A. Zero-Knowledge AES-256-GCM Pipeline
- **Entropy & Key Derivation**: When generating QR codes and transfer links, generate a cryptographically secure 256-bit symmetric key (`crypto.getRandomValues`) placed exclusively in the URL fragment (`#key=...`). URL fragments are never transmitted over HTTP requests to signaling servers or cloud proxies.
- **Chunk-by-Chunk Authenticated Encryption**:
  - Each binary transfer chunk will be framed with a unique 12-byte initialization vector (IV) and a 16-byte GCM authentication tag: `[ 12-byte IV ] + [ Encrypted Payload ] + [ 16-byte Tag ]`.
  - Automatic tamper detection: Decryption failure triggers immediate stream abort and tamper warning.
- **Visual Cryptographic Fingerprint**: Display short SHA-256 key fingerprints (safety numbers) on both sender and receiver interfaces so users can verify peer identity with 100% confidence.

### B. Persistent Activity Ledger & SHA-256 Integrity Audits
- **Dual SHA-256 Streaming Hasher**: Calculate real-time SHA-256 digests on both sender and receiver using `crypto.subtle.digest` or incremental block hashing.
- **Cryptographic Audit Ledger**:
  - Persisted in browser `IndexedDB` with fallback to `localStorage`.
  - Records: file name, byte size, MIME type, direction (Sent/Received), peer ID, transit protocol (WebRTC Direct P2P vs Fast Server Relay), transfer duration, average throughput (MB/s), sender SHA-256 checksum, receiver SHA-256 checksum, and audit status (`MATCH` / `MISMATCH`).
- **Interactive Audit Modal & Export**:
  - Verification badge on completed items with one-click checksum inspector.
  - JSON & CSV export for compliance and auditing.
  - Search, filter by status, and clear history actions.

### C. Unified Modular Engine & Installable PWA
- **Dedicated Web App Manifest**: Provide `/site.webmanifest` separate from the Chrome extension's `manifest.json`, declaring standalone display, theme colors, and icons.
- **PWA Service Worker & Install Flow**:
  - Clean `sw.js` cache management for offline app shell loading.
  - In-app install banner with deferred prompt (`beforeinstallprompt`) supporting Android Chrome, Desktop Edge/Chrome, and iOS Safari instructions.
- **Unified Transfer Engine Core**: Modular export structure linking WebRTC P2P (`p2p.ts`), stream-to-disk sink (`streamDiskSink.ts`), E2EE crypto (`crypto.ts`), and activity ledger (`auditLedger.ts`).

---

## 2. Proposed Changes

### Core Engine & Cryptography
#### `src/utils/engine/auditLedger.ts`
- Implement robust `AuditLedger` service using `IndexedDB`:
  - Methods: `recordTransfer()`, `getTransferHistory()`, `verifyFileChecksum()`, `exportLedgerAsJson()`, `clearLedger()`.
  - Incremental SHA-256 calculation utilities for files and streaming chunks.

#### `src/utils/engine/crypto.ts` & `src/utils/p2p.ts`
- Connect `generateQrEntropyKey` and `importKeyFromHex` directly into `P2PTransferManager`.
- Embed E2EE chunk encryption into `sendFile` and decryption into `receiveFile` / `StreamDiskSink`.
- Append calculated SHA-256 checksum to `FILE_END` control frame so the receiver can verify bit-exact delivery.

### User Interface & Experience
#### `src/components/ActivityAuditDrawer.tsx` (New)
- Dedicated sliding panel or tab view showcasing the full transfer history:
  - Cryptographic badge indicator (`Tamper-Free SHA-256 Verified`).
  - Speed, duration, and transit protocol indicators.
  - One-click copy for checksums and file re-verification tool.

#### `src/components/SenderView.tsx` & `src/components/ReceiverView.tsx`
- Display active E2EE lock status indicator with key fingerprint preview.
- Seamlessly pass the generated `#key=...` hash when creating QR codes and share links.
- On transfer completion, immediately log to `AuditLedger` and display the SHA-256 verification status.

#### `src/components/DirectDownloadPortal.tsx` & `src/components/MobileScannerPortal.tsx`
- Parse `#key=...` from URL hash upon scan/open and decrypt binary frames automatically.
- Display verified zero-knowledge lock badge in mobile header.

#### `src/components/PWAInstallBanner.tsx` & `public/site.webmanifest`
- Create `/public/site.webmanifest` configured for installable PWA compliance.
- Update `index.html` to reference `/site.webmanifest`.
- Implement responsive install prompt toast with dismiss and install triggers.

---

## 3. Verification Plan

### Automated Build & Syntax Checks
- Run `npm run lint` (`tsc --noEmit`) to verify strict type correctness across all modified and new files.
- Run `compile_applet` to confirm Vite production bundle builds without errors.

### Manual Verification Scenarios
1. **End-to-End Encryption Validation**:
   - Send file with E2EE key generated in QR code `#key=...`.
   - Verify network packet payloads are ciphertext (non-plaintext) with valid 12-byte IV and 16-byte GCM tags.
   - Verify receiver successfully decrypts and writes file to disk.
2. **SHA-256 Integrity Audit**:
   - Transfer sample image/file.
   - Confirm sender and receiver calculate identical SHA-256 hashes.
   - Check that the transfer appears in the Activity Audit Ledger marked as `VERIFIED`.
3. **PWA Compliance**:
   - Inspect manifest link in `index.html` and verify standalone PWA metadata.
   - Verify install prompt trigger behaves properly on mobile and desktop viewports.
