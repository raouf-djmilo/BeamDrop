import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Laptop,
  ArrowRight,
  Upload,
  Download,
  Check,
  Send,
  Sparkles,
  Zap,
  Radio,
  FileArchive,
  Image as ImageIcon,
  BookOpen,
  FileSpreadsheet,
  Presentation,
  FileText,
  RotateCcw,
  CheckCircle2,
  Terminal,
  ExternalLink
} from 'lucide-react';
import { P2PTransferManager, TransferFile } from '../utils/p2p';
import { formatBytes, formatSpeed } from '../utils/formatters';
import { playChime } from '../utils/audio';

export const SplitSimulator: React.FC = () => {
  const [senderPeer, setSenderPeer] = useState<P2PTransferManager | null>(null);
  const [receiverPeer, setReceiverPeer] = useState<P2PTransferManager | null>(null);
  const [isPaired, setIsPaired] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<{
    fileName: string;
    progress: number;
    speed: number;
  } | null>(null);
  const [receivedSimFiles, setReceivedSimFiles] = useState<TransferFile[]>([]);
  const [simText, setSimText] = useState('https://beam-drop-mu.vercel.app');
  const [receivedSimTexts, setReceivedSimTexts] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  // Extension simulator internal tabs
  const [extTab, setExtTab] = useState<'objects' | 'radar' | 'notebook'>('objects');
  const [handshakeModal, setHandshakeModal] = useState<{
    sender: string;
    objectName: string;
    size: string;
    type: string;
  } | null>(null);

  useEffect(() => {
    // Spin up two separate WebRTC peers in memory
    const sender = new P2PTransferManager();
    const receiver = new P2PTransferManager();

    setSenderPeer(sender);
    setReceiverPeer(receiver);

    let senderId = '';
    let receiverId = '';

    const setup = async () => {
      try {
        senderId = await sender.init('sim-pc-' + Math.random().toString(36).substring(2, 6));
        receiverId = await receiver.init('sim-phone-' + Math.random().toString(36).substring(2, 6));

        receiver.onFileReceiveStart = (f) => {
          setActiveTransfer({ fileName: f.name, progress: 0, speed: 0 });
        };

        receiver.onFileProgress = (id, progress, speed) => {
          setActiveTransfer((prev) => (prev ? { ...prev, progress, speed } : null));
        };

        receiver.onFileReceiveComplete = (f) => {
          playChime('complete');
          setActiveTransfer(null);
          setReceivedSimFiles((prev) => [f, ...prev]);
        };

        receiver.onTextReceive = (p) => {
          playChime('message');
          setReceivedSimTexts((prev) => [p.text, ...prev]);
        };

        sender.onConnected = () => {
          setIsPaired(true);
          playChime('connect');
        };

        receiver.onConnected = () => {
          setIsPaired(true);
        };
      } catch (err) {
        console.error('Simulator init error:', err);
      }
    };

    setup();

    return () => {
      sender.destroy();
      receiver.destroy();
    };
  }, []);

  const simulatePairing = async () => {
    if (!senderPeer || !receiverPeer || !senderPeer.myPeerId) return;
    setIsConnecting(true);
    try {
      await receiverPeer.connect(senderPeer.myPeerId);
      setIsPaired(true);
    } catch (e: any) {
      console.error('Pair failed:', e);
      alert('Pairing simulation failed: ' + e.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const triggerDirectBeam = (name: string, sizeBytes: number, type: 'zip' | 'photo' | 'note') => {
    if (!isPaired) {
      simulatePairing().then(() => {
        setTimeout(() => executeSend(name, sizeBytes, type), 600);
      });
      return;
    }
    executeSend(name, sizeBytes, type);
  };

  const executeSend = async (name: string, sizeBytes: number, type: 'zip' | 'photo' | 'note') => {
    if (type === 'note') {
      if (!simText.trim()) return;
      senderPeer?.sendText(simText.trim());
      return;
    }

    const content = 'Simulated payload: ' + '0123456789ABCDEF'.repeat(Math.floor(sizeBytes / 32));
    const blob = new Blob([content], {
      type: type === 'zip' ? 'application/zip' : 'image/jpeg'
    });
    const file = new (window as any).File([blob], name, { type: blob.type });

    setActiveTransfer({ fileName: name, progress: 0, speed: 0 });

    try {
      await senderPeer?.sendFile(file, (progress, speed) => {
        setActiveTransfer({ fileName: name, progress, speed });
      });
      playChime('complete');
    } catch (e: any) {
      console.error(e);
    } finally {
      setActiveTransfer(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Simulator Control Header */}
      <div className="glass-panel-glow rounded-3xl p-5 border border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-extrabold text-white flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Next-Gen Interactive P2P Simulator</span>
            </h3>
            <span className="text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/60 px-2 py-0.5 rounded-full">
              Real WebRTC RAM-to-RAM
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Test the live Spider Radar, Object Stager, and Phone Receiver handshake simultaneously in one window.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={simulatePairing}
            disabled={isPaired || isConnecting}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md cursor-pointer ${
              isPaired
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-600/25'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>{isPaired ? 'WebRTC Paired (Direct Bridge)' : isConnecting ? 'Connecting P2P...' : '1-Click Direct Pair'}</span>
          </button>
        </div>
      </div>

      {/* Side-by-side Viewports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left: Modern PC Chrome Extension Window */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-2">
            <span className="flex items-center space-x-1 font-semibold text-slate-300">
              <Laptop className="w-4 h-4 text-cyan-400" />
              <span>PC Chrome Extension Popup</span>
            </span>
            <span className="font-mono text-[10px] text-cyan-400">BeamDrop v1.5.2 HUD</span>
          </div>

          <div className="w-full max-w-[390px] mx-auto bg-slate-950 border-2 border-slate-800 rounded-3xl p-4 shadow-2xl space-y-3.5">
            {/* Window Bar */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow">
                  <Zap className="w-3.5 h-3.5 text-white fill-white" />
                </div>
                <div>
                  <span className="font-bold text-xs text-white">BeamDrop</span>
                  <span className="ml-1 text-[9px] font-mono text-cyan-400">P2P</span>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                  isPaired
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {isPaired ? '● Connected' : 'Waiting for Peer'}
              </span>
            </div>

            {/* Extension Sub-Tabs */}
            <div className="flex bg-slate-900/90 border border-slate-800 p-1 rounded-xl gap-1">
              <button
                onClick={() => setExtTab('objects')}
                className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  extTab === 'objects' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Objects
              </button>
              <button
                onClick={() => setExtTab('radar')}
                className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center space-x-1 ${
                  extTab === 'radar' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span>Radar</span>
              </button>
              <button
                onClick={() => setExtTab('notebook')}
                className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  extTab === 'notebook' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Notes
              </button>
            </div>

            {/* TAB 1: Objects View */}
            {extTab === 'objects' && (
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-slate-300">Beam Multi-Type Objects:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => triggerDirectBeam('Project_Backup_Archive.zip', 256 * 1024, 'zip')}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/60 text-left transition-all group cursor-pointer"
                  >
                    <FileArchive className="w-4 h-4 text-amber-400 mb-1 group-hover:scale-110 transition-transform" />
                    <p className="text-[11px] font-bold text-slate-200 truncate">archive.zip</p>
                    <p className="text-[9px] text-slate-500">256 KB • Zip File</p>
                  </button>

                  <button
                    onClick={() => triggerDirectBeam('Holiday_Camera_Photo.jpg', 512 * 1024, 'photo')}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/60 text-left transition-all group cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
                    <p className="text-[11px] font-bold text-slate-200 truncate">photo.jpg</p>
                    <p className="text-[9px] text-slate-500">512 KB • Image</p>
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-300">Beam Note or URL Link:</p>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={simText}
                      onChange={(e) => setSimText(e.target.value)}
                      placeholder="URL or Note..."
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono text-[11px]"
                    />
                    <button
                      onClick={() => triggerDirectBeam('Note', simText.length, 'note')}
                      className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Mini Spider Radar */}
            {extTab === 'radar' && (
              <div className="space-y-3">
                <div className="w-full aspect-[4/3] rounded-2xl bg-slate-900 border border-slate-800 relative flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 rounded-full border border-cyan-500/20"></div>
                  <div className="absolute inset-[25%] rounded-full border border-cyan-500/30"></div>
                  <div className="radar-sweep-beam"></div>

                  {/* Nodes */}
                  <div className="absolute z-10 w-7 h-7 rounded-lg bg-cyan-500 text-white flex items-center justify-center shadow">
                    <Laptop className="w-3.5 h-3.5" />
                  </div>

                  {/* Smartphone Blip */}
                  <div
                    onClick={() => triggerDirectBeam('Instant_Beam_to_Phone.jpg', 300 * 1024, 'photo')}
                    className="absolute right-8 top-8 z-20 cursor-pointer group flex flex-col items-center"
                  >
                    <div className="radar-blip-pulse bg-emerald-400/30"></div>
                    <div className="relative w-6 h-6 rounded-full bg-emerald-400 text-slate-950 font-bold flex items-center justify-center text-[10px] shadow">
                      
                    </div>
                    <span className="text-[9px] font-mono text-emerald-300 mt-1">Galaxy (4ms)</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="text-[11px] font-bold text-white">Target Mobile Phone</span>
                  </div>
                  <button
                    onClick={() => triggerDirectBeam('Direct_Beam_Archive.zip', 400 * 1024, 'zip')}
                    className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold cursor-pointer"
                  >
                    Beam to Phone
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: Mini Notebook */}
            {extTab === 'notebook' && (
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[10px] text-cyan-300 leading-relaxed">
                  <p className="text-slate-500">// BeamDrop Instant Note</p>
                  <p>const host = "192.168.1.15";</p>
                  <p>const latency = 1; // 1ms ping</p>
                </div>
                <button
                  onClick={() => triggerDirectBeam('Note', 60, 'note')}
                  className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  Beam Note to Receiver
                </button>
              </div>
            )}

            {/* Active Transfer Stream Meter */}
            {activeTransfer && (
              <div className="p-2.5 bg-cyan-950/60 border border-cyan-500/40 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-white truncate max-w-[180px]">
                    {activeTransfer.fileName}
                  </span>
                  <span className="text-cyan-400 font-mono font-bold">
                    {formatSpeed(activeTransfer.speed)}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 transition-all duration-100"
                    style={{ width: `${activeTransfer.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Modern Mobile Phone Receiver Mockup */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-2">
            <span className="flex items-center space-x-1 font-semibold text-slate-300">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Mobile Phone Browser (Web Receiver)</span>
            </span>
            <span className="font-mono text-[10px] text-emerald-400">Mobile Viewport</span>
          </div>

          <div className="w-full max-w-[340px] mx-auto bg-slate-950 border-4 border-slate-800 rounded-[38px] p-4 shadow-2xl min-h-[460px] flex flex-col justify-between relative overflow-hidden">
            {/* Dynamic Island / Notch */}
            <div className="w-24 h-4 bg-slate-900 border border-slate-800 rounded-full mx-auto mb-3 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-slate-800"></div>
            </div>

            {/* Phone Screen Content */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-xs font-bold text-white">BeamDrop Mobile</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  isPaired ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
                }`}>
                  {isPaired ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>

              {/* Handshake Acceptance Order Prompt */}
              {activeTransfer && (
                <div className="p-3 bg-cyan-950/80 border border-cyan-500/40 rounded-2xl space-y-2 animate-pulse">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white truncate">Receiving: {activeTransfer.fileName}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-cyan-400 h-1.5 transition-all"
                      style={{ width: `${activeTransfer.progress}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] font-mono text-cyan-300 text-right">{activeTransfer.progress}%</p>
                </div>
              )}

              {/* Received Payloads History */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Received in Memory ({receivedSimFiles.length + receivedSimTexts.length})
                </p>

                {receivedSimFiles.length === 0 && receivedSimTexts.length === 0 && !activeTransfer && (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    <Smartphone className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                    <p>Click "1-Click Direct Pair" above,</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">then beam an object from the PC popup!</p>
                  </div>
                )}

                {/* Received Files */}
                {receivedSimFiles.map((f, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{f.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{formatBytes(f.size)}</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full">
                      SAVED
                    </span>
                  </div>
                ))}

                {/* Received Notes */}
                {receivedSimTexts.map((txt, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-indigo-300">
                      <span>Notebook Note</span>
                      <span className="font-mono text-slate-400">{txt.length} chars</span>
                    </div>
                    <p className="text-xs text-white font-mono break-all line-clamp-2">{txt}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Bottom Home Bar */}
            <div className="w-28 h-1 bg-slate-800 rounded-full mx-auto mt-4"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
