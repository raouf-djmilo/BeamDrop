import React from 'react';
import {
  Menu,
  X,
  Zap,
  Radio,
  Building2,
  BookOpen,
  Chrome,
  Camera,
  Info,
  ShieldCheck,
  Cpu,
  QrCode,
  Layers,
  ChevronRight,
  ExternalLink,
  User as UserIcon,
  LogIn,
  Crown
} from 'lucide-react';
import { useTransfer } from '../context/TransferContext';
import { useAuth } from '../context/AuthContext';
import { MainTab, TABS_CONFIG } from './Sidebar';
import { ProfileDropdown } from './ProfileDropdown';

export { type MainTab };

interface HeaderProps {
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  onOpenExtensionModal: () => void;
  onOpenMobileScanner?: () => void;
  onOpenAuthModal?: () => void;
  onOpenProfileModal?: () => void;
  onOpenPricingModal?: () => void;
  showArchitectureModal: boolean;
  setShowArchitectureModal: (show: boolean) => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenExtensionModal,
  onOpenMobileScanner,
  onOpenAuthModal,
  onOpenProfileModal,
  onOpenPricingModal,
  showArchitectureModal,
  setShowArchitectureModal,
  onToggleMobileMenu,
  isMobileMenuOpen = false
}) => {
  const { isConnected, connectedPeers, isQueueSending, currentTransfer } = useTransfer();
  const { currentUser, userProfile, userTier, dailyUsage } = useAuth();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = React.useState(false);
  const peerCount = connectedPeers.length;

  const currentTab = TABS_CONFIG.find((t) => t.id === activeTab) || TABS_CONFIG[0];
  const TabIcon = currentTab.icon;

  return (
    <>
      {/* TOP NAVIGATION BAR (Responsive: Mobile Bar with Hamburger & Desktop Breadcrumbs Bar) */}
      <header className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-2xl border-b border-sky-200/70 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* LEFT ZONE: Mobile Hamburger Button & Brand + Desktop Breadcrumbs */}
          <div className="flex items-center space-x-3">
            {/* Mobile Hamburger Button */}
            {onToggleMobileMenu && (
              <button
                type="button"
                onClick={onToggleMobileMenu}
                className="lg:hidden p-2 rounded-xl text-slate-700 hover:text-sky-700 hover:bg-sky-50 transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center border border-sky-200/60"
                aria-label="Toggle Navigation Menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5 text-sky-700" />
                ) : (
                  <Menu className="w-5 h-5 text-slate-800" />
                )}
              </button>
            )}

            {/* Mobile Brand Mark */}
            <div
              onClick={() => setActiveTab('sender')}
              className="flex lg:hidden items-center space-x-2 cursor-pointer group shrink-0"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 via-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
                <Zap className="w-4 h-4 text-white fill-white" />
              </div>
              <span className="text-sm font-black text-slate-900 leading-none tracking-tight">
                BeamDrop
              </span>
            </div>

            {/* Desktop Clean Breadcrumbs */}
            <div className="hidden lg:flex items-center space-x-2 text-xs">
              <span className="font-bold text-slate-400 tracking-tight">
                BeamDrop
              </span>
              <span className="text-slate-300">/</span>
              <div className="flex items-center space-x-2 bg-sky-50/80 text-slate-800 px-2.5 py-1 rounded-lg border border-sky-200/60 font-semibold">
                <TabIcon className="w-3.5 h-3.5 text-sky-600" />
                <span>{currentTab.label}</span>
              </div>
            </div>
          </div>

          {/* RIGHT ZONE: Status & Camera Scanner */}
          <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">
            {/* Active Streaming Pill */}
            {isQueueSending && currentTransfer && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-sky-100 border border-sky-300 text-sky-900 text-[10px] font-mono animate-pulse">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                <span className="truncate max-w-[90px] sm:max-w-[140px]">{currentTransfer.fileName}</span>
                <span className="font-bold">{currentTransfer.progress}%</span>
              </div>
            )}

            {/* Connected Peers Status Badge */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium border ${
                isConnected || peerCount > 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-sky-50 text-slate-500 border-sky-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isConnected || peerCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              <span className="hidden sm:inline">
                {peerCount > 0 ? `${peerCount} Connected` : 'Ready'}
              </span>
              <span className="sm:hidden">
                {peerCount > 0 ? `${peerCount}` : 'P2P'}
              </span>
            </div>

            {/* Mobile / Desktop Camera Scan Launcher */}
            {onOpenMobileScanner && (
              <button
                type="button"
                onClick={onOpenMobileScanner}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition-all text-xs font-semibold cursor-pointer shadow-xs active:scale-95 min-h-[36px]"
                title="Scan QR Code via Camera"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Scan QR</span>
              </button>
            )}

            {/* User Account / Profile Entry Point */}
            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileDropdownOpen((prev) => !prev)}
                  className="flex items-center space-x-2 pl-1 pr-2.5 sm:pr-3 py-1 rounded-xl bg-white hover:bg-sky-50 border border-sky-200/90 text-slate-800 transition-all cursor-pointer shadow-2xs hover:border-sky-300 min-h-[36px]"
                  title="View Account Profile & Subscription"
                >
                  <div className="w-6 h-6 rounded-full p-[1.5px] bg-gradient-to-tr from-pink-500 via-amber-400 to-sky-400 shrink-0">
                    <div className="w-full h-full rounded-full bg-sky-500 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden">
                      {userProfile?.photoURL ? (
                        <img
                          src={userProfile.photoURL}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : userProfile?.fullName ? (
                        userProfile.fullName[0].toUpperCase()
                      ) : currentUser.displayName ? (
                        currentUser.displayName[0].toUpperCase()
                      ) : (
                        'U'
                      )}
                    </div>
                  </div>
                  <div className="text-left hidden sm:flex items-center space-x-1.5 truncate leading-tight">
                    <span className="text-[11px] font-bold text-slate-800 truncate block max-w-[85px]">
                      {userProfile?.username ? `@${userProfile.username}` : userProfile?.fullName || 'Account'}
                    </span>
                    {userTier === 'pro' ? (
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider flex items-center space-x-0.5 shadow-2xs">
                        <Zap className="w-2.5 h-2.5 fill-white" />
                        <span>PRO</span>
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 text-[9px] font-bold">
                        {dailyUsage?.sendOperations || 0}/15
                      </span>
                    )}
                  </div>
                </button>

                <ProfileDropdown
                  isOpen={isProfileDropdownOpen}
                  onClose={() => setIsProfileDropdownOpen(false)}
                  onOpenProfile={() => {
                    setIsProfileDropdownOpen(false);
                    if (onOpenProfileModal) onOpenProfileModal();
                  }}
                  onOpenPricing={() => {
                    setIsProfileDropdownOpen(false);
                    if (onOpenPricingModal) onOpenPricingModal();
                  }}
                  onOpenSettings={() => {
                    setIsProfileDropdownOpen(false);
                    onOpenExtensionModal();
                  }}
                  anchorClassName="top-full right-0 mt-2"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white hover:bg-sky-50 border border-sky-200/90 text-slate-700 hover:text-sky-800 transition-all text-xs font-semibold cursor-pointer shadow-2xs hover:border-sky-300 min-h-[36px]"
                title="Sign In / Create Account (Optional)"
              >
                <UserIcon className="w-3.5 h-3.5 text-sky-600" />
                <span className="hidden sm:inline text-[11px]">Sign In</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Architecture Spec Modal */}
      {showArchitectureModal && (
        <div
          onClick={() => setShowArchitectureModal(false)}
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white/95 backdrop-blur-2xl border border-white/95 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 cursor-default max-h-[85vh] overflow-y-auto shadow-[0_25px_60px_rgba(2,132,199,0.18)]"
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
                <X className="w-4 h-4" />
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

              <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200/90 space-y-1">
                <h4 className="font-bold text-purple-900 flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-purple-600" />
                  <span>Chrome Extension Native Integration</span>
                </h4>
                <p className="text-slate-600">
                  Download or unpack the Chrome extension in 1 click. Right-click any image, video, link, or text anywhere on the web to beam it directly to your mobile phone or connected peers.
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
