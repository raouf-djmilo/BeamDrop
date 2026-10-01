import React from 'react';
import {
  Zap,
  QrCode,
  Radio,
  Building2,
  BookOpen,
  Chrome,
  Camera,
  X,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useTransfer } from '../context/TransferContext';

export type MainTab = 'sender' | 'receive' | 'radar' | 'workspaces' | 'notebook' | 'extension';

export interface TabConfig {
  id: MainTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const TABS_CONFIG: TabConfig[] = [
  { id: 'sender', label: 'Send', icon: Zap },
  { id: 'receive', label: 'Receive', icon: QrCode },
  { id: 'radar', label: 'Radar', icon: Radio },
  { id: 'workspaces', label: 'Rooms', icon: Building2 },
  { id: 'notebook', label: 'Notebook', icon: BookOpen },
  { id: 'extension', label: 'Extension', icon: Chrome }
];

interface SidebarProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenMobileScanner: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isMobileOpen,
  onCloseMobile,
  onOpenMobileScanner,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { isConnected, connectedPeers } = useTransfer();
  const peerCount = connectedPeers ? connectedPeers.length : 0;

  const handleTabClick = (tabId: MainTab, isMobile: boolean = false) => {
    onSelectTab(tabId);
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  const renderNavItems = (isMobile: boolean = false) => {
    return (
      <nav className="space-y-1">
        {TABS_CONFIG.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => handleTabClick(tab.id, isMobile)}
              title={isCollapsed && !isMobile ? tab.label : undefined}
              className={`w-full flex items-center rounded-xl transition-all duration-150 cursor-pointer min-h-[42px] ${
                isCollapsed && !isMobile
                  ? 'justify-center p-2.5'
                  : 'px-3 py-2.5 justify-start space-x-3'
              } ${
                isActive
                  ? 'bg-sky-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-sky-100/70 active:bg-sky-200/60 font-medium'
              }`}
            >
              <Icon
                className={`shrink-0 transition-transform ${
                  isCollapsed && !isMobile ? 'w-5 h-5' : 'w-4 h-4'
                } ${isActive ? 'text-white' : 'text-slate-500'}`}
              />
              {(!isCollapsed || isMobile) && (
                <span className="text-sm truncate leading-none">
                  {tab.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    );
  };

  return (
    <>
      {/* DESKTOP SIDEBAR: Slim (w-56) when expanded, Ultra-compact (w-16) when collapsed */}
      <aside
        className={`hidden lg:flex shrink-0 flex-col min-h-screen bg-white/90 backdrop-blur-xl border-r border-sky-200/80 sticky top-0 h-screen z-30 transition-all duration-200 ${
          isCollapsed ? 'w-16 p-2' : 'w-56 p-3'
        }`}
      >
        <div className="flex flex-col h-full justify-between">
          {/* Top Brand Bar & Collapse Toggle */}
          <div className="space-y-3">
            <div
              className={`flex items-center pb-3 border-b border-sky-100/80 ${
                isCollapsed ? 'justify-center' : 'justify-between px-1'
              }`}
            >
              {/* Brand Logo & Name */}
              <button
                type="button"
                onClick={() => onSelectTab('sender')}
                className="flex items-center space-x-2.5 cursor-pointer group text-left"
                title="BeamDrop Home"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 via-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform shrink-0">
                  <Zap className="w-4 h-4 text-white fill-white" />
                </div>
                {!isCollapsed && (
                  <span className="text-base font-extrabold text-slate-900 tracking-tight leading-none">
                    BeamDrop
                  </span>
                )}
              </button>

              {/* Collapse/Expand Toggle Button */}
              {onToggleCollapse && !isCollapsed && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-sky-50 transition-colors cursor-pointer"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* If collapsed, show re-expand button right beneath the logo */}
            {isCollapsed && onToggleCollapse && (
              <div className="flex justify-center pb-2">
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-sky-700 hover:bg-sky-100/80 transition-colors cursor-pointer"
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Navigation Menu */}
            {renderNavItems(false)}
          </div>

          {/* Bottom Controls: Clean Status Dot & Quick Scan Button */}
          <div className="space-y-2 pt-3 border-t border-sky-100/80">
            {/* Quick QR Scanner */}
            <button
              type="button"
              onClick={onOpenMobileScanner}
              title={isCollapsed ? 'Scan QR' : undefined}
              className={`w-full flex items-center rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200/80 text-xs font-semibold transition-all cursor-pointer min-h-[38px] ${
                isCollapsed ? 'justify-center p-2' : 'px-3 py-2 space-x-2'
              }`}
            >
              <Camera className="w-4 h-4 text-sky-600 shrink-0" />
              {!isCollapsed && <span className="truncate">Scan QR</span>}
            </button>

            {/* Minimal Status Dot */}
            <div
              className={`flex items-center text-[11px] text-slate-500 font-medium ${
                isCollapsed ? 'justify-center' : 'px-2 space-x-2'
              }`}
              title={isConnected || peerCount > 0 ? `${peerCount} Connected` : 'P2P Ready'}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isConnected || peerCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                }`}
              />
              {!isCollapsed && (
                <span className="truncate">
                  {isConnected || peerCount > 0 ? `${peerCount} Connected` : 'P2P Ready'}
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE HAMBURGER DRAWER (Slide-over overlay on small screens) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop blur with tap outside to dismiss */}
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
          />

          {/* Slide-in Sidebar Panel: Slim & Simple */}
          <div className="relative w-64 max-w-[80vw] h-full bg-white/95 backdrop-blur-2xl shadow-2xl p-4 flex flex-col z-50 border-r border-sky-200">
            <div className="flex items-center justify-between pb-3 border-b border-sky-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-md shadow-sky-500/20">
                  <Zap className="w-4 h-4 text-white fill-white" />
                </div>
                <span className="text-base font-extrabold text-slate-900 tracking-tight">
                  BeamDrop
                </span>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-sky-50 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 py-4 overflow-y-auto">
              {renderNavItems(true)}
            </div>

            <div className="pt-3 border-t border-sky-100">
              <button
                type="button"
                onClick={() => {
                  onOpenMobileScanner();
                  onCloseMobile();
                }}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-semibold shadow-xs"
              >
                <Camera className="w-4 h-4" />
                <span>Scan QR Code</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
