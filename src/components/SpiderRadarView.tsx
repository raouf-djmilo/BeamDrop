import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Wifi,
  Laptop,
  Smartphone,
  Router,
  RefreshCw,
  Zap,
  Shield,
  Activity,
  CheckCircle2,
  ExternalLink,
  Flame,
  Globe,
  SlidersHorizontal
} from 'lucide-react';
import { playChime } from '../utils/audio';

export interface DiscoveredPeer {
  id: string;
  name: string;
  ip: string;
  mac?: string;
  deviceType: 'phone' | 'laptop' | 'router' | 'desktop';
  icon: string;
  protocol: 'wifi' | 'hotspot' | 'bt';
  latency: number; // ms
  isGateway?: boolean;
  x: number; // percentage 10-90
  y: number; // percentage 10-90
  signal?: string;
  lastSeen: number;
}

interface SpiderRadarViewProps {
  onDirectBeamTarget?: (peer: DiscoveredPeer) => void;
}

export const SpiderRadarView: React.FC<SpiderRadarViewProps> = ({ onDirectBeamTarget }) => {
  const [networkMeta, setNetworkMeta] = useState<{
    ssid: string;
    band: string;
    signal: string;
    speed: string;
    myIp: string;
    subnet: string;
    isHotspot: boolean;
  }>({
    ssid: 'IdoomFibre_ATJJMkt95',
    band: '5 GHz',
    signal: '94%',
    speed: '1560 Mbps',
    myIp: '192.168.100.9',
    subnet: '192.168.100.0/24',
    isHotspot: false
  });

  const [discoveredPeers, setDiscoveredPeers] = useState<DiscoveredPeer[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'phone' | 'laptop' | 'router'>('all');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [selectedPeer, setSelectedPeer] = useState<DiscoveredPeer | null>(null);
  const [audioFeedback, setAudioFeedback] = useState<boolean>(true);

  // Web Audio Radar Ping Sound
  const playRadarBlip = () => {
    if (!audioFeedback) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // High-pitch sonar ping
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  };

  // Scan network via backend API (or local mesh fallback)
  const performNetworkScan = async (showFeedback = true) => {
    if (showFeedback) setIsScanning(true);

    const endpoints = [
      '/api/scan-lan',
      'http://localhost:3001/api/scan-lan',
      'http://localhost:3000/api/scan-lan'
    ];

    let liveDataFound = false;

    for (const url of endpoints) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            setNetworkMeta(json.network);

            if (Array.isArray(json.devices)) {
              const mapped: DiscoveredPeer[] = json.devices.map((dev: any, i: number) => {
                const octet = parseInt((dev.ip || '1').split('.').pop(), 10) || (i + 1);
                const angle = ((octet * 137.5) % 360) * (Math.PI / 180);
                let dist = 52;
                if (dev.isGateway) dist = 22;
                else if (dev.deviceType === 'phone') dist = 38 + ((octet % 3) * 4);
                else if (dev.deviceType === 'laptop') dist = 60 + ((octet % 3) * 4);
                else dist = 75;

                const x = Math.min(88, Math.max(12, 50 + Math.cos(angle) * dist));
                const y = Math.min(88, Math.max(12, 50 + Math.sin(angle) * dist));

                return {
                  id: dev.id || `lan-${dev.ip}`,
                  name: dev.name,
                  ip: dev.ip,
                  mac: dev.mac,
                  deviceType: dev.deviceType || 'phone',
                  icon: dev.icon || (dev.deviceType === 'phone' ? '📱' : dev.deviceType === 'laptop' ? '💻' : '🌐'),
                  protocol: dev.protocol || 'wifi',
                  latency: dev.latency || 4,
                  isGateway: dev.isGateway,
                  x,
                  y,
                  signal: dev.signal || json.network.signal,
                  lastSeen: Date.now()
                };
              });

              setDiscoveredPeers(mapped);
              liveDataFound = true;
              if (showFeedback) playRadarBlip();
              break;
            }
          }
        }
      } catch (e) {}
    }

    // Default Fallback if on public hosted web domain without local agent
    if (!liveDataFound && discoveredPeers.length === 0) {
      setDiscoveredPeers([
        {
          id: 'lan-192-168-100-1',
          name: 'Wi-Fi 6 Router (IdoomFibre_ATJJMkt95)',
          ip: '192.168.100.1',
          mac: '4c-d6-29-e3-53-42',
          deviceType: 'router',
          icon: '🌐',
          protocol: 'wifi',
          latency: 1,
          isGateway: true,
          x: 50,
          y: 28,
          signal: '96%',
          lastSeen: Date.now()
        },
        {
          id: 'lan-192-168-100-52',
          name: 'Samsung Galaxy / iPhone (Local Node)',
          ip: '192.168.100.52',
          mac: 'e6-76-78-8c-dd-fa',
          deviceType: 'phone',
          icon: '📱',
          protocol: 'wifi',
          latency: 4,
          isGateway: false,
          x: 75,
          y: 42,
          signal: '92%',
          lastSeen: Date.now()
        },
        {
          id: 'lan-192-168-100-14',
          name: 'MacBook Pro / PC Workstation',
          ip: '192.168.100.14',
          mac: 'f8-e4-fb-3a-12-09',
          deviceType: 'laptop',
          icon: '💻',
          protocol: 'wifi',
          latency: 2,
          isGateway: false,
          x: 28,
          y: 70,
          signal: '94%',
          lastSeen: Date.now()
        }
      ]);
    }

    setTimeout(() => {
      setIsScanning(false);
    }, 600);
  };

  useEffect(() => {
    performNetworkScan(false);

    // BroadcastChannel mesh listener for intra-browser multi-tab discovery
    const meshChannel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('beamdrop_local_mesh_channel')
      : null;

    if (meshChannel) {
      meshChannel.onmessage = (evt) => {
        const data = evt.data;
        if (!data || !data.id) return;
        if (data.type === 'RADAR_BEACON' || data.type === 'RADAR_PONG') {
          setDiscoveredPeers(prev => {
            if (prev.some(p => p.id === data.id)) return prev;
            playRadarBlip();
            return [
              ...prev,
              {
                id: data.id,
                name: data.name || 'Nearby Browser Peer',
                ip: data.ip || '192.168.100.x',
                deviceType: data.deviceType || 'laptop',
                icon: data.icon || '💻',
                protocol: 'wifi',
                latency: 3,
                x: 50 + (Math.random() * 40 - 20),
                y: 50 + (Math.random() * 40 - 20),
                lastSeen: Date.now()
              }
            ];
          });
        }
      };

      // Announce self
      meshChannel.postMessage({
        type: 'RADAR_BEACON',
        id: 'web-node-' + Math.random().toString(36).slice(2, 7),
        name: 'Web Workstation',
        deviceType: 'laptop',
        icon: '💻'
      });
    }

    const interval = setInterval(() => {
      performNetworkScan(false);
    }, 8000);

    return () => {
      clearInterval(interval);
      if (meshChannel) meshChannel.close();
    };
  }, []);

  // Filtered devices
  const filteredPeers = discoveredPeers.filter(peer => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'phone') return peer.deviceType === 'phone';
    if (activeFilter === 'laptop') return peer.deviceType === 'laptop' || peer.deviceType === 'desktop';
    if (activeFilter === 'router') return peer.deviceType === 'router' || peer.isGateway;
    return true;
  });

  const phoneCount = discoveredPeers.filter(p => p.deviceType === 'phone').length;
  const pcCount = discoveredPeers.filter(p => p.deviceType === 'laptop' || p.deviceType === 'desktop').length;
  const routerCount = discoveredPeers.filter(p => p.deviceType === 'router' || p.isGateway).length;

  return (
    <div className="space-y-6">
      {/* 1. Network Telemetry HUD Bar */}
      <div className="glass-panel-glow rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-cyan-500/20">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
            <Radio className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
                <span>{networkMeta.ssid}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping"></span>
              </h2>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                networkMeta.isHotspot
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
              }`}>
                {networkMeta.isHotspot ? '🔥 HOTSPOT MESH' : '📶 WI-FI LAN'}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
              <span>{networkMeta.band} • {networkMeta.speed}</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">{networkMeta.signal} Signal</span>
              <span>•</span>
              <span className="text-cyan-400">{networkMeta.myIp}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => performNetworkScan(true)}
            disabled={isScanning}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-all shadow-md shadow-cyan-600/20 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning Mesh...' : 'Sweep Spider Radar'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Radar Screen & Devices List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Radar Screen (7 cols) */}
        <div className="lg:col-span-7 glass-panel rounded-3xl p-6 border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
          {/* Subtle Radar Background Grid */}
          <div className="w-full max-w-[440px] aspect-square relative flex items-center justify-center">
            {/* Concentric Circle Rings */}
            <div className="absolute inset-0 rounded-full border border-cyan-500/15 pointer-events-none"></div>
            <div className="absolute inset-[15%] rounded-full border border-cyan-500/20 pointer-events-none"></div>
            <div className="absolute inset-[35%] rounded-full border border-cyan-500/30 pointer-events-none"></div>
            <div className="absolute inset-[55%] rounded-full border border-cyan-500/40 pointer-events-none"></div>

            {/* Radial Spider Web Spokes */}
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent pointer-events-none"></div>
            <div className="absolute inset-y-0 left-1/2 w-[1px] bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent pointer-events-none"></div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-full h-[1px] bg-cyan-500/10 rotate-45"></div>
              <div className="w-full h-[1px] bg-cyan-500/10 -rotate-45"></div>
            </div>

            {/* Rotating Cyber Radar Sweep */}
            <div className="radar-sweep-beam"></div>

            {/* Center Local User Node */}
            <div className="absolute z-10 flex flex-col items-center">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500 text-white flex items-center justify-center shadow-lg shadow-cyan-500/50 border border-white/20">
                <Laptop className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold text-cyan-300 bg-slate-950/80 px-2 py-0.5 rounded-full mt-1 border border-cyan-500/30">
                You (Local)
              </span>
            </div>

            {/* Interactive Radar Blips */}
            {filteredPeers.map((peer) => {
              const isSelected = selectedPeer?.id === peer.id;
              const isPhone = peer.deviceType === 'phone';
              const isRouter = peer.deviceType === 'router' || peer.isGateway;

              const blipColor = isRouter
                ? 'bg-amber-400 text-amber-950 border-amber-300'
                : isPhone
                ? 'bg-emerald-400 text-emerald-950 border-emerald-300'
                : 'bg-cyan-400 text-cyan-950 border-cyan-300';

              const pulseColor = isRouter
                ? 'bg-amber-400/30'
                : isPhone
                ? 'bg-emerald-400/30'
                : 'bg-cyan-400/30';

              return (
                <div
                  key={peer.id}
                  onClick={() => setSelectedPeer(peer)}
                  style={{ left: `${peer.x}%`, top: `${peer.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                >
                  {/* Pulse Effect */}
                  <div className={`radar-blip-pulse ${pulseColor}`}></div>

                  {/* Blip Node */}
                  <div className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg border transition-all group-hover:scale-125 ${blipColor} ${
                    isSelected ? 'ring-4 ring-cyan-400 scale-125' : ''
                  }`}>
                    <span>{peer.icon}</span>
                  </div>

                  {/* Tooltip on Hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-xl bg-slate-900/95 border border-cyan-500/40 text-white text-[11px] font-medium whitespace-nowrap shadow-xl pointer-events-none flex flex-col items-center z-30">
                    <span className="font-bold text-cyan-300">{peer.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{peer.ip} • {peer.latency}ms</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Radar Legend Footer */}
          <div className="w-full mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-around text-xs text-slate-400">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span>Smartphones (Android/iOS)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
              <span>PCs & Laptops</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span>Gateway / Router</span>
            </div>
          </div>
        </div>

        {/* Discovered Devices Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Category Filter Pills */}
          <div className="flex items-center space-x-1.5 bg-slate-900/80 border border-slate-800 p-1.5 rounded-2xl overflow-x-auto">
            <button
              onClick={() => setActiveFilter('all')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeFilter === 'all'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <span>All</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                {discoveredPeers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveFilter('phone')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeFilter === 'phone'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <span>📱 Phones</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                {phoneCount}
              </span>
            </button>

            <button
              onClick={() => setActiveFilter('laptop')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeFilter === 'laptop'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <span>💻 PCs</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                {pcCount}
              </span>
            </button>

            <button
              onClick={() => setActiveFilter('router')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeFilter === 'router'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <span>🌐 Gateway</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                {routerCount}
              </span>
            </button>
          </div>

          {/* Cards List */}
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredPeers.length === 0 ? (
              <div className="text-center py-12 px-4 glass-panel rounded-3xl border border-slate-800 text-slate-400">
                <Radio className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-300">No active peers in this category</p>
                <p className="text-xs text-slate-500 mt-1">Make sure devices are connected to the same Wi-Fi or Hotspot.</p>
              </div>
            ) : (
              filteredPeers.map((peer) => {
                const isSelected = selectedPeer?.id === peer.id;
                const maskedMac = peer.mac ? peer.mac.replace(/^([0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2})-.*-([0-9a-f]{2})$/i, '$1-**-**-$2') : '';

                return (
                  <div
                    key={peer.id}
                    onClick={() => setSelectedPeer(peer)}
                    className={`glass-panel rounded-2xl p-3.5 border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-cyan-400/80 bg-slate-900/95 shadow-lg shadow-cyan-500/10'
                        : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-lg relative shrink-0">
                        <span>{peer.icon}</span>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950 absolute -bottom-0.5 -right-0.5"></span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <p className="text-xs font-bold text-white truncate max-w-[150px] sm:max-w-[200px]">
                            {peer.name}
                          </p>
                          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                            peer.protocol === 'hotspot'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                          }`}>
                            {peer.protocol === 'hotspot' ? '🔥 Hotspot' : '📶 5GHz'}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2 mt-1 text-[11px] font-mono text-slate-400">
                          <span className="text-cyan-400">{peer.ip}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-bold">{peer.latency}ms</span>
                          {maskedMac && (
                            <>
                              <span>•</span>
                              <span className="text-slate-500">{maskedMac}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDirectBeamTarget) {
                          onDirectBeamTarget(peer);
                        } else {
                          alert(`🎯 Direct Beam initialized for ${peer.name} (${peer.ip})!\nSwitch to the "Beam Objects" tab to select files or notes to transmit.`);
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center space-x-1 shadow-md shadow-cyan-600/25 shrink-0 cursor-pointer transition-all"
                    >
                      <Zap className="w-3.5 h-3.5 fill-white text-white" />
                      <span>Beam</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
