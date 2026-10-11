/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop Multi-Peer Mesh Broadcasting Engine & Real-Time Telemetry Hub
 * Coordinates simultaneous multi-device transfers and stream telemetry.
 */

export interface MeshPeerDevice {
  peerId: string;
  name: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  connectedAt: number;
  progress: number;
  speed: number; // bytes/sec
  status: 'connected' | 'streaming' | 'completed' | 'error';
  lastAckChunk?: number;
  rtt?: number;
}

export interface TelemetrySample {
  timestamp: number;
  speedBytesPerSec: number;
  rttMs: number;
  bufferedAmountBytes: number;
}

export interface LiveEngineTelemetry {
  currentThroughput: number;
  peakThroughput: number;
  rttMs: number;
  bufferedAmount: number;
  chunksSent: number;
  totalChunks: number;
  packetsVerified: number;
  transportType: 'LAN Direct P2P' | 'STUN Direct P2P' | 'TURN Relay' | 'RAM Transit';
  history: TelemetrySample[];
}

export class MeshBroadcastManager {
  private peers: Map<string, MeshPeerDevice> = new Map();
  private telemetryHistory: TelemetrySample[] = [];
  private maxHistorySamples: number = 30;
  private peakSpeed: number = 0;
  private listeners: Set<(peers: MeshPeerDevice[]) => void> = new Set();
  private telemetryListeners: Set<(telemetry: LiveEngineTelemetry) => void> = new Set();

  public registerPeer(peerId: string, userAgent?: string): MeshPeerDevice {
    const ua = (userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '')).toLowerCase();
    let deviceType: 'mobile' | 'desktop' | 'tablet' = 'desktop';
    let name = 'Connected Device';

    if (/ipad|tablet/i.test(ua)) {
      deviceType = 'tablet';
      name = 'Tablet Receiver';
    } else if (/iphone/i.test(ua)) {
      deviceType = 'mobile';
      name = 'Apple iPhone';
    } else if (/android/i.test(ua)) {
      deviceType = 'mobile';
      name = 'Android Smartphone';
    } else if (/macintosh|mac os/i.test(ua)) {
      deviceType = 'desktop';
      name = 'macOS Workstation';
    } else if (/windows/i.test(ua)) {
      deviceType = 'desktop';
      name = 'Windows PC';
    }

    const peer: MeshPeerDevice = {
      peerId,
      name,
      deviceType,
      connectedAt: Date.now(),
      progress: 0,
      speed: 0,
      status: 'connected',
      rtt: 12
    };

    this.peers.set(peerId, peer);
    this.notifyPeers();
    return peer;
  }

  public removePeer(peerId: string) {
    this.peers.delete(peerId);
    this.notifyPeers();
  }

  public updatePeerProgress(peerId: string, progress: number, speed: number, status: MeshPeerDevice['status'] = 'streaming') {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.progress = progress;
      peer.speed = speed;
      peer.status = status;
      this.notifyPeers();
    }
  }

  public recordTelemetrySample(sample: Omit<TelemetrySample, 'timestamp'>) {
    const fullSample: TelemetrySample = {
      timestamp: Date.now(),
      ...sample
    };

    if (sample.speedBytesPerSec > this.peakSpeed) {
      this.peakSpeed = sample.speedBytesPerSec;
    }

    this.telemetryHistory.push(fullSample);
    if (this.telemetryHistory.length > this.maxHistorySamples) {
      this.telemetryHistory.shift();
    }

    const live: LiveEngineTelemetry = {
      currentThroughput: sample.speedBytesPerSec,
      peakThroughput: this.peakSpeed,
      rttMs: sample.rttMs,
      bufferedAmount: sample.bufferedAmountBytes,
      chunksSent: 0,
      totalChunks: 0,
      packetsVerified: 0,
      transportType: sample.rttMs < 15 ? 'LAN Direct P2P' : 'STUN Direct P2P',
      history: [...this.telemetryHistory]
    };

    this.telemetryListeners.forEach(listener => listener(live));
  }

  public getPeers(): MeshPeerDevice[] {
    return Array.from(this.peers.values());
  }

  public getTelemetryHistory(): TelemetrySample[] {
    return [...this.telemetryHistory];
  }

  public onPeersChange(cb: (peers: MeshPeerDevice[]) => void): () => void {
    this.listeners.add(cb);
    cb(this.getPeers());
    return () => this.listeners.delete(cb);
  }

  public onTelemetryUpdate(cb: (telemetry: LiveEngineTelemetry) => void): () => void {
    this.telemetryListeners.add(cb);
    return () => this.telemetryListeners.delete(cb);
  }

  private notifyPeers() {
    const list = this.getPeers();
    this.listeners.forEach(listener => listener(list));
  }
}

export const meshBroadcastHub = new MeshBroadcastManager();
