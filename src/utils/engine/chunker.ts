/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop Adaptive Chunk Sizing Engine
 * Implements AIMD (Additive Increase / Multiplicative Decrease) with real-time RTT probing
 * and Backpressure Flow Control to maximize LAN throughput (up to 512KB chunks).
 */

export interface ChunkSizingLadderTier {
  name: string;
  maxRtt: number;
  chunkSize: number;
  targetWindow: number;
}

export const CHUNK_LADDER: ChunkSizingLadderTier[] = [
  { name: 'Ultra-LAN / Wi-Fi 6 Direct', maxRtt: 15,  chunkSize: 512 * 1024, targetWindow: 8 * 1024 * 1024 },
  { name: 'Fast Home Wi-Fi (5GHz)',    maxRtt: 50,  chunkSize: 256 * 1024, targetWindow: 4 * 1024 * 1024 },
  { name: 'Standard WAN / Fair Wi-Fi', maxRtt: 150, chunkSize: 64 * 1024,  targetWindow: 1 * 1024 * 1024 },
  { name: 'Weak 4G / High-Loss TURN',  maxRtt: 99999, chunkSize: 32 * 1024, targetWindow: 256 * 1024 }
];

export class AdaptiveChunker {
  public currentChunkSize: number = 256 * 1024; // Default starting tier
  public currentRtt: number = 10; // ms
  private pingInterval: any = null;
  private lastPingSentAt: number = 0;
  private onRttUpdateCallback?: (rtt: number, tier: string, chunkSize: number) => void;

  constructor(onRttUpdate?: (rtt: number, tier: string, chunkSize: number) => void) {
    this.onRttUpdateCallback = onRttUpdate;
  }

  /**
   * Start RTT probe loop every 500ms
   */
  public startProbing(sendPingFn: (pingTime: number) => void) {
    this.stopProbing();
    this.pingInterval = setInterval(() => {
      this.lastPingSentAt = performance.now();
      sendPingFn(this.lastPingSentAt);
    }, 500);
  }

  public stopProbing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Process Pong response and recalculate chunk ladder
   */
  public handlePong(echoedTime: number) {
    const now = performance.now();
    const measuredRtt = Math.max(1, Math.round(now - (echoedTime || this.lastPingSentAt)));
    // Exponential Moving Average (EMA) to smooth RTT jitter
    this.currentRtt = Math.round(this.currentRtt * 0.7 + measuredRtt * 0.3);
    this.recalculateLadder();
  }

  private recalculateLadder() {
    let matchedTier = CHUNK_LADDER[CHUNK_LADDER.length - 1];
    for (const tier of CHUNK_LADDER) {
      if (this.currentRtt <= tier.maxRtt) {
        matchedTier = tier;
        break;
      }
    }

    this.currentChunkSize = matchedTier.chunkSize;
    this.onRttUpdateCallback?.(this.currentRtt, matchedTier.name, this.currentChunkSize);
  }

  /**
   * Adaptive Backpressure Control:
   * Returns true if channel is safe to send, or false if sender must wait for onbufferedamountlow
   */
  public async handleBackpressure(channel: RTCDataChannel): Promise<void> {
    const HIGH_WATER_MARK = Math.max(64 * 1024, this.currentChunkSize * 4);
    const LOW_WATER_MARK = Math.max(32 * 1024, this.currentChunkSize * 2);

    try {
      channel.bufferedAmountLowThreshold = LOW_WATER_MARK;
    } catch (_) {}

    if (channel.bufferedAmount > HIGH_WATER_MARK) {
      // Multiplicative Decrease under buffer congestion
      this.currentChunkSize = Math.max(32 * 1024, Math.floor(this.currentChunkSize / 2));

      await new Promise<void>((resolve) => {
        let finished = false;
        const done = () => {
          if (!finished) {
            finished = true;
            if (watchdog) clearTimeout(watchdog);
            if (checkInterval) clearInterval(checkInterval);
            channel.onbufferedamountlow = null;
            resolve();
          }
        };

        // Safety watchdog: never freeze for more than 150ms even if browser fails to trigger onbufferedamountlow
        const watchdog = setTimeout(done, 150);

        const checkInterval = setInterval(() => {
          if (!channel || channel.readyState !== 'open' || channel.bufferedAmount <= LOW_WATER_MARK) {
            done();
          }
        }, 10);

        channel.onbufferedamountlow = done;
      });
    } else if (channel.bufferedAmount < LOW_WATER_MARK && this.currentRtt < 20) {
      // Additive Increase when pipe is empty on low latency LAN
      this.currentChunkSize = Math.min(512 * 1024, this.currentChunkSize + 32 * 1024);
    }
  }
}
