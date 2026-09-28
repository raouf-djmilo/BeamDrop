import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  FileCode,
  FolderArchive,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Zap,
  Terminal,
  Cpu,
  HelpCircle,
  Settings
} from 'lucide-react';
import { getExtensionFiles, generateExtensionZipBlob, ExtensionFile } from '../extension-source/extensionFiles';

interface ExtensionHubProps {
  receiverBaseUrl: string;
}

export const ExtensionHub: React.FC<ExtensionHubProps> = ({ receiverBaseUrl }) => {
  const [customUrl, setCustomUrl] = useState<string>(receiverBaseUrl);
  const [selectedFileName, setSelectedFileName] = useState<string>('manifest.json');
  const [copied, setCopied] = useState<boolean>(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState<boolean>(false);

  const files = getExtensionFiles(customUrl);
  const currentFile = files.find((f) => f.name === selectedFileName) || files[0];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    try {
      setIsDownloadingZip(true);
      const zipBlob = await generateExtensionZipBlob(customUrl);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'BeamDrop-Chrome-Extension-ManifestV3.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Error generating zip: ' + e.message);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero Banner with Download Action */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono">
              <Sparkles className="w-3.5 h-3.5" />
              <span>OFFICIAL CHROME EXTENSION (MANIFEST V3)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              BeamDrop Extension Source & Package
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Install directly into Google Chrome, Brave, Edge, or Opera. Transfer files, links, and selections from your desktop browser to any phone with instant QR pairing and zero cloud storage.
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-slate-400 pt-1">
              <span className="flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Manifest V3 Compliant</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>WebRTC DataChannel</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Zero Server Storage</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <button
              onClick={handleDownloadZip}
              disabled={isDownloadingZip}
              className="px-6 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-2xl shadow-xl shadow-cyan-500/30 transition-all flex items-center justify-center space-x-2.5 active:scale-95 cursor-pointer"
            >
              <FolderArchive className="w-5 h-5" />
              <span>{isDownloadingZip ? 'Packaging Extension...' : 'Download Extension (.ZIP)'}</span>
            </button>
            <a
              href="#installation-guide"
              className="px-5 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-xl text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors border border-slate-700/60"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Installation Steps</span>
            </a>
          </div>
        </div>

        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#08334415_1px,transparent_1px),linear-gradient(to_bottom,#08334415_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      </div>

      {/* Extension Config & Receiver Endpoint */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2 text-slate-300">
          <Settings className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold">Configured Web Receiver URL:</span>
          <span className="text-[11px] text-slate-500">(Embedded into generated QR codes)</span>
        </div>
        <div className="flex items-center space-x-2 flex-1 max-w-md">
          <input
            type="text"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* File Explorer & Source Code Viewer */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {/* Top Bar with File Tabs */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 flex-wrap gap-2">
          <div className="flex items-center space-x-1 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
            {files.map((file) => {
              const isSelected = file.name === selectedFileName;
              return (
                <button
                  key={file.name}
                  onClick={() => setSelectedFileName(file.name)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                    isSelected
                      ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>{file.name}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleCopyCode}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy File</span>
              </>
            )}
          </button>
        </div>

        {/* File Description Banner */}
        <div className="px-5 py-2.5 bg-slate-900/95 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-cyan-400">{currentFile.path}</span>
          <span>{currentFile.description}</span>
        </div>

        {/* Code Content */}
        <div className="p-4 bg-slate-950 max-h-[500px] overflow-y-auto font-mono text-xs text-slate-200 leading-relaxed custom-scrollbar select-text">
          <pre className="whitespace-pre">
            <code>{currentFile.content}</code>
          </pre>
        </div>
      </div>

      {/* Installation Guide & Chrome Web Store deployment */}
      <div id="installation-guide" className="space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center space-x-2">
          <Terminal className="w-5 h-5 text-cyan-400" />
          <span>How to install in Chrome (Takes 30 seconds):</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-2">
            <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold text-xs font-mono">
              1
            </span>
            <h4 className="text-xs font-bold text-slate-100">Download & Extract</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              Click the <strong>Download Extension (.ZIP)</strong> button above and extract the folder to your computer.
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-2">
            <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold text-xs font-mono">
              2
            </span>
            <h4 className="text-xs font-bold text-slate-100">Open Extensions Tab</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              In Google Chrome, navigate to <code className="text-cyan-400 bg-slate-950 px-1 py-0.5 rounded font-mono">chrome://extensions</code>
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-2">
            <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold text-xs font-mono">
              3
            </span>
            <h4 className="text-xs font-bold text-slate-100">Enable Developer Mode</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              Toggle the <strong>Developer mode</strong> switch in the top right corner of the Extensions page.
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-2">
            <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold text-xs font-mono">
              4
            </span>
            <h4 className="text-xs font-bold text-slate-100">Load Unpacked</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              Click <strong>Load unpacked</strong> and select the extracted folder. BeamDrop is now installed in your browser!
            </p>
          </div>
        </div>
      </div>

      {/* Release History & OTA Update Engine */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 text-xs font-mono text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>OVER-THE-AIR (OTA) VERSION REGISTRY</span>
            </div>
            <h3 className="text-lg font-bold text-white">Release Timeline & In-Extension Update Engine</h3>
            <p className="text-xs text-slate-400">
              The Chrome Extension automatically pings your GitHub / Vercel cloud registry to notify users of new versions.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <div className="px-3.5 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
              Latest: <span className="text-cyan-400 font-bold">v1.2.0</span>
            </div>
            <a
              href="/version.json"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-medium transition-colors flex items-center space-x-1"
            >
              <span>View version.json</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950/80 border border-cyan-500/30 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                v1.2.0 (CURRENT)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">2026-09-28</span>
            </div>
            <h4 className="text-xs font-bold text-white">Direct Download & OTA Updates</h4>
            <ul className="text-[11px] text-slate-400 space-y-1 list-disc pl-4">
              <li>Direct phone download dialog upon scanning QR.</li>
              <li>Updates tab inside extension with live cloud check.</li>
              <li>1-click update ZIP package download.</li>
            </ul>
          </div>

          <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                v1.1.0
              </span>
              <span className="text-[10px] text-slate-500 font-mono">2026-09-28</span>
            </div>
            <h4 className="text-xs font-bold text-slate-200">Staging Area & Flow Control</h4>
            <ul className="text-[11px] text-slate-400 space-y-1 list-disc pl-4">
              <li>Multi-file staging before generating QR code.</li>
              <li>Backpressure streaming for large files.</li>
              <li>Offline glassmorphism UI & strict 380px sizing.</li>
            </ul>
          </div>

          <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                v1.0.0
              </span>
              <span className="text-[10px] text-slate-500 font-mono">2026-09-27</span>
            </div>
            <h4 className="text-xs font-bold text-slate-200">Initial Launch</h4>
            <ul className="text-[11px] text-slate-400 space-y-1 list-disc pl-4">
              <li>Manifest V3 Chrome Extension architecture.</li>
              <li>RAM-to-RAM WebRTC DataChannel transfer.</li>
              <li>Zero database, zero storage, high privacy.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
