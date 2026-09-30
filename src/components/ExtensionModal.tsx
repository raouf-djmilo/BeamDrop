import React, { useState } from 'react';
import JSZip from 'jszip';
import {
  FolderArchive,
  FolderCheck,
  CheckCircle2,
  ExternalLink,
  Download,
  AlertCircle,
  FolderOpen,
  Chrome,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  X,
  Copy,
  Check
} from 'lucide-react';
import { APP_VERSION } from '../config/version';

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiverBaseUrl: string;
}

export const ExtensionModal: React.FC<ExtensionModalProps> = ({
  isOpen,
  onClose,
  receiverBaseUrl
}) => {
  const [isUnpacking, setIsUnpacking] = useState(false);
  const [unpackedSuccess, setUnpackedSuccess] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const targetReceiverUrl = receiverBaseUrl || 'https://beam-drop-mu.vercel.app';

  // 1-Click Native Folder Unpacker via File System Access API (Zero-ZIP)
  const handleDirectFolderUnpack = async () => {
    setErrorMessage('');
    if (!('showDirectoryPicker' in window)) {
      setErrorMessage('Your browser does not support the File System Access API. Please use Google Chrome, Edge, Brave, or Opera, or download the traditional .ZIP below.');
      return;
    }

    try {
      setIsUnpacking(true);
      // Prompt user to select destination folder
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });

      setFolderName(dirHandle.name || 'Selected Folder');

      // 1. Clean all existing old files in destination folder ("Remove all fiche")
      try {
        for await (const [name] of (dirHandle as any).entries()) {
          if (name !== '.git') {
            try {
              await (dirHandle as any).removeEntry(name, { recursive: true });
            } catch (_) {}
          }
        }
      } catch (cleanErr) {
        console.warn('Folder pre-clean notice:', cleanErr);
      }

      // 2. Fetch complete extension package bundle
      const zipRes = await fetch('/extension.zip?_t=' + Date.now());
      if (!zipRes.ok) {
        throw new Error(`Failed to download extension package: status ${zipRes.status}`);
      }

      const zipBuf = await zipRes.arrayBuffer();
      const zip = await JSZip.loadAsync(zipBuf);

      // 3. Write all fresh files directly to disk
      for (const relPath of Object.keys(zip.files)) {
        if (zip.files[relPath].dir) continue;
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

      setIsUnpacking(false);
      setUnpackedSuccess(true);
    } catch (err: any) {
      setIsUnpacking(false);
      if (err.name !== 'AbortError') {
        setErrorMessage(err?.message || 'Could not write files to selected folder');
      }
    }
  };

  const copyExtensionsUrl = () => {
    navigator.clipboard.writeText('chrome://extensions');
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white/90 backdrop-blur-3xl border border-white/95 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 cursor-default shadow-[0_25px_60px_rgba(2,132,199,0.18)] relative overflow-hidden"
      >
        {/* Glow backdrop accent */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-sky-300/30 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-sky-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-600">
              <Chrome className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold text-slate-900">BeamDrop Chrome Extension</h3>
                <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-300 text-[10px] font-mono font-bold">
                  v{APP_VERSION.full}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">Desktop Instant Pair & Beam Companion</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-sky-50 hover:bg-sky-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer border border-sky-200/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1-Click Unpacker Section */}
        {!unpackedSuccess ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-200 space-y-2">
              <div className="flex items-center space-x-2 text-sky-800 text-xs font-bold">
                <Sparkles className="w-4 h-4 text-sky-600" />
                <span>Zero-ZIP Direct Folder Extraction</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Click the button below to pick or create an empty folder on your PC. The browser will unpack all extension files directly into it ready for Chrome.
              </p>
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleDirectFolderUnpack}
              disabled={isUnpacking}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-blue-500 text-white font-extrabold text-sm shadow-xl shadow-sky-500/25 transition-all flex items-center justify-center space-x-2.5 active:scale-98 cursor-pointer"
            >
              <FolderOpen className="w-5 h-5" />
              <span>
                {isUnpacking ? 'Writing Unpacked Files...' : '📁 1-Click Unpack into Folder (Zero-ZIP)'}
              </span>
            </button>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Fallback traditional ZIP download */}
            <div className="pt-2 text-center">
              <a
                href="/extension.zip"
                download="beamdrop-extension.zip"
                className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-sky-700 transition-colors font-mono font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download traditional .ZIP archive instead</span>
              </a>
            </div>
          </div>
        ) : (
          /* Step-by-Step Installation Visual Guide */
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center space-x-3 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold">Folder Unpacked Successfully!</p>
                <p className="text-[11px] text-emerald-700 font-mono mt-0.5">
                  Saved into: <strong>{folderName}</strong>
                </p>
              </div>
            </div>

            {/* 3-Step Guided Visual Cards */}
            <div className="space-y-2.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 flex items-start space-x-3">
                <span className="w-6 h-6 rounded-full bg-sky-200 text-sky-800 font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </span>
                <div className="flex-1">
                  <p className="font-bold text-slate-900">Open Extensions Manager</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Type chrome://extensions in a new browser tab.</p>
                  <button
                    onClick={copyExtensionsUrl}
                    className="mt-2 px-3 py-1 rounded-lg bg-white hover:bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-mono font-semibold flex items-center space-x-1.5 cursor-pointer shadow-xs"
                  >
                    {copiedUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedUrl ? 'Copied chrome://extensions' : 'Copy chrome://extensions URL'}</span>
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 flex items-start space-x-3">
                <span className="w-6 h-6 rounded-full bg-sky-200 text-sky-800 font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </span>
                <div>
                  <p className="font-bold text-slate-900">Enable Developer Mode</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Toggle the switch in the top-right corner of the extensions page.</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 flex items-start space-x-3">
                <span className="w-6 h-6 rounded-full bg-sky-200 text-sky-800 font-bold flex items-center justify-center shrink-0 text-xs">
                  3
                </span>
                <div>
                  <p className="font-bold text-slate-900">Click 'Load Unpacked'</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Select the unpacked folder: <strong>{folderName}</strong></p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-sky-100">
              <button
                onClick={() => setUnpackedSuccess(false)}
                className="text-xs text-slate-500 hover:text-sky-700 cursor-pointer font-semibold"
              >
                Unpack to another folder
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 text-white font-bold text-xs cursor-pointer shadow-md shadow-sky-500/20"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
