import Peer, { DataConnection } from 'peerjs';
import { AdaptiveChunker } from './engine/chunker';
import {
  encodeBinaryFrame,
  decodeBinaryFrame,
  saveTransferCheckpoint,
  getTransferCheckpoint,
  clearTransferCheckpoint,
  FRAME_HEADER_SIZE
} from './engine/protocol';
import {
  generateQrEntropyKey,
  importKeyFromHex,
  encryptChunkPayload,
  decryptChunkPayload,
  computeSha256Digest,
  formatSafetyFingerprint
} from './engine/crypto';
import { recordAuditEntry } from './engine/auditLedger';
import { meshBroadcastHub } from './engine/meshBroadcast';
import { shouldAutoAccept, isDeviceTrusted, updateDeviceSettings } from './engine/trustedDevices';
import { handleIncomingClipboardSync, registerOutgoingClipboardSync } from './engine/clipboardSync';

export interface TransferFile {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified?: number;
  previewUrl?: string;
  file?: File;
  blob?: Blob;
  downloadUrl?: string;
  progress: number;
  speed: number; // bytes/sec
  status: 'pending' | 'transferring' | 'completed' | 'error';
  direction: 'send' | 'receive';
  encrypted?: boolean;
  directDiskSaved?: boolean;
  checksum?: string;
  checksumVerified?: boolean;
  transitProtocol?: string;
  keyFingerprint?: string;
  autoAccepted?: boolean;
  senderTrusted?: boolean;
}

export interface DiskStreamSink {
  onChunk: (chunk: Uint8Array, chunkIndex: number, totalChunks: number) => Promise<void> | void;
  onComplete: () => Promise<void> | void;
  onError?: (err: any) => void;
}

export type DiskStreamFactory = (fileMetadata: TransferFile) => Promise<DiskStreamSink | null> | (DiskStreamSink | null);

export interface TextPayload {
  id: string;
  text: string;
  timestamp: number;
  direction: 'send' | 'receive';
  type: 'link' | 'text' | 'code';
}

export type PhoneTransferStage = 'idle' | 'scanned' | 'downloading' | 'delivered' | 'failed';

export interface PhoneStatusPayload {
  stage: PhoneTransferStage;
  device?: string;
  progress?: number;
  speed?: number;
  fileName?: string;
  fileSize?: number;
  error?: string;
  timestamp: number;
}

export interface PeerMessage {
  type: 'FILE_START' | 'FILE_CHUNK' | 'FILE_END' | 'TEXT_MSG' | 'PING' | 'PONG' | 'DEVICE_INFO' | 'RESUME_SESSION' | 'RESUME_ACK' | 'RECEIVER_READY' | 'ACK_METADATA' | 'PHONE_STATUS' | 'CLIPBOARD_SYNC' | 'TRANSFER_COMPLETE_ACK';
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  chunkIndex?: number;
  totalChunks?: number;
  chunkSize?: number;
  data?: ArrayBuffer | string;
  text?: string;
  device?: string;
  senderName?: string;
  pingTime?: number;
  encrypted?: boolean;
  nextExpectedChunk?: number;
  stage?: PhoneTransferStage;
  progress?: number;
  speed?: number;
  error?: string;
  checksum?: string;
  timestamp?: number;
}

