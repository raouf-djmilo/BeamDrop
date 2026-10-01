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
  decryptChunkPayload
} from './engine/crypto';

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
}

export interface TextPayload {
  id: string;
  text: string;
  timestamp: number;
  direction: 'send' | 'receive';
  type: 'link' | 'text' | 'code';
}

export interface PeerMessage {
  type: 'FILE_START' | 'FILE_CHUNK' | 'FILE_END' | 'TEXT_MSG' | 'PING' | 'PONG' | 'DEVICE_INFO' | 'RESUME_SESSION' | 'RESUME_ACK' | 'RECEIVER_READY' | 'ACK_METADATA';
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
  pingTime?: number;
  encrypted?: boolean;
  nextExpectedChunk?: number;
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
  // Multiplexed parallel channels per peer for unordered Head-of-line blocking elimination
  private subChannels: Map<string, RTCDataChannel[]> = new Map();

  public connectedPeersList: string[] = [];
  public onPeersChange?: (peers: string[]) => void;
  public myPeerId: string = '';
  public connectedPeerId: string = '';
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
  public onStatusChange?: (status: string) => void;
  public onFileReceiveStart?: (file: TransferFile) => void;
  public onFileProgress?: (fileId: string, progress: number, speed: number) => void;
  public onFileReceiveComplete?: (file: TransferFile) => void;
  public onTextReceive?: (textPayload: TextPayload) => void;
  public onError?: (error: string) => void;

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
      if (this.peer && !this.peer.destroyed) {
        if (this.peer.disconnected) {
          this.attemptReconnect();
        } else {
          try {
            const socket = (this.peer as any).socket;
            if (socket && socket._socket && socket._socket.readyState === WebSocket.OPEN) {
              socket._send({ type: 'HEARTBEAT' });
            }
          } catch (e) {}
        }
      }
    }, 15000);
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
        } catch (e) {
          try {
            this.init(this.myPeerId).catch(() => {});
          } catch (_) {}
        }
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
    this.activeConnections.set(conn.peer, conn);
    this.connectedPeersList = Array.from(this.activeConnections.keys());
    this.isConnected = true;
    this.isConnecting = false;

    const devCount = this.activeConnections.size;
    this.onStatusChange?.(`Connected with peer (${devCount} device${devCount > 1 ? 's' : ''})`);
    this.onConnected?.(conn.peer);
    this.onPeersChange?.(this.connectedPeersList);

    // Setup multiplexed secondary channel if supported
    this.setupMultiplexedChannels(conn);

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
      this.subChannels.delete(conn.peer);
      this.connectedPeersList = Array.from(this.activeConnections.keys());

      if (this.activeConnections.size > 0) {
        this.connection = this.activeConnections.values().next().value || null;
        this.connectedPeerId = this.connection ? this.connection.peer : '';
        this.isConnected = true;
        this.onStatusChange?.(`Peer disconnected (${this.activeConnections.size} remaining)`);
      } else {
        this.isConnected = false;
        this.connection = null;
        this.connectedPeerId = '';
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

  private setupMultiplexedChannels(conn: DataConnection) {
    try {
      const pc = (conn as any).peerConnection as RTCPeerConnection | undefined;
      if (pc && typeof pc.createDataChannel === 'function') {
        const ch1 = pc.createDataChannel(`beam_strip_1`, { ordered: false, maxRetransmits: 30 });
        ch1.binaryType = 'arraybuffer';
        ch1.onmessage = (evt) => this.handleIncomingData(evt.data);

        const ch2 = pc.createDataChannel(`beam_strip_2`, { ordered: false, maxRetransmits: 30 });
        ch2.binaryType = 'arraybuffer';
        ch2.onmessage = (evt) => this.handleIncomingData(evt.data);

        this.subChannels.set(conn.peer, [ch1, ch2]);
      }
    } catch (e) {
      // Fallback to standard PeerJS data channel
    }
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

        const entry = this.incomingFiles.get(meta.fileId);
        if (entry) {
          entry.chunks.set(meta.chunkIndex, finalPayload);
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
            const sortedBuffers: ArrayBuffer[] = [];
            for (let idx = 0; idx < meta.totalChunks; idx++) {
              const buf = entry.chunks.get(idx);
              if (buf) sortedBuffers.push(buf);
            }
            const blob = new Blob(sortedBuffers, { type: entry.metadata.type });
            const downloadUrl = URL.createObjectURL(blob);
            const completedFile: TransferFile = {
              ...entry.metadata,
              blob,
              downloadUrl,
              previewUrl: entry.metadata.type.startsWith('image/') ? downloadUrl : undefined,
              progress: 100,
              status: 'completed'
            };
            this.onFileReceiveComplete?.(completedFile);
            clearTransferCheckpoint(meta.fileId);
            this.incomingFiles.delete(meta.fileId);
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
            this.sendMessage({
              type: 'FILE_CHUNK',
              fileId: entry.fileId,
              chunkIndex: idx,
              data: frame
            });
          });
        }
      }
      return;
    }

    if (msg.type === 'RESUME_SESSION') {
      // Receiver requested resuming from chunk index
      return;
    }

    // Standard JSON message handling
    switch (msg.type) {
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
        }
        break;

      case 'FILE_START':
        if (msg.fileId && msg.fileName && msg.fileSize !== undefined) {
          const newFile: TransferFile = {
            id: msg.fileId,
            name: msg.fileName,
            size: msg.fileSize,
            type: msg.fileMime || 'application/octet-stream',
            progress: 0,
            speed: 0,
            status: 'transferring',
            direction: 'receive',
            encrypted: Boolean(msg.encrypted)
          };
          this.incomingFiles.set(msg.fileId, {
            metadata: newFile,
            chunks: new Map(),
            receivedIndices: new Set(),
            receivedBytes: 0,
            startTime: Date.now(),
            lastSpeedCalcTime: Date.now(),
            lastReceivedBytes: 0,
            chunkSize: msg.chunkSize || 256 * 1024,
            totalChunks: msg.totalChunks || 1
          });
          this.onFileReceiveStart?.(newFile);
        }
        break;

      case 'FILE_CHUNK':
        if (msg.fileId && msg.data) {
          const entry = this.incomingFiles.get(msg.fileId);
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
          this.onFileProgress?.(msg.fileId, progress, speed);
        }
        break;

      case 'FILE_END':
        if (msg.fileId) {
          const entry = this.incomingFiles.get(msg.fileId);
          if (!entry) return;
          const sortedBuffers: ArrayBuffer[] = [];
          for (let i = 0; i < (entry.totalChunks || entry.chunks.size); i++) {
            const b = entry.chunks.get(i);
            if (b) sortedBuffers.push(b);
          }
          const blob = new Blob(sortedBuffers, { type: entry.metadata.type });
          const downloadUrl = URL.createObjectURL(blob);
          const completedFile: TransferFile = {
            ...entry.metadata,
            blob,
            downloadUrl,
            previewUrl: entry.metadata.type.startsWith('image/') ? downloadUrl : undefined,
            progress: 100,
            status: 'completed'
          };
          this.onFileReceiveComplete?.(completedFile);
          this.incomingFiles.delete(msg.fileId);
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
   * High-Throughput Adaptive File Streaming:
   * Uses Dynamic Adaptive Chunks (up to 512KB on LAN) + 32-Byte Binary Framing
   * + AES-GCM-256 Authentication + Backpressure Control + Round-robin channel striping.
   */
  public async sendFile(
    file: File,
    onProgress?: (progress: number, speed: number) => void
  ): Promise<void> {
    if (this.activeConnections.size === 0 && (!this.connection || !this.isConnected)) {
      throw new Error('No peer connected');
    }

    const fileId = 'file-' + Math.random().toString(36).substring(2, 9);
    const chunkSize = this.adaptiveChunker.currentChunkSize;
    const totalChunks = Math.ceil(file.size / chunkSize);
    (this as any).lastSentFileEntry = {
      file,
      fileId,
      chunkSize,
      totalChunks,
      isEncrypted: Boolean(this.sessionCryptoKey)
    };

    // 1. Notify Start
    this.sendMessage({
      type: 'FILE_START',
      fileId,
      fileName: file.name,
      fileSize: file.size,
      fileMime: file.type || 'application/octet-stream',
      chunkSize,
      totalChunks,
      encrypted: Boolean(this.sessionCryptoKey)
    });

    let sentBytes = 0;
    let lastTime = Date.now();
    let lastSent = 0;

    // Get active data channels for striping
    const primaryConn = this.connection || this.activeConnections.values().next().value;
    const dc = (primaryConn as any)?.dataChannel as RTCDataChannel | undefined;
    const peerId = primaryConn ? primaryConn.peer : '';
    const extraChannels = (peerId && this.subChannels.get(peerId)) || [];
    const allChannels = [dc, ...extraChannels].filter(Boolean) as RTCDataChannel[];

    // 2. Stream Binary Framed Chunks
    for (let i = 0; i < totalChunks; i++) {
      if (!this.isConnected && this.activeConnections.size === 0) {
        throw new Error('Connection lost during file transfer');
      }

      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const slice = file.slice(start, end);
      let payload = await slice.arrayBuffer();

      let flags = 0;
      // Per-Chunk Encryption if key active
      if (this.sessionCryptoKey) {
        payload = await encryptChunkPayload(payload, this.sessionCryptoKey);
        flags = 1;
      }

      // Encode 32-byte binary frame
      const frameBuffer = encodeBinaryFrame(fileId, i, totalChunks, payload, flags);

      // Select channel using round-robin striping
      const targetChannel = allChannels[i % allChannels.length] || dc;

      if (targetChannel && targetChannel.readyState === 'open') {
        // Backpressure check
        await this.adaptiveChunker.handleBackpressure(targetChannel);
        targetChannel.send(frameBuffer);
      } else {
        // Fallback to PeerJS connection
        this.activeConnections.forEach((c) => {
          if (c.open) (c as any).send(frameBuffer);
        });
      }

      sentBytes += (end - start);
      const progress = Math.min(100, Math.round((sentBytes / file.size) * 100));
      const now = Date.now();
      const elapsed = (now - lastTime) / 1000;
      let speed = 0;

      if (elapsed >= 0.25 || i === totalChunks - 1) {
        speed = (sentBytes - lastSent) / Math.max(elapsed, 0.001);
        lastTime = now;
        lastSent = sentBytes;
        onProgress?.(progress, speed);
      }

      // Yield event loop every 8 chunks
      if (i % 8 === 0) {
        await new Promise((r) => setTimeout(r, 1));
      }
    }

    // 3. Notify End
    this.sendMessage({
      type: 'FILE_END',
      fileId
    });

    onProgress?.(100, 0);
  }

  public disconnect() {
    this.adaptiveChunker.stopProbing();
    this.connection?.close();
    this.activeConnections.forEach((c) => {
      try { c.close(); } catch (_) {}
    });
    this.activeConnections.clear();
    this.subChannels.clear();
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
