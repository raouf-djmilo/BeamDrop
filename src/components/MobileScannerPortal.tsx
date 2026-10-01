import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  Upload,
  Zap,
  CheckCircle2,
  X,
  FileCheck,
  RefreshCw,
  Flashlight,
  SwitchCamera,
  Film,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  Smartphone,
  ChevronRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { P2PTransferManager } from '../utils/p2p';
import { formatBytes, formatSpeed } from '../utils/formatters';
import { playChime } from '../utils/audio';
import { consumeSharedPayload } from '../utils/sharedVault';
import { useAuth } from '../context/AuthContext';

interface MobileScannerPortalProps {
  transferManager: P2PTransferManager;
  initialTargetPeer?: string;
  onClose?: () => void;
}

export const MobileScannerPortal: React.FC<MobileScannerPortalProps> = ({
  transferManager,
  initialTargetPeer,
  onClose
}) => {
  const { trackOp } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetPeerId, setTargetPeerId] = useState<string>(initialTargetPeer || '');
  const [sharedFromAndroid, setSharedFromAndroid] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);

  // Transfer State
  const [transferStatus, setTransferStatus] = useState<'idle' | 'connecting' | 'transferring' | 'completed' | 'error'>('idle');
  const [transferProgress, setTransferProgress] = useState<number>(0);
  const [transferSpeed, setTransferSpeed] = useState<number>(0);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [completedCount, setCompletedCount] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Initialize Camera for live QR scanning
  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    try {
      setCameraError('');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access not supported on this browser. You can enter the QR address code manually below.');
        setCameraActive(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        setIsScanning(true);
        scanFrame();

        // Check torch support
        const track = stream.getVideoTracks()[0];
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.torch) {
          setHasTorch(true);
        }
      }
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setCameraError('Camera permission denied or camera unavailable. You can enter or paste the QR address code below.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      const newTorchState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: newTorchState }]
      });
      setTorchOn(newTorchState);
    } catch (e) {
      console.warn('Torch failed:', e);
    }
  };

  const switchCameraMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // 2. Real-time Video QR Code Frame Scanner via jsQR
  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        handleQrDetected(code.data);
        return;
      }
    }

    if (isScanning) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
    }
  };

  // 3. Handle QR Code Detection
  const handleQrDetected = (qrData: string) => {
    let peer = qrData.trim();
    // Parse if it's a full URL e.g. https://.../?peer=beam-xyz or beam://drop/xyz
    try {
      if (peer.includes('peer=')) {
        const u = new URL(peer);
        peer = u.searchParams.get('peer') || peer;
      } else if (peer.includes('/download/') || peer.includes('/portal/')) {
        const parts = peer.split('/');
        peer = parts[parts.length - 1] || peer;
      } else if (peer.startsWith('beam://receive/') || peer.startsWith('beam:drop:')) {
        peer = peer.replace('beam://receive/', '').replace('beam:drop:', '');
      } else if (peer.startsWith('BD-')) {
        // Resolve crypto address format BD-8F29-4B01 -> beam-8f294b01
        const clean = peer.replace(/^BD-/, '').replace(/-/g, '').toLowerCase();
        peer = 'beam-' + clean;
      }
    } catch (_) {}

    if (peer) {
      setIsScanning(false);
      stopCamera();
      setTargetPeerId(peer);
      playChime('connect');
      trackOp('qr_scan').catch((err) => console.warn('QR scan quota:', err));

      // Vibrate if mobile device
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([80, 50, 80]);
      }

      // If user already staged files, auto-initiate transfer immediately!
      if (selectedFiles.length > 0) {
        initiateTransfer(peer, selectedFiles);
      }
    }
  };

  // 4. File Selection Handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArr = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArr]);

      // If we already scanned a peer, start transfer immediately!
      if (targetPeerId) {
        initiateTransfer(targetPeerId, [...selectedFiles, ...filesArr]);
      }
    }
  };

  const removeFile = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // 5. Transfer Execution to the Scanned PC
  const initiateTransfer = async (peer: string, files: File[]) => {
    if (files.length === 0) {
      setErrorMessage('Please select photos, videos, or files to beam.');
      return;
    }

    try {
      setTransferStatus('connecting');
      setErrorMessage('');

      // Connect if not already connected to this peer
      if (!transferManager.isConnected || transferManager.connectedPeerId !== peer) {
        await transferManager.connect(peer);
      }

      setTransferStatus('transferring');
      setCompletedCount(0);

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setCurrentFileName(f.name);
        setTransferProgress(0);

        await transferManager.sendFile(f, (progress, speed) => {
          setTransferProgress(progress);
          setTransferSpeed(speed);
        });

        setCompletedCount(i + 1);
      }

      setTransferStatus('completed');
      playChime('complete');
    } catch (err: any) {
      console.error('Mobile Beam transfer failed:', err);
      setTransferStatus('error');
      setErrorMessage(err?.message || 'Transfer failed. Please check connection and try again.');
    }
  };

  // Check for shared payload from Android Share Sheet (Web Share Target API)
  useEffect(() => {
    consumeSharedPayload().then((payload) => {
      if (payload && payload.files && payload.files.length > 0) {
        setSelectedFiles(payload.files);
        setSharedFromAndroid(true);
        if (targetPeerId) {
          initiateTransfer(targetPeerId, payload.files);
        }
      }
    });
  }, [targetPeerId]);

  useEffect(() => {
    if (initialTargetPeer) {
      setTargetPeerId(initialTargetPeer);
      setIsScanning(false);
    } else {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [initialTargetPeer]);

  const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xl flex flex-col items-center justify-start p-3 sm:p-6 overflow-y-auto font-sans">
      <div className="w-full max-w-lg bg-white/90 backdrop-blur-3xl border border-white/95 rounded-3xl shadow-[0_25px_60px_rgba(2,132,199,0.18)] p-5 sm:p-6 flex flex-col gap-5 my-auto relative">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-sky-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <span>Mobile Camera Scanner</span>
                <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-mono font-bold border border-sky-300">
                  P2P BEAM
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">Scan PC QR Address to beam photos & media instantly</p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-sky-50 hover:bg-sky-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors border border-sky-200/60 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Android Share Sheet Received Badge */}
        {sharedFromAndroid && selectedFiles.length > 0 && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl p-3.5 flex items-center space-x-3 text-emerald-950 animate-fade-in shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-xs">
              🤖
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold flex items-center gap-1.5">
                <span>Android Share Sheet Ready</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                  {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} staged
                </span>
              </p>
              <p className="text-[11px] text-emerald-700">Point your camera at the PC screen QR code to beam them now!</p>
            </div>
          </div>
        )}

        {/* Transferring Live State Card */}
        {transferStatus === 'transferring' && (
          <div className="bg-sky-50 border border-sky-300 rounded-2xl p-4 space-y-3 animate-fade-in shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-xs">
                  <Zap className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-mono font-bold text-sky-700">Streaming Live to PC</p>
                  <p className="text-xs font-bold text-slate-900 truncate max-w-[220px]">{currentFileName}</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-sky-700">{transferProgress}%</span>
            </div>

            <div className="w-full h-2.5 bg-sky-200/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all duration-150 rounded-full"
                style={{ width: `${transferProgress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 font-semibold">
              <span>File {completedCount + 1} of {selectedFiles.length}</span>
              <span>{formatSpeed(transferSpeed)}</span>
            </div>
          </div>
        )}

        {/* Transfer Complete Card */}
        {transferStatus === 'completed' && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-5 text-center space-y-3 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md shadow-emerald-500/25">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-emerald-950">Transferred Successfully!</h3>
              <p className="text-xs text-emerald-700 mt-0.5">
                All {selectedFiles.length} file(s) ({formatBytes(totalBytes)}) received directly on PC.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedFiles([]);
                setTransferStatus('idle');
                startCamera();
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              Beam More Photos & Files
            </button>
          </div>
        )}

        {/* Stage 1: When PC is Connected */}
        {targetPeerId && transferStatus !== 'completed' && transferStatus !== 'transferring' && (
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-50 border-2 border-emerald-300 rounded-3xl p-5 space-y-4 shadow-sm animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                    Receiver Address Locked
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900 mt-0.5">Target PC: {targetPeerId}</h3>
                </div>
              </div>
              <button
                onClick={() => {
                  setTargetPeerId('');
                  startCamera();
                }}
                className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-semibold cursor-pointer"
              >
                Rescan QR
              </button>
            </div>

            {/* Quick Action Buttons to Pick Photos / Files */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-4 px-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 text-white font-bold text-xs shadow-md shadow-sky-500/25 flex flex-col items-center justify-center gap-1.5 cursor-pointer active:scale-98 transition-all"
              >
                <ImageIcon className="w-5 h-5" />
                <span>Choose Photos / Media</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-4 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md shadow-slate-900/25 flex flex-col items-center justify-center gap-1.5 cursor-pointer active:scale-98 transition-all"
              >
                <FileText className="w-5 h-5" />
                <span>Select Files / Zip</span>
              </button>
            </div>
          </div>
        )}

        {/* Stage 2: Camera Viewfinder (Only when peer is NOT known yet) */}
        {!targetPeerId && transferStatus !== 'completed' && transferStatus !== 'transferring' && (
          <div className="space-y-4">
            {cameraActive ? (
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900 border-2 border-sky-400 shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Laser Scanning Overlay Animation */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  {/* Cyber Scanner Reticle Box */}
                  <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-dashed border-sky-300/90 rounded-2xl relative shadow-[0_0_25px_rgba(56,189,248,0.4)]">
                    <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-sky-400 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-sky-400 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-sky-400 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-sky-400 rounded-br-lg" />

                    {/* Animated Scanning Beam Bar */}
                    <div className="w-full h-1 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_15px_#38bdf8] animate-bounce-slow" />
                  </div>
                  <span className="mt-3 px-3 py-1 rounded-full bg-slate-900/80 text-white text-[11px] font-semibold backdrop-blur-md border border-white/20">
                    Align PC QR Code inside frame
                  </span>
                </div>

                {/* Camera Utilities (Torch & Switch) */}
                <div className="absolute top-3 right-3 flex items-center space-x-2">
                  {hasTorch && (
                    <button
                      onClick={toggleTorch}
                      className={`p-2 rounded-xl backdrop-blur-md transition-colors cursor-pointer ${
                        torchOn ? 'bg-amber-400 text-slate-900' : 'bg-black/50 text-white'
                      }`}
                      title="Toggle Flashlight"
                    >
                      <Flashlight className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={switchCameraMode}
                    className="p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white backdrop-blur-md transition-colors cursor-pointer"
                    title="Switch Camera"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-2">
                <div className="flex items-center space-x-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Manual Address Input</span>
                </div>
                <p className="text-amber-800 text-[11px] leading-relaxed">
                  {cameraError || 'Camera inactive.'} Paste the PC QR Address code below to establish connection:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={targetPeerId}
                    onChange={(e) => setTargetPeerId(e.target.value)}
                    placeholder="e.g. BD-8F29-4B01 or peer ID"
                    className="flex-1 px-3 py-2 rounded-xl bg-white border border-sky-300 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <button
                    onClick={() => {
                      if (targetPeerId && selectedFiles.length > 0) {
                        initiateTransfer(targetPeerId, selectedFiles);
                      }
                    }}
                    className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-500 cursor-pointer"
                  >
                    Set
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

            {/* Media & Files Drawer */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>Selected Files to Beam ({selectedFiles.length})</span>
                  {selectedFiles.length > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-bold">
                      {formatBytes(totalBytes)}
                    </span>
                  )}
                </span>

                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer border border-sky-300"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>+ Pick Media / Files</span>
                </button>
              </div>

              {selectedFiles.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 rounded-2xl border-2 border-dashed border-sky-200 hover:border-sky-400 bg-sky-50/60 hover:bg-sky-50 transition-all text-center cursor-pointer space-y-1.5"
                >
                  <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mx-auto">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">Tap to select Photos, Videos, or Files</p>
                  <p className="text-[11px] text-slate-500">Pick any media from your iPhone or Android gallery</p>
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {selectedFiles.map((f, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white/80 border border-sky-200/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <FileCheck className="w-4 h-4 text-sky-600 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate max-w-[200px]">{f.name}</span>
                        <span className="text-[10px] font-mono text-slate-500">({formatBytes(f.size)})</span>
                      </div>
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Primary Action Button */}
            {selectedFiles.length > 0 && targetPeerId && (
              <button
                onClick={() => initiateTransfer(targetPeerId, selectedFiles)}
                disabled={transferStatus === 'connecting'}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-blue-500 text-white font-extrabold text-sm shadow-xl shadow-sky-500/25 transition-all flex items-center justify-center space-x-2 active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                <span>
                  {transferStatus === 'connecting'
                    ? 'Connecting to PC...'
                    : `🚀 Beam ${selectedFiles.length} File(s) to PC Now`}
                </span>
              </button>
            )}
      </div>
    </div>
  );
};
