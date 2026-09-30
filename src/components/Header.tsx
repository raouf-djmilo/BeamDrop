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
          <div className="liquid-glass-capsule rounded-full px-3 sm:px-5 py-2 flex items-center justify-between gap-2 sm:gap-4 shadow-2xl overflow-hidden">
            
            {/* Brand Mark (Glowing Electric Cyan) */}
            <div
              onClick={() => setActiveTab('sender')}
              className="flex items-center space-x-2.5 cursor-pointer group shrink-0"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-400 via-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 group-hover:scale-105 transition-transform">
                <Zap className="w-4 h-4 text-white fill-white" />
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-extrabold text-white tracking-tight">
                  BeamDrop
                </span>
                <span className="hidden sm:inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  v{APP_VERSION.full}
                </span>
              </div>
            </div>

            {/* Exactly 4 Clean Navigation Tabs (Zero Scrollbar, no-scrollbar) */}
            <nav className="flex items-center p-1 rounded-full bg-slate-950/50 border border-white/5 space-x-1 no-scrollbar overflow-hidden shrink-0">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={'relative flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer shrink-0 ' + (
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    )}
                  >
                    {tab.icon}
                    <span className="hidden xs:inline whitespace-nowrap">{tab.label}</span>
                    {tab.id === 'radar' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse hidden sm:inline-block" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Utilities: Extension Pill Button + P2P Specs Modal */}
            <div className="flex items-center space-x-2 shrink-0">
              {/* Background Stream Pill if running in background */}
              {isQueueSending && currentTransfer && (
                <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>Streaming {currentTransfer.progress}%</span>
                </div>
              )}

              {/* Dedicated Specular Glass Extension Pill */}
              <button
                onClick={onOpenExtensionModal}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-white border border-cyan-500/30 transition-all text-xs font-semibold cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
                title="Unpack or Download Chrome Extension"
              >
                <Chrome className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline font-mono text-[11px]">Get Extension</span>
                <span className="text-[9px] font-mono font-bold bg-cyan-950 px-1 py-0.2 rounded border border-cyan-800/40">
                  v{APP_VERSION.full}
                </span>
              </button>

              {/* Connected Devices Indicator */}
              <div
                className={'hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium border ' + (
                  isConnected || peerCount > 0
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-800/60 text-slate-400 border-white/5'
                )}
              >
                <span
                  className={'w-1.5 h-1.5 rounded-full ' + (
                    isConnected || peerCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                  )}
                />
                <span>
                  {peerCount > 0 ? peerCount + ' Peer' + (peerCount > 1 ? 's' : '') : 'Ready'}
                </span>
              </div>

              {/* Architecture Info Button */}
              <button
                onClick={() => setShowArchitectureModal(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                title="How P2P RAM-to-RAM Works"
              >
                <Info className="w-4 h-4 text-cyan-400" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Architecture Modal */}
      {showArchitectureModal && (
        <div
          onClick={() => setShowArchitectureModal(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="liquid-glass-card rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 cursor-default max-h-[85vh] overflow-y-auto no-scrollbar"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Liquid Glass P2P Kernel</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Zero Database • Zero Cloud Bandwidth</p>
                </div>
              </div>
              <button
                onClick={() => setShowArchitectureModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
              <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 space-y-1">
                <h4 className="font-bold text-cyan-300 flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Global State Isolation & Sequential Queue</span>
                </h4>
                <p className="text-slate-400">
                  Transfers run independently in a top-level Context Store. Switching between Direct Beam, Radar, and Workspaces never interrupts an in-flight file. Multi-file uploads are dispatched sequentially to prevent DataChannel buffer exhaustion.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <h4 className="font-bold text-emerald-300 flex items-center space-x-1.5">
                  <Zap className="w-4 h-4" />
                  <span>Adaptive AIMD Sizing & Safari Watchdog</span>
                </h4>
                <p className="text-slate-400">
                  Dynamic chunk sizing scales up to 512KB on ultra-fast LANs and down to 32KB on lossy mobile networks. A 400ms Watchdog safety timer eliminates silent buffer freezes on iOS Safari.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                onClick={() => setShowArchitectureModal(false)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold cursor-pointer"
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
