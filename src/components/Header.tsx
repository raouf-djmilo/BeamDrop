import React, { useState } from 'react';
import {
  Zap,
  Radio,
  Download,
  Share2,
  Smartphone,
  Laptop,
  FolderArchive,
  FlaskConical,
  Volume2,
  VolumeX,
  Info,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { P2PTransferManager } from '../utils/p2p';

interface HeaderProps {
  activeTab: 'sender' | 'receiver' | 'extension' | 'simulator';
  setActiveTab: (tab: 'sender' | 'receiver' | 'extension' | 'simulator') => void;
  transferManager: P2PTransferManager;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  transferManager
}) => {
  const [showArchitectureModal, setShowArchitectureModal] = useState(false);

  return (
    <>
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('sender')}>
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                <Zap className="w-5 h-5 text-white fill-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-base font-extrabold text-white tracking-tight">
                    BeamDrop
                  </h1>
                  <span className="text-[10px] font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/50 px-1.5 py-0.5 rounded">
                    P2P
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Direct Device-to-Device • Zero Cloud Storage
                </p>
              </div>
            </div>

            {/* Architecture / Info Button for mobile */}
            <div className="md:hidden flex items-center space-x-2">
              <button
                onClick={() => setShowArchitectureModal(true)}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                title="System Architecture"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation Mode Tabs */}
          <div className="flex items-center space-x-1 bg-slate-900/90 border border-slate-800 p-1 rounded-2xl overflow-x-auto">
            <button
              onClick={() => setActiveTab('sender')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeTab === 'sender'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Sender (PC)</span>
            </button>

            <button
              onClick={() => setActiveTab('receiver')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeTab === 'receiver'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Receiver (Phone)</span>
            </button>

            <button
              onClick={() => setActiveTab('extension')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeTab === 'extension'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
              <span>Chrome Extension</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 text-[9px] font-mono font-bold">
                v1.4.0
              </span>
            </button>

            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeTab === 'simulator'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
              <span>Live Simulator</span>
            </button>
          </div>

          {/* Right Action: Architecture Info Modal */}
          <div className="hidden md:flex items-center space-x-3">
            <button
              onClick={() => setShowArchitectureModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 bg-slate-900/90 border border-slate-800 hover:border-slate-700 hover:text-white transition-colors"
            >
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>How P2P Works</span>
            </button>
          </div>
        </div>
      </header>

      {/* Architecture Modal */}
      {showArchitectureModal && (
        <div
          onClick={() => setShowArchitectureModal(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 cursor-default max-h-[85vh] overflow-y-auto custom-scrollbar"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">BeamDrop P2P Architecture</h3>
                  <p className="text-[11px] text-slate-400">Zero database, zero cloud storage</p>
                </div>
              </div>
              <button
                onClick={() => setShowArchitectureModal(false)}
                className="text-slate-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 space-y-1">
                <h4 className="font-bold text-cyan-400 flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>1. Direct WebRTC DataChannel (End-to-End Encrypted)</span>
                </h4>
                <p className="text-slate-400">
                  Files (ZIP, 4K videos, photos) are broken down into 64KB binary chunks and streamed directly from RAM of device A to RAM of device B. The transfer never touches any cloud storage (AWS S3, Firebase, Supabase), which means 0$ hosting costs and 100% privacy.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/50 space-y-1">
                <h4 className="font-bold text-emerald-400 flex items-center space-x-1.5">
                  <Zap className="w-4 h-4" />
                  <span>2. LAN Local Network Speeds (30-50+ MB/s)</span>
                </h4>
                <p className="text-slate-400">
                  When the sender PC and receiver phone share the same Wi-Fi or local network, WebRTC ICE candidates negotiate a direct local IP route. Traffic stays local without consuming mobile internet data.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/50 space-y-1">
                <h4 className="font-bold text-amber-400 flex items-center space-x-1.5">
                  <Radio className="w-4 h-4" />
                  <span>3. Instant QR Code Handshake</span>
                </h4>
                <p className="text-slate-400">
                  The extension encodes the WebRTC session ID into a QR code pointing to the lightweight Web Receiver. The mobile camera opens the page without needing any app installation. Small texts can even be encoded directly into the QR code for zero-network scanning!
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/50 space-y-1">
                <h4 className="font-bold text-purple-400 flex items-center space-x-1.5">
                  <FolderArchive className="w-4 h-4" />
                  <span>4. Chrome Extension (Manifest V3)</span>
                </h4>
                <p className="text-slate-400">
                  Includes background service worker and context menu integrations ("Send selection to Phone", "Send link to Phone"), making sending any website content to mobile effortless.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowArchitectureModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
