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

  // Return beam message from phone to PC
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const replyFileInputRef = useRef<HTMLInputElement | null>(null);

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
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <span>Receiver Mode</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/70 text-cyan-400 border border-cyan-800/40">
                  WEB RECEIVER
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Receives files directly into device memory via WebRTC
              </p>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-1.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoDownload}
                onChange={(e) => setAutoDownload(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Auto-download</span>
            </label>

            <div
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                transferManager.isConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  transferManager.isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
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
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              type="submit"
              disabled={!targetId.trim() || transferManager.isConnecting}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-cyan-500/20 disabled:opacity-50 transition-all flex items-center justify-center space-x-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{transferManager.isConnecting ? 'Connecting...' : 'Connect to PC'}</span>
            </button>
          </form>
        )}
      </div>

      {/* Live Incoming Streaming File Card */}
      {currentIncomingFile && (
        <div className="bg-gradient-to-r from-cyan-950/80 via-slate-900 to-blue-950/80 border-2 border-cyan-500/50 rounded-3xl p-5 shadow-2xl shadow-cyan-950/40 space-y-3 animate-pulse-slow">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-xs text-cyan-400 font-mono uppercase tracking-wider">
                  Receiving Live Stream
                </p>
                <h3 className="text-sm font-bold text-white truncate max-w-[280px]">
                  {currentIncomingFile.name}
                </h3>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-mono font-bold text-cyan-400">
                {formatSpeed(currentIncomingFile.speed)}
              </span>
              <p className="text-[10px] text-slate-400">
                {currentIncomingFile.progress}% Complete
              </p>
            </div>
          </div>

          <div className="w-full bg-slate-900/80 rounded-full h-3 overflow-hidden p-0.5 border border-cyan-500/30">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-150"
              style={{ width: `${currentIncomingFile.progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>RAM Stream buffer</span>
            <span>
              {formatBytes((currentIncomingFile.size * currentIncomingFile.progress) / 100)} / {formatBytes(currentIncomingFile.size)}
            </span>
          </div>
        </div>
      )}

      {/* Empty State when no transfers yet */}
      {!currentIncomingFile && receivedFiles.length === 0 && receivedTexts.length === 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-10 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400">
            <Laptop className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">
            {transferManager.isConnected
              ? 'Ready to receive files from PC!'
              : 'Waiting for connection...'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {transferManager.isConnected
              ? 'Files or texts dropped on the PC will show up here automatically.'
              : 'Scan the QR code displayed on your PC screen to establish a high-speed direct peer connection.'}
          </p>
        </div>
      )}

      {/* Last Download Notification Banner */}
      {receivedFiles.length > 0 && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between text-xs shadow-lg">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-white">Download Complete! Saved to your device</p>
              <p className="text-[11px] text-slate-400">
                "{receivedFiles[0].name}" streamed and saved automatically.
              </p>
            </div>
          </div>
          <button
            onClick={() => triggerDownload(receivedFiles[0])}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold shrink-0 transition-colors flex items-center space-x-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tap to re-download</span>
          </button>
        </div>
      )}

      {/* Received Files List */}
      {receivedFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
            <span>Received Files</span>
            <span className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 flex items-center justify-center text-[10px] font-mono">
              {receivedFiles.length}
            </span>
          </h3>

          <div className="grid grid-cols-1 gap-3">
            {receivedFiles.map((file) => {
              const isImage = file.type.startsWith('image/');
              return (
                <div
                  key={file.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    {/* Thumbnail or Icon */}
                    {isImage && file.previewUrl ? (
                      <div
                        onClick={() => setPreviewModalFile(file)}
                        className="w-12 h-12 rounded-xl overflow-hidden bg-slate-950 shrink-0 cursor-pointer border border-slate-700 hover:scale-105 transition-transform"
                      >
                        <img
                          src={file.previewUrl}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-800/80 flex items-center justify-center shrink-0 border border-slate-700/50">
                        {getFileIcon(file.type, file.name)}
                      </div>
                    )}

                    <div className="truncate">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-xs font-bold text-white truncate max-w-md">
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
                      <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5 font-mono">
                        <span>{formatBytes(file.size)}</span>
                        <span>•</span>
                        <span className="text-emerald-400 flex items-center space-x-1">
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
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-colors"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => triggerDownload(file)}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-cyan-500/20 flex items-center space-x-1.5 transition-all"
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
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
            <span>Received Messages & Links</span>
            <span className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 flex items-center justify-center text-[10px] font-mono">
              {receivedTexts.length}
            </span>
          </h3>

          <div className="space-y-2.5">
            {receivedTexts.map((item) => {
              const isUrl = /^https?:\/\//i.test(item.text.trim());
              return (
                <div
                  key={item.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-mono text-cyan-400">
                      {item.direction === 'send' ? 'Sent by Phone' : 'Received from PC'}
                    </span>
                    <span>
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 font-mono text-xs text-slate-200 break-all select-all whitespace-pre-wrap">
                    {item.text}
                  </div>

                  <div className="flex items-center justify-end space-x-2">
                    {isUrl && (
                      <a
                        href={item.text.trim()}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs flex items-center space-x-1 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open Link</span>
                      </a>
                    )}
                    <button
                      onClick={() => copyTextToClipboard(item.text, item.id)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-cyan-950 hover:text-cyan-400 text-slate-200 rounded-lg text-xs flex items-center space-x-1 transition-colors"
                    >
                      {copiedId === item.id ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
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
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-200 flex items-center space-x-2">
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Send Back to PC (Reverse Beam)</span>
            </h4>
            <span className="text-[10px] text-slate-500">Bi-directional P2P</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Quick text/link back to PC..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendReplyText()}
              className="flex-1 bg-slate-950/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={sendReplyText}
              disabled={!replyText.trim()}
              className="px-4 py-2 bg-slate-800 hover:bg-cyan-600 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-colors flex items-center space-x-1"
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
              className="w-full py-2 border border-dashed border-slate-700 hover:border-cyan-500/80 rounded-xl text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center space-x-1.5 transition-all"
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
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-4 space-y-3 cursor-default"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white truncate max-w-md">
                {previewModalFile.name}
              </h3>
              <button
                onClick={() => setPreviewModalFile(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-black/50 max-h-[70vh] flex items-center justify-center">
              <img
                src={previewModalFile.previewUrl}
                alt={previewModalFile.name}
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => triggerDownload(previewModalFile)}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Image</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
