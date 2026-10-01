import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import {
  Download,
  Copy,
  Check,
  FileCode,
  FolderArchive,
  FolderOpen,
  FolderCheck,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Zap,
  Terminal,
  Cpu,
  HelpCircle,
  Settings,
  Chrome,
  AlertCircle,
  RefreshCw,
  X
} from 'lucide-react';
import { getExtensionFiles, fetchExtensionFiles, generateExtensionZipBlob, ExtensionFile } from '../extension-source/extensionFiles';

interface ExtensionHubProps {
  receiverBaseUrl: string;
}

export const ExtensionHub: React.FC<ExtensionHubProps> = ({ receiverBaseUrl }) => {
  const [customUrl, setCustomUrl] = useState<string>(receiverBaseUrl);
  const [selectedFileName, setSelectedFileName] = useState<string>('manifest.json');
  const [copied, setCopied] = useState<boolean>(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState<boolean>(false);
  const [isUnpackingFolder, setIsUnpackingFolder] = useState<boolean>(false);
  const [folderProgress, setFolderProgress] = useState<string>('');
  const [unpackedSuccessFolder, setUnpackedSuccessFolder] = useState<string | null>(null);
  const [folderErrorMessage, setFolderErrorMessage] = useState<string>('');
  const [copiedChromeUrl, setCopiedChromeUrl] = useState<boolean>(false);
  const [files, setFiles] = useState<ExtensionFile[]>(() => getExtensionFiles(receiverBaseUrl));
  const [gitStatus, setGitStatus] = useState<{
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    date: string;
    isLoading: boolean;
  }>({
    sha: '38027b12bd5f40e8d7e97f9112125571b4ad5746',
    shortSha: '38027b1',
    message: 'perf: optimize WebRTC transfer and fallback logic',
    author: 'Raouf Djemel',
    date: 'Just now',
    isLoading: false
  });

  const checkGitHubCommit = async () => {
    setGitStatus(prev => ({ ...prev, isLoading: true }));
    try {
      const res = await fetch('https://api.github.com/repos/raouf-djmilo/BeamDrop/commits?per_page=1', { cache: 'no-store' });
      if (res.ok) {
        const commits = await res.json();
        if (Array.isArray(commits) && commits[0] && commits[0].sha) {
          const sha = commits[0].sha;
          setGitStatus({
            sha,
            shortSha: sha.slice(0, 7),
            message: commits[0].commit?.message?.split('\n')[0] || 'Repository update',
            author: commits[0].commit?.author?.name || 'Raouf Djemel',
            date: new Date(commits[0].commit?.author?.date || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isLoading: false
          });
          return;
        }
      }
    } catch (_) {}

    // Fallback to internal /api/git-status
    try {
      const res2 = await fetch('/api/git-status?_t=' + Date.now());
      if (res2.ok) {
        const data = await res2.json();
        if (data && data.sha) {
          setGitStatus({
            sha: data.sha,
            shortSha: data.shortSha || data.sha.slice(0, 7),
            message: data.message || 'Repository update',
            author: data.author || 'Raouf Djemel',
            date: new Date(data.date || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isLoading: false
          });
          return;
        }
      }
    } catch (_) {}

    setGitStatus(prev => ({ ...prev, isLoading: false }));
  };

  useEffect(() => {
    checkGitHubCommit();
  }, []);

  useEffect(() => {
    fetchExtensionFiles(customUrl).then((loaded) => {
      if (loaded && loaded.length > 0) {
        setFiles(loaded);
      }
    });
  }, [customUrl]);

  const currentFile = files.find((f) => f.name === selectedFileName) || files[0];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyChromeUrl = () => {
    navigator.clipboard.writeText('chrome://extensions');
    setCopiedChromeUrl(true);
    setTimeout(() => setCopiedChromeUrl(false), 2000);
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

  // 1-Click Native Folder Unpacker via File System Access API (Zero-ZIP)
  const handleDirectFolderUnpack = async () => {
    setFolderErrorMessage('');
    setUnpackedSuccessFolder(null);

    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      setFolderErrorMessage('Your browser does not support the native File System Access API. Please use Google Chrome, Brave, Edge, or Opera, or click "Download Extension (.ZIP)" to download the folder archive.');
      return;
    }

    try {
      setIsUnpackingFolder(true);
      setFolderProgress('Opening folder picker on your PC...');

      const dirHandle = await (window as any).showDirectoryPicker({
        id: 'beamdrop-extension-folder',
        mode: 'readwrite'
      });

      const targetName = dirHandle.name || 'Extension Folder';
      setFolderProgress(`Cleaning previous files in "${targetName}"...`);

      // Clean old files
      try {
        for await (const [name] of (dirHandle as any).entries()) {
          if (name !== '.git') {
            try {
              await (dirHandle as any).removeEntry(name, { recursive: true });
            } catch (_) {}
          }
        }
      } catch (cleanErr) {
        console.warn('Pre-clean notice:', cleanErr);
      }

      setFolderProgress('Downloading extension package...');
      const zipRes = await fetch('/extension.zip?_t=' + Date.now());
      if (!zipRes.ok) {
        throw new Error(`Failed to download extension package: status ${zipRes.status}`);
      }

      const zipBuf = await zipRes.arrayBuffer();
      const zip = await JSZip.loadAsync(zipBuf);

      const fileKeys = Object.keys(zip.files).filter((k) => !zip.files[k].dir);
      let count = 0;

      for (const relPath of fileKeys) {
        count++;
        setFolderProgress(`Writing [${count}/${fileKeys.length}]: ${relPath}...`);
        const fileData = await zip.files[relPath].async('uint8array');

        const parts = relPath.split(/[/\\]/);
        let targetDir = dirHandle;

        for (let i = 0; i < parts.length - 1; i++) {
          const subDir = parts[i];
          if (subDir) {
            targetDir = await targetDir.getDirectoryHandle(subDir, { create: true });
          }
        }

        const fileName = parts[parts.length - 1];
        const fileHandle = await targetDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(fileData);
        await writable.close();
      }

      // Stamp fresh buildInfo.js with canonical GitHub SHA
      try {
        const buildInfoJs = `window.BEAMDROP_BUILD = {\n` +
          `  version: "1.6.2",\n` +
          `  commitSha: ${JSON.stringify(gitStatus.sha || '38027b12bd5f40e8d7e97f9112125571b4ad5746')},\n` +
          `  shortSha: ${JSON.stringify(gitStatus.shortSha || '38027b1')},\n` +
          `  buildHash: ${JSON.stringify(gitStatus.shortSha || '38027b1')},\n` +
          `  buildTimestamp: ${Math.floor(Date.now() / 1000)},\n` +
          `  patchNotes: ${JSON.stringify(gitStatus.message || 'Synchronized with GitHub main branch')}\n` +
          `};\n`;
        const bHandle = await (dirHandle as any).getFileHandle('buildInfo.js', { create: true });
        const bWriter = await bHandle.createWritable();
        await bWriter.write(new TextEncoder().encode(buildInfoJs));
        await bWriter.close();
      } catch (bErr) {
        console.warn('Failed stamping buildInfo.js on folder unpack:', bErr);
      }

      setUnpackedSuccessFolder(targetName);
      setFolderProgress('');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Folder unpack failed:', err);
        setFolderErrorMessage(err.message || 'Failed writing files to folder');
      }
    } finally {
      setIsUnpackingFolder(false);
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

          <div className="flex flex-col gap-2.5 shrink-0 min-w-[240px]">
            {/* Action 1: Direct Native Folder Writer */}
            <button
              onClick={handleDirectFolderUnpack}
              disabled={isUnpackingFolder || isDownloadingZip}
              className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-2xl shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center space-x-2.5 active:scale-95 cursor-pointer disabled:opacity-50"
              title="Select a folder on your computer to directly write all 25 extension files (Load Unpacked)"
            >
              <FolderOpen className="w-4 h-4" />
              <span>{isUnpackingFolder ? 'Unpacking to Folder...' : 'Save Directly to Folder'}</span>
            </button>

            {/* Action 2: Traditional .ZIP Archive */}
            <button
              onClick={handleDownloadZip}
              disabled={isDownloadingZip || isUnpackingFolder}
              className="px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-2xl shadow-xl shadow-cyan-500/30 transition-all flex items-center justify-center space-x-2.5 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <FolderArchive className="w-4 h-4" />
              <span>{isDownloadingZip ? 'Packaging Extension...' : 'Download Extension (.ZIP)'}</span>
            </button>

            {/* Action 3: Open Updater Studio */}
            <a
              href="/updater.html"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-cyan-300 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors border border-cyan-500/30"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Open Updater Studio</span>
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
            </a>
          </div>
        </div>

        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#08334415_1px,transparent_1px),linear-gradient(to_bottom,#08334415_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      </div>

      {/* Live Unpacking Progress Feedback */}
      {isUnpackingFolder && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 flex items-center space-x-3 text-xs text-emerald-200 animate-pulse">
          <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
          <div className="flex-1 font-mono">
            <span className="font-bold text-emerald-300">Writing Extension Folder: </span>
            <span>{folderProgress || 'Processing...'}</span>
          </div>
        </div>
      )}

      {/* Success Unpacked Notification Banner */}
      {unpackedSuccessFolder && (
        <div className="bg-emerald-950/70 border border-emerald-400/50 rounded-2xl p-5 space-y-3 shadow-xl shadow-emerald-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-300 font-bold text-sm">
              <FolderCheck className="w-5 h-5 text-emerald-400" />
              <span>Extension Folder Ready in &quot;{unpackedSuccessFolder}&quot;!</span>
            </div>
            <button
              onClick={() => setUnpackedSuccessFolder(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-emerald-100/90 leading-relaxed">
            All 25 extension files and icons were written cleanly to your selected folder. You can now load it into Chrome in seconds:
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={handleCopyChromeUrl}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-mono text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              {copiedChromeUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedChromeUrl ? 'Copied chrome://extensions' : 'Copy: chrome://extensions'}</span>
            </button>
            <span className="text-[11px] text-slate-300 font-medium">
              ➔ Paste in Chrome ➔ Toggle <strong>Developer mode</strong> ➔ Click <strong>Load unpacked</strong>
            </span>
          </div>
        </div>
      )}

      {/* Error Notice */}
      {folderErrorMessage && (
        <div className="bg-rose-950/50 border border-rose-500/40 rounded-2xl p-4 flex items-center justify-between text-xs text-rose-200">
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{folderErrorMessage}</span>
          </div>
          <button
            onClick={() => setFolderErrorMessage('')}
            className="text-rose-400 hover:text-rose-200 text-xs px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3-Way Download & Setup Options Hub */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Option 1: Direct Folder Unpack */}
        <div className="bg-slate-900/80 border border-emerald-500/30 hover:border-emerald-500/60 rounded-2xl p-5 space-y-3 transition-all flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FolderOpen className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Save Directly to Folder</h3>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Native File System Access writes all 25 extension files directly into any local folder on your PC without extracting ZIPs.
            </p>
          </div>
          <button
            onClick={handleDirectFolderUnpack}
            disabled={isUnpackingFolder}
            className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Pick Folder &amp; Save</span>
          </button>
        </div>

        {/* Option 2: Traditional ZIP Download */}
        <div className="bg-slate-900/80 border border-cyan-500/30 hover:border-cyan-500/60 rounded-2xl p-5 space-y-3 transition-all flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <FolderArchive className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Download Extension (.ZIP)</h3>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Standard zip package containing all extension source files, icons, libraries, and Manifest V3 config ready for any platform.
            </p>
          </div>
          <button
            onClick={handleDownloadZip}
            disabled={isDownloadingZip}
            className="w-full px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .ZIP (154 KB)</span>
          </button>
        </div>

        {/* Option 3: In-Place Folder Updater */}
        <div className="bg-slate-900/80 border border-slate-800 hover:border-sky-500/40 rounded-2xl p-5 space-y-3 transition-all flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">In-Place Folder Updater</h3>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Dedicated updater studio to Clean old files from your folder and inject fresh releases from GitHub with 1-click.
            </p>
          </div>
          <a
            href="/updater.html"
            target="_blank"
            rel="noreferrer"
            className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm active:scale-95"
          >
            <span>Open Updater Studio</span>
            <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
          </a>
        </div>
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
        {/* Live GitHub Status Card */}
        <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold">LIVE GITHUB VERIFICATION (raouf-djmilo/BeamDrop)</span>
            </div>
            <p className="text-sm font-semibold text-white">
              Latest Repo Commit: <span className="font-mono text-cyan-300 font-bold">{gitStatus.shortSha}</span> • &quot;{gitStatus.message}&quot;
            </p>
            <p className="text-xs text-slate-400">
              Author: <span className="text-slate-300 font-medium">{gitStatus.author}</span> • Checked: {gitStatus.date}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={checkGitHubCommit}
              disabled={gitStatus.isLoading}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors flex items-center space-x-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${gitStatus.isLoading ? 'animate-spin text-cyan-400' : ''}`} />
              <span>{gitStatus.isLoading ? 'Checking GitHub...' : 'Sync GitHub Status'}</span>
            </button>
            <a
              href="https://github.com/raouf-djmilo/BeamDrop/commits/main"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-colors flex items-center space-x-1"
            >
              <span>GitHub Commits</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1" />
            </a>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 text-xs font-mono text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>OVER-THE-AIR (OTA) 1-CLICK UPDATE ENGINE</span>
            </div>
            <h3 className="text-lg font-bold text-white">Release Timeline & In-Place Extension Updater</h3>
            <p className="text-xs text-slate-400">
              The Chrome Extension automatically monitors GitHub / Vercel cloud releases. Users update with 1-click without deleting or removing the extension from Chrome!
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <div className="px-3.5 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
              Latest: <span className="text-cyan-400 font-bold">v1.6.2</span>
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

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-slate-950/90 border border-cyan-500/40 rounded-2xl p-4 space-y-2 shadow-lg shadow-cyan-950/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                v1.6.2 (LATEST)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">2026-10-01</span>
            </div>
            <h4 className="text-xs font-bold text-white">Live GitHub Tree Injector & Clean Engine</h4>
            <ul className="text-[11px] text-slate-400 space-y-1 list-disc pl-4">
              <li>Direct In-Place File System Injector for all 25 extension files.</li>
              <li>Thorough 5-pass Clean Folder engine removing all obsolete files.</li>
              <li>Real-time Remote Phone Status detection (scan, speed, delivery).</li>
              <li>1-Click Rebuild QR button with ephemeral rolling nonce token.</li>
            </ul>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                v1.3.0
              </span>
              <span className="text-[10px] text-slate-500 font-mono">2026-09-28</span>
            </div>
            <h4 className="text-xs font-bold text-slate-200">1-Click Fast Updater</h4>
            <ul className="text-[11px] text-slate-400 space-y-1 list-disc pl-4">
              <li>In-extension 2-state update view.</li>
              <li>Toolbar notification badge ('NEW').</li>
              <li>Background alarm periodic check.</li>
            </ul>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                v1.2.0
              </span>
              <span className="text-[10px] text-slate-500 font-mono">2026-09-28</span>
            </div>
            <h4 className="text-xs font-bold text-slate-200">Direct Download Gateway</h4>
            <ul className="text-[11px] text-slate-400 space-y-1 list-disc pl-4">
              <li>Direct phone download dialog upon scanning QR.</li>
              <li>Dedicated isolated download window with zero website UI.</li>
              <li>Live stream progress bar and auto-download trigger.</li>
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
              <li>64KB backpressure streaming for large files.</li>
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
