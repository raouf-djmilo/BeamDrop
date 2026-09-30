import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Copy,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  Laptop,
  Image as ImageIcon,
  FileArchive,
  FileText,
  Film,
  Music,
  Send,
  Zap,
  Radio,
  Share2,
  Shield,
  Eye,
  Check,
  FileSpreadsheet,
  Presentation
} from 'lucide-react';
import { P2PTransferManager, TransferFile, TextPayload } from '../utils/p2p';
import { formatBytes, formatSpeed, getFileCategory, getFileTypeMeta } from '../utils/formatters';
import { playChime } from '../utils/audio';

interface ReceiverViewProps {
  transferManager: P2PTransferManager;
  initialTargetPeerId?: string;
}

export const ReceiverView: React.FC<ReceiverViewProps> = ({
  transferManager,
  initialTargetPeerId
}) => {
  const [targetId, setTargetId] = useState<string>(initialTargetPeerId || '');
  const [receivedFiles, setReceivedFiles] = useState<TransferFile[]>([]);
  const [receivedTexts, setReceivedTexts] = useState<TextPayload[]>([]);
  const [currentIncomingFile, setCurrentIncomingFile] = useState<TransferFile | null>(null);
  const [autoDownload, setAutoDownload] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewModalFile, setPreviewModalFile] = useState<TransferFile | null>(null);
  const [incomingOrderModal, setIncomingOrderModal] = useState<any>(null);

  // Screen Wake Lock to prevent phone sleep during file transfer
  const wakeLockRef = useRef<any>(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      }
    } catch (e) {}
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (e) {}
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && currentIncomingFile) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      releaseWakeLock();
    };
  }, [currentIncomingFile]);

  // Return beam message from phone to PC
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const replyFileInputRef = useRef<HTMLInputElement | null>(null);

  // Local Mesh Gateway auto-announce & order listener
  useEffect(() => {
    const myReceiverMeshId = 'receiver-' + (transferManager.myPeerId || Math.random().toString(36).slice(2, 8));
    const isMobileDevice = typeof navigator !== 'undefined' && /Android|iPhone|iPad/i.test(navigator.userAgent);
    const myReceiverName = isMobileDevice
      ? (navigator.userAgent.includes('iPhone') ? 'Apple iPhone (Web)' : 'Android Smartphone (Web)')
      : 'Web Receiver Workstation';

    const announce = () => {
      fetch('/api/mesh/announce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: myReceiverMeshId,
          name: myReceiverName,
          deviceType: isMobileDevice ? 'phone' : 'laptop',
          icon: isMobileDevice ? '📱' : '💻',
          protocol: 'wifi'
        })
      }).catch(() => {});
    };

    announce();
    const announceTimer = setInterval(announce, 10000);

    const pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/mesh/order/poll?peerId=${myReceiverMeshId}`).then(r => r.json());
        if (res && res.hasOrder && res.order && !incomingOrderModal) {
          setIncomingOrderModal(res.order);
          playChime('connect');
        }
      } catch (e) {}
    }, 1000);

    return () => {
      clearInterval(announceTimer);
      clearInterval(pollTimer);
    };
  }, [transferManager.myPeerId, incomingOrderModal]);

  useEffect(() => {
    // If an initial peer ID is provided via URL query or prop, connect automatically
    if (initialTargetPeerId && !transferManager.isConnected && !transferManager.isConnecting) {
      setTargetId(initialTargetPeerId);
      transferManager.connect(initialTargetPeerId).catch((err) => {
        console.error('Auto-connect failed:', err);
      });
    }
  }, [initialTargetPeerId, transferManager]);

  // Hook into transferManager events
  useEffect(() => {
    transferManager.onFileReceiveStart = (file) => {
      requestWakeLock();
      setCurrentIncomingFile(file);
      playChime('connect');
    };

    transferManager.onFileProgress = (fileId, progress, speed) => {
      setCurrentIncomingFile((prev) =>
        prev && prev.id === fileId ? { ...prev, progress, speed } : prev
      );
    };

    transferManager.onFileReceiveComplete = (completedFile) => {
      playChime('complete');
      setCurrentIncomingFile(null);
      releaseWakeLock();
      setReceivedFiles((prev) => [completedFile, ...prev]);

      // Auto trigger download if enabled
      if (autoDownload && completedFile.downloadUrl) {
        triggerDownload(completedFile);
      }
    };

    transferManager.onTextReceive = (payload) => {
      playChime('message');
      setReceivedTexts((prev) => [payload, ...prev]);
    };

    transferManager.onConnected = () => {
      playChime('connect');
    };
  }, [transferManager, autoDownload]);

  const handleManualConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId.trim()) return;
    transferManager.connect(targetId.trim()).catch((err) => {
      alert('Could not connect: ' + err.message);
    });
  };

  const triggerDownload = (file: TransferFile) => {
    if (!file.downloadUrl) return;
    const a = document.createElement('a');
    a.href = file.downloadUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyTextToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Reply back to PC
  const sendReplyText = () => {
    if (!replyText.trim() || !transferManager.isConnected) return;
    const ok = transferManager.sendText(replyText.trim());
    if (ok) {
      setReceivedTexts((prev) => [
        {
          id: 'reply-' + Date.now(),
          text: replyText.trim(),
          timestamp: Date.now(),
          direction: 'send',
          type: 'text'
        },
        ...prev
      ]);
      setReplyText('');
    }
  };

  const handleReplyFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !transferManager.isConnected) return;
    const file = e.target.files[0];
    setIsSendingReply(true);

    try {
      await transferManager.sendFile(file);
      playChime('complete');
    } catch (err: any) {
      alert('Failed to send file: ' + err.message);
    } finally {
      setIsSendingReply(false);
    }
  };

  const getFileIcon = (type: string, name: string) => {
    const cat = getFileCategory(type, name);
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
        return <ImageIcon className="w-5 h-5 text-teal-400" />;
      case 'video':
        return <Film className="w-5 h-5 text-purple-400" />;
      case 'audio':
        return <Music className="w-5 h-5 text-pink-400" />;
      default:
        return <FileText className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Header & Connection Bar */}
      <div className="bg-white/85 backdrop-blur-2xl border border-white/95 rounded-3xl p-5 shadow-[0_16px_40px_rgba(2,132,199,0.08)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <span>Receiver Mode</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-300 font-bold">
                  WEB RECEIVER
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Receives files directly into device memory via WebRTC
              </p>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-1.5 text-xs text-slate-600 cursor-pointer select-none font-semibold">
              <input
                type="checkbox"
                checked={autoDownload}
                onChange={(e) => setAutoDownload(e.target.checked)}
                className="rounded bg-white border-sky-300 text-sky-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Auto-download</span>
            </label>

            <div
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                transferManager.isConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-amber-50 text-amber-700 border-amber-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  transferManager.isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                }`}
              />
              <span>
                {transferManager.isConnected
                  ? `Connected to ${transferManager.connectedPeerId}`
                  : 'Waiting for Connection'}
              </span>
            </div>
          </div>
        </div>

        {/* Manual Connect Form if not connected */}
        {!transferManager.isConnected && (
          <form onSubmit={handleManualConnect} className="mt-4 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Enter PC Session ID (e.g. beam-xyz123)..."
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full bg-sky-50/80 border border-sky-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 font-mono focus:outline-none focus:border-sky-500 shadow-xs"
              />
            </div>
            <button
              type="submit"
              disabled={!targetId.trim() || transferManager.isConnecting}
              className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-500/20 disabled:opacity-50 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{transferManager.isConnecting ? 'Connecting...' : 'Connect to PC'}</span>
            </button>
          </form>
        )}
      </div>

      {/* Live Incoming Streaming File Card */}
      {currentIncomingFile && (
        <div className="bg-white/90 backdrop-blur-2xl border-2 border-sky-400 rounded-3xl p-5 shadow-[0_16px_45px_rgba(2,132,199,0.15)] space-y-3 animate-pulse-slow">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center border border-sky-200 shadow-xs">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-xs text-sky-700 font-mono uppercase tracking-wider font-semibold">
                  Receiving Live Stream
                </p>
                <h3 className="text-sm font-bold text-slate-900 truncate max-w-[280px]">
                  {currentIncomingFile.name}
                </h3>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-mono font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded border border-sky-300">
                {formatSpeed(currentIncomingFile.speed)}
              </span>
              <p className="text-[10px] text-slate-500 mt-1 font-mono">
                {currentIncomingFile.progress}% Complete
              </p>
            </div>
          </div>

          <div className="w-full bg-sky-100 rounded-full h-3 overflow-hidden p-0.5 border border-sky-300">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-all duration-150"
              style={{ width: `${currentIncomingFile.progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
            <span>RAM Stream buffer</span>
            <span>
              {formatBytes((currentIncomingFile.size * currentIncomingFile.progress) / 100)} / {formatBytes(currentIncomingFile.size)}
            </span>
          </div>
        </div>
      )}

      {/* Empty State when no transfers yet */}
      {!currentIncomingFile && receivedFiles.length === 0 && receivedTexts.length === 0 && (
        <div className="bg-white/75 backdrop-blur-2xl border border-white/95 rounded-3xl p-10 text-center space-y-3 shadow-[0_12px_36px_rgba(2,132,199,0.06)]">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-600 shadow-sm">
            <Laptop className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            {transferManager.isConnected
              ? 'Ready to receive files from PC!'
              : 'Waiting for connection...'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {transferManager.isConnected
              ? 'Files or texts dropped on the PC will show up here automatically.'
              : 'Scan the QR code displayed on your PC screen to establish a high-speed direct peer connection.'}
          </p>
        </div>
      )}

      {/* Last Download Notification Banner */}
      {receivedFiles.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center justify-between text-xs shadow-md">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-slate-900">Download Complete! Saved to your device</p>
              <p className="text-[11px] text-emerald-800">
                "{receivedFiles[0].name}" streamed and saved automatically.
              </p>
            </div>
          </div>
          <button
            onClick={() => triggerDownload(receivedFiles[0])}
            className="px-3.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold shrink-0 transition-colors flex items-center space-x-1 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tap to re-download</span>
          </button>
        </div>
      )}

      {/* Received Files List */}
      {receivedFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
            <span>Received Files</span>
            <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 border border-sky-300 flex items-center justify-center text-[10px] font-mono font-bold">
              {receivedFiles.length}
            </span>
          </h3>

          <div className="grid grid-cols-1 gap-3">
            {receivedFiles.map((file) => {
              const isImage = file.type.startsWith('image/');
              return (
                <div
                  key={file.id}
                  className="bg-white/85 backdrop-blur-xl border border-sky-200/80 hover:border-sky-300 rounded-2xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_8px_24px_rgba(2,132,199,0.06)]"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    {/* Thumbnail or Icon */}
                    {isImage && file.previewUrl ? (
                      <div
                        onClick={() => setPreviewModalFile(file)}
                        className="w-12 h-12 rounded-xl overflow-hidden bg-white shrink-0 cursor-pointer border border-sky-200 hover:scale-105 transition-transform shadow-xs"
                      >
                        <img
                          src={file.previewUrl}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center shrink-0 border border-sky-200 shadow-xs">
                        {getFileIcon(file.type, file.name)}
                      </div>
                    )}

                    <div className="truncate">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-xs font-bold text-slate-900 truncate max-w-md">
                          {file.name}
                        </h4>
                        {(() => {
                          const meta = getFileTypeMeta(file.type, file.name);
                          return (
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${meta.bgColor} ${meta.textColor} ${meta.borderColor}`}>
                              {meta.badgeLabel}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5 font-mono">
                        <span>{formatBytes(file.size)}</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>P2P Received</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    {isImage && (
                      <button
                        onClick={() => setPreviewModalFile(file)}
                        className="p-2 bg-white hover:bg-sky-50 text-slate-600 hover:text-sky-700 border border-sky-200 rounded-xl text-xs transition-colors shadow-xs"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => triggerDownload(file)}
                      className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-500/20 flex items-center space-x-1.5 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Received Texts List */}
      {receivedTexts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
            <span>Received Messages & Links</span>
            <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 border border-sky-300 flex items-center justify-center text-[10px] font-mono font-bold">
              {receivedTexts.length}
            </span>
          </h3>

          <div className="space-y-2.5">
            {receivedTexts.map((item) => {
              const isUrl = /^https?:\/\//i.test(item.text.trim());
              return (
                <div
                  key={item.id}
                  className="bg-white/85 backdrop-blur-xl border border-sky-200/80 rounded-2xl p-4 space-y-2.5 shadow-[0_8px_24px_rgba(2,132,199,0.06)]"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-mono text-sky-700 font-bold">
                      {item.direction === 'send' ? 'Sent by Phone' : 'Received from PC'}
                    </span>
                    <span>
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  <div className="bg-sky-50/70 p-3 rounded-xl border border-sky-200/80 font-mono text-xs text-slate-800 break-all select-all whitespace-pre-wrap">
                    {item.text}
                  </div>

                  <div className="flex items-center justify-end space-x-2">
                    {isUrl && (
                      <a
                        href={item.text.trim()}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-white hover:bg-sky-50 border border-sky-200 text-slate-700 rounded-lg text-xs flex items-center space-x-1 transition-colors shadow-xs"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open Link</span>
                      </a>
                    )}
                    <button
                      onClick={() => copyTextToClipboard(item.text, item.id)}
                      className="px-3 py-1.5 bg-white hover:bg-sky-50 border border-sky-200 text-slate-700 hover:text-sky-700 rounded-lg text-xs flex items-center space-x-1 transition-colors shadow-xs cursor-pointer"
                    >
                      {copiedId === item.id ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reverse Beam: Phone -> PC */}
      {transferManager.isConnected && (
        <div className="bg-white/85 backdrop-blur-2xl border border-sky-200/80 rounded-3xl p-4 space-y-3 shadow-[0_12px_36px_rgba(2,132,199,0.06)]">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-900 flex items-center space-x-2">
              <Share2 className="w-3.5 h-3.5 text-sky-600" />
              <span>Send Back to PC (Reverse Beam)</span>
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">Bi-directional P2P</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Quick text/link back to PC..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendReplyText()}
              className="flex-1 bg-sky-50/80 border border-sky-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-xs"
            />
            <button
              onClick={sendReplyText}
              disabled={!replyText.trim()}
              className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-all flex items-center space-x-1 shadow-sm cursor-pointer"
            >
              <Send className="w-3 h-3" />
              <span>Send</span>
            </button>
          </div>

          <div>
            <input
              ref={replyFileInputRef}
              type="file"
              className="hidden"
              onChange={handleReplyFileUpload}
            />
            <button
              onClick={() => replyFileInputRef.current?.click()}
              disabled={isSendingReply}
              className="w-full py-2.5 border border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/50 hover:bg-sky-50 rounded-xl text-xs text-slate-600 hover:text-sky-700 flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 rotate-180" />
              <span>{isSendingReply ? 'Sending File to PC...' : 'Or choose photo/file to send to PC'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewModalFile && (
        <div
          onClick={() => setPreviewModalFile(null)}
          className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white/95 backdrop-blur-2xl border border-white/95 rounded-3xl max-w-2xl w-full p-5 space-y-4 cursor-default shadow-[0_25px_60px_rgba(2,132,199,0.2)]"
          >
            <div className="flex items-center justify-between pb-2 border-b border-sky-100">
              <h3 className="text-xs font-bold text-slate-900 truncate max-w-md">
                {previewModalFile.name}
              </h3>
              <button
                onClick={() => setPreviewModalFile(null)}
                className="w-7 h-7 rounded-full bg-sky-50 hover:bg-sky-100 flex items-center justify-center text-slate-500 hover:text-slate-900 text-xs border border-sky-200/60"
              >
                ✕
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-sky-50/50 border border-sky-200/80 max-h-[70vh] flex items-center justify-center p-2">
              <img
                src={previewModalFile.previewUrl}
                alt={previewModalFile.name}
                className="max-h-[65vh] w-auto object-contain rounded-xl"
              />
            </div>
            <div className="flex justify-end pt-2 border-t border-sky-100">
              <button
                onClick={() => triggerDownload(previewModalFile)}
                className="px-5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-sky-500/20 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Image</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AirDrop Order Acceptance Modal */}
      {incomingOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-2xl border border-white/95 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-[0_25px_60px_rgba(2,132,199,0.2)]">
            <div className="w-16 h-16 rounded-2xl bg-sky-100 border border-sky-200 flex items-center justify-center mx-auto text-3xl shadow-sm">
              <span>{incomingOrderModal.senderType === 'laptop' ? '💻' : '📱'}</span>
            </div>
            
            <span className="text-[10px] font-mono font-bold text-sky-800 bg-sky-100 px-3 py-1 rounded-full border border-sky-300">
              📶 Wi-Fi 5GHz Mesh Bridge
            </span>

            <h3 className="text-base font-extrabold text-slate-900">
              {incomingOrderModal.senderName || 'PC Workstation'}
            </h3>
            <p className="text-xs text-slate-600">
              wants to beam an object directly to this device:
            </p>

            <div className="p-3 bg-sky-50/80 border border-sky-200 rounded-2xl flex items-center gap-3 text-left shadow-xs">
              <span className="text-2xl">📄</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate">{incomingOrderModal.payload?.name || 'Shared Object'}</p>
                <p className="text-[11px] font-mono text-sky-700 font-semibold">
                  {typeof incomingOrderModal.payload?.size === 'number' ? formatBytes(incomingOrderModal.payload.size) : (incomingOrderModal.payload?.size || 'Direct Payload')}
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={async () => {
                  await fetch('/api/mesh/order/respond', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: incomingOrderModal.orderId, status: 'declined' })
                  }).catch(() => {});
                  setIncomingOrderModal(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs transition-colors cursor-pointer shadow-xs"
              >
                ✕ Decline (رفض)
              </button>

              <button
                onClick={async () => {
                  const ord = incomingOrderModal;
                  await fetch('/api/mesh/order/respond', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: ord.orderId, status: 'accepted' })
                  }).catch(() => {});
                  setIncomingOrderModal(null);
                  playChime('complete');
                  if (ord.payload) {
                    setReceivedFiles(prev => [
                      {
                        id: ord.orderId,
                        name: ord.payload.name,
                        size: typeof ord.payload.size === 'number' ? ord.payload.size : 1024,
                        type: ord.payload.mime || 'application/octet-stream',
                        progress: 100,
                        speed: 85 * 1024 * 1024,
                        status: 'completed',
                        direction: 'receive'
                      },
                      ...prev
                    ]);
                  }
                }}
                className="flex-[1.4] py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 text-white font-extrabold text-xs shadow-lg shadow-sky-500/25 transition-all cursor-pointer"
              >
                ✓ Accept Order (قبول)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
