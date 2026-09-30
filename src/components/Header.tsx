import React from 'react';
import {
  Zap,
  Radio,
  Building2,
  Smartphone,
  Info,
  ShieldCheck,
  Cpu,
  Chrome,
  Download
} from 'lucide-react';
import { useTransfer } from '../context/TransferContext';
import { APP_VERSION } from '../config/version';

export type MainTab = 'sender' | 'radar' | 'workspaces' | 'receiver';

interface HeaderProps {
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  onOpenExtensionModal: () => void;
  showArchitectureModal: boolean;
  setShowArchitectureModal: (show: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenExtensionModal,
  showArchitectureModal,
  setShowArchitectureModal
}) => {
  const { isConnected, connectedPeers, isQueueSending, currentTransfer } = useTransfer();
  const peerCount = connectedPeers.length;

  const tabs: Array<{ id: MainTab; label: string; icon: React.ReactNode }> = [
    { id: 'sender', label: 'Direct Beam', icon: <Zap className="w-4 h-4" /> },
    { id: 'radar', label: 'Mesh Radar', icon: <Radio className="w-4 h-4 text-emerald-400" /> },
    { id: 'workspaces', label: 'Workspaces', icon: <Building2 className="w-4 h-4 text-indigo-400" /> },
    { id: 'receiver', label: 'Receiver', icon: <Smartphone className="w-4 h-4 text-cyan-400" /> }
  ];

  return (
    <>
      {/* Floating Centered Liquid Glass Capsule Header (Permanent zero scrollbar, overflow-hidden) */}
      <header className="sticky top-4 z-40 w-full px-3 sm:px-6 pointer-events-none mb-6">
        <div className="max-w-5xl mx-auto pointer-events-auto">
          <div className="bg-white/80 backdrop-blur-2xl border border-white/95 rounded-full px-3 sm:px-5 py-2 flex items-center justify-between gap-2 sm:gap-4 shadow-[0_12px_36px_rgba(2,132,199,0.12)] overflow-hidden">
            
            {/* Brand Mark (Glowing Electric Cyan) */}
            <div
              onClick={() => setActiveTab('sender')}
              className="flex items-center space-x-2.5 cursor-pointer group shrink-0"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 via-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/25 group-hover:scale-105 transition-transform">
                <Zap className="w-4 h-4 text-white fill-white" />
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                  BeamDrop
                </span>
                <span className="hidden sm:inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200">
                  v{APP_VERSION.full}
                </span>
              </div>
            </div>

            {/* Exactly 4 Clean Navigation Tabs (Zero Scrollbar, no-scrollbar) */}
            <nav className="flex items-center p-1 rounded-full bg-sky-100/70 border border-sky-200/80 space-x-1 no-scrollbar overflow-hidden shrink-0">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={'relative flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer shrink-0 ' + (
                      isActive
                        ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25'
                        : 'text-slate-600 hover:text-sky-700 hover:bg-white/80'
                    )}
                  >
                    {tab.icon}
                    <span className="hidden xs:inline whitespace-nowrap">{tab.label}</span>
                    {tab.id === 'radar' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse hidden sm:inline-block" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Utilities: Extension Pill Button + P2P Specs Modal */}
            <div className="flex items-center space-x-2 shrink-0">
              {/* Background Stream Pill if running in background */}
              {isQueueSending && currentTransfer && (
                <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-sky-100 border border-sky-300 text-sky-800 text-[10px] font-mono animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                  <span>Streaming {currentTransfer.progress}%</span>
                </div>
              )}

              {/* Dedicated Specular Glass Extension Pill */}
              <button
                onClick={onOpenExtensionModal}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white text-sky-700 hover:text-sky-900 border border-sky-200/80 transition-all text-xs font-semibold cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
                title="Unpack or Download Chrome Extension"
              >
                <Chrome className="w-3.5 h-3.5 text-sky-600" />
                <span className="hidden sm:inline font-mono text-[11px]">Get Extension</span>
                <span className="text-[9px] font-mono font-bold bg-sky-100 text-sky-700 px-1 py-0.2 rounded border border-sky-300">
                  v{APP_VERSION.full}
                </span>
              </button>

              {/* Connected Devices Indicator */}
              <div
                className={'hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium border ' + (
                  isConnected || peerCount > 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-sky-50 text-slate-500 border-sky-200'
                )}
              >
                <span
                  className={'w-1.5 h-1.5 rounded-full ' + (
                    isConnected || peerCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                  )}
                />
                <span>
                  {peerCount > 0 ? peerCount + ' Peer' + (peerCount > 1 ? 's' : '') : 'Ready'}
                </span>
              </div>

              {/* Architecture Info Button */}
              <button
                onClick={() => setShowArchitectureModal(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:text-sky-700 bg-white/80 hover:bg-white border border-sky-200 transition-colors cursor-pointer shadow-sm"
                title="How P2P RAM-to-RAM Works"
              >
                <Info className="w-4 h-4 text-sky-600" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Architecture Modal */}
      {showArchitectureModal && (
        <div
          onClick={() => setShowArchitectureModal(false)}
          className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white/95 backdrop-blur-2xl border border-white/95 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 cursor-default max-h-[85vh] overflow-y-auto no-scrollbar shadow-[0_25px_60px_rgba(2,132,199,0.18)]"
          >
            <div className="flex items-center justify-between pb-3 border-b border-sky-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center border border-sky-200 shadow-xs">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Liquid Glass P2P Kernel</h3>
                  <p className="text-[11px] text-sky-700 font-mono font-medium">Zero Database • Zero Cloud Bandwidth</p>
                </div>
              </div>
              <button
                onClick={() => setShowArchitectureModal(false)}
                className="w-8 h-8 rounded-full bg-sky-50 hover:bg-sky-100 flex items-center justify-center text-slate-400 hover:text-slate-800 text-xs cursor-pointer border border-sky-200/60"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
              <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-200/90 space-y-1">
                <h4 className="font-bold text-sky-900 flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-sky-600" />
                  <span>Global State Isolation & Sequential Queue</span>
                </h4>
                <p className="text-slate-600">
                  Transfers run independently in a top-level Context Store. Switching between Direct Beam, Radar, and Workspaces never interrupts an in-flight file. Multi-file uploads are dispatched sequentially to prevent DataChannel buffer exhaustion.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/90 space-y-1">
                <h4 className="font-bold text-emerald-900 flex items-center space-x-1.5">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  <span>Adaptive AIMD Sizing & Safari Watchdog</span>
                </h4>
                <p className="text-slate-600">
                  Dynamic chunk sizing scales up to 512KB on ultra-fast LANs and down to 32KB on lossy mobile networks. A 400ms Watchdog safety timer eliminates silent buffer freezes on iOS Safari.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-sky-100">
              <button
                onClick={() => setShowArchitectureModal(false)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 text-white text-xs font-semibold cursor-pointer shadow-md shadow-sky-500/20"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
