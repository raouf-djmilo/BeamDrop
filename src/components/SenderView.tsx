import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileArchive,
  FileText,
  Image,
  Film,
  Music,
  Code,
  X,
  Send,
  Zap,
  CheckCircle2,
  Copy,
  Smartphone,
  ShieldCheck,
  Radio,
  FileCheck,
  ArrowRight,
  RotateCcw,
  FileSpreadsheet,
  Presentation,
  Sparkles,
  Layers,
  RefreshCw
} from 'lucide-react';
import { P2PTransferManager, PhoneStatusPayload } from '../utils/p2p';
import { QrDisplay } from './QrDisplay';
import { ephemeralPortalEngine, EphemeralPortalSession } from '../utils/engine/portal';
import { Clock, Globe, Shield } from 'lucide-react';
import { formatBytes, formatSpeed, getFileCategory, getFileTypeMeta } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { playChime } from '../utils/audio';

interface SenderViewProps {
  transferManager: P2PTransferManager;
  receiverBaseUrl: string;
  targetedPeer?: any;
  initialTextPayload?: string;
}

export const SenderView: React.FC<SenderViewProps> = ({
  transferManager,
  receiverBaseUrl,
  targetedPeer,
  initialTextPayload
}) => {
  const { recordTransfer } = useAuth();
  const { notifyPending, notifySuccess, notifyError, notifyInfo, updateNotification } = useNotification();
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isQrGenerated, setIsQrGenerated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'files' | 'text'>(initialTextPayload ? 'text' : 'files');
  const [textPayload, setTextPayload] = useState<string>(initialTextPayload || '');
  const [directQrMode, setDirectQrMode] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [e2eeKeyHex, setE2eeKeyHex] = useState<string>('');
  const [currentTransfer, setCurrentTransfer] = useState<{
    fileName: string;
    progress: number;
    speed: number;
    fileSize: number;
  } | null>(null);
  const [transferCompleted, setTransferCompleted] = useState<boolean>(false);
  const [sentHistory, setSentHistory] = useState<{ name: string; size: number; time: string; type: string }[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [remotePhoneStatus, setRemotePhoneStatus] = useState<PhoneStatusPayload | null>(null);
  const [active10MinPortal, setActive10MinPortal] = useState<EphemeralPortalSession | null>(null);
  const [copiedPortalLink, setCopiedPortalLink] = useState(false);

  // Guards against re-entrant loops
  const lastRebuildTimeRef = useRef<number>(0);
  const isRebuildingRef = useRef<boolean>(false);
  const hasSentCurrentBatchRef = useRef<boolean>(false);
  const isSendingRef = useRef<boolean>(false);

  // Rolling Ephemeral One-Time QR Protocol Engine
  const generateSessionNonce = () => {
    return Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 6);
  };

  const [qrSessionNonce, setQrSessionNonce] = useState<string>(() => generateSessionNonce());
  const [rebuiltNotice, setRebuiltNotice] = useState<string | null>(null);
  const [isRebuilding, setIsRebuilding] = useState<boolean>(false);

  const rebuildQrSession = (reason: 'scan' | 'complete' | 'error' | 'manual' = 'manual') => {
    const now = Date.now();
    // Guard against infinite loops: strict cooldown debounce (at least 2.5s between rebuilds)
    if (now - lastRebuildTimeRef.current < 2500 || isRebuildingRef.current) {
      return;
    }
    lastRebuildTimeRef.current = now;
    isRebuildingRef.current = true;

    setIsRebuilding(true);
    setRemotePhoneStatus(null);
    const nextNonce = generateSessionNonce();
    setQrSessionNonce(nextNonce);

    let message = 'Fresh random QR Code rebuilt';
    if (reason === 'complete') {
      message = 'Beam complete • QR rotated to new random session';
    } else if (reason === 'error') {
      message = 'Session reset • Fresh QR generated';
    } else if (reason === 'scan') {
      message = 'Scan processed • QR rotated for next session';
    } else if (reason === 'manual') {
      message = 'QR rebuilt with new random token';
    }

    setRebuiltNotice(message);
    notifyInfo(message, 'Single-use rolling security session refreshed');
    setTimeout(() => {
      setIsRebuilding(false);
      isRebuildingRef.current = false;
    }, 600);
    setTimeout(() => setRebuiltNotice(null), 3500);

    // Re-stage file in transit cache with new token safely (only for lightweight files <= 25MB)
    if (stagedFiles.length > 0 && transferManager.myPeerId) {
      const file = stagedFiles[0];
      if (file.size <= 25 * 1024 * 1024) {
        const fileNameEnc = encodeURIComponent(file.name);
        const mimeEnc = encodeURIComponent(file.type || 'application/octet-stream');
        fetch(`${targetBaseUrl}/api/transit?peer=${encodeURIComponent(transferManager.myPeerId)}&token=${nextNonce}&name=${fileNameEnc}&mime=${mimeEnc}`, {
          method: 'POST',
          body: file
        }).catch((e) => console.debug('Transit fallback stage notice:', e));
      } else {
        console.log(`[BeamDrop] Large file (${file.name}, ${(file.size / (1024 * 1024)).toFixed(1)} MB) optimized for direct high-speed P2P DataChannel transmission.`);
      }
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Default to provided receiver base URL or current origin
  const targetBaseUrl = receiverBaseUrl || (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : 'https://beam-drop-mu.vercel.app');

  const firstFile = stagedFiles[0];
  const fileParams = firstFile
    ? `&name=${encodeURIComponent(firstFile.name)}&size=${firstFile.size}&mime=${encodeURIComponent(firstFile.type || '')}`
    : '';

  const receiverUrl = activeTab === 'files'
    ? `${targetBaseUrl}/download?peer=${transferManager.myPeerId}&token=${qrSessionNonce}&nonce=${qrSessionNonce}${fileParams}`
    : `${targetBaseUrl}/notebook.html?peer=${transferManager.myPeerId}&token=${qrSessionNonce}&type=text`;

  const qrValue = directQrMode && textPayload.trim() && textPayload.length < 500
    ? textPayload.trim()
    : receiverUrl;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    setStagedFiles((prev) => [...prev, ...newFiles]);
    setTransferCompleted(false);
    hasSentCurrentBatchRef.current = false;
    notifyInfo('Files Staged', `${newFiles.length} item${newFiles.length > 1 ? 's' : ''} ready to beam`);
  };

  const removeFile = (index: number) => {
    setStagedFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length === 0) {
        setIsQrGenerated(false);
      }
      return updated;
    });
  };

  const clearStaging = () => {
    setStagedFiles([]);
    setIsQrGenerated(false);
    setCurrentTransfer(null);
    setTransferCompleted(false);
    hasSentCurrentBatchRef.current = false;
    rebuildQrSession('manual');
  };

  const handleGenerateQr = () => {
    if (stagedFiles.length === 0 && !textPayload.trim()) return;
    setIsQrGenerated(true);
    setTransferCompleted(false);
    playChime('connect');

    // Pre-stage in Ephemeral RAM Transit for instant 4G/5G mobile cellular phone fallback (only files <= 25MB)
    if (stagedFiles.length > 0 && transferManager.myPeerId) {
      const file = stagedFiles[0];
      if (file.size <= 25 * 1024 * 1024) {
        const fileNameEnc = encodeURIComponent(file.name);
        const mimeEnc = encodeURIComponent(file.type || 'application/octet-stream');
        fetch(`${targetBaseUrl}/api/transit?peer=${encodeURIComponent(transferManager.myPeerId)}&name=${fileNameEnc}&mime=${mimeEnc}`, {
          method: 'POST',
          body: file
        }).then(res => res.json()).then(data => {
          console.log('[BeamDrop] Pre-staged file in RAM transit for mobile fallback:', data);
        }).catch((e) => console.debug('Transit fallback stage notice:', e));
      } else {
        console.log(`[BeamDrop] Staged large payload (${file.name}, ${(file.size / (1024 * 1024)).toFixed(1)} MB) configured for ultra-fast direct P2P streaming.`);
      }
    }
  };

  // Automatic Hands-Free Stream Initiation when Phone Receiver Connects & Two-Way Verification
  useEffect(() => {
    transferManager.onConnected = () => {
      if (
        stagedFiles.length > 0 &&
        isQrGenerated &&
        !isSendingRef.current &&
        !hasSentCurrentBatchRef.current
      ) {
        startSendFiles();
      }
    };

    transferManager.onPhoneStatus = (status) => {
      setRemotePhoneStatus(status);
      if (status.stage === 'scanned') {
        notifySuccess(
          'Phone Scanned & Paired!',
          `${status.device || 'Remote device'} verified via camera scan.`
        );
      } else if (status.stage === 'delivered') {
        notifySuccess(
          'Remote Storage Confirmed!',
          `${status.fileName || 'Data'} verified received & saved on phone.`
        );
      } else if (status.stage === 'failed') {
        notifyError(
          'Remote Storage Failed',
          status.error || 'Phone could not write file to device storage.'
        );
      }
    };

    transferManager.onDisconnected = () => {
      setRemotePhoneStatus((prev) =>
        prev && prev.stage !== 'delivered'
          ? { stage: 'failed', error: 'Remote phone closed connection', timestamp: Date.now() }
          : prev
      );
    };

    return () => {
      transferManager.onConnected = undefined;
      transferManager.onPhoneStatus = undefined;
    };
  }, [transferManager, stagedFiles, isQrGenerated, notifySuccess, notifyError]);

  // Start sending files over WebRTC
  const startSendFiles = async () => {
    if (!transferManager.isConnected) {
      notifyError(
        'Remote Device Not Connected',
        'Please scan the QR code with your phone or remote browser to pair first.'
      );
      return;
    }

    if (stagedFiles.length === 0 || isSendingRef.current || hasSentCurrentBatchRef.current) {
      return;
    }

    isSendingRef.current = true;
    setIsSending(true);

    let allSucceeded = true;

    for (const file of stagedFiles) {
      let notifId = '';
      try {
        setCurrentTransfer({
          fileName: file.name,
          progress: 0,
          speed: 0,
          fileSize: file.size
        });

        // Trigger real-time streaming notification in liquid glass bar
        notifId = notifyPending(
          `Streaming ${file.name}`,
          'Direct P2P transmission over encrypted WebRTC DataChannel',
          { name: file.name, size: file.size, mime: file.type },
          0,
          0
        );

        await transferManager.sendFile(file, (progress, speed) => {
          setCurrentTransfer((prev) =>
            prev ? { ...prev, progress, speed } : null
          );
          if (notifId) {
            updateNotification(notifId, { progress, speed });
          }
        });

        setSentHistory((prev) => [
          {
            name: file.name,
            size: file.size,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: file.type || 'file'
          },
          ...prev
        ]);
        recordTransfer(file.name, file.size, file.type, 'sent');

        if (notifId) {
          updateNotification(notifId, {
            type: 'success',
            title: 'File Delivered Successfully!',
            message: `${file.name} (${formatBytes(file.size)}) transferred cleanly with zero cloud latency.`,
            progress: 100,
            duration: 4500
          });
        }
      } catch (err: any) {
        console.warn('File transfer notice:', err);
        allSucceeded = false;
        if (notifId) {
          updateNotification(notifId, {
            type: 'error',
            title: 'Transfer Interrupted',
            message: `Could not finish streaming ${file.name}: ${err?.message || 'Remote socket connection closed.'}`,
            duration: 6000
          });
        } else {
          notifyError('Transfer Interrupted', `Could not finish streaming ${file.name}. Remote device may have closed.`);
        }
        break;
      }
    }

    isSendingRef.current = false;
    setIsSending(false);
    setCurrentTransfer(null);

    if (allSucceeded) {
      hasSentCurrentBatchRef.current = true;
      playChime('complete');
      setTransferCompleted(true);
      if (stagedFiles.length > 1) {
        notifySuccess('All Transfers Complete', `${stagedFiles.length} files successfully beamed.`);
      }
      // Safely regenerate QR session once after successful beam
      rebuildQrSession('complete');
    }
  };

  const sendTextPayload = () => {
    if (!textPayload.trim()) {
      notifyError('Empty Text Beam', 'Please type or paste some text before beaming.');
      return;
    }

    if (!transferManager.isConnected) {
      notifyError('Device Not Connected', 'Please scan the QR code with your phone first!');
      return;
    }

    const success = transferManager.sendText(textPayload.trim());
    if (success) {
      playChime('message');
      setSentHistory((prev) => [
        {
          name: textPayload.trim().slice(0, 32) + (textPayload.length > 32 ? '...' : ''),
          size: new Blob([textPayload]).size,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'text'
        },
        ...prev
      ]);
      recordTransfer('Text Beam', new Blob([textPayload]).size, 'text/plain', 'sent');
      notifySuccess(
        'Text Beam Delivered',
        textPayload.trim().slice(0, 45) + (textPayload.length > 45 ? '...' : '')
      );
      setTextPayload('');
      setTransferCompleted(true);
      rebuildQrSession('complete');
    } else {
      notifyError('Text Beam Failed', 'Could not transmit snippet over active data channel.');
    }
  };

  const handleCreate10MinPortal = async () => {
    if (stagedFiles.length === 0) return;
    let hex = e2eeKeyHex;
    if (!hex) {
      hex = await transferManager.setupE2EE();
      setE2eeKeyHex(hex);
    }
    const session = ephemeralPortalEngine.createPortal(
      transferManager.myPeerId,
      { name: firstFile.name, size: firstFile.size, type: firstFile.type || 'application/octet-stream' },
      hex,
      targetBaseUrl
    );
    setActive10MinPortal(session);
    playChime('connect');
    notifySuccess('10-Min Portal Active', 'Single-use expiring link generated with client-side encryption key.');
  };

  const copyPortalLink = () => {
    if (active10MinPortal) {
      navigator.clipboard.writeText(active10MinPortal.shareUrl);
      setCopiedPortalLink(true);
      notifyInfo('Link Copied', 'Portal link copied to clipboard.');
      setTimeout(() => setCopiedPortalLink(false), 2000);
    }
  };

  const copyPairLink = () => {
    navigator.clipboard.writeText(receiverUrl);
    setCopiedLink(true);
    notifyInfo('Link Copied', 'Pairing link copied to clipboard.');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getFileIcon = (mime: string, name: string) => {
    const cat = getFileCategory(mime, name);
    switch (cat) {
      case 'excel':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
      case 'powerpoint':
        return <Presentation className="w-5 h-5 text-amber-400" />;
      case 'word':
        return <FileText className="w-5 h-5 text-blue-400" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-rose-400" />;
      case 'archive':
        return <FileArchive className="w-5 h-5 text-yellow-400" />;
      case 'image':
        return <Image className="w-5 h-5 text-teal-400" />;
      case 'video':
        return <Film className="w-5 h-5 text-purple-400" />;
      case 'audio':
        return <Music className="w-5 h-5 text-pink-400" />;
      case 'code':
        return <Code className="w-5 h-5 text-cyan-400" />;
      default:
        return <FileText className="w-5 h-5 text-slate-300" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: File Staging & Transfer Controls */}
      <div className="lg:col-span-7 space-y-5">
        {/* Targeted Peer Banner from Spider Radar */}
        {targetedPeer && (
          <div className="bg-sky-50/90 backdrop-blur-xl rounded-2xl p-3 border border-sky-300 flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 border border-sky-300 flex items-center justify-center text-sm font-bold shadow-xs">
                <span>{targetedPeer.icon || '🎯'}</span>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Targeting {targetedPeer.name}</span>
                  <span className="text-[10px] font-mono text-sky-700 font-semibold">({targetedPeer.ip})</span>
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Radar Ping: <span className="text-emerald-700 font-bold">{targetedPeer.latency || 4}ms</span> • RAM-to-RAM Bridge Ready
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold bg-sky-100 text-sky-800 border border-sky-300 px-2 py-0.5 rounded-full">
              Spider Link
            </span>
          </div>
        )}

        {/* Mode Selector */}
        <div className="bg-white/90 backdrop-blur-xl border border-sky-200/90 p-1.5 rounded-2xl flex items-center shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('files')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
              activeTab === 'files'
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-sky-50'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Send Files</span>
            {stagedFiles.length > 0 && (
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                activeTab === 'files' ? 'bg-white/25 text-white' : 'bg-sky-100 text-sky-800'
              }`}>
                {stagedFiles.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
              activeTab === 'text'
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-sky-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Text &amp; Links</span>
            {textPayload.trim() && (
              <span className={`w-2 h-2 rounded-full ${activeTab === 'text' ? 'bg-emerald-300' : 'bg-emerald-500'}`} />
            )}
          </button>
        </div>

        {/* Tab 1: File Staging & Upload */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            {/* Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className="relative border-2 border-dashed border-sky-300 hover:border-sky-500 bg-white/75 hover:bg-sky-50/80 backdrop-blur-2xl rounded-3xl p-8 text-center cursor-pointer transition-all duration-200 group shadow-[0_12px_36px_rgba(2,132,199,0.06)]"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="*/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="w-16 h-16 mx-auto mb-3.5 rounded-3xl bg-gradient-to-tr from-sky-100 via-sky-50 to-blue-100 border border-sky-200 flex items-center justify-center text-sky-600 group-hover:scale-110 group-hover:border-sky-400 transition-all shadow-sm">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Drop files here to beam
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Photos, videos, documents, or archives • Fast &amp; Direct
              </p>
            </div>

            {/* Staged Files Preview */}
            {stagedFiles.length > 0 && (
              <div className="bg-white/85 backdrop-blur-2xl border border-white/95 rounded-3xl p-5 space-y-4 shadow-[0_16px_40px_rgba(2,132,199,0.08)]">
                <div className="flex items-center justify-between text-xs pb-3 border-b border-sky-100">
                  <span className="font-semibold text-slate-800 flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse"></span>
                    <span>Staged Files ({stagedFiles.length})</span>
                  </span>
                  <div className="flex items-center space-x-3">
                    <span className="text-sky-700 font-mono font-bold">
                      {formatBytes(stagedFiles.reduce((acc, f) => acc + f.size, 0))} total
                    </span>
                    <button
                      onClick={clearStaging}
                      className="text-slate-400 hover:text-rose-500 text-[11px] transition-colors cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {stagedFiles.map((file, idx) => {
                    const meta = getFileTypeMeta(file.type, file.name);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-2xl bg-sky-50/60 border border-sky-200/70 hover:border-sky-300 transition-colors text-xs"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 border border-sky-200 shadow-xs">
                            {getFileIcon(file.type, file.name)}
                          </div>
                          <div className="truncate">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-slate-900 truncate">{file.name}</span>
                              <span
                                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${meta.bgColor} ${meta.textColor} ${meta.borderColor}`}
                              >
                                {meta.badgeLabel}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">{formatBytes(file.size)}</p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(idx);
                          }}
                          className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-white/80 transition-colors cursor-pointer"
                          title="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Primary CTA: Generate QR Code Portal */}
                {!isQrGenerated ? (
                  <button
                    onClick={handleGenerateQr}
                    className="w-full py-3.5 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs rounded-2xl shadow-xl shadow-sky-500/25 transition-all flex items-center justify-center space-x-2 active:scale-95 cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-current" />
                    <span>⚡ Generate QR Code for this Upload</span>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={startSendFiles}
                      disabled={isSending}
                      className={`w-full py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-xl cursor-pointer ${
                        transferManager.isConnected
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-white shadow-emerald-500/25 active:scale-95'
                          : 'bg-sky-100 text-slate-400 border border-sky-200 cursor-not-allowed'
                      }`}
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {isSending
                          ? 'Streaming to Phone...'
                          : transferManager.isConnected
                          ? 'Beam Staged Files to Phone'
                          : 'Scan QR with Phone to Start Stream'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Text / Links */}
        {activeTab === 'text' && (
          <div className="space-y-4">
            <div className="bg-white/85 backdrop-blur-2xl border border-white/95 rounded-3xl p-5 space-y-3 shadow-[0_16px_40px_rgba(2,132,199,0.08)]">
              <label className="text-xs font-semibold text-slate-800">
                Paste link, note, Wi-Fi password, or token:
              </label>
              <textarea
                value={textPayload}
                onChange={(e) => {
                  setTextPayload(e.target.value);
                  setTransferCompleted(false);
                }}
                placeholder="Paste links, long messages, notes, credentials..."
                rows={5}
                className="w-full bg-sky-50/70 border border-sky-200/80 rounded-2xl p-3.5 text-xs text-slate-800 placeholder-slate-400 font-mono focus:outline-none focus:border-sky-500 transition-colors resize-none shadow-xs"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={directQrMode}
                    onChange={(e) => setDirectQrMode(e.target.checked)}
                    className="rounded bg-white border-sky-300 text-sky-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Encode raw text in QR (Offline camera read)</span>
                </label>
                <button
                  onClick={handleGenerateQr}
                  disabled={!textPayload.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-500/20 cursor-pointer"
                >
                  ⚡ Generate QR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live Streaming Transfer Progress Card */}
        {currentTransfer && (
          <div className="p-5 bg-white/90 backdrop-blur-2xl border-2 border-sky-400 rounded-3xl shadow-[0_16px_45px_rgba(2,132,199,0.15)] space-y-3.5 animate-pulse-slow">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center text-sky-600 shrink-0 border border-sky-200 shadow-xs">
                  <Radio className="w-4 h-4 animate-pulse" />
                </div>
                <div className="truncate">
                  <p className="text-[10px] text-sky-700 font-mono uppercase tracking-wider font-semibold">Streaming DataChannel</p>
                  <p className="font-bold text-slate-900 truncate max-w-[260px] text-xs">
                    {currentTransfer.fileName}
                  </p>
                </div>
              </div>
              <span className="font-mono text-sky-700 font-bold text-sm bg-sky-100 px-2.5 py-1 rounded-lg border border-sky-300">
                {formatSpeed(currentTransfer.speed)}
              </span>
            </div>

            <div className="w-full bg-sky-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-sky-300">
              <div
                className="h-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 rounded-full transition-all duration-150 shadow-sm"
                style={{ width: `${currentTransfer.progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping"></span>
                <span>Active Stream ({currentTransfer.progress}%)</span>
              </span>
              <span>
                {formatBytes((currentTransfer.fileSize * currentTransfer.progress) / 100)} / {formatBytes(currentTransfer.fileSize)}
              </span>
            </div>
          </div>
        )}

        {/* Transfer Complete Card */}
        {transferCompleted && (
          <div className="bg-emerald-50/90 border border-emerald-300 rounded-3xl p-5 flex items-center justify-between text-xs shadow-md">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-300 shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Transfer Complete!</p>
                <p className="text-[11px] text-slate-600">File streamed directly into phone memory with zero cloud storage.</p>
              </div>
            </div>
            <button
              onClick={clearStaging}
              className="px-4 py-2 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Send Another</span>
            </button>
          </div>
        )}
      </div>

      {/* Right Column: Dynamic QR Portal & Watermarked Card Generator */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-white/85 backdrop-blur-2xl border border-white/95 rounded-3xl p-6 text-center shadow-[0_20px_50px_rgba(2,132,199,0.12)] space-y-4">
          <div className="flex items-center justify-between pb-3.5 border-b border-sky-100">
            <div className="flex items-center space-x-2.5 text-left">
              <div className="w-8 h-8 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-600">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Scan to Connect</p>
                <p className="text-[10px] text-slate-500 font-mono">Mobile / Tablet Pairing</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => rebuildQrSession('manual')}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-slate-700 hover:text-sky-800 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs active:scale-95"
                title="Regenerate fresh random QR Code & session token"
              >
                <RefreshCw className={`w-3 h-3 text-sky-600 ${isRebuilding ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Rebuild QR</span>
              </button>

              <div
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  transferManager.isConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-sky-50 text-slate-600 border-sky-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    transferManager.isConnected ? 'bg-emerald-500' : 'bg-sky-400'
                  }`}
                />
                <span>{transferManager.isConnected ? 'Connected' : 'Ready'}</span>
              </div>
            </div>
          </div>

          {/* Rolling Ephemeral Security Protocol Bar */}
          <div className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px]">
            <div className="flex items-center space-x-1.5 text-slate-600">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="font-semibold text-slate-700">Rolling One-Time QR</span>
            </div>
            <span className="font-mono text-[10px] text-sky-700 bg-sky-100 px-2 py-0.5 rounded-md border border-sky-200 font-bold">
              #{qrSessionNonce.slice(0, 6)}
            </span>
          </div>

          {/* Real-Time Remote Phone Detection & Verification Status */}
          {remotePhoneStatus ? (
            <div
              className={`w-full px-3 py-2 rounded-2xl border text-xs font-medium flex items-center justify-between transition-all ${
                remotePhoneStatus.stage === 'scanned'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs'
                  : remotePhoneStatus.stage === 'downloading'
                  ? 'bg-sky-50 border-sky-300 text-sky-900 shadow-xs'
                  : remotePhoneStatus.stage === 'delivered'
                  ? 'bg-emerald-100/90 border-emerald-400 text-emerald-950 shadow-sm'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <span className="shrink-0 text-base">
                  {remotePhoneStatus.stage === 'delivered'
                    ? '✓'
                    : remotePhoneStatus.stage === 'failed'
                    ? '⚠️'
                    : '📱'}
                </span>
                <div className="text-left truncate">
                  <p className="font-bold text-[11px] truncate">
                    {remotePhoneStatus.stage === 'scanned' && `Phone Scanned: ${remotePhoneStatus.device || 'Mobile'}`}
                    {remotePhoneStatus.stage === 'downloading' && `Phone Downloading (${remotePhoneStatus.progress || 0}%)`}
                    {remotePhoneStatus.stage === 'delivered' && 'Verified: Delivered to Phone Storage!'}
                    {remotePhoneStatus.stage === 'failed' && 'Phone Storage Delivery Failed'}
                  </p>
                  <p className="text-[10px] opacity-80 truncate">
                    {remotePhoneStatus.stage === 'scanned' && 'Camera scan detected • P2P socket open'}
                    {remotePhoneStatus.stage === 'downloading' && `${remotePhoneStatus.speed ? formatSpeed(remotePhoneStatus.speed) : 'Streaming'} • Writing chunks`}
                    {remotePhoneStatus.stage === 'delivered' && `${remotePhoneStatus.fileName || 'Files'} confirmed saved`}
                    {remotePhoneStatus.stage === 'failed' && (remotePhoneStatus.error || 'Connection closed by phone')}
                  </p>
                </div>
              </div>
              <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/80 border border-current">
                {remotePhoneStatus.stage}
              </span>
            </div>
          ) : (
            <div className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[11px] flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                <span>Waiting for phone camera scan...</span>
              </span>
              <span className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" />
            </div>
          )}

          {/* Rebuilt Notice feedback */}
          {rebuiltNotice && (
            <div className="w-full px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center space-x-2 animate-fade-in">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{rebuiltNotice}</span>
            </div>
          )}

          {/* QR Display with Scanner Framing */}
          <div className="py-1 flex flex-col items-center">
            <QrDisplay
              value={qrValue}
              size={220}
              fileName={firstFile ? (stagedFiles.length > 1 ? `${firstFile.name} (+${stagedFiles.length - 1} more)` : firstFile.name) : undefined}
              fileSize={stagedFiles.length > 0 ? stagedFiles.reduce((acc, f) => acc + f.size, 0) : undefined}
              fileCategory={firstFile ? getFileCategory(firstFile.type, firstFile.name) : undefined}
              sessionToken={qrSessionNonce}
              showControls={true}
            />
          </div>

          {/* 10-Minute Ephemeral Drop Portal Generator */}
          {firstFile && (
            <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-left space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">10-Min Ephemeral Portal</p>
                    <p className="text-[10px] text-slate-500">Single-use expiring link for clients</p>
                  </div>
                </div>
                {!active10MinPortal ? (
                  <button
                    onClick={handleCreate10MinPortal}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs transition-all cursor-pointer shadow-xs"
                  >
                    Generate Portal
                  </button>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-mono text-[10px] font-bold">
                    ACTIVE (10:00)
                  </span>
                )}
              </div>

              {active10MinPortal && (
                <div className="space-y-2 pt-1 border-t border-amber-200">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={active10MinPortal.shareUrl}
                      className="bg-white border border-amber-300 text-[11px] text-amber-900 font-mono rounded-lg px-2.5 py-1.5 flex-1 select-all focus:outline-none shadow-xs"
                    />
                    <button
                      onClick={copyPortalLink}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shrink-0 transition-colors cursor-pointer shadow-xs"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedPortalLink ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                    <span>🔒 Client can download anywhere with zero app install</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Direct Session Link Card */}
          <div className="bg-sky-50/80 rounded-2xl p-3.5 border border-sky-200/80 text-left space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <span className="font-semibold">Target Portal Route:</span>
              <span className="font-mono text-sky-700 font-bold truncate max-w-[200px]">
                {targetBaseUrl}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={receiverUrl}
                className="bg-white border border-sky-200 text-[11px] text-slate-800 font-mono rounded-lg px-2.5 py-1.5 flex-1 select-all focus:outline-none shadow-xs"
              />
              <button
                onClick={copyPairLink}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shrink-0 transition-colors cursor-pointer shadow-xs"
              >
                {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
