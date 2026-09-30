import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  ShieldCheck,
  Download,
  AlertCircle,
  CheckCircle2,
  FileArchive,
  FileText,
  Film,
  Music,
  Image as ImageIcon,
  Zap,
  Lock,
  RefreshCw,
  Eye,
  Radio
} from 'lucide-react';
import { P2PTransferManager, TransferFile } from '../utils/p2p';
import { formatBytes, formatSpeed, getFileCategory, getFileTypeMeta } from '../utils/formatters';
import { playChime } from '../utils/audio';

interface PortalViewProps {
  portalId: string;
  expectedPeerId: string;
  expectedFileName?: string;
  expectedFileSize?: number;
  expectedFileMime?: string;
}

export const PortalView: React.FC<PortalViewProps> = ({
  portalId,
  expectedPeerId,
  expectedFileName = 'Shared File',
  expectedFileSize = 0,
  expectedFileMime = ''
}) => {
  const [timeLeftSec, setTimeLeftSec] = useState<number>(600);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'completed'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [currentFile, setCurrentFile] = useState<TransferFile | null>(null);
  const [downloadedFile, setDownloadedFile] = useState<TransferFile | null>(null);
  const [downloadTriggered, setDownloadTriggered] = useState<boolean>(false);

  const transferManager = useRef<P2PTransferManager>(new P2PTransferManager()).current;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsExpired(true);
          setConnectionStatus('error');
          setErrorMessage('This 10-minute drop portal has expired. Files auto-purged.');
          transferManager.destroy();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [transferManager]);

  useEffect(() => {
    let isMounted = true;
    document.title = 'Instant Drop Portal • ' + expectedFileName;

    if (typeof window !== 'undefined' && window.location.hash.includes('key=')) {
      const match = window.location.hash.match(/key=([0-9a-fA-F]{64})/i);
      if (match) {
        transferManager.setE2EEKeyFromHex(match[1]);
      }
    }

    transferManager.onConnected = () => {
      if (!isMounted) return;
      setConnectionStatus('connected');
      playChime('connect');
    };

    transferManager.onFileReceiveStart = (file: TransferFile) => {
      if (!isMounted) return;
      setCurrentFile(file);
    };

    transferManager.onFileProgress = (fileId: string, progress: number, speed: number) => {
      if (!isMounted) return;
      setCurrentFile((prev: any) => prev && prev.id === fileId ? { ...prev, progress, speed } : prev);
    };

    transferManager.onFileReceiveComplete = (completed: TransferFile) => {
      if (!isMounted) return;
      setCurrentFile(null);
      setDownloadedFile(completed);
      setConnectionStatus('completed');
      playChime('complete');

      if (completed.downloadUrl && !downloadTriggered) {
        setDownloadTriggered(true);
        const a = document.createElement('a');
        a.href = completed.downloadUrl;
        a.download = completed.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    };

    const myReceiverId = 'portal-rx-' + Math.random().toString(36).substring(2, 8);
    transferManager.init(myReceiverId)
      .then(() => {
        if (!isMounted) return;
        return transferManager.connect(expectedPeerId);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setConnectionStatus('error');
        setErrorMessage(err?.message || 'Failed to establish E2EE stream with portal sender');
      });

    return () => {
      isMounted = false;
      transferManager.destroy();
    };
  }, [expectedPeerId, expectedFileName, transferManager]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
  };

  const displayName = downloadedFile?.name || currentFile?.name || expectedFileName;
  const displaySize = downloadedFile?.size || currentFile?.size || expectedFileSize;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans selection:bg-cyan-500 selection:text-white">
      <div className="max-w-md w-full mx-auto space-y-4">
        <div className={'p-4 rounded-3xl border shadow-xl backdrop-blur-xl flex items-center justify-between transition-colors ' + (
          isExpired
            ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
            : timeLeftSec < 120
            ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
            : 'bg-cyan-950/60 border-cyan-500/30 text-cyan-300'
        )}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-black/40 flex items-center justify-center shrink-0 border border-white/10">
              <Clock className={'w-5 h-5 ' + (isExpired ? 'text-rose-400' : 'text-cyan-400 animate-spin-slow')} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white">
                10-Minute Ephemeral Portal
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                {isExpired ? 'Link terminated & purged' : 'Single-use encrypted drop'}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="font-mono text-xl font-extrabold tracking-tight">
              {formatTimer(timeLeftSec)}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6 text-center">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center shadow-lg relative">
            <div className="absolute inset-0 rounded-3xl border-2 border-cyan-400/30 animate-pulse pointer-events-none" />
            <FileArchive className="w-10 h-10 text-cyan-400" />
          </div>

          <div>
            <h2 className="text-base font-extrabold text-white truncate max-w-xs mx-auto">
              {displayName}
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              {displaySize > 0 ? formatBytes(displaySize) : 'Encrypted Payload'} • AES-GCM-256
            </p>
          </div>

          {currentFile && (
            <div className="space-y-2 text-left">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-cyan-400 font-bold">Streaming ({currentFile.progress}%)</span>
                <span className="text-slate-400">{formatSpeed(currentFile.speed)}</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden p-0.5 border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-150"
                  style={{ width: currentFile.progress + '%' }}
                />
              </div>
            </div>
          )}

          {connectionStatus === 'completed' && downloadedFile && (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>File Downloaded to Memory Successfully!</span>
            </div>
          )}

          {connectionStatus === 'error' && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center justify-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage || 'Connection closed.'}</span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-center gap-2">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Zero-Knowledge E2EE • Auto-Destroy on Exit</span>
          </div>
        </div>
      </div>
    </div>
  );
};
