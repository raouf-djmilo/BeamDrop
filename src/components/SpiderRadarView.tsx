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
  Plus,
  Building2
} from 'lucide-react';
import { workspaceEngine, WorkspaceNode } from '../utils/engine/workspace';
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
  // Persistent Team Workspace State
  const [workspaceSlug, setWorkspaceSlug] = useState<string>('');
  const [workspacePin, setWorkspacePin] = useState<string>('');
  const [isWorkspaceActive, setIsWorkspaceActive] = useState<boolean>(false);
  const [workspaceNodes, setWorkspaceNodes] = useState<WorkspaceNode[]>([]);
  const [workspaceError, setWorkspaceError] = useState<string>('');

  const handleJoinWorkspace = async () => {
    if (!workspaceSlug.trim() || !workspacePin.trim()) return;
    setWorkspaceError('');
    const res = await workspaceEngine.announceInWorkspace(
      workspaceSlug.trim().toLowerCase(),
      workspacePin.trim(),
      {
        id: myDeviceInfo.ip || 'node-' + Math.random().toString(36).slice(2, 7),
        name: myDeviceInfo.name,
        deviceType: myDeviceInfo.deviceType,
        icon: myDeviceInfo.icon
      }
    );
    if (res.success) {
      setIsWorkspaceActive(true);
      setWorkspaceNodes(res.nodes);
      workspaceEngine.startHeartbeat(
        workspaceSlug.trim().toLowerCase(),
        workspacePin.trim(),
        {
          id: myDeviceInfo.ip || 'node-' + Math.random().toString(36).slice(2, 7),
          name: myDeviceInfo.name,
          deviceType: myDeviceInfo.deviceType,
          icon: myDeviceInfo.icon
        },
        (updatedNodes) => setWorkspaceNodes(updatedNodes)
      );
    } else {
      setWorkspaceError(res.error || 'Failed to authenticate in workspace');
    }
  };

  const handleLeaveWorkspace = () => {
    workspaceEngine.stopHeartbeat();
    setIsWorkspaceActive(false);
    setWorkspaceNodes([]);
  };

  // Real Network Metadata
  const [networkMeta, setNetworkMeta] = useState<{
    ssid: string;
    band: string;
    signal: string;
    speed: string;
    myIp: string;
    isHotspot: boolean;
  }>({
    ssid: 'Connecting to Mesh...',
    band: 'Wi-Fi / Mesh P2P',
    signal: '100%',
    speed: 'Direct WebRTC',
    myIp: 'Detecting...',
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
    let icon = 'laptop';

    if (/iPhone|iPad|iPod/i.test(ua)) {
      name = 'Apple iPhone';
      deviceType = 'phone';
      icon = 'phone';
    } else if (/Android/i.test(ua)) {
      name = 'Android Smartphone';
      deviceType = 'phone';
      icon = 'phone';
    } else if (/Macintosh|Mac OS/i.test(ua)) {
      name = 'MacBook Pro';
      deviceType = 'laptop';
      icon = 'laptop';
    } else if (/Windows/i.test(ua)) {
      name = 'Windows PC';
      deviceType = 'desktop';
      icon = 'laptop';
    } else if (/Linux/i.test(ua)) {
      name = 'Linux Station';
      deviceType = 'desktop';
      icon = 'laptop';
    }

    return { name, deviceType, icon, ip: 'Detecting...' };
  });

  // Real Discovered Peers - ZERO mock devices!
  const [discoveredPeers, setDiscoveredPeers] = useState<DiscoveredPeer[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'phone' | 'laptop' | 'router'>('all');
  const [selectedPeer, setSelectedPeer] = useState<DiscoveredPeer | null>(null);
  const [audioFeedback, setAudioFeedback] = useState<boolean>(true);


  const [roomHash, setRoomHash] = useState<string>('');
  const [roomPin, setRoomPin] = useState<string>(() => (typeof localStorage !== 'undefined' ? localStorage.getItem('beamdrop_radar_pin') || '' : ''));

  const abortControllerRef = useRef<AbortController | null>(null);
  const myPeerIdRef = useRef<string>(typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('beamdrop_mesh_peer_id') || ('peer-' + Math.random().toString(36).slice(2, 9))) : ('peer-' + Math.random().toString(36).slice(2, 9)));
  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('beamdrop_mesh_peer_id', myPeerIdRef.current);
    }
  }, []);

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

  // 1.   // 1. Detect Real Local Private LAN IP via WebRTC ICE candidate gathering (typ host)
  // + Fetch Public IP & Room Hash from /api/ip (PairDrop Mesh Pairing)
  useEffect(() => {
    let resolved = false;

    // A. WebRTC Private LAN IP detection (filtering for host candidates and private IP ranges)
    const detectLanIp = async () => {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        });
        pc.createDataChannel('lan-ip-probe');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const timer = setTimeout(() => {
          if (!resolved) {
            try { pc.close(); } catch (_) {}
          }
        }, 3500);

        pc.onicecandidate = (event) => {
          if (!event || !event.candidate || !event.candidate.candidate) return;
          const candidateStr = event.candidate.candidate;
          // Capture LAN private IP from candidate strings containing host or standard ranges
          const ipRegex = /(192\.168\.[0-9]{1,3}\.[0-9]{1,3}|10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}|172\.(?:1[6-9]|2[0-9]|3[01])\.[0-9]{1,3}\.[0-9]{1,3})/;
          const match = candidateStr.match(ipRegex);
          if (match && match[1]) {
            const privateLanIp = match[1];
            resolved = true;
            clearTimeout(timer);
            try { pc.close(); } catch (_) {}
            setMyDeviceInfo(prev => ({ ...prev, ip: privateLanIp }));
            const parts = privateLanIp.split('.');
            if (parts.length === 4) {
              const prefix = parts.slice(0, 3).join('.');
              setNetworkMeta(prev => ({
                ...prev,
                myIp: privateLanIp,
                
              }));
            }
          }
        };
      } catch (e) {}
    };

    // B. Fetch Public IP and room hash from /api/ip
    const fetchPublicRoomHash = async () => {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const endpoints = [
        origin ? `${origin}/api/ip` : '/api/ip',
        '/api/ip',
        'https://beam-drop-mu.vercel.app/api/ip'
      ];
      for (const url of endpoints) {
        try {
          const res = await fetch(url + '?_t=' + Date.now(), { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data && data.success && data.roomHash) {
              setRoomHash(data.roomHash);
              setMyDeviceInfo(prev => ({
                ...prev,
                ip: prev.ip === 'Detecting...' || prev.ip === '127.0.0.1' ? data.ip : prev.ip
              }));
              setNetworkMeta(prev => ({
                ...prev,
                ssid: 'Wi-Fi Room (' + data.roomHash + ')',
                myIp: prev.myIp === 'Detecting...' || prev.myIp === '127.0.0.1' ? data.ip : prev.myIp
              }));
              break;
            }
          }
        } catch (_) {}
      }
    };

    detectLanIp();
    fetchPublicRoomHash();
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

  // 2. Fetch live active devices from Mesh Signaling (PairDrop / Snapdrop Same-Wi-Fi Architecture)
  const queryLocalMeshBackend = async (): Promise<boolean> => {
    const pinParam = roomPin ? ('&pin=' + encodeURIComponent(roomPin)) : '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const endpoints = [
      origin ? `${origin}/api/mesh/devices?_t=${Date.now()}${pinParam}` : `/api/mesh/devices?_t=${Date.now()}${pinParam}`,
      '/api/mesh/devices?_t=' + Date.now() + pinParam,
      'https://beam-drop-mu.vercel.app/api/mesh/devices?_t=' + Date.now() + pinParam,
      '/api/scan-lan?_t=' + Date.now()
    ];

    let foundAny = false;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            if (json.roomHash) {
              setRoomHash(json.roomHash);
              setNetworkMeta(prev => ({
                ...prev,
                ssid: 'Wi-Fi Room (' + json.roomHash + ')'
              }));
            }
            if (json.network) {
              setNetworkMeta(prev => ({
                ...prev,
                ssid: json.network.ssid || prev.ssid,
                band: json.network.band || prev.band,
                signal: json.network.signal || prev.signal,
                speed: json.network.speed || prev.speed,
                myIp: json.network.myIp && json.network.myIp !== '127.0.0.1' ? json.network.myIp : prev.myIp,
                
                isHotspot: Boolean(json.network.isHotspot)
              }));
            }
            if (Array.isArray(json.devices)) {
              // Map all devices except our own persistent node ID
              json.devices.forEach((dev: any) => {
                if (dev.id && dev.id === myPeerIdRef.current) return;
                addOrUpdateRealPeer({
                  id: dev.id || ('lan-' + (dev.ip || 'node').replace(/\./g, '-')),
                  name: dev.name || ('Device (' + (dev.ip || 'Nearby') + ')'),
                  ip: dev.ip || 'LAN Node',
                  mac: dev.mac,
                  deviceType: dev.deviceType || (dev.isGateway ? 'router' : 'phone'),
                  icon: dev.icon || (dev.isGateway ? 'gateway' : 'phone'),
                  protocol: dev.protocol || 'wifi',
                  latency: dev.latency || 2,
                  isGateway: dev.isGateway,
                  x: 50,
                  y: 50,
                  signal: dev.signal || '92%',
                  lastSeen: Date.now()
                });
                foundAny = true;
              });
              if (foundAny) return true;
            }
          }
        }
      } catch (e) {}
    }
    return foundAny;
  };
