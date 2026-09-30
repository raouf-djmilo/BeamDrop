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
import { downloadIosShortcut, OFFICIAL_IOS_SHORTCUT_ICLOUD_URL } from '../utils/shortcutGenerator';
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
  const [shortcutQrDataUrl, setShortcutQrDataUrl] = useState<string>('');
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedShortcutUrl, setCopiedShortcutUrl] = useState<boolean>(false);
  const [autoDownload, setAutoDownload] = useState<boolean>(true);
  const [showScannerModal, setShowScannerModal] = useState<boolean>(false);
  const [showIosGuideModal, setShowIosGuideModal] = useState<boolean>(false);
  const [showAndroidGuideModal, setShowAndroidGuideModal] = useState<boolean>(false);

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

  // Render high-res QR Code for official Apple iCloud Shortcut
  useEffect(() => {
    QRCode.toDataURL(OFFICIAL_IOS_SHORTCUT_ICLOUD_URL, {
      width: 300,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => setShortcutQrDataUrl(url))
      .catch((err) => console.error('Failed to generate Shortcut QR code:', err));
  }, []);

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

  const copyShortcutLink = () => {
    navigator.clipboard.writeText(OFFICIAL_IOS_SHORTCUT_ICLOUD_URL);
    setCopiedShortcutUrl(true);
    setTimeout(() => setCopiedShortcutUrl(false), 2000);
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

          <div className="flex flex-col sm:flex-row gap-2.5">
            <a
              href={OFFICIAL_IOS_SHORTCUT_ICLOUD_URL}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 hover:from-slate-800 text-white font-bold text-xs shadow-md shadow-slate-900/20 flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-98"
            >
              <Apple className="w-4 h-4 text-sky-400" />
              <span>📲 Get Official iOS Shortcut</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70 ml-1" />
            </a>
            <button
              onClick={() => setShowIosGuideModal(true)}
              className="py-3 px-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 flex items-center justify-center space-x-1.5 cursor-pointer transition-colors"
              title="View QR Code & Setup Guide"
            >
              <QrCode className="w-3.5 h-3.5 text-slate-600" />
              <span>QR &amp; Guide</span>
            </button>
          </div>
        </div>

        {/* Card 2: Android Quick Share & Native Share Sheet */}
        <div className="bg-white/85 backdrop-blur-2xl border border-white/95 rounded-3xl p-6 shadow-[0_16px_40px_rgba(2,132,199,0.06)] flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 font-bold text-base">
                🤖
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Android Share Sheet</h3>
                <p className="text-xs text-slate-500">Share from Gallery &amp; Files in 1 Tap</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Install BeamDrop on Android in 1 tap. Whenever you are in <strong>Google Photos, Gallery, or Files</strong>, tap <strong>Share → BeamDrop</strong> to scan PC QR and transfer instantly!
            </p>

            {/* 3 Step Visual Mini Guide */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center space-x-2 text-slate-700">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0">1</span>
                <span>Install BeamDrop Web App in Chrome / Edge</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-700">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0">2</span>
                <span>Select media in Gallery/Files ➔ Tap Share ➔ "BeamDrop"</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-700">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0">3</span>
                <span>Point camera at this PC screen ➔ Transferred!</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => setShowAndroidGuideModal(true)}
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 hover:from-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/20 flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-98"
            >
              <span>🤖 Setup Android Share Sheet</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-70" />
            </button>
            <button
              onClick={() => setShowScannerModal(true)}
              className="py-3 px-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 flex items-center justify-center space-x-1.5 cursor-pointer transition-colors"
              title="Launch Camera Scanner directly"
            >
              <Camera className="w-3.5 h-3.5 text-slate-600" />
              <span>Camera</span>
            </button>
          </div>
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

      {/* iOS Shortcuts Setup Assistant Modal */}
      {showIosGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-sky-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <Apple className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold">Apple iOS Share Sheet Setup</h3>
                  <p className="text-[11px] text-slate-300">Beam from iPhone Photos &amp; Files in 1 Tap</p>
                </div>
              </div>
              <button
                onClick={() => setShowIosGuideModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
              
              {/* Method 1: Official Apple iCloud Shortcut (1-Tap Install) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-50 via-white to-blue-50 border-2 border-sky-300 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-extrabold text-slate-900">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">1</span>
                    <span className="text-sm">Official Apple iCloud Shortcut</span>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Apple Verified</span>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Cryptographically signed by Apple. Tapping below opens the native Apple Shortcuts installation sheet on your iPhone with zero security warnings.
                </p>

                {/* QR Code and Actions */}
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3.5 rounded-xl border border-sky-100">
                  {shortcutQrDataUrl && (
                    <div className="flex flex-col items-center shrink-0">
                      <img
                        src={shortcutQrDataUrl}
                        alt="Scan to Install iOS Shortcut"
                        className="w-24 h-24 rounded-lg border border-slate-200 shadow-xs"
                      />
                      <span className="text-[9px] text-slate-500 font-medium mt-1">Scan with iPhone Camera</span>
                    </div>
                  )}

                  <div className="flex-1 w-full space-y-2">
                    <a
                      href={OFFICIAL_IOS_SHORTCUT_ICLOUD_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center space-x-2 shadow-sm transition-all"
                    >
                      <Apple className="w-4 h-4 text-sky-400" />
                      <span>Install Shortcut on iPhone</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                    </a>

                    <button
                      onClick={copyShortcutLink}
                      className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      {copiedShortcutUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                      <span>{copiedShortcutUrl ? 'iCloud Link Copied!' : 'Copy iCloud Link'}</span>
                    </button>
                  </div>
                </div>

                {/* How to use after installing */}
                <div className="space-y-1.5 pt-2 text-[11px] text-slate-600 border-t border-sky-100">
                  <div className="font-bold text-slate-800 text-xs">How to use it on your iPhone:</div>
                  <div className="flex items-center space-x-2">
                    <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-[10px] shrink-0">1</span>
                    <span>Select any photo, video, or document in Photos / Files</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-[10px] shrink-0">2</span>
                    <span>Tap the <strong>Share</strong> button ➔ select <strong>BeamDrop to PC</strong></span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-[10px] shrink-0">3</span>
                    <span>Point iPhone camera at your PC screen ➔ files transfer instantly!</span>
                  </div>
                </div>
              </div>

              {/* Method 2: Zero-Install Instant Camera Scan */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 font-extrabold text-slate-900">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">2</span>
                  <span>Zero-Install Camera Scan (No Setup Needed!)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Simply open your iPhone's <strong>native Camera app</strong>, point it at the QR code on your PC screen, and tap the yellow link. Choose any photos or files to send immediately!
                </p>
              </div>

              {/* Method 3: Add to Home Screen (Safari Web App) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 font-extrabold text-slate-900">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">3</span>
                  <span>Add to Home Screen (Safari Web App)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Open this link in Safari on your iPhone, tap the Safari <strong>Share</strong> button, then select <strong>Add to Home Screen</strong>. BeamDrop will open like an App Store app!
                </p>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowIosGuideModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
              >
                Got It
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Android Share Sheet Setup Assistant Modal */}
      {showAndroidGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-white shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-lg">
                  🤖
                </div>
                <div>
                  <h3 className="text-sm font-extrabold">Android Native Share Sheet</h3>
                  <p className="text-[11px] text-emerald-200">Share from Gallery &amp; Files directly to PC</p>
                </div>
              </div>
              <button
                onClick={() => setShowAndroidGuideModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
              
              {/* Highlight Card: How Android Share Sheet works */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-teal-50 border-2 border-emerald-300 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-extrabold text-slate-900">
                    <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">1</span>
                    <span className="text-sm">Install App in Chrome (1-Tap Setup)</span>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Android Native</span>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Installing BeamDrop as a Web App registers it with Android's system share menu. You'll be able to share photos, videos, and files directly from Google Photos or Files!
                </p>

                {/* QR Code and Actions */}
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3.5 rounded-xl border border-emerald-100">
                  {qrDataUrl && (
                    <div className="flex flex-col items-center shrink-0">
                      <img
                        src={qrDataUrl}
                        alt="Scan to Open on Android"
                        className="w-24 h-24 rounded-lg border border-slate-200 shadow-xs"
                      />
                      <span className="text-[9px] text-slate-500 font-medium mt-1">Scan with Android Camera</span>
                    </div>
                  )}

                  <div className="flex-1 w-full space-y-2">
                    <p className="text-[11px] text-slate-600">
                      Open in <strong>Google Chrome</strong> or <strong>Samsung Internet</strong> on your phone:
                    </p>
                    <button
                      onClick={copyLink}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Link Copied!' : 'Copy Mobile Link'}</span>
                    </button>
                    <p className="text-[10px] text-slate-500 text-center">
                      Tap Chrome Menu (⋮) ➔ <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2: Sharing Media from Gallery/Files */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center space-x-2 font-extrabold text-slate-900">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">2</span>
                  <span>How to Share from your Android Phone</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-slate-600 pl-1">
                  <div className="flex items-center space-x-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-[10px] shrink-0">A</span>
                    <span>Open <strong>Google Photos</strong>, <strong>Gallery</strong>, or <strong>Files</strong>.</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-[10px] shrink-0">B</span>
                    <span>Select any photos, videos, zip, or files ➔ Tap <strong>Share</strong>.</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-[10px] shrink-0">C</span>
                    <span>Select <strong>BeamDrop</strong> from the app share list.</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0">D</span>
                    <span>BeamDrop opens with your files ready. Point camera at PC QR ➔ Beamed!</span>
                  </div>
                </div>
              </div>

              {/* Alternative: Instant Camera Viewfinder */}
              <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-1 text-slate-700">
                <div className="flex items-center space-x-1.5 font-bold text-xs text-sky-950">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  <span>No Setup Alternative:</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  You can also simply scan the QR code on your PC screen with your Android camera without installing anything to transfer files directly in your browser.
                </p>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowAndroidGuideModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
              >
                Got It
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
