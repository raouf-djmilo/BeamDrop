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
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Eye,
  AlertCircle
} from 'lucide-react';
import { P2PTransferManager, TransferFile } from '../utils/p2p';
import { formatBytes, formatSpeed, getFileCategory } from '../utils/formatters';
import { playChime } from '../utils/audio';

interface DirectDownloadPortalProps {
  peerId: string;
  expectedFileName?: string;
  expectedFileSize?: number;
  expectedFileMime?: string;
  onSwitchToFullApp?: () => void;
}

export const DirectDownloadPortal: React.FC<DirectDownloadPortalProps> = ({
  peerId,
  expectedFileName = '',
  expectedFileSize = 0,
  expectedFileMime = '',
  onSwitchToFullApp
}) => {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [currentFile, setCurrentFile] = useState<TransferFile | null>(null);
  const [downloadedFile, setDownloadedFile] = useState<TransferFile | null>(null);
  const [downloadTriggered, setDownloadTriggered] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);

  const transferManager = useMemo(() => new P2PTransferManager(), []);
  const autoTriggeredRef = useRef(false);

  // Fallback initial metadata from URL query
  const displayName = downloadedFile?.name || currentFile?.name || expectedFileName || 'Shared File';
  const displaySize = downloadedFile?.size || currentFile?.size || expectedFileSize || 0;
  const displayMime = downloadedFile?.type || currentFile?.type || expectedFileMime || 'application/octet-stream';

  useEffect(() => {
    let isMounted = true;

    // Hook up transfer events
    transferManager.onConnected = () => {
      if (!isMounted) return;
      setConnectionStatus('connected');
      playChime('connect');
    };

    transferManager.onStatusChange = (status) => {
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

    // Initialize WebRTC client
    const myReceiverId = 'receiver-' + Math.random().toString(36).substring(2, 9);
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
  }, [peerId, transferManager]);

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
      case 'image':
        return <ImageIcon className="w-8 h-8 text-emerald-400" />;
      case 'video':
        return <Film className="w-8 h-8 text-purple-400" />;
      case 'audio':
        return <Music className="w-8 h-8 text-pink-400" />;
      case 'archive':
        return <FileArchive className="w-8 h-8 text-amber-400" />;
      default:
        return <FileText className="w-8 h-8 text-cyan-400" />;
    }
  };

  const isImage = displayMime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(displayName);
  const isVideo = displayMime.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(displayName);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans selection:bg-cyan-500 selection:text-white">
      {/* Minimal Top Brand Bar */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white">
            <Download className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center space-x-1.5">
              <span>BeamDrop</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                DIRECT DOWNLOAD
              </span>
            </h1>
          </div>
        </div>

        {/* Connection status tag */}
        <div
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
            connectionStatus === 'connected'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : connectionStatus === 'error'
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected'
                ? 'bg-emerald-400'
                : connectionStatus === 'error'
                ? 'bg-rose-400'
                : 'bg-amber-400 animate-ping'
            }`}
          />
          <span className="text-[11px]">
            {connectionStatus === 'connected'
              ? 'Direct Link Active'
              : connectionStatus === 'error'
              ? 'Connection Error'
              : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Main Direct Download Card */}
      <main className="max-w-md w-full mx-auto my-auto py-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden space-y-6">
          {/* Subtle glow effect */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Card Header & File Identity */}
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center shrink-0 shadow-inner">
              {downloadedFile?.previewUrl && isImage ? (
                <img
                  src={downloadedFile.previewUrl}
                  alt={displayName}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                getFileCategoryIcon(displayMime, displayName)
              )}
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                Incoming File
              </span>
              <h2 className="text-base font-bold text-white truncate max-w-full mt-0.5" title={displayName}>
                {displayName}
              </h2>
              <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono mt-1">
                {displaySize > 0 && <span>{formatBytes(displaySize)}</span>}
                {displaySize > 0 && <span>•</span>}
                <span className="text-emerald-400 flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 inline" />
                  <span>Direct Encrypted P2P</span>
                </span>
              </div>
            </div>
          </div>

          {/* STATE 1: Receiving Stream in Progress */}
          {currentFile && (
            <div className="bg-cyan-950/40 border border-cyan-500/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-cyan-300 font-semibold flex items-center space-x-1.5">
                  <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
                  <span>Streaming directly to your device...</span>
                </span>
                <span className="font-mono text-cyan-400 font-bold">
                  {formatSpeed(currentFile.speed)}
                </span>
              </div>

              {/* Real-time streaming progress track */}
              <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden p-0.5 border border-cyan-500/30">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 rounded-full transition-all duration-150"
                  style={{ width: `${currentFile.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>{currentFile.progress}% Complete</span>
                <span>
                  {formatBytes((currentFile.size * currentFile.progress) / 100)} / {formatBytes(currentFile.size)}
                </span>
              </div>
            </div>
          )}

          {/* STATE 2: Waiting for stream or connecting */}
          {!currentFile && !downloadedFile && connectionStatus !== 'error' && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {connectionStatus === 'connected'
                    ? 'Connected to PC! Initiating download...'
                    : 'Connecting directly to Desktop...'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Keep this window open. The file will stream directly from the PC without uploading to any server.
                </p>
              </div>
            </div>
          )}

          {/* STATE 3: Error connecting */}
          {connectionStatus === 'error' && (
            <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-5 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
              <div>
                <h3 className="text-sm font-semibold text-rose-200">Connection Failed</h3>
                <p className="text-xs text-rose-300/80 mt-1 max-w-xs mx-auto">
                  {errorMessage || 'Could not establish direct WebRTC session with the PC. Please verify both devices are online and rescan.'}
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
              >
                Retry Connection
              </button>
            </div>
          )}

          {/* STATE 4: Transfer Complete -> Native Download Banner & Big Button */}
          {downloadedFile && (
            <div className="space-y-4">
              <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-2xl p-4 flex items-center space-x-3 text-xs">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div className="flex-1">
                  <p className="font-bold text-white text-sm">Download Finished!</p>
                  <p className="text-slate-300 text-[11px] mt-0.5">
                    File has been sent directly to your phone's downloads folder.
                  </p>
                </div>
              </div>

              {/* Big Prominent Save / Download Button (in case browser blocked auto-download) */}
              <button
                onClick={handleManualDownloadClick}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl text-sm font-bold shadow-xl shadow-cyan-500/25 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Download className="w-5 h-5" />
                <span>
                  {downloadTriggered
                    ? `Save Again (${formatBytes(downloadedFile.size)})`
                    : `Tap to Download (${formatBytes(downloadedFile.size)})`}
                </span>
              </button>

              {/* Image / Video Instant Preview Button */}
              {isImage && downloadedFile.previewUrl && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
                  >
                    <Eye className="w-4 h-4 text-cyan-400" />
                    <span>{showPreview ? 'Hide Photo Preview' : 'View Photo on Device'}</span>
                  </button>

                  {showPreview && (
                    <div className="rounded-2xl overflow-hidden border border-slate-700 bg-black/60 max-h-72 flex items-center justify-center p-2">
                      <img
                        src={downloadedFile.previewUrl}
                        alt={downloadedFile.name}
                        className="max-h-64 max-w-full rounded-xl object-contain shadow-lg"
                      />
                    </div>
                  )}
                </div>
              )}

              {isVideo && downloadedFile.downloadUrl && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
                  >
                    <Film className="w-4 h-4 text-purple-400" />
                    <span>{showPreview ? 'Hide Video Player' : 'Play Video on Phone'}</span>
                  </button>

                  {showPreview && (
                    <div className="rounded-2xl overflow-hidden border border-slate-700 bg-black max-h-72">
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
            </div>
          )}

          {/* Privacy & Zero-Cloud Guarantee Tag */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Zero Servers</span>
            </div>
            <span>•</span>
            <div>Zero Cloud Storage</div>
            <span>•</span>
            <div>Direct RAM Stream</div>
          </div>
        </div>
      </main>

      {/* Subtle Link to Full App if user wants it */}
      <footer className="max-w-md w-full mx-auto text-center py-4">
        {onSwitchToFullApp && (
          <button
            onClick={onSwitchToFullApp}
            className="text-xs text-slate-500 hover:text-cyan-400 transition-colors inline-flex items-center space-x-1 cursor-pointer"
          >
            <span>Need to send files back to PC? Open BeamDrop Full Web App</span>
            <ExternalLink className="w-3 h-3 ml-0.5" />
          </button>
        )}
      </footer>
    </div>
  );
};