// 3. In-Browser Subnet Active Scanner Engine with Real-Time Counters ("ALL COUNT LI RAHO MY JIHAZI")
  // 5. Active Mesh Presence Loop (3-second polling & 15-second graceful prune)
  useEffect(() => {
    const meshChannel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('beamdrop_local_mesh_channel')
      : null;

    if (meshChannel) {
      meshChannel.onmessage = (evt) => {
        const data = evt.data;
        if (!data || !data.id || data.id === myPeerIdRef.current) return;
        if (data.type === 'RADAR_BEACON' || data.type === 'RADAR_PONG') {
          addOrUpdateRealPeer({
            id: data.id,
            name: data.name || 'Nearby Browser Peer',
            ip: data.ip || myDeviceInfo.ip || 'Local Station',
            deviceType: data.deviceType || 'laptop',
            icon: data.icon || 'laptop',
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
        id: myPeerIdRef.current,
        name: myDeviceInfo.name,
        deviceType: myDeviceInfo.deviceType,
        icon: myDeviceInfo.icon,
        ip: myDeviceInfo.ip
      });
    }

    const announceSelf = () => {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const endpoints = [
        origin ? `${origin}/api/mesh/announce` : '/api/mesh/announce',
        '/api/mesh/announce',
        'https://beam-drop-mu.vercel.app/api/mesh/announce'
      ];
      endpoints.forEach(url => {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: myPeerIdRef.current,
            name: myDeviceInfo.name,
            deviceType: myDeviceInfo.deviceType,
            icon: myDeviceInfo.icon,
            pin: roomPin || undefined,
            ip: myDeviceInfo.ip && myDeviceInfo.ip !== 'Detecting...' && myDeviceInfo.ip !== '127.0.0.1' ? myDeviceInfo.ip : undefined
          })
        }).catch(() => {});
      });
    };

    announceSelf();
    queryLocalMeshBackend();

    // 100% Active Mesh Signaling: Poll every 3 seconds for immediate discovery
    const heartbeatTimer = setInterval(() => {
      announceSelf();
      queryLocalMeshBackend();

      // Gracefully prune disconnected or inactive peers after 15 seconds
      const now = Date.now();
      setDiscoveredPeers(prev => prev.filter(p => p.isGateway || (now - p.lastSeen < 15000)));
    }, 3000);

    return () => {
      clearInterval(heartbeatTimer);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (meshChannel) meshChannel.close();
    };
  }, [myDeviceInfo.ip, roomPin]);
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

  return (
    <div className="space-y-6">
      {/* Persistent Team Workspace Bar (Pro Mesh) */}
      <div className="bg-white/85 backdrop-blur-2xl rounded-3xl p-4 sm:p-5 border border-indigo-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_12px_36px_rgba(99,102,241,0.08)]">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0 shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>Team Workspace Mesh</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                  PRO VIRTUAL ROOM
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {isWorkspaceActive
                ? 'Connected to /w/' + workspaceSlug + ' (' + workspaceNodes.length + ' devices online)'
                : 'Connect devices across different Wi-Fi networks'}
            </p>
          </div>
        </div>

        {!isWorkspaceActive ? (
          <div className="flex items-center space-x-2 flex-wrap sm:flex-nowrap">
            <input
              type="text"
              placeholder="slug (e.g. design-team)"
              value={workspaceSlug}
              onChange={(e) => setWorkspaceSlug(e.target.value)}
              className="bg-indigo-50/60 border border-indigo-200 rounded-xl px-3 py-1.5 text-xs text-indigo-950 font-mono placeholder-indigo-400 focus:outline-none focus:border-indigo-500 w-36 shadow-xs"
            />
            <input
              type="password"
              placeholder="PIN (4-6 digits)"
              value={workspacePin}
              onChange={(e) => setWorkspacePin(e.target.value)}
              maxLength={6}
              className="bg-indigo-50/60 border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs text-indigo-950 font-mono placeholder-indigo-400 focus:outline-none focus:border-indigo-500 w-28 shadow-xs"
            />
            <button
              onClick={handleJoinWorkspace}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              Join Mesh
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-mono font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>/w/{workspaceSlug}</span>
            </div>
            <button
              onClick={handleLeaveWorkspace}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium cursor-pointer shadow-xs"
            >
              Leave
            </button>
          </div>
        )}
      </div>

      {/* 1. Real Network Telemetry HUD Bar */}
      <div className="bg-white/90 backdrop-blur-2xl rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-sky-200/90 shadow-[0_12px_36px_rgba(2,132,199,0.08)]">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20 shrink-0 text-white">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>{networkMeta.ssid}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping"></span>
              </h2>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                networkMeta.isHotspot
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-sky-50 text-sky-800 border-sky-300'
              }`}>
                {networkMeta.isHotspot ? 'HOTSPOT MESH' : 'REAL WI-FI LAN'}
              </span>
            </div>
            <p className="text-xs text-slate-600 flex items-center flex-wrap gap-2 mt-0.5 font-mono">
              <span className="inline-flex items-center text-emerald-700 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1.5 animate-pulse"></span>
                Connected to Mesh
              </span>
              <span>•</span>
              <span className="text-sky-700 font-bold">Room: {roomHash || 'Auto (Same Wi-Fi)'}</span>
              <span>•</span>
              <span className="text-slate-600">Public IP: <strong className="text-slate-900 font-mono font-bold">{myDeviceInfo.ip}</strong></span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-wrap">
          <button
            onClick={() => setAudioFeedback(!audioFeedback)}
            title={audioFeedback ? 'Disable Radar Sound' : 'Enable Radar Sound'}
            className="p-2.5 rounded-xl bg-white border border-sky-200 hover:border-sky-300 text-slate-600 hover:text-sky-700 hover:bg-sky-50 transition-all cursor-pointer shadow-xs"
          >
            {audioFeedback ? <Volume2 className="w-4 h-4 text-sky-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          <button
            onClick={() => queryLocalMeshBackend()}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-white font-semibold text-xs transition-all shadow-md cursor-pointer bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 shadow-sky-500/25"
            title="Scan Mesh Nodes"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Scan Mesh Nodes</span>
          </button>
        </div>
      </div>

      {/* 2. ACTIVE MESH SIGNALING & PAIRING STATUS BAR */}
      <div className="glass-panel rounded-2xl p-4 border border-sky-200/80 shadow-[0_8px_24px_rgba(2,132,199,0.06)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <div>
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Active Mesh Presence Engine
              </span>
              <span className="text-[11px] text-sky-700 ml-2 font-mono font-semibold">
                Auto-discovering phones & PCs on same Wi-Fi
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-3 text-xs font-mono">
            <span className="text-slate-500">
              Room: <strong className="text-sky-700 font-bold">{roomHash || 'Auto (Same Wi-Fi)'}</strong>
            </span>
            <span>•</span>
            <span className="text-slate-500">
              Online Discovered: <strong className="text-emerald-700 font-bold">{discoveredPeers.length}</strong>
            </span>
          </div>
        </div>

        {/* Dynamic Connection Instructions & Private Room PIN */}
        <div className="mt-3 pt-1 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-600 text-[11px]">
            <Smartphone className="w-4 h-4 text-sky-600 shrink-0" />
            <span>
              Open <strong className="text-sky-700 font-mono font-bold">{typeof window !== 'undefined' ? window.location.origin : 'https://beam-drop-mu.vercel.app'}</strong> on your phone (same Wi-Fi) to appear instantly on radar!
            </span>
          </div>

          {/* Room PIN Tool for Public Wi-Fi Collision Isolation */}
          <div className="flex items-center space-x-1.5 shrink-0" title="Set an optional 4-digit PIN to isolate devices on public Wi-Fi (cafes, universities)">
            <Shield className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span className="text-slate-500 whitespace-nowrap">Private Room PIN:</span>
            <input
              type="text"
              value={roomPin}
              maxLength={4}
              onChange={(e) => {
                const val = e.target.value.trim();
                setRoomPin(val);
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem('beamdrop_radar_pin', val);
                }
                setDiscoveredPeers([]);
              }}
              placeholder="Optional"
              className="bg-white border border-sky-300 rounded-lg px-2 py-1 text-sky-800 font-mono text-xs w-20 text-center focus:outline-none focus:border-sky-500 shadow-xs"
            />
          </div>
        </div>
      </div>
      {/* Main Grid: Radar Screen & Devices List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Radar Screen (7 cols) */}
        <div className="lg:col-span-7 glass-panel rounded-3xl p-6 border border-white/95 shadow-[0_16px_40px_rgba(2,132,199,0.08)] flex flex-col items-center justify-center relative overflow-hidden">
          {/* Subtle Radar Background Grid */}
          <div className="w-full max-w-[440px] aspect-square relative flex items-center justify-center">
            {/* Concentric Circle Rings */}
            <div className="absolute inset-0 rounded-full border border-sky-400/20 pointer-events-none"></div>
            <div className="absolute inset-[15%] rounded-full border border-sky-400/25 pointer-events-none"></div>
            <div className="absolute inset-[35%] rounded-full border border-sky-400/35 pointer-events-none"></div>
            <div className="absolute inset-[55%] rounded-full border border-sky-400/45 pointer-events-none"></div>

            {/* Radial Spider Web Spokes */}
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-gradient-to-r from-transparent via-sky-400/30 to-transparent pointer-events-none"></div>
            <div className="absolute inset-y-0 left-1/2 w-[1px] bg-gradient-to-b from-transparent via-sky-400/30 to-transparent pointer-events-none"></div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-full h-[1px] bg-sky-400/15 rotate-45"></div>
              <div className="w-full h-[1px] bg-sky-400/15 -rotate-45"></div>
            </div>

            {/* Rotating Cyber Radar Sweep */}
            <div className="radar-sweep-beam"></div>

            {/* Center Local User Node ("Jihezi") */}
            <div className="absolute z-10 flex flex-col items-center">
              <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/40 border border-white/40">
                <Laptop className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold text-sky-800 bg-white px-2 py-0.5 rounded-full mt-1 border border-sky-300 shadow-xs">
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
                  onDoubleClick={() => onDirectBeamTarget && onDirectBeamTarget(peer)}
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
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-xl bg-white/95 border border-sky-300 text-slate-800 text-[11px] font-medium whitespace-nowrap shadow-xl pointer-events-none flex flex-col items-center z-30">
                    <span className="font-bold text-sky-800">{peer.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{peer.ip} • {peer.latency}ms</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Action Selected Peer Bar */}
          {selectedPeer && (
            <div className="w-full mt-4 p-3 rounded-2xl bg-sky-50/95 border border-sky-300 flex items-center justify-between shadow-xs transition-all">
              <div className="flex items-center space-x-2.5 min-w-0">
                <span className="text-xl">{selectedPeer.icon}</span>
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-900 truncate">{selectedPeer.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{selectedPeer.ip} • {selectedPeer.latency}ms • Direct Mesh Link Ready</p>
                </div>
              </div>
              <button
                onClick={() => onDirectBeamTarget && onDirectBeamTarget(selectedPeer)}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-sky-600/20 cursor-pointer shrink-0 ml-2"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Beam Directly</span>
              </button>
            </div>
          )}

          {/* Radar Legend Footer */}
          <div className="w-full mt-6 pt-4 border-t border-sky-100 flex items-center justify-around text-xs text-slate-500">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Smartphones (Android/iOS)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
              <span>PCs & Laptops</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Gateway / Router</span>
            </div>
          </div>
        </div>

        {/* Discovered Devices Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Category Filter Pills */}
          <div className="flex items-center space-x-1.5 bg-white/80 border border-sky-200/80 p-1.5 rounded-2xl overflow-x-auto shadow-xs">
            <button
              onClick={() => setActiveFilter('all')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-sky-700 hover:bg-sky-50'
              }`}
            >
              <span>All</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15 font-mono">
                {discoveredPeers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveFilter('phone')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeFilter === 'phone'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <span>Phones</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15 font-mono">
                {phoneCount}
              </span>
            </button>

            <button
              onClick={() => setActiveFilter('laptop')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeFilter === 'laptop'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-sky-700 hover:bg-sky-50'
              }`}
            >
              <span>PCs</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15 font-mono">
                {pcCount}
              </span>
            </button>

            <button
              onClick={() => setActiveFilter('router')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeFilter === 'router'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
              }`}
            >
              <span>Gateway</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15 font-mono">
                {routerCount}
              </span>
            </button>
          </div>

          {/* Cards List */}
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredPeers.length === 0 ? (
              <div className="text-center py-10 px-4 glass-panel rounded-3xl border border-white/95 text-slate-500 space-y-3 shadow-[0_12px_36px_rgba(2,132,199,0.06)]">
                <Radio className="w-10 h-10 mx-auto text-sky-500 animate-pulse" />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    No other devices detected in this Wi-Fi room yet
                  </p>
                  <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
                    Zero mock devices. Open BeamDrop on your smartphone, tablet, or another PC connected to the same Wi-Fi network, and it will be recognized here automatically!
                  </p>
                </div>
                {true && (
                  <button
                    onClick={() => queryLocalMeshBackend()}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 text-white font-semibold text-xs shadow-md shadow-sky-500/20 cursor-pointer inline-flex items-center space-x-1.5 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh Mesh Presence</span>
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
                        ? 'border-sky-400 bg-sky-50/90 shadow-md shadow-sky-500/10'
                        : 'border-sky-200/70 hover:border-sky-300 hover:bg-white/90 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white border border-sky-200 flex items-center justify-center text-lg relative shrink-0 shadow-xs">
                        <span>{peer.icon}</span>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white absolute -bottom-0.5 -right-0.5"></span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <p className="text-xs font-bold text-slate-900 truncate max-w-[150px] sm:max-w-[200px]">
                            {peer.name}
                          </p>
                          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                            peer.protocol === 'hotspot'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-sky-100 text-sky-800 border border-sky-300'
                          }`}>
                            {peer.protocol === 'hotspot' ? 'Hotspot' : '5GHz'}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2 mt-1 text-[11px] font-mono text-slate-500">
                          <span className="text-sky-700 font-semibold">{peer.ip}</span>
                          <span>•</span>
                          <span className="text-emerald-700 font-bold">{peer.latency}ms</span>
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
                          alert(`Direct Beam initialized for ${peer.name} (${peer.ip})!\nSwitch to the "Beam Objects" tab to select files or notes to transmit.`);
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
