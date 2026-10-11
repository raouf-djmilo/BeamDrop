import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  X,
  Radio,
  Wifi,
  ShieldCheck,
  Server,
  Layers,
  ArrowUpRight,
  Minimize2,
  Maximize2,
  RefreshCw,
  Cpu,
  Smartphone,
  Laptop
} from 'lucide-react';
import { formatBytes, formatSpeed } from '../utils/formatters';
import {
  meshBroadcastHub,
  MeshPeerDevice,
  LiveEngineTelemetry
} from '../utils/engine/meshBroadcast';

interface PacketTelemetryDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PacketTelemetryDashboard: React.FC<PacketTelemetryDashboardProps> = ({
  isOpen,
  onClose
}) => {
  const [peers, setPeers] = useState<MeshPeerDevice[]>([]);
  const [telemetry, setTelemetry] = useState<LiveEngineTelemetry>({
    currentThroughput: 0,
    peakThroughput: 0,
    rttMs: 12,
    bufferedAmount: 0,
    chunksSent: 0,
    totalChunks: 0,
    packetsVerified: 0,
    transportType: 'LAN Direct P2P',
    history: []
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const unsubPeers = meshBroadcastHub.onPeersChange(setPeers);
    const unsubTelemetry = meshBroadcastHub.onTelemetryUpdate(setTelemetry);

    return () => {
      unsubPeers();
      unsubTelemetry();
    };
  }, [isOpen]);

  // Render 60fps throughput sparkline
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const history = telemetry.history;
    if (history.length < 2) {
      // Draw idle baseline
      ctx.beginPath();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.moveTo(0, height - 10);
      ctx.lineTo(width, height - 10);
      ctx.stroke();
      return;
    }

    const maxVal = Math.max(1024 * 1024, telemetry.peakThroughput || 1);
    const step = width / (history.length - 1);

    // Fill area gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(14, 165, 233, 0.4)');
    grad.addColorStop(1, 'rgba(14, 165, 233, 0)');

    ctx.beginPath();
    ctx.moveTo(0, height);
    history.forEach((sample, idx) => {
      const x = idx * step;
      const normalized = Math.min(1, sample.speedBytesPerSec / maxVal);
      const y = height - (normalized * (height - 16)) - 8;
      if (idx === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Stroke line
    ctx.beginPath();
    history.forEach((sample, idx) => {
      const x = idx * step;
      const normalized = Math.min(1, sample.speedBytesPerSec / maxVal);
      const y = height - (normalized * (height - 16)) - 8;
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }, [isOpen, telemetry]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-slate-900 border border-sky-500/40 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white">
        {/* HUD Top Bar */}
        <div className="p-5 border-b border-sky-900/50 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shadow-lg">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Live Packet &amp; Network Telemetry</h2>
                <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  LIVE 60FPS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Real-time SCTP throughput, latency curves, and binary frame inspection
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* HUD Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-sky-500/20 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Throughput</span>
              <p className="text-base sm:text-lg font-bold font-mono text-sky-400">
                {formatSpeed(telemetry.currentThroughput)}
              </p>
              <span className="text-[10px] text-slate-500 font-mono">
                Peak: {formatSpeed(telemetry.peakThroughput)}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-sky-500/20 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">RTT Latency</span>
              <p className="text-base sm:text-lg font-bold font-mono text-emerald-400">
                {telemetry.rttMs} ms
              </p>
              <span className="text-[10px] text-emerald-400/80 font-mono flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                <span>{telemetry.transportType}</span>
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-sky-500/20 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">SCTP Buffer</span>
              <p className="text-base sm:text-lg font-bold font-mono text-indigo-400">
                {formatBytes(telemetry.bufferedAmount)}
              </p>
              <span className="text-[10px] text-slate-500 font-mono">
                Watermark: 256KB - 1MB
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-sky-500/20 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Mesh Receivers</span>
              <p className="text-base sm:text-lg font-bold font-mono text-amber-400">
                {peers.length} Device{peers.length !== 1 ? 's' : ''}
              </p>
              <span className="text-[10px] text-slate-500 font-mono">
                Parallel Broadcast Active
              </span>
            </div>
          </div>

          {/* Live Throughput Canvas Graph */}
          <div className="p-4 rounded-3xl bg-slate-950/80 border border-sky-500/30 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                <span>Bandwidth Throughput Curve</span>
              </span>
              <span className="text-sky-400">{formatSpeed(telemetry.currentThroughput)}</span>
            </div>

            <div className="w-full h-32 rounded-2xl bg-slate-900/90 overflow-hidden relative border border-white/5">
              <canvas
                ref={canvasRef}
                width={640}
                height={128}
                className="w-full h-full block"
              />
            </div>
          </div>

          {/* Multi-Peer Mesh Devices Status */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Connected Mesh Broadcast Peers</span>
              <span className="font-mono text-sky-400">{peers.length} active</span>
            </h3>

            {peers.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-800/40 border border-white/5 text-center text-xs text-slate-400 space-y-1.5">
                <Radio className="w-6 h-6 text-slate-500 mx-auto" />
                <p className="font-semibold text-slate-300">No Remote Peers Linked Yet</p>
                <p className="text-[11px] text-slate-500">
                  Scan the QR code with one or more phones to see them stream in parallel.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {peers.map((peer) => (
                  <div
                    key={peer.peerId}
                    className="p-3.5 rounded-2xl bg-slate-800/70 border border-sky-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                        {peer.deviceType === 'mobile' ? (
                          <Smartphone className="w-4 h-4" />
                        ) : (
                          <Laptop className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-white">{peer.name}</p>
                        <p className="text-[11px] font-mono text-slate-400">
                          {peer.peerId} • {peer.rtt || 12}ms latency
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-28 sm:w-36 bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-sky-400 to-blue-500 h-full transition-all"
                          style={{ width: `${peer.progress}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] text-sky-300 font-bold w-12 text-right">
                        {peer.progress}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 32-Byte Binary Framing Header Visualizer */}
          <div className="p-4 rounded-3xl bg-slate-950/80 border border-sky-500/30 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>32-Byte Binary Frame Layout (E2EE Envelope)</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-bold">AES-256-GCM + IV</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[11px] text-center">
              <div className="p-2 rounded-xl bg-slate-800 border border-sky-400/30">
                <p className="text-sky-400 font-bold">16 Bytes</p>
                <p className="text-[10px] text-slate-400">File UUID</p>
              </div>
              <div className="p-2 rounded-xl bg-slate-800 border border-blue-400/30">
                <p className="text-blue-400 font-bold">4 Bytes</p>
                <p className="text-[10px] text-slate-400">Chunk Index</p>
              </div>
              <div className="p-2 rounded-xl bg-slate-800 border border-indigo-400/30">
                <p className="text-indigo-400 font-bold">4 Bytes</p>
                <p className="text-[10px] text-slate-400">Total Chunks</p>
              </div>
              <div className="p-2 rounded-xl bg-slate-800 border border-purple-400/30">
                <p className="text-purple-400 font-bold">4 Bytes</p>
                <p className="text-[10px] text-slate-400">Payload Len</p>
              </div>
              <div className="p-2 rounded-xl bg-slate-800 border border-emerald-400/30">
                <p className="text-emerald-400 font-bold">4 Bytes</p>
                <p className="text-[10px] text-slate-400">E2EE Flags</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900 border border-white/5 space-y-1 text-[11px] text-slate-400">
              <p>• Unique 12-Byte IV prepended per chunk packet</p>
              <p>• 16-Byte Authenticated GCM tag appended to detect network tampering</p>
              <p>• Zero memory buildup: streamed directly to sandboxed disk sink</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-sky-900/50 bg-slate-950 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-mono text-[11px]">
            High-Throughput P2P SCTP DataChannel Engine
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
          >
            Close Telemetry HUD
          </button>
        </div>
      </div>
    </div>
  );
};
