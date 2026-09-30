import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Download,
  CheckCircle2,
  FileArchive,
  FileText,
  Film,
  Music,
  Image as ImageIcon,
  Radio,
  ShieldCheck,
  RefreshCw,
  Eye,
  AlertCircle,
  FileSpreadsheet,
  Presentation
} from 'lucide-react';
import { P2PTransferManager, TransferFile } from '../utils/p2p';
import { formatBytes, formatSpeed, getFileCategory, getFileTypeMeta } from '../utils/formatters';
import { playChime } from '../utils/audio';

interface DirectDownloadPortalProps {
  peerId: string;
  expectedFileName?: string;
  expectedFileSize?: number;
  expectedFileMime?: string;
}

export const DirectDownloadPortal: React.FC<DirectDownloadPortalProps> = ({
  peerId,
  expectedFileName = '',
  expectedFileSize = 0,
  expectedFileMime = ''
}) => {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [currentFile, setCurrentFile] = useState<TransferFile | null>(null);
  const [downloadedFile, setDownloadedFile] = useState<TransferFile | null>(null);
  const [downloadTriggered, setDownloadTriggered] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);

  const transferManager = useMemo(() => new P2PTransferManager(), []);
  const autoTriggeredRef = useRef(false);
  const isConnectingRef = useRef(false);

  // Metadata from URL query or incoming stream
  const displayName = downloadedFile?.name || currentFile?.name || expectedFileName || 'Shared File';
  const displaySize = downloadedFile?.size || currentFile?.size || expectedFileSize || 0;
  const displayMime = downloadedFile?.type || currentFile?.type || expectedFileMime || 'application/octet-stream';

  useEffect(() => {
    let isMounted = true;

    // Set page title to the file name directly
    document.title = `Download ${displayName}`;

    transferManager.onConnected = () => {
      if (!isMounted) return;
      setConnectionStatus('connected');
      playChime('connect');
      // Emit immediate RECEIVER_READY control frame to unlock sender pump loop
      try {
        transferManager.sendMessage({ type: 'RECEIVER_READY' });
      } catch (_) {}
    };

    transferManager.onStatusChange = (status) => {
      if (
        status.toLowerCase().includes('disconnected') ||
        status.toLowerCase().includes('reconnecting') ||
        status.toLowerCase().includes('waiting')
      ) {
        return;
      }
      if (status.toLowerCase().includes('error') || status.toLowerCase().includes('failed')) {
        setConnectionStatus('error');
        setErrorMessage(status);
      }
    };

    transferManager.onFileReceiveStart = (file) => {
      if (!isMounted) return;
      setCurrentFile(file);
      playChime('connect');
    };

    transferManager.onFileProgress = (fileId, progress, speed) => {
      if (!isMounted) return;
      setCurrentFile((prev) =>
        prev && prev.id === fileId ? { ...prev, progress, speed } : prev
      );
    };

    transferManager.onFileReceiveComplete = (completedFile) => {
      if (!isMounted) return;
      setCurrentFile(null);
      setDownloadedFile(completedFile);
      playChime('complete');

      // Direct automatic download to phone storage
      if (!autoTriggeredRef.current && completedFile.downloadUrl) {
        autoTriggeredRef.current = true;
        setDownloadTriggered(true);
        triggerBrowserDownload(completedFile.downloadUrl, completedFile.name);
      }
    };

    

    transferManager.onTextReceive = (payload) => {
      if (!isMounted) return;
      if (payload && payload.text === 'SESSION_CANCELLED_BY_HOST') {
        setConnectionStatus('error');
        setErrorMessage('This QR session was cancelled or terminated by the sender.');
      }
    };
    // Initialize WebRTC client
    // Load E2EE Key from camera hash fragment (#key=...)
    if (typeof window !== 'undefined' && window.location.hash.includes('key=')) {
      const match = window.location.hash.match(/key=([0-9a-fA-F]{64})/i);
      if (match) {
        transferManager.setE2EEKeyFromHex(match[1]);
      }
    }
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;

    const myReceiverId = 'dl-' + Math.random().toString(36).substring(2, 9);
    transferManager
      .init(myReceiverId)
      .then(() => {
        if (!isMounted) return;
        return transferManager.connect(peerId);
      })
      .then(() => {
        if (!isMounted) return;
        setConnectionStatus('connected');
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Direct connection failed:', err);
        setConnectionStatus('error');
        setErrorMessage(err.message || 'Could not connect to PC session');
      });

    return () => {
      isMounted = false;
      transferManager.destroy();
    };
  }, [peerId, transferManager, displayName]);

  const triggerBrowserDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloadTriggered(true);
  };

  const handleManualDownloadClick = () => {
    if (downloadedFile && downloadedFile.downloadUrl) {
      triggerBrowserDownload(downloadedFile.downloadUrl, downloadedFile.name);
    }
  };

  const getFileCategoryIcon = (mime: string, name: string) => {
    const cat = getFileCategory(mime, name);
    switch (cat) {
      case 'excel':
        return <FileSpreadsheet className="w-10 h-10 text-emerald-400" />;
      case 'powerpoint':
        return <Presentation className="w-10 h-10 text-amber-400" />;
      case 'word':
        return <FileText className="w-10 h-10 text-blue-400" />;
      case 'pdf':
        return <FileText className="w-10 h-10 text-rose-400" />;
      case 'archive':
        return <FileArchive className="w-10 h-10 text-yellow-400" />;
      case 'image':
        return <ImageIcon className="w-10 h-10 text-teal-400" />;
      case 'video':
        return <Film className="w-10 h-10 text-purple-400" />;
      case 'audio':
        return <Music className="w-10 h-10 text-pink-400" />;
      default:
        return <FileText className="w-10 h-10 text-cyan-400" />;
    }
  };

  const isImage = displayMime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(displayName);
  const isVideo = displayMime.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(displayName);
  const fileMeta = getFileTypeMeta(displayMime, displayName);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-sky-50 to-blue-100 text-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 font-sans selection:bg-sky-500 selection:text-white relative overflow-hidden">
      {/* Background Soft Ambient Light Spheres */}
      <div className="fixed top-10 left-10 w-96 h-96 bg-sky-300/40 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-cyan-200/50 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Centered Isolated Direct Download Box */}
      <main className="max-w-md w-full mx-auto">
        <div className="bg-white/90 border border-white/95 rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(2,132,199,0.15)] backdrop-blur-2xl relative overflow-hidden space-y-6 text-center">
          {/* Subtle Ambient Light */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Large File Icon */}
          <div className="w-20 h-20 mx-auto rounded-3xl bg-white border border-sky-200 flex items-center justify-center shadow-md relative">
            <div className="absolute inset-0 rounded-3xl border-2 border-sky-400/40 animate-pulse pointer-events-none" />
            {downloadedFile?.previewUrl && isImage ? (
              <img
                src={downloadedFile.previewUrl}
                alt={displayName}
                className="w-full h-full object-cover rounded-3xl"
              />
            ) : (
              getFileCategoryIcon(displayMime, displayName)
            )}
          </div>

          {/* File Name & Specs */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-center space-x-1.5">
              <span className={`text-[10px] font-mono uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border ${fileMeta.bgColor} ${fileMeta.textColor} ${fileMeta.borderColor}`}>
                {fileMeta.badgeLabel}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-sky-700 font-bold px-2 py-0.5 rounded-full bg-sky-100 border border-sky-300">
                Direct Download
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 break-words max-w-full pt-1" title={displayName}>
              {displayName}
            </h1>
            <div className="flex items-center justify-center space-x-2 text-xs text-slate-500 font-mono pt-0.5">
              {displaySize > 0 && <span className="font-semibold text-slate-700">{formatBytes(displaySize)}</span>}
              {displaySize > 0 && <span>•</span>}
              <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 inline text-emerald-600" />
                <span>Encrypted P2P Link</span>
              </span>
            </div>
          </div>

          {/* Real-time Streaming Progress Bar */}
          {currentFile && (
            <div className="bg-sky-50/80 border border-sky-300 rounded-2xl p-4 space-y-3 text-left shadow-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="text-sky-900 font-semibold flex items-center space-x-1.5">
                  <Radio className="w-3.5 h-3.5 animate-pulse text-sky-600" />
                  <span>Streaming directly into device memory...</span>
                </span>
                <span className="font-mono text-sky-700 font-bold bg-sky-100 px-2 py-0.5 rounded border border-sky-300">
                  {formatSpeed(currentFile.speed)}
                </span>
              </div>

              <div className="w-full bg-sky-100 rounded-full h-3 overflow-hidden p-0.5 border border-sky-300">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 rounded-full transition-all duration-150"
                  style={{ width: `${currentFile.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                <span>{currentFile.progress}% Complete</span>
                <span>
                  {formatBytes((currentFile.size * currentFile.progress) / 100)} / {formatBytes(currentFile.size)}
                </span>
              </div>
            </div>
          )}

          {/* Waiting for stream connection state */}
          {!currentFile && !downloadedFile && connectionStatus !== 'error' && (
            <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-4 text-center space-y-2">
              <div className="w-8 h-8 mx-auto rounded-full bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
              <p className="text-xs text-slate-600 font-medium">
                {connectionStatus === 'connected'
                  ? 'Connected! Starting direct file download...'
                  : 'Establishing direct device-to-device connection...'}
              </p>
            </div>
          )}

          {/* Error Message */}
          {connectionStatus === 'error' && (
            <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 text-center space-y-2">
              <AlertCircle className="w-7 h-7 text-rose-500 mx-auto" />
              <p className="text-xs text-rose-700">
                {errorMessage || 'Connection failed. Please rescan the QR code.'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-1.5 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                Retry
              </button>
            </div>
          )}

          {/* Complete Success Alert */}
          {downloadedFile && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3.5 flex items-center space-x-3 text-xs text-left shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-slate-900">Saved to Downloads!</p>
                <p className="text-slate-600 text-[11px]">
                  File has been downloaded directly to your phone.
                </p>
              </div>
            </div>
          )}

          {/* Giant Primary Download Action Button */}
          <button
            onClick={handleManualDownloadClick}
            disabled={!downloadedFile}
            className="w-full py-4 px-6 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-2xl text-sm font-bold shadow-xl shadow-sky-500/25 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="w-5 h-5" />
            <span>
              {downloadedFile
                ? `Save Again (${formatBytes(downloadedFile.size)})`
                : currentFile
                ? `Downloading (${formatBytes(displaySize)})...`
                : `Download File (${formatBytes(displaySize)})`}
            </span>
          </button>

          {/* Instant Media Preview if photo or video */}
          {downloadedFile && isImage && downloadedFile.previewUrl && (
            <div className="space-y-2 pt-1">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="w-full py-2 bg-white hover:bg-sky-50 border border-sky-200 text-slate-700 hover:text-sky-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Eye className="w-3.5 h-3.5 text-sky-600" />
                <span>{showPreview ? 'Hide Photo' : 'Preview Photo'}</span>
              </button>

              {showPreview && (
                <div className="rounded-2xl overflow-hidden border border-sky-200 bg-sky-50/50 max-h-72 flex items-center justify-center p-2">
                  <img
                    src={downloadedFile.previewUrl}
                    alt={downloadedFile.name}
                    className="max-h-64 max-w-full rounded-xl object-contain shadow-md"
                  />
                </div>
              )}
            </div>
          )}

          {downloadedFile && isVideo && downloadedFile.downloadUrl && (
            <div className="space-y-2 pt-1">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="w-full py-2 bg-white hover:bg-sky-50 border border-sky-200 text-slate-700 hover:text-sky-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Film className="w-3.5 h-3.5 text-indigo-600" />
                <span>{showPreview ? 'Hide Video' : 'Play Video'}</span>
              </button>

              {showPreview && (
                <div className="rounded-2xl overflow-hidden border border-sky-200 bg-black max-h-72">
                  <video
                    controls
                    playsInline
                    src={downloadedFile.downloadUrl}
                    className="w-full max-h-64 object-contain"
                  />
                </div>
              )}
            </div>
          )}

          {/* Minimal Privacy Guarantee Tag */}
          <p className="text-[11px] text-slate-500 font-mono pt-2 border-t border-sky-100">
            🔒 Direct Device-to-Device Stream • Zero Cloud Storage
          </p>
        </div>
      </main>
    </div>
  );
};
