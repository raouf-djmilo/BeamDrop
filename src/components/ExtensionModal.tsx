import React, { useState } from 'react';
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

      // Fetch dynamic files from server
      const fileList = [
        'manifest.json',
        'popup.html',
        'popup.js',
        'style.css',
        'background.js',
        'options.html',
        'options.js'
      ];

      for (const fname of fileList) {
        try {
          const res = await fetch('/extension/' + fname);
          if (res.ok) {
            let content = await res.text();
            // Ensure configured Web Receiver URL is embedded
            if (fname === 'popup.js' || fname === 'background.js') {
              content = content.replace(/https:\/\/beam-drop-mu\.vercel\.app/g, targetReceiverUrl);
            }
            const fileHandle = await dirHandle.getFileHandle(fname, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
          }
        } catch (e) {
          console.warn('Skipped non-essential file:', fname);
        }
      }

      // Handle icons subfolder
      try {
        const iconsDirHandle = await dirHandle.getDirectoryHandle('icons', { create: true });
        const iconFiles = ['icon16.png', 'icon48.png', 'icon128.png', 'icon-16.png', 'icon-48.png', 'icon-128.png', 'icon.svg'];
        for (const iconName of iconFiles) {
          try {
            const iconRes = await fetch('/extension/icons/' + iconName);
            if (iconRes.ok) {
              const blob = await iconRes.blob();
              const iconFileHandle = await iconsDirHandle.getFileHandle(iconName, { create: true });
              const iconWritable = await iconFileHandle.createWritable();
              await iconWritable.write(blob);
              await iconWritable.close();
            }
          } catch (_) {}
        }
      } catch (_) {}

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
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="liquid-glass-card rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 cursor-default border border-white/10 shadow-2xl relative overflow-hidden"
      >
        {/* Glow backdrop accent */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Chrome className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold text-white">BeamDrop Chrome Extension</h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-bold">
                  v{APP_VERSION.full}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">Desktop Instant Pair & Beam Companion</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1-Click Unpacker Section */}
        {!unpackedSuccess ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 space-y-2">
              <div className="flex items-center space-x-2 text-cyan-300 text-xs font-bold">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Zero-ZIP Direct Folder Extraction</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Click the button below to pick or create an empty folder on your PC. The browser will unpack all extension files directly into it ready for Chrome.
              </p>
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleDirectFolderUnpack}
              disabled={isUnpacking}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-sm shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center space-x-2.5 active:scale-98 cursor-pointer"
            >
              <FolderOpen className="w-5 h-5" />
              <span>
                {isUnpacking ? 'Writing Unpacked Files...' : '📁 1-Click Unpack into Folder (Zero-ZIP)'}
              </span>
            </button>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Fallback traditional ZIP download */}
            <div className="pt-2 text-center">
              <a
                href="/extension.zip"
                download="beamdrop-extension.zip"
                className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors font-mono"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download traditional .ZIP archive instead</span>
              </a>
            </div>
          </div>
        ) : (
          /* Step-by-Step Installation Visual Guide */
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 flex items-center space-x-3 text-emerald-300 text-xs font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold">Folder Unpacked Successfully!</p>
                <p className="text-[11px] text-emerald-200/80 font-mono mt-0.5">
                  Saved into: <strong>{folderName}</strong>
                </p>
              </div>
            </div>

            {/* 3-Step Guided Visual Cards */}
            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start space-x-3">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </span>
                <div className="flex-1">
                  <p className="font-bold text-white">Open Extensions Manager</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">Type chrome://extensions in a new browser tab.</p>
                  <button
                    onClick={copyExtensionsUrl}
                    className="mt-2 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-[10px] font-mono flex items-center space-x-1.5 cursor-pointer"
                  >
                    {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedUrl ? 'Copied chrome://extensions' : 'Copy chrome://extensions URL'}</span>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start space-x-3">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </span>
                <div>
                  <p className="font-bold text-white">Enable Developer Mode</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">Toggle the switch in the top-right corner of the extensions page.</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start space-x-3">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-xs">
                  3
                </span>
                <div>
                  <p className="font-bold text-white">Click 'Load Unpacked'</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">Select the unpacked folder: <strong>{folderName}</strong></p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <button
                onClick={() => setUnpackedSuccess(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Unpack to another folder
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer shadow-lg shadow-cyan-500/20"
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
