import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  SlidersHorizontal,
  Search,
  Check,
  Server,
  Terminal,
  Crosshair,
  Volume2,
  VolumeX,
  Plus
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
  // Real Network Metadata
  const [networkMeta, setNetworkMeta] = useState<{
    ssid: string;
    band: string;
    signal: string;
    speed: string;
    myIp: string;
    subnet: string;
    isHotspot: boolean;
  }>({
    ssid: 'Local Wi-Fi Network',
    band: '5 GHz / 2.4 GHz',
    signal: '92%',
    speed: 'Auto-Negotiated',
    myIp: 'Detecting...',
    subnet: '192.168.1.0/24',
    isHotspot: false
  });

  // Local Device Identity ("Jihezi")
  const [myDeviceInfo, setMyDeviceInfo] = useState<{
    name: string;
    deviceType: 'phone' | 'laptop' | 'desktop';
    icon: string;
    ip: string;
  }>(() => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    let name = 'Local Workstation';
    let deviceType: 'phone' | 'laptop' | 'desktop' = 'laptop';
    let icon = '💻';

    if (/iPhone|iPad|iPod/i.test(ua)) {
      name = 'Apple iPhone';
      deviceType = 'phone';
      icon = '📱';
    } else if (/Android/i.test(ua)) {
      name = 'Android Smartphone';
      deviceType = 'phone';
      icon = '📱';
    } else if (/Macintosh|Mac OS/i.test(ua)) {
      name = 'MacBook Pro';
      deviceType = 'laptop';
      icon = '💻';
    } else if (/Windows/i.test(ua)) {
      name = 'Windows PC';
      deviceType = 'desktop';
      icon = '💻';
    } else if (/Linux/i.test(ua)) {
      name = 'Linux Station';
      deviceType = 'desktop';
      icon = '💻';
    }

    return { name, deviceType, icon, ip: '127.0.0.1' };
  });

  // Real Discovered Peers - ZERO mock devices!
  const [discoveredPeers, setDiscoveredPeers] = useState<DiscoveredPeer[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'phone' | 'laptop' | 'router'>('all');
  const [selectedPeer, setSelectedPeer] = useState<DiscoveredPeer | null>(null);
  const [audioFeedback, setAudioFeedback] = useState<boolean>(true);

  // Live Subnet Scanner Counter State ("ALL COUNT LI RAHO MY JIHAZI")
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedIpsCount, setScannedIpsCount] = useState<number>(0);
  const [totalSubnetIps, setTotalSubnetIps] = useState<number>(254);
  const [currentScanningIp, setCurrentScanningIp] = useState<string>('');
  const [scanSpeedIpsPerSec, setScanSpeedIpsPerSec] = useState<number>(0);
  const [customSubnetPrefix, setCustomSubnetPrefix] = useState<string>('192.168.1');
  const [manualProbeIp, setManualProbeIp] = useState<string>('');
  const [isProbingManual, setIsProbingManual] = useState<boolean>(false);
  const [probeResultMsg, setProbeResultMsg] = useState<string>('');

  const abortControllerRef = useRef<AbortController | null>(null);

  // Web Audio Sonar Ping
  const playRadarBlip = () => {
    if (!audioFeedback) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  };

  // 1. Detect Real Local IP of this Device using WebRTC ICE candidates
  useEffect(() => {
    let resolved = false;

    const detectLocalIp = async () => {
      try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('detect-lan-ip');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const timeout = setTimeout(() => {
          if (!resolved) {
            pc.close();
          }
        }, 3000);

        pc.onicecandidate = (event) => {
          if (!event || !event.candidate || !event.candidate.candidate) return;
          const line = event.candidate.candidate;
          const match = line.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
          if (match) {
            const detected = match[1];
            if (!detected.startsWith('127.') && !detected.startsWith('0.')) {
              resolved = true;
              clearTimeout(timeout);
              pc.close();

              setMyDeviceInfo(prev => ({ ...prev, ip: detected }));
              const parts = detected.split('.');
              if (parts.length === 4) {
                const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
                setCustomSubnetPrefix(prefix);
                setNetworkMeta(prev => ({
                  ...prev,
                  myIp: detected,
                  subnet: `${prefix}.0/24`
                }));
              }
            }
          }
        };
      } catch (e) {}
    };

    detectLocalIp();
  }, []);

  // Helper to add or update discovered real peer
  const addOrUpdateRealPeer = (peer: DiscoveredPeer) => {
    setDiscoveredPeers(prev => {
      const idx = prev.findIndex(p => p.ip === peer.ip || p.id === peer.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...peer, lastSeen: Date.now() };
        return updated;
      }

      // Calculate radar position based on octet and type
      const octet = parseInt((peer.ip || '1').split('.').pop() || '1', 10) || 1;
      const angle = ((octet * 137.5) % 360) * (Math.PI / 180);
      let dist = 50;
      if (peer.isGateway) dist = 22;
      else if (peer.deviceType === 'phone') dist = 38 + ((octet % 3) * 4);
      else if (peer.deviceType === 'laptop') dist = 60 + ((octet % 3) * 4);
      else dist = 75;

      const x = Math.min(88, Math.max(12, 50 + Math.cos(angle) * dist));
      const y = Math.min(88, Math.max(12, 50 + Math.sin(angle) * dist));

      playRadarBlip();
      return [...prev, { ...peer, x, y, lastSeen: Date.now() }];
    });
  };

  // 2. Fetch live data from backend / local gateway (/api/scan-lan & /api/mesh/devices)
  const queryLocalMeshBackend = async (): Promise<boolean> => {
    const endpoints = [
      '/api/mesh/devices',
      '/api/scan-lan',
      'http://localhost:3000/api/mesh/devices',
      'http://localhost:3000/api/scan-lan',
      'http://localhost:3001/api/mesh/devices',
      'http://localhost:3001/api/scan-lan'
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(`${url}?_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            if (json.network) {
              setNetworkMeta(prev => ({
                ...prev,
                ssid: json.network.ssid || prev.ssid,
                band: json.network.band || prev.band,
                signal: json.network.signal || prev.signal,
                speed: json.network.speed || prev.speed,
                myIp: json.network.myIp !== '127.0.0.1' ? json.network.myIp : prev.myIp,
                subnet: json.network.subnet || prev.subnet,
                isHotspot: Boolean(json.network.isHotspot)
              }));
              if (json.network.myIp && json.network.myIp !== '127.0.0.1') {
                setMyDeviceInfo(prev => ({ ...prev, ip: json.network.myIp }));
                const parts = json.network.myIp.split('.');
                if (parts.length === 4) {
                  setCustomSubnetPrefix(`${parts[0]}.${parts[1]}.${parts[2]}`);
                }
              }
            }

            if (Array.isArray(json.devices)) {
              json.devices.forEach((dev: any) => {
                addOrUpdateRealPeer({
                  id: dev.id || `lan-${dev.ip.replace(/\./g, '-')}`,
                  name: dev.name || `Device (${dev.ip})`,
                  ip: dev.ip,
                  mac: dev.mac,
                  deviceType: dev.deviceType || (dev.isGateway ? 'router' : 'phone'),
                  icon: dev.icon || (dev.isGateway ? '🌐' : '📱'),
                  protocol: dev.protocol || 'wifi',
                  latency: dev.latency || 2,
                  isGateway: dev.isGateway,
                  x: 50,
                  y: 50,
                  signal: dev.signal || json.network?.signal,
                  lastSeen: Date.now()
                });
              });
              return true;
            }
          }
        }
      } catch (e) {}
    }
    return false;
  };

  // 3. In-Browser Subnet Active Scanner Engine with Real-Time Counters ("ALL COUNT LI RAHO MY JIHAZI")
  const startRealSubnetSweep = async () => {
    if (isScanning) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsScanning(false);
      return;
    }

    setIsScanning(true);
    setScannedIpsCount(0);
    setTotalSubnetIps(254);
    setProbeResultMsg('');

    // First check system ARP / mesh backend
    await queryLocalMeshBackend();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const prefix = customSubnetPrefix.trim() || '192.168.1';
    const startTime = Date.now();
    const batchSize = 16;
    let completedCount = 0;

    // Scan IPs from 1 to 254
    const ipsToScan: string[] = [];
    // Prioritize router/gateway (.1 and .254) first
    ipsToScan.push(`${prefix}.1`);
    ipsToScan.push(`${prefix}.254`);
    for (let i = 2; i < 254; i++) {
      ipsToScan.push(`${prefix}.${i}`);
    }

    const testHostOnline = async (targetIp: string): Promise<boolean> => {
      if (targetIp === myDeviceInfo.ip) return false;
      const pingStart = performance.now();

      // Probing ports via fast fetch / image load
      const ports = [80, 8080, 3000, 443, 8000];
      for (const port of ports) {
        if (controller.signal.aborted) return false;
        try {
          const timeoutSignal = AbortSignal.timeout(280);
          await fetch(`http://${targetIp}:${port}/?_beam_probe=${Date.now()}`, {
            method: 'HEAD',
            mode: 'no-cors',
            signal: timeoutSignal
          });
          const latency = Math.max(1, Math.round(performance.now() - pingStart));
          const isGw = targetIp.endsWith('.1') || targetIp.endsWith('.254');
          addOrUpdateRealPeer({
            id: `lan-${targetIp.replace(/\./g, '-')}`,
            name: isGw ? `Wi-Fi Router Gateway (${targetIp})` : `Active Node (${targetIp})`,
            ip: targetIp,
            deviceType: isGw ? 'router' : 'phone',
            icon: isGw ? '🌐' : '📱',
            protocol: 'wifi',
            latency,
            isGateway: isGw,
            x: 50,
            y: 50,
            lastSeen: Date.now()
          });
          return true;
        } catch (err: any) {
          // If error is NOT a timeout (e.g. Connection Refused or CORS preflight rejection),
          // it indicates a live host answered the TCP handshake!
          if (err && err.name !== 'TimeoutError' && !controller.signal.aborted) {
            const latency = Math.max(1, Math.round(performance.now() - pingStart));
            if (latency < 280) {
              const isGw = targetIp.endsWith('.1') || targetIp.endsWith('.254');
              addOrUpdateRealPeer({
                id: `lan-${targetIp.replace(/\./g, '-')}`,
                name: isGw ? `Wi-Fi Router Gateway (${targetIp})` : `Active Node (${targetIp})`,
                ip: targetIp,
                deviceType: isGw ? 'router' : 'phone',
                icon: isGw ? '🌐' : '📱',
                protocol: 'wifi',
                latency,
                isGateway: isGw,
                x: 50,
                y: 50,
                lastSeen: Date.now()
              });
              return true;
            }
          }
        }
      }
      return false;
    };

    // Run parallel batches with live counter progression
    for (let i = 0; i < ipsToScan.length; i += batchSize) {
      if (controller.signal.aborted) break;

      const batch = ipsToScan.slice(i, i + batchSize);
      setCurrentScanningIp(batch[0]);

      await Promise.all(batch.map(ip => testHostOnline(ip)));

      completedCount += batch.length;
      setScannedIpsCount(Math.min(completedCount, 254));

      const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
      setScanSpeedIpsPerSec(Math.round(completedCount / elapsedSec));
    }

    setIsScanning(false);
    setCurrentScanningIp('');
    playChime('complete');
  };

  // 4. Manual IP Direct Probe
  const handleManualProbe = async () => {
    const target = manualProbeIp.trim();
    if (!target) return;
    setIsProbingManual(true);
    setProbeResultMsg(`Pinging ${target}...`);

    const start = performance.now();
    let responded = false;

    try {
      const ports = [80, 8080, 3000, 443, 8000];
      for (const p of ports) {
        try {
          await fetch(`http://${target}:${p}/?_t=${Date.now()}`, {
            method: 'HEAD',
            mode: 'no-cors',
            signal: AbortSignal.timeout(600)
          });
          responded = true;
          break;
        } catch (e: any) {
          if (e && e.name !== 'TimeoutError') {
            responded = true;
            break;
          }
        }
      }
    } catch (e) {}

    const latency = Math.max(1, Math.round(performance.now() - start));
    setIsProbingManual(false);

    if (responded) {
      const isGw = target.endsWith('.1') || target.endsWith('.254');
      addOrUpdateRealPeer({
        id: `lan-${target.replace(/\./g, '-')}`,
        name: isGw ? `Wi-Fi Router (${target})` : `Discovered Device (${target})`,
        ip: target,
        deviceType: isGw ? 'router' : 'phone',
        icon: isGw ? '🌐' : '📱',
        protocol: 'wifi',
        latency,
        isGateway: isGw,
        x: 50,
        y: 50,
        lastSeen: Date.now()
      });
      setProbeResultMsg(`✅ Device at ${target} responded in ${latency}ms! Added to Radar.`);
    } else {
      setProbeResultMsg(`⚠️ No response from ${target} within timeout. Verify device is connected to the same Wi-Fi.`);
    }
  };

  // 5. Broadcast Channel for Intra-Machine Multi-Tab Discovery
  useEffect(() => {
    const meshChannel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('beamdrop_local_mesh_channel')
      : null;

    if (meshChannel) {
      meshChannel.onmessage = (evt) => {
        const data = evt.data;
        if (!data || !data.id || data.id === myDeviceInfo.name) return;
        if (data.type === 'RADAR_BEACON' || data.type === 'RADAR_PONG') {
          addOrUpdateRealPeer({
            id: data.id,
            name: data.name || 'Nearby Browser Peer',
            ip: data.ip || myDeviceInfo.ip || 'Local Station',
            deviceType: data.deviceType || 'laptop',
            icon: data.icon || '💻',
            protocol: 'wifi',
            latency: 2,
            x: 50,
            y: 50,
            lastSeen: Date.now()
          });
        }
      };

      // Announce self to local tabs
      meshChannel.postMessage({
        type: 'RADAR_BEACON',
        id: `web-node-${Math.random().toString(36).slice(2, 7)}`,
        name: myDeviceInfo.name,
        deviceType: myDeviceInfo.deviceType,
        icon: myDeviceInfo.icon,
        ip: myDeviceInfo.ip
      });
    }

    const announceSelf = () => {
      fetch('/api/mesh/announce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `peer-${Math.random().toString(36).slice(2, 8)}`,
          name: myDeviceInfo.name,
          deviceType: myDeviceInfo.deviceType,
          icon: myDeviceInfo.icon,
          ip: myDeviceInfo.ip !== 'Detecting...' ? myDeviceInfo.ip : undefined
        })
      }).catch(() => {});
    };

    announceSelf();
    queryLocalMeshBackend();

    // Periodic heartbeat & peer query
    const heartbeatTimer = setInterval(() => {
      announceSelf();
      queryLocalMeshBackend();

      // Prune inactive peers older than 35s
      const now = Date.now();
      setDiscoveredPeers(prev => prev.filter(p => p.isGateway || now - p.lastSeen < 35000));
    }, 4000);

    return () => {
      clearInterval(heartbeatTimer);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (meshChannel) meshChannel.close();
    };
  }, [myDeviceInfo.ip]);

  // Filtered devices
  const filteredPeers = useMemo(() => {
    return discoveredPeers.filter(peer => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'phone') return peer.deviceType === 'phone';
      if (activeFilter === 'laptop') return peer.deviceType === 'laptop' || peer.deviceType === 'desktop';
      if (activeFilter === 'router') return peer.deviceType === 'router' || peer.isGateway;
      return true;
    });
  }, [discoveredPeers, activeFilter]);

  const phoneCount = discoveredPeers.filter(p => p.deviceType === 'phone').length;
  const pcCount = discoveredPeers.filter(p => p.deviceType === 'laptop' || p.deviceType === 'desktop').length;
  const routerCount = discoveredPeers.filter(p => p.deviceType === 'router' || p.isGateway).length;
  const scanProgress = totalSubnetIps > 0 ? Math.round((scannedIpsCount / totalSubnetIps) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* 1. Real Network Telemetry HUD Bar */}
      <div className="glass-panel-glow rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-cyan-500/25">
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
                {networkMeta.isHotspot ? '🔥 HOTSPOT MESH' : '📶 REAL WI-FI LAN'}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center flex-wrap gap-2 mt-0.5 font-mono">
              <span>{networkMeta.band}</span>
              <span>•</span>
              <span className="text-cyan-400 font-semibold">Subnet: {networkMeta.subnet}</span>
              <span>•</span>
              <span className="text-emerald-400 font-bold">This Device IP: {myDeviceInfo.ip}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-wrap">
          <button
            onClick={() => setAudioFeedback(!audioFeedback)}
            title={audioFeedback ? 'Disable Radar Sound' : 'Enable Radar Sound'}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            {audioFeedback ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            onClick={startRealSubnetSweep}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-white font-semibold text-xs transition-all shadow-md cursor-pointer ${
              isScanning
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25'
                : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/25'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Stop Subnet Sweep' : 'Sweep Subnet for Devices'}</span>
          </button>
        </div>
      </div>

      {/* 2. REAL-TIME SUBNET SCANNER COUNTER HUD ("ALL COUNT LI RAHO MY JIHAZI") */}
      <div className="glass-panel rounded-2xl p-4 border border-cyan-500/20 bg-slate-950/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <Crosshair className={`w-4 h-4 ${isScanning ? 'text-cyan-400 animate-spin' : 'text-slate-400'}`} />
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Real Subnet Discovery Counter
              </span>
              <span className="text-[11px] text-slate-400 ml-2 font-mono">
                {isScanning ? `Inspecting ${currentScanningIp || customSubnetPrefix + '.x'}...` : 'Ready to inspect local Wi-Fi nodes'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs font-mono">
            <span className="text-slate-400">
              Scanned: <strong className="text-cyan-400">{scannedIpsCount}</strong> / {totalSubnetIps} IPs ({scanProgress}%)
            </span>
            <span>•</span>
            <span className="text-slate-400">
              Online Found: <strong className="text-emerald-400">{discoveredPeers.length}</strong>
            </span>
            {isScanning && scanSpeedIpsPerSec > 0 && (
              <>
                <span>•</span>
                <span className="text-amber-400 font-bold">{scanSpeedIpsPerSec} IPs/s</span>
              </>
            )}
          </div>
        </div>

        {/* Live Progress Bar */}
        <div className="mt-3">
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-500 rounded-full transition-all duration-150"
              style={{ width: `${scanProgress}%` }}
            ></div>
          </div>
        </div>

        {/* Subnet Prefix Selector & Direct IP Prober */}
        <div className="mt-3 pt-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 whitespace-nowrap">Subnet Target:</span>
            <input
              type="text"
              value={customSubnetPrefix}
              onChange={(e) => setCustomSubnetPrefix(e.target.value)}
              placeholder="192.168.1"
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-cyan-300 font-mono text-xs w-32 focus:outline-none focus:border-cyan-400"
            />
            <span className="text-slate-500 font-mono">.1 → .254</span>
          </div>

          {/* Direct Manual IP Probe Tool */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 whitespace-nowrap">Probe IP:</span>
            <input
              type="text"
              value={manualProbeIp}
              onChange={(e) => setManualProbeIp(e.target.value)}
              placeholder="e.g. 192.168.1.50"
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono text-xs w-36 focus:outline-none focus:border-cyan-400"
            />
            <button
              onClick={handleManualProbe}
              disabled={isProbingManual || !manualProbeIp.trim()}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-semibold rounded-lg text-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center space-x-1"
            >
              <Search className="w-3 h-3" />
              <span>{isProbingManual ? 'Pinging...' : 'Ping Node'}</span>
            </button>
          </div>
        </div>

        {probeResultMsg && (
          <p className="mt-2 text-[11px] font-mono text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
            {probeResultMsg}
          </p>
        )}
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

            {/* Center Local User Node ("Jihezi") */}
            <div className="absolute z-10 flex flex-col items-center">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500 text-white flex items-center justify-center shadow-lg shadow-cyan-500/50 border border-white/20">
                <Laptop className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold text-cyan-300 bg-slate-950/80 px-2 py-0.5 rounded-full mt-1 border border-cyan-500/30">
                You ({myDeviceInfo.ip !== 'Detecting...' ? myDeviceInfo.ip : 'Local'})
              </span>
            </div>

            {/* Interactive Radar Blips for REAL discovered peers */}
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
              <div className="text-center py-10 px-4 glass-panel rounded-3xl border border-slate-800 text-slate-400 space-y-3">
                <Radio className={`w-10 h-10 mx-auto ${isScanning ? 'text-cyan-400 animate-spin' : 'text-slate-600'}`} />
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    {isScanning ? 'Scanning Wi-Fi subnet for real active devices...' : 'No other devices detected on this Wi-Fi yet'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
                    Zero mock devices. Open BeamDrop on your smartphone, tablet, or another PC connected to the same Wi-Fi network, and it will be recognized here automatically!
                  </p>
                </div>
                {!isScanning && (
                  <button
                    onClick={startRealSubnetSweep}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-md shadow-cyan-600/20 cursor-pointer inline-flex items-center space-x-1.5 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Run Subnet Sweep Now</span>
                  </button>
                )}
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
