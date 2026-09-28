import React, { useState, useRef } from 'react';
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
  RotateCcw
} from 'lucide-react';
import { P2PTransferManager } from '../utils/p2p';
import { QrDisplay } from './QrDisplay';
import { formatBytes, formatSpeed, getFileCategory } from '../utils/formatters';
import { playChime } from '../utils/audio';

interface SenderViewProps {
  transferManager: P2PTransferManager;
  receiverBaseUrl: string;
}

export const SenderView: React.FC<SenderViewProps> = ({
  transferManager,
  receiverBaseUrl
}) => {
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isQrGenerated, setIsQrGenerated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'files' | 'text'>('files');
  const [textPayload, setTextPayload] = useState<string>('');
  const [directQrMode, setDirectQrMode] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [currentTransfer, setCurrentTransfer] = useState<{
    fileName: string;
    progress: number;
    speed: number;
    fileSize: number;
  } | null>(null);
  const [transferCompleted, setTransferCompleted] = useState<boolean>(false);
  const [sentHistory, setSentHistory] = useState<{ name: string; size: number; time: string; type: string }[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Default to Vercel production URL or current preview URL
  const targetBaseUrl = receiverBaseUrl.includes('vercel.app')
    ? receiverBaseUrl
    : 'https://beam-drop-mu.vercel.app';

  const firstFile = stagedFiles[0];
  const fileParams = firstFile
    ? `&name=${encodeURIComponent(firstFile.name)}&size=${firstFile.size}&mime=${encodeURIComponent(firstFile.type || '')}`
    : '';

  const receiverUrl = activeTab === 'files' && firstFile
    ? `${targetBaseUrl}/download?peer=${transferManager.myPeerId}${fileParams}`
    : `${targetBaseUrl}/?peer=${transferManager.myPeerId}&mode=receive`;

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
  };

  const handleGenerateQr = () => {
    if (stagedFiles.length === 0 && !textPayload.trim()) return;
    setIsQrGenerated(true);
    setTransferCompleted(false);
    playChime('connect');
  };

  // Start sending files over WebRTC
  const startSendFiles = async () => {
    if (!transferManager.isConnected) {
      alert('Please scan the QR code with your phone or remote device first to connect!');
      return;
    }

    if (stagedFiles.length === 0) return;

    setIsSending(true);

    for (const file of stagedFiles) {
      try {
        setCurrentTransfer({
          fileName: file.name,
          progress: 0,
          speed: 0,
          fileSize: file.size
        });

        await transferManager.sendFile(file, (progress, speed) => {
          setCurrentTransfer((prev) =>
            prev ? { ...prev, progress, speed } : null
          );
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
      } catch (err: any) {
        console.error('File transfer failed:', err);
        alert('File transfer failed: ' + err.message);
        break;
      }
    }

    playChime('complete');
    setIsSending(false);
    setCurrentTransfer(null);
    setTransferCompleted(true);
  };

  const sendTextPayload = () => {
    if (!textPayload.trim()) return;

    if (!transferManager.isConnected) {
      alert('Please scan the QR code with your phone first!');
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
      setTextPayload('');
      setTransferCompleted(true);
    }
  };

  const copyPairLink = () => {
    navigator.clipboard.writeText(receiverUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getFileIcon = (mime: string, name: string) => {
    const cat = getFileCategory(mime, name);
    switch (cat) {
      case 'image': return <Image className="w-5 h-5 text-emerald-400" />;
      case 'video': return <Film className="w-5 h-5 text-purple-400" />;
      case 'audio': return <Music className="w-5 h-5 text-pink-400" />;
      case 'archive': return <FileArchive className="w-5 h-5 text-amber-400" />;
      case 'code': return <Code className="w-5 h-5 text-cyan-400" />;
      default: return <FileText className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: File Staging & Transfer Controls */}
      <div className="lg:col-span-7 space-y-5">
        {/* Mode Selector */}
        <div className="bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl flex items-center space-x-1 shadow-sm">
          <button
            onClick={() => setActiveTab('files')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'files'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Send Media / Files (Photos, 4K Video, ZIP)</span>
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'text'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Quick Text / Links</span>
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
              className="relative border-2 border-dashed border-slate-700/80 hover:border-cyan-500/80 bg-slate-900/60 hover:bg-cyan-950/10 rounded-3xl p-8 text-center cursor-pointer transition-all duration-200 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="*/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all shadow-inner">
                <UploadCloud className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-semibold text-slate-100">
                Drop ANY file, photo, 4K video, or folder here
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Direct streaming from RAM over WebRTC. Zero server storage, zero upload wait.
              </p>
            </div>

            {/* Staged Files Preview */}
            {stagedFiles.length > 0 && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-800">
                  <span className="font-semibold text-slate-200 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    <span>Staged Files ({stagedFiles.length})</span>
                  </span>
                  <div className="flex items-center space-x-3">
                    <span className="text-cyan-400 font-mono font-semibold">
                      {formatBytes(stagedFiles.reduce((acc, f) => acc + f.size, 0))} total
                    </span>
                    <button
                      onClick={clearStaging}
                      className="text-slate-500 hover:text-rose-400 text-[11px] transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="max-h-52 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {stagedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50 hover:border-slate-600 transition-colors text-xs"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                          {getFileIcon(file.type, file.name)}
                        </div>
                        <div className="truncate">
                          <p className="font-medium text-slate-200 truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-400">{formatBytes(file.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(idx);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Primary CTA: Generate QR Code Portal */}
                {!isQrGenerated ? (
                  <button
                    onClick={handleGenerateQr}
                    className="w-full py-3.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-2xl shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center space-x-2 active:scale-95"
                  >
                    <Zap className="w-4 h-4 fill-current" />
                    <span>⚡ Generate QR Code for this Upload</span>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={startSendFiles}
                      disabled={isSending}
                      className={`w-full py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-xl ${
                        transferManager.isConnected
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-white shadow-emerald-500/25 active:scale-95'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
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
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-3">
              <label className="text-xs font-semibold text-slate-200">
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
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl p-3.5 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500 transition-colors resize-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={directQrMode}
                    onChange={(e) => setDirectQrMode(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Encode raw text in QR (Offline camera read)</span>
                </label>
                <button
                  onClick={handleGenerateQr}
                  disabled={!textPayload.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-md shadow-cyan-500/20"
                >
                  ⚡ Generate QR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live Streaming Transfer Progress Card */}
        {currentTransfer && (
          <div className="p-5 bg-gradient-to-r from-cyan-950/80 via-slate-900 to-blue-950/80 border-2 border-cyan-500/50 rounded-3xl shadow-xl shadow-cyan-950/30 space-y-3 animate-pulse-slow">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 min-w-0">
                <Radio className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
                <span className="font-bold text-white truncate max-w-[260px]">
                  {currentTransfer.fileName}
                </span>
              </div>
              <span className="font-mono text-cyan-400 font-bold">
                {formatSpeed(currentTransfer.speed)}
              </span>
            </div>

            <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden p-0.5 border border-cyan-500/30">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 rounded-full transition-all duration-150"
                style={{ width: `${currentTransfer.progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Streaming P2P DataChannel ({currentTransfer.progress}%)</span>
              <span>
                {formatBytes((currentTransfer.fileSize * currentTransfer.progress) / 100)} / {formatBytes(currentTransfer.fileSize)}
              </span>
            </div>
          </div>
        )}

        {/* Transfer Complete Card */}
        {transferCompleted && (
          <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-3xl p-5 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold text-white">Transfer Complete!</p>
                <p className="text-[11px] text-slate-400">File streamed directly and saved to device.</p>
              </div>
            </div>
            <button
              onClick={clearStaging}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Send Another</span>
            </button>
          </div>
        )}
      </div>

      {/* Right Column: Dynamic QR Portal */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 text-center shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-left">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">Phone Pairing</p>
                <p className="text-[10px] text-slate-400 font-mono">Direct WebRTC</p>
              </div>
            </div>

            <div
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
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
              <span>{transferManager.isConnected ? 'Phone Connected' : 'Waiting for Scan'}</span>
            </div>
          </div>

          {/* QR Display */}
          <div className="py-2 flex flex-col items-center">
            <QrDisplay
              value={qrValue}
              size={200}
              label="Vercel Web Receiver QR"
              sublabel="Scan with phone camera to trigger auto-download"
            />
          </div>

          {/* Vercel Host & Session ID */}
          <div className="bg-slate-950/80 rounded-2xl p-3.5 border border-slate-800/80 text-left space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Target Portal:</span>
              <span className="font-mono text-cyan-400 truncate max-w-[200px]">
                {targetBaseUrl}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={receiverUrl}
                className="bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono rounded-lg px-2.5 py-1.5 flex-1 select-all focus:outline-none"
              />
              <button
                onClick={copyPairLink}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center space-x-1 shrink-0 transition-colors"
              >
                {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-center space-x-4 text-[11px] text-slate-400">
            <div className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Direct P2P Stream</span>
            </div>
            <span>•</span>
            <div>Zero Cloud Storage</div>
          </div>
        </div>
      </div>
    </div>
  );
};
