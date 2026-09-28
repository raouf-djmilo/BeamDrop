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
  Image as ImageIcon
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
  const [simText, setSimText] = useState('');
  const [receivedSimTexts, setReceivedSimTexts] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

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
        senderId = await sender.init('sim-sender-' + Math.random().toString(36).substring(2, 6));
        receiverId = await receiver.init('sim-receiver-' + Math.random().toString(36).substring(2, 6));

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

  const simulateSendFile = async (type: 'zip' | 'photo') => {
    if (!senderPeer || !senderPeer.isConnected) {
      alert('Please click "Simulate QR Scan / Pair" first!');
      return;
    }

    const content = 'Test simulated payload: ' + '0123456789ABCDEF'.repeat(16384); // ~256KB
    const blob = new Blob([content], {
      type: type === 'zip' ? 'application/zip' : 'image/jpeg'
    });
    const fileName = type === 'zip' ? 'Project_Backup_Archive.zip' : 'Holiday_Camera_Photo.jpg';
    const file = new (window as any).File([blob], fileName, { type: blob.type });

    setActiveTransfer({ fileName, progress: 0, speed: 0 });

    try {
      await senderPeer.sendFile(file, (progress, speed) => {
        setActiveTransfer({ fileName, progress, speed });
      });
      playChime('complete');
    } catch (e: any) {
      console.error(e);
    } finally {
      setActiveTransfer(null);
    }
  };

  const simulateSendText = () => {
    if (!simText.trim() || !senderPeer || !senderPeer.isConnected) return;
    senderPeer.sendText(simText.trim());
    setSimText('');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Simulator Control Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Side-by-Side P2P Simulator</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Test the real-time WebRTC file stream right here without opening an external device.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={simulatePairing}
            disabled={isPaired || isConnecting}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md ${
              isPaired
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-white shadow-cyan-500/20'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isPaired ? 'Devices Paired (WebRTC Open)' : isConnecting ? 'Connecting P2P...' : 'Simulate QR Scan / Pair'}</span>
          </button>
        </div>
      </div>

      {/* Side-by-side viewports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left: Chrome Extension Popup Mock */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-2">
            <span className="flex items-center space-x-1 font-semibold text-slate-300">
              <Laptop className="w-4 h-4 text-cyan-400" />
              <span>PC Chrome Extension Popup</span>
            </span>
            <span className="font-mono text-[10px]">380px Extension Window</span>
          </div>

          <div className="w-full max-w-[390px] mx-auto bg-slate-900 border-2 border-slate-700/80 rounded-3xl p-4 shadow-2xl shadow-cyan-950/20 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow">
                  <Zap className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-xs text-white">BeamDrop</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                  isPaired
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {isPaired ? 'Phone Connected' : 'Waiting'}
              </span>
            </div>

            {/* Quick Test Action Buttons */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-slate-300">Beam a Test File:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => simulateSendFile('zip')}
                  disabled={!isPaired}
                  className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 disabled:opacity-40 text-left transition-colors flex items-center space-x-2.5"
                >
                  <FileArchive className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="truncate">
                    <p className="text-xs font-semibold text-slate-200 truncate">archive.zip</p>
                    <p className="text-[10px] text-slate-400">256 KB Demo</p>
                  </div>
                </button>
                <button
                  onClick={() => simulateSendFile('photo')}
                  disabled={!isPaired}
                  className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 disabled:opacity-40 text-left transition-colors flex items-center space-x-2.5"
                >
                  <ImageIcon className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="truncate">
                    <p className="text-xs font-semibold text-slate-200 truncate">photo.jpg</p>
                    <p className="text-[10px] text-slate-400">Image file</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Send Text */}
            <div className="space-y-2 pt-1 border-t border-slate-800">
              <p className="text-[11px] font-medium text-slate-300">Send Text or Link:</p>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Type message, URL, code..."
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && simulateSendText()}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={simulateSendText}
                  disabled={!isPaired || !simText.trim()}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Active transfer pill */}
            {activeTransfer && (
              <div className="p-2.5 bg-cyan-950/60 border border-cyan-500/40 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-white truncate max-w-[180px]">
                    {activeTransfer.fileName}
                  </span>
                  <span className="text-cyan-400 font-mono">
                    {formatSpeed(activeTransfer.speed)}
                  </span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-cyan-400 h-full transition-all duration-150"
                    style={{ width: `${activeTransfer.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Phone Frame Mock */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-2">
            <span className="flex items-center space-x-1 font-semibold text-slate-300">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Mobile Phone Browser (Web Receiver)</span>
            </span>
            <span className="font-mono text-[10px]">Mobile Viewport</span>
          </div>

          <div className="w-full max-w-[390px] mx-auto bg-slate-950 border-4 border-slate-800 rounded-[36px] p-5 shadow-2xl relative min-h-[460px] flex flex-col justify-between">
            {/* Top Phone Notch / Dynamic Island */}
            <div className="w-28 h-4 bg-slate-800 rounded-full mx-auto mb-3" />

            {/* Phone Screen Content */}
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
                <span className="font-bold text-white">BeamDrop Mobile</span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {isPaired ? 'LIVE P2P' : 'OFFLINE'}
                </span>
              </div>

              {/* Streaming feedback */}
              {activeTransfer && (
                <div className="p-3 bg-gradient-to-r from-cyan-950 to-blue-950 border border-cyan-500/40 rounded-2xl space-y-2 animate-pulse">
                  <div className="flex items-center justify-between text-xs text-white">
                    <span className="font-semibold truncate max-w-[160px]">{activeTransfer.fileName}</span>
                    <span className="font-mono text-cyan-400">{activeTransfer.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full"
                      style={{ width: `${activeTransfer.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* List of received files in simulator */}
              {receivedSimFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Downloaded Files
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {receivedSimFiles.map((f, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate max-w-[160px] text-white font-medium">
                            {f.name}
                          </span>
                        </div>
                        <a
                          href={f.downloadUrl}
                          download={f.name}
                          className="text-[10px] text-cyan-400 hover:underline shrink-0"
                        >
                          Save
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* List of received texts */}
              {receivedSimTexts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Received Texts
                  </p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {receivedSimTexts.map((txt, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 select-all"
                      >
                        {txt}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {receivedSimFiles.length === 0 && receivedSimTexts.length === 0 && !activeTransfer && (
                <div className="text-center py-10 space-y-2">
                  <p className="text-xs text-slate-500">
                    {isPaired ? 'Connected! Send a file from the left.' : 'Click "Simulate QR Scan" above'}
                  </p>
                </div>
              )}
            </div>

            {/* Phone Home Bar */}
            <div className="w-24 h-1 bg-slate-700 rounded-full mx-auto mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
};
