import Peer, { DataConnection } from 'peerjs';

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
}

export interface TextPayload {
  id: string;
  text: string;
  timestamp: number;
  direction: 'send' | 'receive';
  type: 'link' | 'text' | 'code';
}

export interface PeerMessage {
  type: 'FILE_START' | 'FILE_CHUNK' | 'FILE_END' | 'TEXT_MSG' | 'PING' | 'PONG' | 'DEVICE_INFO';
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  chunkIndex?: number;
  totalChunks?: number;
  data?: ArrayBuffer | string;
  text?: string;
  device?: string;
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

const CHUNK_SIZE = 64 * 1024; // 64 KB chunks

export class P2PTransferManager {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  public myPeerId: string = '';
  public connectedPeerId: string = '';
  public isConnected: boolean = false;
  public isConnecting: boolean = false;

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
    chunks: ArrayBuffer[];
    receivedBytes: number;
    startTime: number;
    lastSpeedCalcTime: number;
    lastReceivedBytes: number;
  }> = new Map();

  // Sending state
  private isSending: boolean = false;
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;

  constructor() {}

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
            const str = args.map(a => (a && a.message) || String(a)).join(' ');
            if (str.includes('Lost connection') || str.includes('socket') || str.includes('disconnected')) {
              // Harmless signaling socket reconnect notice - handled by auto-reconnect
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
          this.setupConnection(conn);
        });

        this.peer.on('error', (err: any) => {
          const errMsg = String(err?.message || err?.type || err || '');
          const errType = String(err?.type || '');

          // 1. Signaling server disconnect / socket drop is normal & recoverable
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

          // 2. Peer not yet online on signaling server
          if (errType === 'peer-unavailable') {
            console.warn('[BeamDrop P2P] Target peer not yet connected to signaling server');
            this.onStatusChange?.('Waiting for peer to connect...');
            return;
          }

          // 3. ID taken - retry with fresh ID
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
          // Keep-alive ping to peerjs socket
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
          // If reconnect throws because ID was taken or expired, recreate peer
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
    this.connection = conn;
    this.connectedPeerId = conn.peer;
    this.isConnected = true;
    this.isConnecting = false;
    this.onStatusChange?.('Connected with peer');
    this.onConnected?.(conn.peer);

    // Send device info
    this.sendMessage({
      type: 'DEVICE_INFO',
      device: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop / PC'
    });

    conn.on('data', (raw: any) => {
      this.handleIncomingData(raw);
    });

    conn.on('close', () => {
      this.isConnected = false;
      this.connection = null;
      this.onStatusChange?.('Peer disconnected');
      this.onDisconnected?.();
    });

    conn.on('error', (err) => {
      console.error('Data connection error:', err);
      this.onError?.('Data connection error: ' + err.message);
    });
  }

  private handleIncomingData(rawMsg: any) {
    if (!rawMsg || !rawMsg.type) return;

    let msg = rawMsg;

    // Normalize different sender formats (header / chunk / complete vs FILE_START / FILE_CHUNK / FILE_END)
    if (msg.type === 'header' && msg.payload) {
      msg = {
        type: 'FILE_START',
        fileId: msg.fileId || msg.payload.id || 'file-' + Date.now(),
        fileName: msg.payload.name,
        fileSize: msg.payload.size,
        fileMime: msg.payload.mimeType || 'application/octet-stream',
        totalChunks: msg.payload.totalChunks
      };
    } else if (msg.type === 'chunk') {
      let fId = msg.fileId;
      if (!fId && this.incomingFiles.size > 0) {
        fId = Array.from(this.incomingFiles.keys())[this.incomingFiles.size - 1];
      }
      msg = {
        type: 'FILE_CHUNK',
        fileId: fId,
        chunkIndex: msg.chunkIndex,
        data: msg.data
      };
    } else if (msg.type === 'complete') {
      let fId = msg.fileId;
      if (!fId && this.incomingFiles.size > 0) {
        fId = Array.from(this.incomingFiles.keys())[this.incomingFiles.size - 1];
      }
      msg = {
        type: 'FILE_END',
        fileId: fId
      };
    }

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
            direction: 'receive'
          };

          this.incomingFiles.set(msg.fileId, {
            metadata: newFile,
            chunks: [],
            receivedBytes: 0,
            startTime: Date.now(),
            lastSpeedCalcTime: Date.now(),
            lastReceivedBytes: 0
          });

          this.onFileReceiveStart?.(newFile);
        }
        break;

      case 'FILE_CHUNK':
        if (msg.fileId && msg.data) {
          const entry = this.incomingFiles.get(msg.fileId);
          if (!entry) return;

          const chunk = msg.data as ArrayBuffer;
          entry.chunks.push(chunk);
          entry.receivedBytes += chunk.byteLength;

          const progress = Math.min(100, Math.round((entry.receivedBytes / entry.metadata.size) * 100));

          // Calculate speed every 250ms
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

          const blob = new Blob(entry.chunks, { type: entry.metadata.type });
          const downloadUrl = URL.createObjectURL(blob);

          let previewUrl: string | undefined = undefined;
          if (entry.metadata.type.startsWith('image/')) {
            previewUrl = downloadUrl;
          }

          const completedFile: TransferFile = {
            ...entry.metadata,
            blob,
            downloadUrl,
            previewUrl,
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
    if (!this.connection || !this.isConnected) {
      return false;
    }
    try {
      this.connection.send(msg);
      return true;
    } catch (e) {
      console.error('Failed to send message:', e);
      return false;
    }
  }

  public sendText(text: string): boolean {
    return this.sendMessage({
      type: 'TEXT_MSG',
      text
    });
  }

  public async sendFile(
    file: File,
    onProgress?: (progress: number, speed: number) => void
  ): Promise<void> {
    if (!this.connection || !this.isConnected) {
      throw new Error('No peer connected');
    }

    const fileId = 'file-' + Math.random().toString(36).substring(2, 9);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // 1. Notify start
    this.sendMessage({
      type: 'FILE_START',
      fileId,
      fileName: file.name,
      fileSize: file.size,
      fileMime: file.type || 'application/octet-stream',
      totalChunks
    });

    let sentBytes = 0;
    let lastTime = Date.now();
    let lastSent = 0;

    // 2. Stream chunk by chunk
    for (let i = 0; i < totalChunks; i++) {
      if (!this.isConnected) {
        throw new Error('Connection lost during file transfer');
      }

      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const slice = file.slice(start, end);
      const buffer = await slice.arrayBuffer();

      this.sendMessage({
        type: 'FILE_CHUNK',
        fileId,
        chunkIndex: i,
        totalChunks,
        data: buffer
      });

      sentBytes += buffer.byteLength;
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

      // Backpressure control: Wait if WebRTC buffer has > 1MB queued
      const dataChannel = (this.connection as any)?.dataChannel as RTCDataChannel | undefined;
      if (dataChannel) {
        while (dataChannel.bufferedAmount > 1024 * 1024) {
          await new Promise((r) => setTimeout(r, 20));
        }
      }

      // Small throttling yield to avoid overwhelming browser DataChannel buffer
      if (i % 8 === 0) {
        await new Promise((r) => setTimeout(r, 4));
      }
    }

    // 3. Notify end
    this.sendMessage({
      type: 'FILE_END',
      fileId
    });

    onProgress?.(100, 0);
  }

  public disconnect() {
    this.connection?.close();
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
