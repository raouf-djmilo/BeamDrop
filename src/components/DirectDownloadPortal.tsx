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
  Presentation,
  Share2
} from 'lucide-react';
import { P2PTransferManager, TransferFile } from '../utils/p2p';
import { formatBytes, formatSpeed, getFileCategory, getFileTypeMeta } from '../utils/formatters';
import { useNotification } from '../context/NotificationContext';
import { playChime } from '../utils/audio';

interface DirectDownloadPortalProps {
  peerId: string;
  dropId?: string;
  expectedFileName?: string;
  expectedFileSize?: number;
  expectedFileMime?: string;
}

interface CloudDropMeta {
  id: string;
  name: string;
  size: number;
  mime: string;
  sha256?: string;
  createdAt: number;
  expiresAt: number;
  remainingMs: number;
  storageMode: 'gdrive' | 'hybrid';
}

export const DirectDownloadPortal: React.FC<DirectDownloadPortalProps> = ({
  peerId,
  dropId = '',
  expectedFileName = '',
  expectedFileSize = 0,
  expectedFileMime = ''
}) => {
  const { notifyPending, notifySuccess, notifyError } = useNotification();
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [currentFile, setCurrentFile] = useState<TransferFile | null>(null);
  const [downloadedFile, setDownloadedFile] = useState<TransferFile | null>(null);
  const [downloadTriggered, setDownloadTriggered] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [isTransitFetching, setIsTransitFetching] = useState<boolean>(false);
  const [streamTelemetry, setStreamTelemetry] = useState<import('../utils/streamDiskSink').StreamTelemetry | null>(null);

  // 24h Cloud Drop State
  const [cloudMeta, setCloudMeta] = useState<CloudDropMeta | null>(null);
  const [cloudRemainingMs, setCloudRemainingMs] = useState<number>(24 * 60 * 60 * 1000);
  const [isCloudDownloading, setIsCloudDownloading] = useState<boolean>(false);
  const [cloudExpired, setCloudExpired] = useState<boolean>(false);

  const transferManagerRef = useRef<P2PTransferManager | null>(null);
  if (!transferManagerRef.current) {
    transferManagerRef.current = new P2PTransferManager();
  }
  const transferManager = transferManagerRef.current;
  const autoTriggeredRef = useRef(false);
  const isConnectingRef = useRef(false);

  // Metadata from URL query, 24h Cloud Drop, or incoming stream
  const displayName = cloudMeta?.name || downloadedFile?.name || currentFile?.name || expectedFileName || 'Shared File';
  const displaySize = cloudMeta?.size || downloadedFile?.size || currentFile?.size || expectedFileSize || 0;
  const displayMime = cloudMeta?.mime || downloadedFile?.type || currentFile?.type || expectedFileMime || 'application/octet-stream';

  const triggerBrowserDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloadTriggered(true);
  };

  // High-Speed Transit Engine Fallback (Guaranteed 4G/5G mobile cellular transfer)
  const fetchViaTransitFallback = async () => {
    if (downloadedFile || isTransitFetching) return;
    setIsTransitFetching(true);
    try {
      const res = await fetch(`/api/transit?peer=${encodeURIComponent(peerId)}`);
      if (res.status === 200) {
        const blob = await res.blob();
        const rawName = res.headers.get('X-BeamDrop-Name');
        const finalName = rawName ? decodeURIComponent(rawName) : (expectedFileName || 'downloaded_file');
        const downloadUrl = URL.createObjectURL(blob);

        const completedFile: TransferFile = {
          id: 'transit-' + Date.now(),
          name: finalName,
          size: blob.size,
          type: blob.type || expectedFileMime || 'application/octet-stream',
          progress: 100,
          speed: blob.size,
          status: 'completed',
          direction: 'receive',
          blob: blob,
          downloadUrl: downloadUrl,
          previewUrl: (blob.type || '').startsWith('image/') ? downloadUrl : undefined
        };

        setDownloadedFile(completedFile);
        setConnectionStatus('connected');
        playChime('complete');

        if (!autoTriggeredRef.current) {
          autoTriggeredRef.current = true;
          setDownloadTriggered(true);
          triggerBrowserDownload(downloadUrl, finalName);
        }
      }
    } catch (err) {
      console.debug('Transit fallback notice:', err);
    } finally {
      setIsTransitFetching(false);
    }
  };

  useEffect(() => {
    document.title = `Download ${displayName}`;
  }, [displayName]);

  useEffect(() => {
    let isMounted = true;

    // Enable zero-RAM stream-to-disk sink via OPFS / File System Access
    transferManager.diskStreamFactory = async (meta: TransferFile) => {
      try {
        const { createDirectDiskStreamSink } = await import('../utils/streamDiskSink');
        return await createDirectDiskStreamSink(meta, {
          onTelemetry: (t) => {
            if (isMounted) setStreamTelemetry(t);
          }
        });
      } catch (err) {
        console.warn('[DirectDownloadPortal] Disk stream factory notice:', err);
        return null;
      }
    };

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
        try {
          transferManager.sendMessage({
            type: 'PHONE_STATUS',
            stage: 'failed',
            error: status
          });
        } catch (_) {}
        // On WebRTC error, immediately try Transit fallback
        fetchViaTransitFallback();
      }
    };

    transferManager.onFileReceiveStart = (file) => {
      if (!isMounted) return;
      setCurrentFile(file);
      playChime('connect');
      notifyPending(
        `Incoming: ${file.name}`,
        'Receiving stream from host...',
        { name: file.name, size: file.size, mime: file.type }
      );
    };

    transferManager.onFileProgress = (fileId, progress, speed) => {
      if (!isMounted) return;
      setCurrentFile((prev) =>
        prev && prev.id === fileId ? { ...prev, progress, speed } : prev
      );
      if (progress % 10 === 0 || progress > 90) {
        transferManager.sendMessage({
          type: 'PHONE_STATUS',
          stage: 'downloading',
          progress,
          speed
        });
      }
    };

    transferManager.onFileReceiveComplete = (completedFile) => {
      if (!isMounted) return;
      setCurrentFile(null);
      setDownloadedFile(completedFile);
      playChime('complete');

      // Emit remote device delivery ACK to Desktop sender
      transferManager.sendMessage({
        type: 'PHONE_STATUS',
        stage: 'delivered',
        fileName: completedFile.name,
        fileSize: completedFile.size
      });

      notifySuccess(
        'File Downloaded!',
        `${completedFile.name} received cleanly.`,
        { name: completedFile.name, size: completedFile.size, mime: completedFile.type }
      );

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

    // Load E2EE Key from camera hash fragment (#key=...)
    if (typeof window !== 'undefined' && window.location.hash.includes('key=')) {
      const match = window.location.hash.match(/key=([0-9a-fA-F]{64})/i);
      if (match) {
        transferManager.setE2EEKeyFromHex(match[1]);
      }
    }

    if (!isConnectingRef.current) {
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
          const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
          const isAndroid = /Android/i.test(navigator.userAgent);
          const deviceLabel = isIos ? 'iPhone' : isAndroid ? 'Android Phone' : 'Mobile Device';
          transferManager.sendMessage({
            type: 'PHONE_STATUS',
            stage: 'scanned',
            device: deviceLabel
          });
        })
        .catch((err) => {
          if (!isMounted) return;
          console.warn('WebRTC P2P direct failed, falling back to High-Speed Transit Engine:', err);
          fetchViaTransitFallback();
        });

      // Rapid Cellular Fallback: if WebRTC connection is blocked or takes > 6s on 4G/5G, race transit RAM buffer
      const fallbackTimer = setTimeout(() => {
        if (isMounted && !downloadedFile && !currentFile) {
          fetchViaTransitFallback();
        }
      }, 6000);

      return () => {
        isMounted = false;
        clearTimeout(fallbackTimer);
      };
    }

    return () => {
      isMounted = false;
    };
  }, [peerId, dropId]);

  // 24h Global Cloud Drop Metadata & Live Countdown Ticker
  useEffect(() => {
    if (!dropId) return;
    let isMounted = true;
    let timerId: any = null;

    setConnectionStatus('connecting');
    fetch(`/api/cloud-drop?action=get_meta&id=${encodeURIComponent(dropId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!isMounted) return;
        if (!res.ok || !data?.drop) {
          setCloudExpired(Boolean(data?.expired));
          setConnectionStatus('error');
          setErrorMessage(data?.error || 'This 24h Cloud Drop link has expired and was permanently purged.');
          return;
        }
        const meta: CloudDropMeta = data.drop;
        setCloudMeta(meta);
        setConnectionStatus('connected');
        setCloudRemainingMs(Math.max(0, meta.expiresAt - Date.now()));

        timerId = setInterval(() => {
          const rem = Math.max(0, meta.expiresAt - Date.now());
          setCloudRemainingMs(rem);
          if (rem <= 0) {
            setCloudExpired(true);
            setConnectionStatus('error');
            setErrorMessage('24-hour window elapsed. File permanently purged from Cloud Storage.');
            clearInterval(timerId);
          }
        }, 1000);
      })
      .catch(() => {
        if (!isMounted) return;
        setConnectionStatus('error');
        setErrorMessage('Could not reach 24h Global Cloud Drop service.');
      });

    return () => {
      isMounted = false;
      if (timerId) clearInterval(timerId);
    };
  }, [dropId]);

  useEffect(() => {
    return () => {
      transferManagerRef.current?.destroy();
    };
  }, []);

  const handleCloudDropDownload = async () => {
    if (!dropId || !cloudMeta || isCloudDownloading || cloudExpired) return;
    setIsCloudDownloading(true);
    const dlUrl = `/api/cloud-drop?action=download&id=${encodeURIComponent(dropId)}`;
    try {
      const res = await fetch(dlUrl);
      if (!res.ok) throw new Error('Cloud drop expired or unavailable');
      const blob = await res.blob();
      let computedSha = cloudMeta.sha256 || '';
      if (window.crypto?.subtle && blob.size < 120 * 1024 * 1024) {
        const buf = await blob.arrayBuffer();
        const hashBuf = await window.crypto.subtle.digest('SHA-256', buf);
        computedSha = Array.from(new Uint8Array(hashBuf))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      }
      const objectUrl = URL.createObjectURL(blob);
      const completed: TransferFile = {
        id: cloudMeta.id,
        name: cloudMeta.name,
        size: blob.size || cloudMeta.size,
        type: cloudMeta.mime || blob.type || 'application/octet-stream',
        progress: 100,
        speed: blob.size,
        status: 'completed',
        direction: 'receive',
        blob,
        checksum: computedSha,
        downloadUrl: objectUrl,
        previewUrl: (cloudMeta.mime || '').startsWith('image/') ? objectUrl : undefined
      };
      setDownloadedFile(completed);
      playChime('complete');
      triggerBrowserDownload(objectUrl, cloudMeta.name);
    } catch (_) {
      window.location.href = dlUrl;
    } finally {
      setIsCloudDownloading(false);
    }
  };

  const handleManualDownloadClick = () => {
    if (dropId) {
      if (downloadedFile && downloadedFile.downloadUrl) {
        triggerBrowserDownload(downloadedFile.downloadUrl, downloadedFile.name);
      } else {
        handleCloudDropDownload();
      }
      return;
    }
    if (downloadedFile && downloadedFile.downloadUrl) {
      triggerBrowserDownload(downloadedFile.downloadUrl, downloadedFile.name);
    } else {
      fetchViaTransitFallback();
    }
  };

  const handleNativeShare = async () => {
    if (!downloadedFile) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        if (downloadedFile.blob) {
          const shareFile = new File([downloadedFile.blob], downloadedFile.name, {
            type: downloadedFile.type || 'application/octet-stream'
          });
          if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
            await navigator.share({
              files: [shareFile],
              title: downloadedFile.name,
              text: 'Delivered via BeamDrop P2P'
            });
            return;
          }
        }
        await navigator.share({
          title: downloadedFile.name,
          text: `Delivered via BeamDrop P2P: ${downloadedFile.name}`,
          url: downloadedFile.downloadUrl || window.location.href
        });
      } else {
        navigator.clipboard?.writeText(window.location.href);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('Native share notice:', e);
      }
    }
  };

  const getFileCategoryIcon = (mime: string, name: string) => {
    const cat = getFileCategory(mime, name);
    switch (cat) {
      case 'apk':
        return <FileArchive className="w-10 h-10 text-emerald-500" />;
      case 'ipa':
        return <FileArchive className="w-10 h-10 text-sky-500" />;
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

  const cdHours = String(Math.floor(cloudRemainingMs / (1000 * 60 * 60))).padStart(2, '0');
  const cdMinutes = String(Math.floor((cloudRemainingMs % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
  const cdSeconds = String(Math.floor((cloudRemainingMs % (1000 * 60)) / 1000)).padStart(2, '0');
  const cdProgressPct = Math.max(0, Math.min(100, (cloudRemainingMs / (24 * 60 * 60 * 1000)) * 100));

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
                {dropId ? '☁️ 24h Cloud Drop' : 'Direct Download'}
              </span>
              {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('token') && (
                <span className="text-[10px] font-mono text-emerald-700 font-bold px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300">
                  Token: #{new URLSearchParams(window.location.search).get('token')!.slice(0, 6)}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900 break-words max-w-full pt-1" title={displayName}>
              {displayName}
            </h1>
            <div className="flex items-center justify-center space-x-2 text-xs text-slate-500 font-mono pt-0.5">
              {displaySize > 0 && <span className="font-semibold text-slate-700">{formatBytes(displaySize)}</span>}
              {displaySize > 0 && <span>•</span>}
              <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 inline text-emerald-600" />
                <span>{dropId ? 'SHA-256 Verified 24h Vault' : 'Encrypted P2P Link'}</span>
              </span>
            </div>
          </div>

          {/* 24h Cloud Drop Live Countdown Clock HUD */}
          {dropId && cloudMeta && !cloudExpired && (
            <div className="bg-gradient-to-br from-sky-50/95 to-blue-50/90 border border-sky-300/80 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider">
                <span className="text-sky-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Auto-Purge Countdown</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {cloudMeta.storageMode === 'gdrive' ? 'GOOGLE DRIVE 24H' : 'HYBRID CLOUD 24H'}
                </span>
              </div>

              <div className="flex items-center justify-center gap-2 font-mono">
                <div className="bg-slate-900 text-sky-400 px-3 py-2 rounded-xl min-w-[60px] text-center shadow-inner">
                  <div className="text-lg font-extrabold leading-none">{cdHours}</div>
                  <div className="text-[8px] text-slate-400 uppercase tracking-widest mt-1">Hours</div>
                </div>
                <span className="text-slate-700 font-black text-base">:</span>
                <div className="bg-slate-900 text-sky-400 px-3 py-2 rounded-xl min-w-[60px] text-center shadow-inner">
                  <div className="text-lg font-extrabold leading-none">{cdMinutes}</div>
                  <div className="text-[8px] text-slate-400 uppercase tracking-widest mt-1">Mins</div>
                </div>
                <span className="text-slate-700 font-black text-base">:</span>
                <div className="bg-slate-900 text-sky-400 px-3 py-2 rounded-xl min-w-[60px] text-center shadow-inner">
                  <div className="text-lg font-extrabold leading-none">{cdSeconds}</div>
                  <div className="text-[8px] text-slate-400 uppercase tracking-widest mt-1">Secs</div>
                </div>
              </div>

              <div className="w-full h-1.5 bg-sky-200/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-sky-500 to-amber-500 transition-all duration-1000"
                  style={{ width: `${cdProgressPct.toFixed(1)}%` }}
                />
              </div>

              {cloudMeta.sha256 && (
                <div className="text-[10px] font-mono text-emerald-800 bg-emerald-100/80 border border-emerald-300/70 rounded-lg px-2.5 py-1 inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>SHA-256: {cloudMeta.sha256.slice(0, 16)}...</span>
                </div>
              )}
            </div>
          )}

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
          {!currentFile && !downloadedFile && !cloudMeta && connectionStatus !== 'error' && (
            <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-4 text-center space-y-2">
              <div className="w-8 h-8 mx-auto rounded-full bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
              <p className="text-xs text-slate-600 font-medium">
                {dropId
                  ? 'Verifying 24h Cloud Drop Vault...'
                  : connectionStatus === 'connected'
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

          {/* Complete Success Alert with SHA-256 Cryptographic Verification */}
          {downloadedFile && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 text-xs text-left shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-900">Saved to Downloads!</p>
                    <p className="text-slate-600 text-[11px]">
                      File transferred directly with zero server storage.
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                  MATCH 100%
                </span>
              </div>

              {downloadedFile.checksum && (
                <div className="bg-white/80 rounded-xl p-2 border border-emerald-200 flex items-center justify-between gap-2 font-mono text-[10px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-slate-500 font-semibold shrink-0">SHA-256:</span>
                    <span className="text-slate-800 truncate" title={downloadedFile.checksum}>
                      {downloadedFile.checksum.slice(0, 16)}...{downloadedFile.checksum.slice(-8)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(downloadedFile.checksum || '')}
                    className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[9px] font-bold cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Giant Primary Download Action Button (Always Active for immediate download) */}
          <button
            onClick={handleManualDownloadClick}
            disabled={isTransitFetching}
            className="w-full py-4 px-6 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-2xl text-sm font-bold shadow-xl shadow-sky-500/25 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Download className="w-5 h-5" />
            <span>
              {downloadedFile
                ? `Save Again (${formatBytes(downloadedFile.size)})`
                : currentFile
                ? `Streaming (${currentFile.progress}%)...`
                : isTransitFetching
                ? 'Fetching file...'
                : `Download File (${formatBytes(displaySize)})`}
            </span>
          </button>

          {/* 1-Tap Native Mobile Share Sheet Button */}
          {downloadedFile && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full py-3.5 px-6 bg-white hover:bg-emerald-50 border-2 border-emerald-400 text-emerald-800 rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-500/10 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-emerald-600" />
              <span>Share to Apps (WhatsApp, Telegram, Photos...)</span>
            </button>
          )}

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
          <p className="text-[11px] text-slate-500 font-mono pt-2 border-t border-sky-100 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>Direct Device-to-Device Stream • Zero Cloud Storage</span>
          </p>
        </div>
      </main>
    </div>
  );
};
