/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TransferProvider, useTransfer } from './context/TransferContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { NotificationBar } from './components/NotificationBar';
import { Header } from './components/Header';
import { Sidebar, MainTab } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { SenderView } from './components/SenderView';
import { SpiderRadarView } from './components/SpiderRadarView';
import { ReceiveVaultView } from './components/ReceiveVaultView';
import { MobileScannerPortal } from './components/MobileScannerPortal';
import { ExtensionModal } from './components/ExtensionModal';
import { DirectDownloadPortal } from './components/DirectDownloadPortal';
import { PortalView } from './components/PortalView';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { UpgradeModal } from './components/UpgradeModal';
import { PricingModal } from './components/PricingModal';
import { LockedFeatureView } from './components/LockedFeatureView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { X, Zap } from 'lucide-react';

const WorkspacesView = React.lazy(() =>
  import('./components/WorkspacesView').then((m) => ({ default: m.WorkspacesView }))
);
const NotebookView = React.lazy(() =>
  import('./components/NotebookView').then((m) => ({ default: m.NotebookView }))
);
const ExtensionHub = React.lazy(() =>
  import('./components/ExtensionHub').then((m) => ({ default: m.ExtensionHub }))
);

function resolveTabFromLocation(): MainTab {
  if (typeof window === 'undefined') return 'sender';

  try {
    // 1. Path-based check
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/receive') || path.startsWith('/vault')) return 'receive';
    if (path.startsWith('/radar') || path.startsWith('/nearby')) return 'radar';
    if (path.startsWith('/workspaces') || path.startsWith('/rooms')) return 'workspaces';
    if (path.startsWith('/notebook') || path.startsWith('/notes') || path.startsWith('/text')) return 'notebook';
    if (path.startsWith('/extension') || path.startsWith('/hub')) return 'extension';
    if (path.startsWith('/send')) return 'sender';

    // 2. Query parameter check (?tab=... or ?mode=...)
    const params = new URLSearchParams(window.location.search);
    const mode = (params.get('mode') || params.get('tab') || '').toLowerCase();
    if (mode === 'receive' || mode === 'vault') return 'receive';
    if (mode === 'radar') return 'radar';
    if (mode === 'workspaces' || mode === 'rooms') return 'workspaces';
    if (mode === 'notebook') return 'notebook';
    if (mode === 'extension') return 'extension';
    if (mode === 'sender' || mode === 'send') return 'sender';

    // 3. Hash-based check (#receive, #radar, etc.)
    const hash = window.location.hash.toLowerCase().replace(/^#/, '');
    if (hash === 'receive' || hash === 'vault') return 'receive';
    if (hash === 'radar') return 'radar';
    if (hash === 'workspaces' || hash === 'rooms') return 'workspaces';
    if (hash === 'notebook') return 'notebook';
    if (hash === 'extension') return 'extension';
    if (hash === 'send' || hash === 'sender') return 'sender';
  } catch (_) {}

  return 'sender';
}

function MainApp() {
  const { transferManager } = useTransfer();
  const { userTier } = useAuth();

  // One-time initial URL inspection for direct downloads or ephemeral portals
  const initialUrlInfo = useMemo(() => {
    if (typeof window === 'undefined') {
      return { isDownload: false, isPortal: false, peer: '', name: '', size: 0, mime: '', portalId: '' };
    }

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const peer = searchParams.get('peer') || (window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '');
      const name = decodeURIComponent(searchParams.get('name') || searchParams.get('file') || '');
      const size = parseInt(searchParams.get('size') || '0', 10);
      const mime = decodeURIComponent(searchParams.get('mime') || '');
      const mode = searchParams.get('mode');

      const path = window.location.pathname;
      const isDlPath = path.startsWith('/download') || path.startsWith('/dl');
      const isPortal = path.startsWith('/portal');
      const portalMatch = path.match(/\/portal\/([^\/]+)/);
      const portalId = portalMatch ? portalMatch[1] : '';

      const isDirectDownload = Boolean(peer && mode !== 'app' && mode !== 'full' && mode !== 'scan' && mode !== 'scanner');

      return {
        isDownload: (isDirectDownload || isDlPath) && Boolean(peer),
        isPortal: isPortal && Boolean(portalId || peer),
        peer,
        name,
        size,
        mime,
        portalId
      };
    } catch (_) {
      return { isDownload: false, isPortal: false, peer: '', name: '', size: 0, mime: '', portalId: '' };
    }
  }, []);

  // Internal state drives 100% of UI tab rendering
  const [activeTab, setActiveTab] = useState<MainTab>(() => resolveTabFromLocation());
  const [targetedPeer, setTargetedPeer] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('beamdrop_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('beamdrop_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  // Modals & PWA State
  const [showMobileScanner, setShowMobileScanner] = useState<boolean>(false);
  const [showExtensionModal, setShowExtensionModal] = useState<boolean>(false);
  const [showArchitectureModal, setShowArchitectureModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [upgradeReason, setUpgradeReason] = useState<string>('');
  const [showPricingModal, setShowPricingModal] = useState<boolean>(false);
  const [pricingReason, setPricingReason] = useState<string>('');
  const [authModalTab, setAuthModalTab] = useState<'login' | 'signup'>('login');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);

  // Auto-listen for quota exceeded events across the app (Guest -> AuthModal, Free -> PricingModal)
  useEffect(() => {
    const handleQuotaExceeded = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      const trigger = detail?.trigger || (detail?.tier === 'guest' ? 'auth_modal' : 'pricing_modal');
      const reason =
        detail?.quota?.reason ||
        detail?.reason ||
        'Daily transfer limit reached.';

      if (trigger === 'auth_modal') {
        setAuthModalTab('signup');
        setShowAuthModal(true);
      } else {
        setPricingReason(reason);
        setShowPricingModal(true);
      }
    };
    window.addEventListener('beamdrop:quota_exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('beamdrop:quota_exceeded', handleQuotaExceeded);
  }, []);

  /**
   * Refactored handleTabChange:
   * - Sets internal state synchronously so content updates immediately.
   * - Uses history.replaceState (with try/catch) to keep URL clean without
   *   triggering full page reloads, iframe resets, or unwanted navigation cycles.
   */
  const handleTabChange = useCallback((newTab: MainTab) => {
    setActiveTab(newTab);

    if (typeof window !== 'undefined') {
      try {
        const targetPath = newTab === 'sender' ? '/' : `/${newTab}`;
        if (window.location.pathname !== targetPath) {
          // Use replaceState to update the browser address without reloading or pushing endless history entries
          window.history.replaceState({ tab: newTab }, '', targetPath);
        }
      } catch (err) {
        // Fallback for sandboxed iframes without path manipulation permissions
        try {
          const targetHash = '#' + newTab;
          if (window.location.hash !== targetHash) {
            window.location.replace(window.location.pathname + targetHash);
          }
        } catch (_) {}
      }
    }
  }, []);

  // Listen for browser forward/back buttons without triggering reloads or loops
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // 1. Prefer tab recorded in history state
      if (e.state && typeof e.state.tab === 'string') {
        const stateTab = e.state.tab as MainTab;
        setActiveTab((prev) => (prev !== stateTab ? stateTab : prev));
        return;
      }

      // 2. Otherwise resolve from updated location
      const resolved = resolveTabFromLocation();
      setActiveTab((prev) => (prev !== resolved ? resolved : prev));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // PWA Install prompt listener
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const receiverBaseUrl = (typeof window !== 'undefined' && !window.location.host.includes('.run.app') && !window.location.host.includes('localhost') && !window.location.host.includes('127.0.0.1'))
    ? window.location.protocol + '//' + window.location.host
    : 'https://beam-drop-mu.vercel.app';

  // DIRECT DOWNLOAD GATEWAY (Only if loaded explicitly with download parameters)
  if (initialUrlInfo.isDownload && initialUrlInfo.peer) {
    return (
      <ErrorBoundary fallbackTitle="Direct Download Gateway Error">
        <DirectDownloadPortal
          peerId={initialUrlInfo.peer}
          expectedFileName={initialUrlInfo.name}
          expectedFileSize={initialUrlInfo.size}
          expectedFileMime={initialUrlInfo.mime}
        />
      </ErrorBoundary>
    );
  }

  // EPHEMERAL DROP PORTAL (Only if loaded explicitly with /portal path)
  if (initialUrlInfo.isPortal && (initialUrlInfo.portalId || initialUrlInfo.peer)) {
    return (
      <ErrorBoundary fallbackTitle="Ephemeral Portal Error">
        <PortalView
          portalId={initialUrlInfo.portalId || 'active'}
          expectedPeerId={initialUrlInfo.peer}
          expectedFileName={initialUrlInfo.name}
          expectedFileSize={initialUrlInfo.size}
          expectedFileMime={initialUrlInfo.mime}
        />
      </ErrorBoundary>
    );
  }

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-gradient-to-br from-sky-100 via-sky-50 to-blue-100 text-slate-900 flex font-sans selection:bg-sky-500 selection:text-white relative">
      {/* Background Soft Ambient Light Spheres (Liquid Glass Backdrop) */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-sky-300/30 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-1/4 w-[450px] h-[450px] bg-cyan-200/40 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Desktop Persistent Sidebar & Mobile Slide-Out Drawer Navigation Menu */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleTabChange}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenMobileScanner={() => setShowMobileScanner(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
        onOpenAuthModal={() => {
          setAuthModalTab('signup');
          setShowAuthModal(true);
        }}
        onOpenPricingModal={() => {
          setPricingReason('Unlock unlimited P2P transfers & priority high-speed bandwidth.');
          setShowPricingModal(true);
        }}
        onOpenProfileModal={() => setShowProfileModal(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* PWA Native Install Banner */}
        {showInstallBanner && (
          <div className="bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 px-4 py-2.5 text-white flex items-center justify-between text-xs shadow-md">
            <div className="flex items-center space-x-2.5">
              <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center font-bold text-xs">
                <Zap className="w-3.5 h-3.5 fill-white text-white" />
              </div>
              <div>
                <span className="font-bold">Install BeamDrop App</span>
                <span className="hidden sm:inline text-cyan-100 ml-1.5">• High-speed PWA with Web Share Target</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleInstallPWA}
                className="px-3 py-1 rounded-lg bg-white text-slate-900 font-bold hover:bg-slate-100 transition-colors cursor-pointer text-xs"
              >
                Install
              </button>
              <button
                type="button"
                onClick={() => setShowInstallBanner(false)}
                className="p-1 text-white/80 hover:text-white cursor-pointer"
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Responsive Top Bar: Hamburger Menu on Phone + Clean Breadcrumbs on Desktop */}
        <Header
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          onOpenExtensionModal={() => setShowExtensionModal(true)}
          onOpenMobileScanner={() => setShowMobileScanner(true)}
          onOpenAuthModal={() => {
            setAuthModalTab('login');
            setShowAuthModal(true);
          }}
          onOpenProfileModal={() => setShowProfileModal(true)}
          onOpenPricingModal={() => {
            setPricingReason('Unlock unlimited P2P transfers & priority high-speed bandwidth.');
            setShowPricingModal(true);
          }}
          showArchitectureModal={showArchitectureModal}
          setShowArchitectureModal={setShowArchitectureModal}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
          isMobileMenuOpen={isMobileMenuOpen}
        />

        {/* Main Tab Viewport: Driven Exclusively by Internal State `activeTab` */}
        <main className="flex-1 min-h-0 overflow-y-auto max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 lg:pb-8">
          <ErrorBoundary fallbackTitle={`Error Loading ${activeTab} View`} onReset={() => handleTabChange('sender')}>
            <React.Suspense
              fallback={
                <div className="py-20 flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
                  <span className="font-mono text-xs text-sky-700 font-semibold">Loading module...</span>
                </div>
              }
            >
              {activeTab === 'receive' && (
                <ReceiveVaultView
                  transferManager={transferManager}
                  onOpenMobileScanner={() => setShowMobileScanner(true)}
                />
              )}

              {activeTab === 'radar' && (
                userTier === 'pro' ? (
                  <SpiderRadarView
                    onDirectBeamTarget={(peer) => {
                      setTargetedPeer(peer);
                      handleTabChange('sender');
                    }}
                  />
                ) : (
                  <LockedFeatureView
                    featureId="radar"
                    onUpgrade={() => {
                      setPricingReason('Unlock Autonomous Hotspot Radar & Spatial P2P Discovery.');
                      setShowPricingModal(true);
                    }}
                  />
                )
              )}

              {activeTab === 'workspaces' && (
                userTier === 'pro' ? (
                  <WorkspacesView />
                ) : (
                  <LockedFeatureView
                    featureId="workspaces"
                    onUpgrade={() => {
                      setPricingReason('Unlock Collaborative Multi-Device Workspaces & Group Rooms.');
                      setShowPricingModal(true);
                    }}
                  />
                )
              )}

              {activeTab === 'notebook' && (
                userTier === 'pro' ? (
                  <NotebookView />
                ) : (
                  <LockedFeatureView
                    featureId="notebook"
                    onUpgrade={() => {
                      setPricingReason('Unlock Encrypted Cloud Clipboard, Markdown & Code Sync.');
                      setShowPricingModal(true);
                    }}
                  />
                )
              )}

              {activeTab === 'extension' && (
                <ExtensionHub receiverBaseUrl={receiverBaseUrl} />
              )}

              {activeTab === 'sender' && (
                <SenderView
                  transferManager={transferManager}
                  receiverBaseUrl={receiverBaseUrl}
                  targetedPeer={targetedPeer}
                />
              )}
            </React.Suspense>
          </ErrorBoundary>
        </main>

        {/* Clean Minimal Desktop/Tablet Footer */}
        <footer className="border-t border-sky-100 bg-white/60 backdrop-blur-md py-2 px-6 text-center text-xs text-slate-400 hidden sm:block">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-600">BeamDrop</span>
            <span className="text-slate-400">Direct Device-to-Device Transfer</span>
          </div>
        </footer>

        {/* Mobile Smartphone Bottom Quick Navigation Bar */}
        <MobileBottomNav
          activeTab={activeTab}
          onSelectTab={handleTabChange}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />
      </div>

      {/* Mobile Camera Scanner Modal & Portal */}
      {showMobileScanner && (
        <ErrorBoundary fallbackTitle="Scanner Error" onReset={() => setShowMobileScanner(false)}>
          <MobileScannerPortal
            transferManager={transferManager}
            initialTargetPeer={initialUrlInfo.peer}
            onClose={() => setShowMobileScanner(false)}
          />
        </ErrorBoundary>
      )}

      {/* Extension Modal (File System Access 1-Click Unpacker) */}
      <ExtensionModal
        isOpen={showExtensionModal}
        onClose={() => setShowExtensionModal(false)}
        receiverBaseUrl={receiverBaseUrl}
      />

      {/* Optional User Account Auth & Profile Modals */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultTab={authModalTab}
      />

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        triggerReason={upgradeReason}
      />

      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        triggerReason={pricingReason}
        onOpenAuthModal={() => {
          setAuthModalTab('signup');
          setShowPricingModal(false);
          setShowAuthModal(true);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <TransferProvider>
          <NotificationBar />
          <MainApp />
        </TransferProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
