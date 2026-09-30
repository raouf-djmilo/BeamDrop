import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Copy,
  Check,
  Download,
  Smartphone,
  Laptop,
  CheckCircle2,
  Radio,
  Share2,
  Apple,
  Sparkles,
  ShieldCheck,
  FileCheck,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  FileArchive,
  ArrowRight,
  ExternalLink,
  Camera,
  RefreshCw,
  FolderDown,
  Info
} from 'lucide-react';
import { P2PTransferManager, TransferFile, TextPayload } from '../utils/p2p';
import { formatBytes, formatSpeed, getFileTypeMeta } from '../utils/formatters';
import { playChime } from '../utils/audio';
import { downloadIosShortcut } from '../utils/shortcutGenerator';
import { MobileScannerPortal } from './MobileScannerPortal';

interface ReceiveVaultViewProps {
  transferManager: P2PTransferManager;
  onOpenMobileScanner?: () => void;
}

export const ReceiveVaultView: React.FC<ReceiveVaultViewProps> = ({
  transferManager,
  onOpenMobileScanner
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [autoDownload, setAutoDownload] = useState<boolean>(true);
  const [showScannerModal, setShowScannerModal] = useState<boolean>(false);

  // Vault Received Items History
  const [vaultFiles, setVaultFiles] = useState<TransferFile[]>([]);
  const [currentIncomingFile, setCurrentIncomingFile] = useState<TransferFile | null>(null);

  // Generate Crypto-Style Receive Address format e.g. BD-8F29-4B01
  const peerId = transferManager.myPeerId || 'initializing';
  const shortPeer = peerId.replace('beam-', '').toUpperCase();
  const cryptoAddress = `BD-${shortPeer.slice(0, 4)}-${shortPeer.slice(4, 8) || 'ADDR'}-${shortPeer.slice(8, 12) || 'VAULT'}`;

  // Direct Mobile Scan Link
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://beam-drop-mu.vercel.app';
  const directMobileUrl = `${currentOrigin}/?mode=scan&peer=${peerId}`;

  // Render high-res QR Code
  useEffect(() => {
    if (!peerId || peerId === 'initializing') return;

    QRCode.toDataURL(directMobileUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0369a1', // Deep ocean/sky blue for high contrast
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate Receive QR code:', err));
  }, [peerId, directMobileUrl]);

  // Listen for incoming files via transferManager
  useEffect(() => {
    transferManager.onFileReceiveStart = (file: TransferFile) => {
      setCurrentIncomingFile(file);
    };

    transferManager.onFileProgress = (_fileId: string, progress: number, speed: number) => {
      setCurrentIncomingFile((prev) => prev ? { ...prev, progress, speed } : null);
    };

    transferManager.onFileReceiveComplete = (file: TransferFile) => {
      setCurrentIncomingFile(null);
      setVaultFiles((prev) => [file, ...prev]);
      playChime('complete');

      if (autoDownload && file.blob) {
        const url = URL.createObjectURL(file.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    };
  }, [transferManager, autoDownload]);

  const copyAddress = () => {
    navigator.clipboard.writeText(cryptoAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(directMobileUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const downloadFile = (file: TransferFile) => {
    if (!file.blob) return;
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const downloadAllVaultFiles = () => {
    vaultFiles.forEach((f, idx) => {
      setTimeout(() => downloadFile(f), idx * 250);
    });
  };

  const getFileIcon = (mime: string, name: string) => {
    if (mime?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(name)) {
      return <ImageIcon className="w-5 h-5 text-sky-600" />;
    }
    if (mime?.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(name)) {
      return <Film className="w-5 h-5 text-indigo-600" />;
    }
    if (mime?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(name)) {
      return <Music className="w-5 h-5 text-pink-600" />;
    }
    if (/\.(zip|tar|gz|7z|rar)$/i.test(name)) {
      return <FileArchive className="w-5 h-5 text-amber-600" />;
    }
    return <FileText className="w-5 h-5 text-blue-600" />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hero Liquid Glass Receive Card */}
      <div className="bg-white/85 backdrop-blur-2xl border border-white/95 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(2,132,199,0.1)] relative overflow-hidden">
        {/* Specular Ambient Glow */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-sky-200/50 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
          {/* Left: Info & Wallet-Style Receive Address */}
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-semibold border border-sky-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Permanent Receive Address • Live Vault</span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Scan to Beam to this Device
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-md">
                Works like a crypto wallet address for your files. Point any iPhone, Android, or mobile camera to beam media directly into this PC.
              </p>
            </div>

            {/* Crypto Wallet-Style Address Box */}
            <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200/90 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                <span className="uppercase tracking-wider font-mono">BeamDrop Address ID</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Online &amp; Listening
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-sky-200 shadow-xs">
                <code className="text-xs sm:text-sm font-mono font-bold text-sky-900 truncate">
                  {cryptoAddress}
                </code>
                <button
                  onClick={copyAddress}
                  className="px-2.5 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors shrink-0"
                >
                  {copiedAddress ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAddress ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Quick Settings & Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer select-none bg-white/80 px-3 py-1.5 rounded-xl border border-sky-200 shadow-xs">
                <input
                  type="checkbox"
                  checked={autoDownload}
                  onChange={(e) => setAutoDownload(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-0 cursor-pointer"
                />
                <span>Auto-save incoming media to PC</span>
              </label>

              <button
                onClick={copyLink}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-sky-800 border border-sky-200 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Share Link'}</span>
              </button>
            </div>
          </div>

          {/* Right: High-Res QR Code Card */}
          <div className="shrink-0 flex flex-col items-center">
            <div className="p-4 bg-white rounded-3xl border-2 border-sky-200 shadow-[0_12px_36px_rgba(2,132,199,0.12)] relative group">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Receive QR Address"
                  className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl object-contain transition-transform group-hover:scale-102"
                />
              ) : (
                <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl bg-sky-50 flex items-center justify-center animate-pulse">
                  <QrCode className="w-12 h-12 text-sky-400" />
                </div>
              )}

              {/* Center Micro Badge */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-lg border-2 border-white text-white font-bold text-xs pointer-events-none">
                ⚡
              </div>
            </div>
            <p className="text-[11px] font-mono text-slate-500 font-semibold mt-2.5">
              Point iPhone or Android Camera
            </p>
          </div>
        </div>
      </div>

      {/* Live Incoming Streaming Card (if receiving right now) */}
      {currentIncomingFile && (
        <div className="bg-white/95 backdrop-blur-2xl border-2 border-sky-400 rounded-3xl p-5 shadow-[0_16px_45px_rgba(2,132,199,0.16)] space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center border border-sky-200 shadow-xs">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono font-bold text-sky-700">Receiving Live Stream</p>
                <h3 className="text-sm font-bold text-slate-900 truncate max-w-[320px]">
                  {currentIncomingFile.name}
                </h3>
              </div>
            </div>
            <span className="text-sm font-mono font-bold text-sky-700">{currentIncomingFile.progress}%</span>
          </div>

          <div className="w-full h-3 bg-sky-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all duration-150 rounded-full"
              style={{ width: `${currentIncomingFile.progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-slate-600 font-semibold">
            <span>{formatBytes(currentIncomingFile.size)}</span>
            <span>{formatSpeed(currentIncomingFile.speed)}</span>
          </div>
        </div>
      )}

      {/* Apple iOS Shortcut & Mobile Scanner Gateway Hub */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Card 1: Apple iOS Shortcut (iPhone Share Sheet) */}
        <div className="bg-white/85 backdrop-blur-2xl border border-white/95 rounded-3xl p-6 shadow-[0_16px_40px_rgba(2,132,199,0.06)] flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-700 flex items-center justify-center text-white shadow-md">
                <Apple className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Apple iOS Shortcut</h3>
                <p className="text-xs text-slate-500">1-Tap Share from iPhone Photos &amp; Files</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Install the official <strong>BeamDrop to PC</strong> Apple Shortcut. Whenever you are in iPhone Photos or Files, tap <strong>Share → BeamDrop</strong> to open camera scanner and beam to this PC!
            </p>

            {/* 3 Step Visual Mini Guide */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center space-x-2 text-slate-700">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-[10px] shrink-0">1</span>
                <span>Download &amp; add shortcut on your iPhone</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-700">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-[10px] shrink-0">2</span>
                <span>Select photos/videos → Tap Share → "BeamDrop"</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-700">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-[10px] shrink-0">3</span>
                <span>Camera scans PC QR Address → Transferred!</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => downloadIosShortcut(currentOrigin)}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 text-white font-bold text-xs shadow-md shadow-slate-900/20 flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-98"
          >
            <Download className="w-4 h-4" />
            <span>📲 Download "BeamDrop to PC" iOS Shortcut</span>
          </button>
        </div>

        {/* Card 2: Mobile Camera Scanner Portal (Android & iPhone) */}
        <div className="bg-white/85 backdrop-blur-2xl border border-white/95 rounded-3xl p-6 shadow-[0_16px_40px_rgba(2,132,199,0.06)] flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Mobile Camera Scanner</h3>
                <p className="text-xs text-slate-500">Scan &amp; Send from any Smartphone</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Open the interactive mobile camera viewfinder on your phone to scan another screen or test real-time P2P beaming right from your browser.
            </p>

            <div className="p-3 rounded-2xl bg-sky-50/80 border border-sky-200 text-xs text-sky-900 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span>Zero Installation Required</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Works seamlessly in Safari, Chrome, Edge, and Samsung Internet.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowScannerModal(true)}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 text-white font-bold text-xs shadow-md shadow-sky-500/20 flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-98"
          >
            <Camera className="w-4 h-4" />
            <span>📷 Launch Mobile Camera Scanner View</span>
          </button>
        </div>
      </div>

      {/* Received Vault History List */}
      <div className="bg-white/85 backdrop-blur-2xl border border-white/95 rounded-3xl p-6 sm:p-7 shadow-[0_16px_40px_rgba(2,132,199,0.06)] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-sky-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
              📥
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Received Media Vault ({vaultFiles.length})
              </h3>
              <p className="text-[11px] text-slate-500">Files and photos received through your QR Address</p>
            </div>
          </div>

          {vaultFiles.length > 0 && (
            <button
              onClick={downloadAllVaultFiles}
              className="px-3 py-1.5 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors"
            >
              <FolderDown className="w-3.5 h-3.5" />
              <span>Download All</span>
            </button>
          )}
        </div>

        {vaultFiles.length === 0 ? (
          <div className="p-8 rounded-2xl border-2 border-dashed border-sky-200/90 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center mx-auto">
              <QrCode className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-800">Your Receive Vault is Ready</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Photos, videos, and files beamed from mobile or other computers will arrive here instantly.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-sky-100 max-h-96 overflow-y-auto pr-1 space-y-1">
            {vaultFiles.map((file, idx) => (
              <div
                key={file.id || idx}
                className="py-3 px-2 flex items-center justify-between hover:bg-sky-50/60 rounded-xl transition-colors"
              >
                <div className="flex items-center space-x-3 truncate">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0 border border-sky-200/80">
                    {getFileIcon(file.type, file.name)}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-900 truncate max-w-[260px] sm:max-w-md">
                      {file.name}
                    </p>
                    <p className="text-[10px] font-mono text-slate-500">
                      {formatBytes(file.size)} • {file.type || 'Media'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => downloadFile(file)}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-xs shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Save</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile Scanner Modal Viewfinder */}
      {showScannerModal && (
        <MobileScannerPortal
          transferManager={transferManager}
          initialTargetPeer={peerId}
          onClose={() => setShowScannerModal(false)}
        />
      )}
    </div>
  );
};