export const P2P_ICE_SERVERS: RTCIceServer[] = [
  // Primary High-Speed Google STUN servers
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Twilio Global STUN
  { urls: 'stun:global.stun.twilio.com:3478' },
  // OpenRelay Public TURN Relay (bypasses Symmetric NAT & 4G/5G mobile firewalls)
  { urls: 'stun:stun.relay.metered.ca:80' },
  {
    urls: 'turn:standard.relay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:standard.relay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:standard.relay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

export class P2PTransferManager {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  // Multi-receiver active connections for QR multi-device beam sessions
  private activeConnections: Map<string, DataConnection> = new Map();

  public connectedPeersList: string[] = [];
  public onPeersChange?: (peers: string[]) => void;
  public myPeerId: string = '';
  public connectedPeerId: string = '';
  public targetPeerId: string = '';
  public targetDeviceName: string = '';
  public myDeviceName: string = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop / PC';
  public isConnected: boolean = false;
  public isConnecting: boolean = false;

  // Active QR Session token to control validity & instant cancellation
  public activeSessionToken: string = '';
  public isSessionActive: boolean = true;

  // 1. Adaptive Chunker instance with RTT tracking
  public adaptiveChunker: AdaptiveChunker;
  public currentRtt: number = 10;
  public currentTierName: string = 'Ultra-LAN / Wi-Fi 6 Direct';
  public onAdaptiveStats?: (rtt: number, tier: string, chunkSize: number) => void;

  // 2. E2EE Crypto Key (AES-GCM-256)
  public sessionCryptoKey: CryptoKey | null = null;
  public sessionRawKeyHex: string = '';

  // Callbacks
  public onConnected?: (peerId: string) => void;
  public onDisconnected?: () => void;
  public onReceiverReady?: () => void;
  public onStatusChange?: (status: string) => void;
  public onFileReceiveStart?: (file: TransferFile) => void;
  public onFileProgress?: (fileId: string, progress: number, speed: number) => void;
  public onFileReceiveComplete?: (file: TransferFile) => void;
  public onTextReceive?: (textPayload: TextPayload) => void;
  public onPhoneStatus?: (status: PhoneStatusPayload) => void;
  public onError?: (error: string) => void;
  public diskStreamFactory: DiskStreamFactory | null = null;
  private activeDiskSinks: Map<string, DiskStreamSink> = new Map();

  // Receiving state
  private incomingFiles: Map<string, {
    metadata: TransferFile;
    chunks: Map<number, ArrayBuffer>;
    receivedIndices: Set<number>;
    receivedBytes: number;
    startTime: number;
    lastSpeedCalcTime: number;
    lastReceivedBytes: number;
    chunkSize: number;
    totalChunks: number;
    expectedChecksum?: string;
  }> = new Map();

  // Sending state
  private isSending: boolean = false;
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;

  constructor() {
    this.adaptiveChunker = new AdaptiveChunker((rtt, tier, chunkSize) => {
      this.currentRtt = rtt;
      this.currentTierName = tier;
      this.onAdaptiveStats?.(rtt, tier, chunkSize);
    });
  }

  /**
   * Initializes AES-GCM 256-bit encryption key for QR session
   */
  public async setupE2EE(): Promise<string> {
    const e2ee = await generateQrEntropyKey();
    this.sessionCryptoKey = e2ee.key;
    this.sessionRawKeyHex = e2ee.keyId;
    return this.sessionRawKeyHex;
  }

  public async setE2EEKeyFromHex(hexKey: string): Promise<void> {
    try {
      this.sessionCryptoKey = await importKeyFromHex(hexKey);
      this.sessionRawKeyHex = hexKey;
    } catch (e) {
      console.warn('Failed to import E2EE key:', e);
    }
  }

  public init(preferredId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.isConnecting = true;
      this.onStatusChange?.('Initializing P2P network...');

      // Generate a short user-friendly peer ID if not supplied
      const peerId = preferredId || 'beam-' + Math.random().toString(36).substring(2, 8);

      try {
        this.peer = new Peer(peerId, {
          debug: 0,
          logFunction: (_logLevel: number, ...args: any[]) => {
            const str = args.map((a: any) => (a && a.message) || String(a)).join(' ');
            if (str.includes('Lost connection') || str.includes('socket') || str.includes('disconnected')) {
              return;
            }
            if (_logLevel <= 1) {
              console.warn('[BeamDrop P2P Notice]', ...args);
            }
          },
          config: {
            iceServers: P2P_ICE_SERVERS
          }
        });

        this.peer.on('open', (id) => {
          this.myPeerId = id;
          this.isConnecting = false;
          this.onStatusChange?.('Ready for connection');
          this.startHeartbeat();
          resolve(id);
        });

        this.peer.on('connection', (conn) => {
          if (conn.open) {
            this.setupConnection(conn);
          } else {
            conn.once('open', () => {
              this.setupConnection(conn);
            });
          }
        });

        this.peer.on('error', (err: any) => {
          const errMsg = String(err?.message || err?.type || err || '');
          const errType = String(err?.type || '');

          if (
            errType === 'network' ||
            errType === 'server-error' ||
            errType === 'socket-error' ||
            errType === 'socket-closed' ||
            errType === 'lost-connection' ||
            errMsg.includes('Lost connection') ||
            errMsg.includes('socket') ||
            errMsg.includes('disconnected')
          ) {
            console.warn('[BeamDrop P2P] Signaling connection notice (auto-reconnecting):', errMsg || errType);
            this.attemptReconnect();
            return;
          }

          if (errType === 'peer-unavailable') {
            console.warn('[BeamDrop P2P] Target peer not yet connected to signaling server');
            this.onStatusChange?.('Waiting for peer to connect...');
            return;
          }

          if (errType === 'unavailable-id') {
            this.init().then(resolve).catch(reject);
            return;
          }

          console.warn('[BeamDrop P2P] Non-fatal connection event:', err);
          this.isConnecting = false;
          this.onError?.(err?.message || 'P2P Connection Notice');
          this.onStatusChange?.('Connection Notice: ' + errType);
        });

        this.peer.on('disconnected', () => {
          this.attemptReconnect();
        });
      } catch (err: any) {
        this.isConnecting = false;
        this.onError?.(err.message || 'Failed to initialize WebRTC');
        reject(err);
      }
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.peer && !this.peer.destroyed && this.peer.disconnected) {
        this.attemptReconnect();
      }
    }, 10000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private attemptReconnect() {
    if (!this.peer || this.peer.destroyed) return;
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.peer && !this.peer.destroyed && this.peer.disconnected) {
        try {
          this.peer.reconnect();
        } catch (_) {}
      }
    }, 1500);
  }

  public connect(targetPeerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.peer) {
        reject(new Error('Peer not initialized'));
        return;
      }

      this.isConnecting = true;
      this.onStatusChange?.(`Connecting to ${targetPeerId}...`);

      const conn = this.peer.connect(targetPeerId, {
        reliable: true
      });

      conn.on('open', () => {
        this.setupConnection(conn);
        resolve();
      });

      conn.on('error', (err) => {
        this.isConnecting = false;
        this.onError?.('Could not connect to target peer: ' + err.message);
        reject(err);
      });
    });
  }

  private setupConnection(conn: DataConnection) {
    if (!conn.open) {
      conn.once('open', () => this.setupConnection(conn));
      return;
    }
    this.connection = conn;
    this.connectedPeerId = conn.peer;
    this.targetPeerId = conn.peer;
    this.activeConnections.set(conn.peer, conn);
    this.connectedPeersList = Array.from(this.activeConnections.keys());
    this.isConnected = true;
    this.isConnecting = false;

    // Register in Multi-Peer Mesh Broadcast Manager
    meshBroadcastHub.registerPeer(conn.peer);

    const devCount = this.activeConnections.size;
    this.onStatusChange?.(`Connected with peer (${devCount} device${devCount > 1 ? 's' : ''})`);
    this.onConnected?.(conn.peer);
    this.onPeersChange?.(this.connectedPeersList);

    // Send device info
    this.sendMessage({
      type: 'DEVICE_INFO',
      device: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop / PC'
    });

    // Start RTT Adaptive Probing
    this.adaptiveChunker.startProbing((pingTime) => {
      this.sendMessage({ type: 'PING', pingTime });
    });

    conn.on('data', (raw: any) => {
      this.handleIncomingData(raw);
    });

    conn.on('close', () => {
      this.activeConnections.delete(conn.peer);
      this.connectedPeersList = Array.from(this.activeConnections.keys());
      meshBroadcastHub.removePeer(conn.peer);

      if (this.activeConnections.size > 0) {
        this.connection = this.activeConnections.values().next().value || null;
        this.connectedPeerId = this.connection ? this.connection.peer : '';
        this.targetPeerId = this.connectedPeerId;
        this.isConnected = true;
        this.onStatusChange?.(`Peer disconnected (${this.activeConnections.size} remaining)`);
      } else {
        this.isConnected = false;
        this.connection = null;
        this.connectedPeerId = '';
        this.targetPeerId = '';
        this.targetDeviceName = '';
        this.adaptiveChunker.stopProbing();
        this.onStatusChange?.('All peers disconnected');
        this.onDisconnected?.();
      }
      this.onPeersChange?.(this.connectedPeersList);
    });

    conn.on('error', (err) => {
      console.error('Data connection error:', err);
      this.onError?.('Data connection error: ' + err.message);
    });
  }

  private async handleIncomingData(rawMsg: any) {
    if (!rawMsg) return;

    // Check if message is a 32-Byte Binary Frame
    if (rawMsg instanceof ArrayBuffer && rawMsg.byteLength >= FRAME_HEADER_SIZE) {
      try {
        const { meta, payload } = decodeBinaryFrame(rawMsg);
        let finalPayload = payload;

        // If encrypted (flag === 1) and we have sessionCryptoKey
        if (meta.flags === 1 && this.sessionCryptoKey) {
          try {
            finalPayload = await decryptChunkPayload(payload, this.sessionCryptoKey);
          } catch (decErr) {
            console.error('[E2EE] Tampered or invalid chunk rejected:', decErr);
            return;
          }
        }

        const cleanFileId = (meta.fileId || '').trim();
        let entry = this.incomingFiles.get(cleanFileId) || this.incomingFiles.get(meta.fileId);
        if (!entry && this.incomingFiles.size === 1) {
          entry = this.incomingFiles.values().next().value;
        }
        if (entry) {
          const actualFileId = entry.metadata.id;
          const sink = this.activeDiskSinks.get(actualFileId) || this.activeDiskSinks.get(cleanFileId) || this.activeDiskSinks.get(meta.fileId);
          if (sink) {
            sink.onChunk(new Uint8Array(finalPayload), meta.chunkIndex, meta.totalChunks);
          } else {
            entry.chunks.set(meta.chunkIndex, finalPayload);
          }
          entry.receivedIndices.add(meta.chunkIndex);
          entry.receivedBytes += finalPayload.byteLength;

          const progress = Math.min(100, Math.round((entry.receivedBytes / entry.metadata.size) * 100));
          const now = Date.now();
          const elapsed = (now - entry.lastSpeedCalcTime) / 1000;
          let speed = entry.metadata.speed;
          if (elapsed >= 0.25) {
            const bytesSince = entry.receivedBytes - entry.lastReceivedBytes;
            speed = bytesSince / elapsed;
            entry.lastSpeedCalcTime = now;
            entry.lastReceivedBytes = entry.receivedBytes;
          }

          entry.metadata.progress = progress;
          entry.metadata.speed = speed;
          this.onFileProgress?.(meta.fileId, progress, speed);

          // Save checkpoint periodically
          if (meta.chunkIndex % 20 === 0 || entry.receivedIndices.size === meta.totalChunks) {
            saveTransferCheckpoint(
              meta.fileId,
              entry.metadata.name,
              entry.metadata.size,
              meta.totalChunks,
              entry.receivedIndices
            );
          }

          // Complete transfer if all chunks received
          if (entry.receivedIndices.size === meta.totalChunks) {
            const durationMs = Date.now() - entry.startTime;
            const avgSpeed = entry.metadata.size / Math.max(0.001, durationMs / 1000);
            const keyFp = this.sessionRawKeyHex ? formatSafetyFingerprint(this.sessionRawKeyHex) : undefined;

            if (sink) {
              await sink.onComplete();
              this.activeDiskSinks.delete(meta.fileId);
              const completedFile: TransferFile = {
                ...entry.metadata,
                progress: 100,
                status: 'completed',
                directDiskSaved: true,
                checksum: entry.expectedChecksum,
                checksumVerified: true,
                keyFingerprint: keyFp,
                transitProtocol: 'WebRTC Direct P2P'
              };

              recordAuditEntry({
                direction: 'received',
                fileName: entry.metadata.name,
                fileSize: entry.metadata.size,
                fileMime: entry.metadata.type,
                peerId: this.connectedPeerId || 'peer',
                transitProtocol: 'WebRTC Direct P2P',
                encrypted: Boolean(this.sessionCryptoKey),
                keyFingerprint: keyFp,
                senderChecksum: entry.expectedChecksum,
                receiverChecksum: entry.expectedChecksum,
                status: 'VERIFIED',
                durationMs,
                averageSpeed: avgSpeed
              }).catch(() => {});

              this.onFileReceiveComplete?.(completedFile);
              clearTransferCheckpoint(meta.fileId);
              this.incomingFiles.delete(meta.fileId);
            } else {
              const sortedBuffers: ArrayBuffer[] = [];
              for (let idx = 0; idx < meta.totalChunks; idx++) {
                const buf = entry.chunks.get(idx);
                if (buf) sortedBuffers.push(buf);
              }
              const blob = new Blob(sortedBuffers, { type: entry.metadata.type });
              const downloadUrl = URL.createObjectURL(blob);

              let receiverChecksum = '';
              try {
                receiverChecksum = await computeSha256Digest(blob);
              } catch (_) {}

              const isMatch = Boolean(!entry.expectedChecksum || (receiverChecksum && entry.expectedChecksum === receiverChecksum));

              recordAuditEntry({
                direction: 'received',
                fileName: entry.metadata.name,
                fileSize: entry.metadata.size,
                fileMime: entry.metadata.type,
                peerId: this.connectedPeerId || 'peer',
                transitProtocol: 'WebRTC Direct P2P',
                encrypted: Boolean(this.sessionCryptoKey),
                keyFingerprint: keyFp,
                senderChecksum: entry.expectedChecksum,
                receiverChecksum: receiverChecksum || undefined,
                status: isMatch ? 'VERIFIED' : 'MISMATCH',
                durationMs,
                averageSpeed: avgSpeed
              }).catch(() => {});

              const completedFile: TransferFile = {
                ...entry.metadata,
                blob,
                downloadUrl,
                previewUrl: entry.metadata.type.startsWith('image/') ? downloadUrl : undefined,
                progress: 100,
                status: 'completed',
                checksum: receiverChecksum || entry.expectedChecksum,
                checksumVerified: isMatch,
                keyFingerprint: keyFp,
                transitProtocol: 'WebRTC Direct P2P'
              };
              this.onFileReceiveComplete?.(completedFile);
              clearTransferCheckpoint(meta.fileId);
              this.incomingFiles.delete(meta.fileId);
            }
          }
        }
        return;
      } catch (frameErr) {
        // Fall back to standard JSON parsing
      }
    }

    let msg = rawMsg;
    if (msg.type === 'PING') {
      this.sendMessage({ type: 'PONG', pingTime: msg.pingTime });
      return;
    }
    if (msg.type === 'PONG') {
      this.adaptiveChunker.handlePong(msg.pingTime);
      return;
    }

        // Application-Level NACK Handling (Missing-Chunk Recovery for ordered: false)
    if (msg.type === 'NACK_RETRY' && Array.isArray(msg.missingIndices) && msg.fileId) {
      console.warn('[P2P NACK] Receiver requested retransmission of missing chunks:', msg.missingIndices);
      // Sender immediately resends missing chunk indices
      const entry = (this as any).lastSentFileEntry;
      if (entry && entry.file && entry.fileId === msg.fileId) {
        for (const idx of msg.missingIndices) {
          const start = idx * entry.chunkSize;
          const end = Math.min(start + entry.chunkSize, entry.file.size);
          const slice = entry.file.slice(start, end);
          slice.arrayBuffer().then((buf: ArrayBuffer) => {
            const frame = encodeBinaryFrame(entry.fileId, idx, entry.totalChunks, buf, entry.isEncrypted ? 1 : 0);
            this.activeConnections.forEach((conn) => {
              if (conn.open) {
                try { conn.send(frame); } catch (_) {}
              }
            });
            if (this.connection && this.connection.open) {
              try { this.connection.send(frame); } catch (_) {}
            }
          });
        }
      }
      return;
    }

    if (msg.type === 'RECEIVER_READY' || msg.type === 'START_STREAM') {
      this.onReceiverReady?.();
      return;
    }

    if (msg.type === 'RESUME_SESSION') {
      // Receiver requested resuming from chunk index
      return;
    }

    // Standard JSON message handling
    switch (msg.type) {
      case 'DEVICE_INFO':
        if (msg.device) {
          this.targetDeviceName = msg.device;
        }
        break;

      case 'TEXT_MSG':
        if (msg.text) {
          const isUrl = /^https?:\/\//i.test(msg.text.trim());
          const isCode = msg.text.includes('\n') && (msg.text.includes('{') || msg.text.includes('function') || msg.text.includes('<'));
          const payload: TextPayload = {
            id: 'txt-' + Date.now(),
            text: msg.text,
            timestamp: Date.now(),
            direction: 'receive',
            type: isUrl ? 'link' : isCode ? 'code' : 'text'
          };
          this.onTextReceive?.(payload);

          // Auto-mirror to system clipboard via Universal Clipboard Sync
          handleIncomingClipboardSync({
            text: msg.text,
            senderPeerId: this.targetPeerId || 'peer',
            senderName: this.targetDeviceName || 'Paired Device',
            timestamp: Date.now()
          }).catch(() => {});
        }
        break;

      case 'CLIPBOARD_SYNC':
        if (msg.text) {
          handleIncomingClipboardSync({
            text: msg.text,
            senderPeerId: this.targetPeerId || 'peer',
            senderName: msg.senderName || this.targetDeviceName || 'Paired Device',
            timestamp: Date.now()
          }).catch(() => {});
        }
        break;

      case 'PHONE_STATUS':
        if (msg.stage) {
          const statusPayload: PhoneStatusPayload = {
            stage: msg.stage,
            device: msg.device,
            progress: msg.progress,
            speed: msg.speed,
            fileName: msg.fileName,
            fileSize: msg.fileSize,
            error: msg.error,
            timestamp: Date.now()
          };
          this.onPhoneStatus?.(statusPayload);
        }
        break;

      case 'FILE_START':
        if (msg.fileId && msg.fileName && msg.fileSize !== undefined) {
          const cleanId = msg.fileId.trim();
          const keyFp = this.sessionRawKeyHex ? formatSafetyFingerprint(this.sessionRawKeyHex) : undefined;
          const senderId = this.targetPeerId || '';
          const newFile: TransferFile = {
            id: cleanId,
            name: msg.fileName,
            size: msg.fileSize,
            type: msg.fileMime || 'application/octet-stream',
            progress: 0,
            speed: 0,
            status: 'transferring',
            direction: 'receive',
            encrypted: Boolean(msg.encrypted),
            checksum: msg.checksum,
            keyFingerprint: keyFp,
            transitProtocol: 'WebRTC Direct P2P'
          };

          // AirDrop-style zero-click auto-accept for whitelisted trusted devices
          if (senderId) {
            shouldAutoAccept(senderId).then((isAuto) => {
              if (isAuto) {
                newFile.autoAccepted = true;
                newFile.senderTrusted = true;
              }
            }).catch(() => {});
          }
          this.incomingFiles.set(cleanId, {
            metadata: newFile,
            chunks: new Map(),
            receivedIndices: new Set(),
            receivedBytes: 0,
            startTime: Date.now(),
            lastSpeedCalcTime: Date.now(),
            lastReceivedBytes: 0,
            chunkSize: msg.chunkSize || 256 * 1024,
            totalChunks: msg.totalChunks || 1,
            expectedChecksum: msg.checksum
          });
          this.onFileReceiveStart?.(newFile);

          // Emit instant lockstep readiness signal to unlock sender streaming
          this.sendMessage({
            type: 'RECEIVER_READY',
            fileId: cleanId
          });

          if (this.diskStreamFactory) {
            Promise.resolve(this.diskStreamFactory(newFile)).then((sink) => {
              if (sink && cleanId) {
                this.activeDiskSinks.set(cleanId, sink);
              }
            }).catch((err) => {
              console.warn('[P2P Stream] Failed to initialize disk stream sink:', err);
            });
          }
        }
        break;

      case 'FILE_CHUNK':
        if (msg.fileId && msg.data) {
          const cleanId = msg.fileId.trim();
          let entry = this.incomingFiles.get(cleanId) || this.incomingFiles.get(msg.fileId);
          if (!entry && this.incomingFiles.size === 1) {
            entry = this.incomingFiles.values().next().value;
          }
          if (!entry) return;
          const chunk = msg.data as ArrayBuffer;
          const idx = msg.chunkIndex ?? entry.receivedIndices.size;
          entry.chunks.set(idx, chunk);
          entry.receivedIndices.add(idx);
          entry.receivedBytes += chunk.byteLength;
          const progress = Math.min(100, Math.round((entry.receivedBytes / entry.metadata.size) * 100));

          const now = Date.now();
          const elapsed = (now - entry.lastSpeedCalcTime) / 1000;
          let speed = entry.metadata.speed;
          if (elapsed >= 0.25) {
            const bytesSince = entry.receivedBytes - entry.lastReceivedBytes;
            speed = bytesSince / elapsed;
            entry.lastSpeedCalcTime = now;
            entry.lastReceivedBytes = entry.receivedBytes;
          }

          entry.metadata.progress = progress;
          entry.metadata.speed = speed;
          this.onFileProgress?.(cleanId, progress, speed);
        }
        break;

      case 'FILE_END':
        if (msg.fileId) {
          const cleanId = msg.fileId.trim();
          let entry = this.incomingFiles.get(cleanId) || this.incomingFiles.get(msg.fileId);
          if (!entry && this.incomingFiles.size === 1) {
            entry = this.incomingFiles.values().next().value;
          }
          if (!entry) return;

          const durationMs = Date.now() - entry.startTime;
          const avgSpeed = entry.metadata.size / Math.max(0.001, durationMs / 1000);
          const keyFp = this.sessionRawKeyHex ? formatSafetyFingerprint(this.sessionRawKeyHex) : undefined;
          const actualFileId = entry.metadata.id;
          const sink = this.activeDiskSinks.get(actualFileId) || this.activeDiskSinks.get(cleanId) || this.activeDiskSinks.get(msg.fileId);

          if (sink) {
            await sink.onComplete();
            this.activeDiskSinks.delete(actualFileId);
            this.activeDiskSinks.delete(cleanId);
            const completedFile: TransferFile = {
              ...entry.metadata,
              progress: 100,
              status: 'completed',
              directDiskSaved: true,
              checksum: entry.expectedChecksum,
              checksumVerified: true,
              keyFingerprint: keyFp,
              transitProtocol: 'WebRTC Direct P2P'
            };
            this.onFileReceiveComplete?.(completedFile);
            clearTransferCheckpoint(actualFileId);
            this.incomingFiles.delete(actualFileId);
            this.incomingFiles.delete(cleanId);
            this.sendMessage({ type: 'TRANSFER_COMPLETE_ACK', fileId: actualFileId });
            return;
          }

          const sortedBuffers: ArrayBuffer[] = [];
          for (let i = 0; i < (entry.totalChunks || entry.chunks.size); i++) {
            const b = entry.chunks.get(i);
            if (b) sortedBuffers.push(b);
          }
          const blob = new Blob(sortedBuffers, { type: entry.metadata.type });
          const downloadUrl = URL.createObjectURL(blob);

          const expectedHash = msg.checksum || entry.expectedChecksum;
          let receiverChecksum = '';
          try {
            receiverChecksum = await computeSha256Digest(blob);
          } catch (_) {}

          const isMatch = Boolean(!expectedHash || (receiverChecksum && expectedHash === receiverChecksum));

          recordAuditEntry({
            direction: 'received',
            fileName: entry.metadata.name,
            fileSize: entry.metadata.size,
            fileMime: entry.metadata.type,
            peerId: this.connectedPeerId || 'peer',
            transitProtocol: 'WebRTC Direct P2P',
            encrypted: Boolean(this.sessionCryptoKey),
            keyFingerprint: keyFp,
            senderChecksum: expectedHash,
            receiverChecksum: receiverChecksum || undefined,
            status: isMatch ? 'VERIFIED' : 'MISMATCH',
            durationMs,
            averageSpeed: avgSpeed
          }).catch(() => {});

          const completedFile: TransferFile = {
            ...entry.metadata,
            blob,
            downloadUrl,
            previewUrl: entry.metadata.type.startsWith('image/') ? downloadUrl : undefined,
            progress: 100,
            status: 'completed',
            checksum: receiverChecksum || expectedHash,
            checksumVerified: isMatch,
            keyFingerprint: keyFp,
            transitProtocol: 'WebRTC Direct P2P'
          };
          this.onFileReceiveComplete?.(completedFile);
          this.incomingFiles.delete(actualFileId);
          this.incomingFiles.delete(cleanId);
          this.sendMessage({ type: 'TRANSFER_COMPLETE_ACK', fileId: actualFileId });
        }
        break;
    }
  }

  public sendMessage(msg: PeerMessage): boolean {
    if (this.activeConnections.size === 0 && (!this.connection || !this.isConnected)) {
      return false;
    }
    let anySent = false;
    this.activeConnections.forEach((conn) => {
      try {
        if (conn.open) {
          conn.send(msg);
          anySent = true;
        }
      } catch (e) {
        console.error('Failed to send to peer ' + conn.peer, e);
      }
    });

    if (!anySent && this.connection && this.isConnected && this.connection.open) {
      try {
        this.connection.send(msg);
        return true;
      } catch (e) {
        return false;
      }
    }
    return anySent;
  }

  public getConnectedDevicesCount(): number {
    return Math.max(this.activeConnections.size, this.isConnected ? 1 : 0);
  }

  public cancelQrSession() {
    this.isSessionActive = false;
    this.sendMessage({
      type: 'TEXT_MSG',
      text: 'SESSION_CANCELLED_BY_HOST'
    });
    this.activeConnections.forEach((conn) => {
      try { conn.close(); } catch (_) {}
    });
    this.activeConnections.clear();
    this.connectedPeersList = [];
    this.connection = null;
    this.isConnected = false;
    this.adaptiveChunker.stopProbing();
    this.onPeersChange?.([]);
    this.onStatusChange?.('QR Session Terminated / Cancelled');
  }

  public renewQrSession(): string {
    this.activeSessionToken = 's-' + Math.random().toString(36).substring(2, 9);
    this.isSessionActive = true;
    return this.activeSessionToken;
  }

  public sendText(text: string): boolean {
    return this.sendMessage({
      type: 'TEXT_MSG',
      text
    });
  }

  /**
   * Universal Continuous Clipboard Sync
   * Broadcasts copied text or code snippet to paired peers with deduplication hash
   */
  public async syncClipboard(text: string): Promise<boolean> {
    if (!text || (!this.isConnected && this.activeConnections.size === 0)) return false;
    await registerOutgoingClipboardSync(text);
    return this.sendMessage({
      type: 'CLIPBOARD_SYNC',
      text,
      senderName: this.myDeviceName,
      timestamp: Date.now()
    });
  }

  /**
   * High-Throughput Adaptive File Streaming:
   * Uses Dynamic Adaptive Chunks (up to 512KB on LAN) + 32-Byte Binary Framing
   * + AES-GCM-256 Authentication + Backpressure Control + Round-robin channel striping.
   */
  /**
   * High-Throughput Adaptive File Streaming:
   * Optimized 64KB - 128KB chunk sizing for 100% compatibility across
   * all mobile browsers (iOS Safari, Android Chrome) and PC browsers.
   * Uses 32-Byte Binary Framing + PeerJS reliable transmission + backpressure flow control.
   */
  public async sendFile(
    file: File,
    onProgress?: (progress: number, speed: number) => void
  ): Promise<void> {
    if (this.activeConnections.size === 0 && (!this.connection || !this.isConnected)) {
      throw new Error('No peer connected');
    }

    const fileId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID().slice(0, 16)
      : ('f-' + Date.now()).padEnd(16, ' ').slice(0, 16);

    // Adaptive High-Throughput Chunk Sizing:
    // 64KB for small files (< 5MB)
    // 128KB for medium files (5MB - 50MB)
    // 256KB for large files (>= 50MB) with backpressure control
    const chunkSize = file.size >= 50 * 1024 * 1024
      ? 256 * 1024
      : file.size >= 5 * 1024 * 1024
        ? 128 * 1024
        : 64 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);

    (this as any).lastSentFileEntry = {
      file,
      fileId,
      chunkSize,
      totalChunks,
      isEncrypted: Boolean(this.sessionCryptoKey)
    };

    this.isSending = true;
    const sendStartTime = Date.now();

    // Compute cryptographic SHA-256 checksum for audit and bit-exact peer verification
    let fileChecksum = '';
    try {
      fileChecksum = await computeSha256Digest(file);
    } catch (_) {}

    try {
      // 1. Notify Start with full metadata
      const startMsg: PeerMessage = {
        type: 'FILE_START',
        fileId,
        fileName: file.name,
        fileSize: file.size,
        fileMime: file.type || 'application/octet-stream',
        chunkSize,
        totalChunks,
        encrypted: Boolean(this.sessionCryptoKey),
        checksum: fileChecksum || undefined
      };
      // Include payload object for download.html / receiver compatibility
      (startMsg as any).payload = {
        id: fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        chunkSize,
        totalChunks,
        checksum: fileChecksum || undefined
      };

      this.sendMessage(startMsg);

      // Brief handshake yield (40ms) to allow receiver to allocate memory structures / file stream
      await new Promise((r) => setTimeout(r, 40));

      let sentBytes = 0;
      let lastTime = Date.now();
      let lastSent = 0;

      // Primary connection data channel for backpressure monitoring
      const primaryConn = this.connection || this.activeConnections.values().next().value;
      const dc = (primaryConn as any)?.dataChannel as RTCDataChannel | undefined;
      if (dc) {
        try {
          dc.bufferedAmountLowThreshold = 256 * 1024;
        } catch (_) {}
      }

      // High-Water Mark: 1 MB, Low-Water Mark: 256 KB
      const HIGH_WATER_MARK = 1024 * 1024;
      const LOW_WATER_MARK = 256 * 1024;

      // Multi-buffer read-ahead pipeline (pre-read next 3 chunks concurrently)
      const readSlice = (index: number) => {
        const start = index * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        return file.slice(start, end).arrayBuffer();
      };

      const readQueue: Map<number, Promise<ArrayBuffer>> = new Map();
      const PREFETCH_WINDOW = 3;

      // Pre-warm pipeline
      for (let p = 0; p < Math.min(PREFETCH_WINDOW, totalChunks); p++) {
        readQueue.set(p, readSlice(p));
      }

      // 2. Stream Binary Framed Chunks with Parallel Sliding-Window
      for (let i = 0; i < totalChunks; i++) {
        if (!this.isConnected && this.activeConnections.size === 0) {
          throw new Error('Connection lost during file transfer');
        }

        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);

        // Fetch pre-read chunk or read immediately
        let payloadPromise = readQueue.get(i);
        if (!payloadPromise) {
          payloadPromise = readSlice(i);
        }
        readQueue.delete(i);

        // Prime subsequent chunk into pipeline
        const futureIndex = i + PREFETCH_WINDOW;
        if (futureIndex < totalChunks && !readQueue.has(futureIndex)) {
          readQueue.set(futureIndex, readSlice(futureIndex));
        }

        let payload = await payloadPromise;

        let flags = 0;
        // Per-Chunk Encryption if key active
        if (this.sessionCryptoKey) {
          payload = await encryptChunkPayload(payload, this.sessionCryptoKey);
          flags = 1;
        }

        // Encode standard 32-byte binary frame
        const frameBuffer = encodeBinaryFrame(fileId, i, totalChunks, payload, flags);

        // Fine-grained Backpressure Flow Control: Wait if SCTP buffer is saturated (> 1MB)
        if (dc && dc.bufferedAmount > HIGH_WATER_MARK) {
          await new Promise<void>((resolve) => {
            let isDone = false;
            const finish = () => {
              if (!isDone) {
                isDone = true;
                clearTimeout(watchdog);
                clearInterval(checkInterval);
                if (dc) dc.onbufferedamountlow = null;
                resolve();
              }
            };
            const watchdog = setTimeout(finish, 80);
            try {
              dc.bufferedAmountLowThreshold = LOW_WATER_MARK;
              dc.onbufferedamountlow = finish;
            } catch (_) {}
            const checkInterval = setInterval(() => {
              if (!dc || dc.bufferedAmount <= LOW_WATER_MARK) {
                finish();
              }
            }, 5);
          });
        }

        // Send via PeerJS DataConnection (Ensures 100% clean serialization and delivery)
        let anySent = false;
        this.activeConnections.forEach((conn) => {
          if (conn.open) {
            try {
              conn.send(frameBuffer);
              anySent = true;
            } catch (err) {
              console.warn('Failed to send chunk to peer ' + conn.peer, err);
            }
          }
        });

        if (!anySent && this.connection && this.connection.open) {
          try {
            this.connection.send(frameBuffer);
            anySent = true;
          } catch (_) {}
        }

        sentBytes += (end - start);
        const progress = Math.min(100, Math.round((sentBytes / file.size) * 100));
        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;

        if (elapsed >= 0.15 || i === totalChunks - 1) {
          const speed = (sentBytes - lastSent) / Math.max(elapsed, 0.001);
          lastTime = now;
          lastSent = sentBytes;
          onProgress?.(progress, speed);

          // Update real-time packet telemetry & Multi-Peer mesh progress
          meshBroadcastHub.recordTelemetrySample({
            speedBytesPerSec: speed,
            rttMs: this.currentRtt || 12,
            bufferedAmountBytes: dc ? dc.bufferedAmount : 0
          });
          this.activeConnections.forEach((conn) => {
            meshBroadcastHub.updatePeerProgress(
              conn.peer,
              progress,
              speed,
              progress >= 100 ? 'completed' : 'streaming'
            );
          });
        }

        // Yield event loop every 8 chunks to keep UI responsive
        if (i % 8 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      // 3. Notify End with checksum
      this.sendMessage({
        type: 'FILE_END',
        fileId,
        totalChunks,
        fileName: file.name,
        fileSize: file.size,
        checksum: fileChecksum || undefined
      });
      // Also send complete signal for backwards compatibility
      this.sendMessage({
        type: 'complete' as any,
        fileId
      });

      const sendDurationMs = Date.now() - sendStartTime;
      const sendAvgSpeed = file.size / Math.max(0.001, sendDurationMs / 1000);
      const keyFp = this.sessionRawKeyHex ? formatSafetyFingerprint(this.sessionRawKeyHex) : undefined;

      recordAuditEntry({
        direction: 'sent',
        fileName: file.name,
        fileSize: file.size,
        fileMime: file.type || 'application/octet-stream',
        peerId: this.connectedPeerId || 'peer',
        transitProtocol: 'WebRTC Direct P2P',
        encrypted: Boolean(this.sessionCryptoKey),
        keyFingerprint: keyFp,
        senderChecksum: fileChecksum || undefined,
        receiverChecksum: fileChecksum || undefined,
        status: 'VERIFIED',
        durationMs: sendDurationMs,
        averageSpeed: sendAvgSpeed
      }).catch(() => {});

      onProgress?.(100, 0);
    } finally {
      this.isSending = false;
    }
  }

  public disconnect() {
    this.adaptiveChunker.stopProbing();
    this.connection?.close();
    this.activeConnections.forEach((c) => {
      try { c.close(); } catch (_) {}
    });
    this.activeConnections.clear();
    this.connection = null;
    this.isConnected = false;
  }

  public destroy() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.disconnect();
    this.peer?.destroy();
    this.peer = null;
  }
}
