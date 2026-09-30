/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { TransferProvider, useTransfer } from './context/TransferContext';
import { Header, MainTab } from './components/Header';
import { SenderView } from './components/SenderView';
import { SpiderRadarView } from './components/SpiderRadarView';
import { WorkspacesView } from './components/WorkspacesView';
import { ReceiveVaultView } from './components/ReceiveVaultView';
import { MobileScannerPortal } from './components/MobileScannerPortal';
import { ExtensionModal } from './components/ExtensionModal';
import { DirectDownloadPortal } from './components/DirectDownloadPortal';
import { PortalView } from './components/PortalView';
import { X } from 'lucide-react';

function MainApp() {
  const { transferManager } = useTransfer();

  // URL Params Evaluation
  const urlSearchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialPeer = urlSearchParams ? (urlSearchParams.get('peer') || (window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '')) : '';
  const initialName = urlSearchParams ? decodeURIComponent(urlSearchParams.get('name') || urlSearchParams.get('file') || '') : '';
  const initialSize = urlSearchParams ? parseInt(urlSearchParams.get('size') || '0', 10) : 0;
  const initialMime = urlSearchParams ? decodeURIComponent(urlSearchParams.get('mime') || '') : '';
  const initialMode = urlSearchParams ? urlSearchParams.get('mode') : null;

  const pathIsDownload = typeof window !== 'undefined' && (window.location.pathname.startsWith('/download') || window.location.pathname.startsWith('/dl'));
  const isPortalPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/portal');
  const portalIdMatch = typeof window !== 'undefined' ? window.location.pathname.match(/\/portal\/([^\/]+)/) : null;
  const portalId = portalIdMatch ? portalIdMatch[1] : '';

  const isDirectDownload = Boolean(initialPeer && initialMode !== 'app' && initialMode !== 'full' && initialMode !== 'scan' && initialMode !== 'scanner');

  // URL Routing Sync & Distinct Path Navigation
  const getInitialTabFromUrl = (): MainTab => {
    if (typeof window === 'undefined') return 'sender';
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/receive') || path.startsWith('/vault')) return 'receive';
    if (path.startsWith('/radar') || path.startsWith('/nearby')) return 'radar';
    if (path.startsWith('/workspaces') || path.startsWith('/rooms')) return 'workspaces';
    if (path.startsWith('/send')) return 'sender';
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'receive' || params.get('mode') === 'vault') return 'receive';
    if (params.get('mode') === 'radar') return 'radar';
    return 'sender';
  };

  // Streamlined 4-Mode Navigation: Send (/send), Receive (/receive), Radar (/radar), Workspaces (/workspaces)
  const [activeTab, setActiveTab] = useState<MainTab>(getInitialTabFromUrl);
  const [targetedPeer, setTargetedPeer] = useState<any>(null);

  const handleTabChange = (newTab: MainTab) => {
    setActiveTab(newTab);
    if (typeof window !== 'undefined') {
      const targetPath = newTab === 'sender' ? '/send' : `/${newTab}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ tab: newTab }, '', targetPath);
      }
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getInitialTabFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Modals & Mobile Scanner state
  const [showMobileScanner, setShowMobileScanner] = useState<boolean>(initialMode === 'scan' || initialMode === 'scanner');
  const [showExtensionModal, setShowExtensionModal] = useState<boolean>(false);
  const [showArchitectureModal, setShowArchitectureModal] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);

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

  // DIRECT DOWNLOAD GATEWAY (For QR Code Scans)
  if ((isDirectDownload || pathIsDownload) && initialPeer) {
    return (
      <DirectDownloadPortal
        peerId={initialPeer}
        expectedFileName={initialName}
        expectedFileSize={initialSize}
        expectedFileMime={initialMime}
      />
    );
  }

  // 10-MINUTE EPHEMERAL DROP PORTAL
  if (isPortalPath && (portalId || initialPeer)) {
    return (
      <PortalView
        portalId={portalId || 'active'}
        expectedPeerId={initialPeer}
        expectedFileName={initialName}
        expectedFileSize={initialSize}
        expectedFileMime={initialMime}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-sky-50 to-blue-100 text-slate-900 flex flex-col font-sans selection:bg-sky-500 selection:text-white relative overflow-x-hidden">
      {/* Background Soft Ambient Light Spheres (Liquid Glass Backdrop) */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-sky-300/40 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-slow" />
      <div className="fixed bottom-0 right-1/4 w-[450px] h-[450px] bg-cyan-200/50 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-slow" />

      {/* PWA Native Install Banner */}
      {showInstallBanner && (
        <div className="bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 px-4 py-2.5 text-white flex items-center justify-between text-xs shadow-xl">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center font-bold">
              ⚡
            </div>
            <div>
              <span className="font-bold">Install BeamDrop App</span>
              <span className="hidden sm:inline text-cyan-100 ml-1.5">• High-speed PWA with Web Share Target</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleInstallPWA}
              className="px-3.5 py-1 rounded-lg bg-white text-slate-900 font-bold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Install
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              className="p-1 text-white/80 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Streamlined Floating Glass Capsule Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenExtensionModal={() => setShowExtensionModal(true)}
        onOpenMobileScanner={() => setShowMobileScanner(true)}
        showArchitectureModal={showArchitectureModal}
        setShowArchitectureModal={setShowArchitectureModal}
      />

      {/* Main Container: Pure Separation of Send (/send) vs Receive (/receive) vs Radar (/radar) vs Rooms (/workspaces) */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-4">
        {activeTab === 'sender' && (
          <SenderView
            transferManager={transferManager}
            receiverBaseUrl={receiverBaseUrl}
            targetedPeer={targetedPeer}
          />
        )}

        {activeTab === 'receive' && (
          <ReceiveVaultView
            transferManager={transferManager}
            onOpenMobileScanner={() => setShowMobileScanner(true)}
          />
        )}

        {activeTab === 'radar' && (
          <SpiderRadarView
            onDirectBeamTarget={(peer) => {
              setTargetedPeer(peer);
              handleTabChange('sender');
            }}
          />
        )}

        {activeTab === 'workspaces' && (
          <WorkspacesView />
        )}
      </main>

      {/* Mobile Camera Scanner Modal & Portal */}
      {showMobileScanner && (
        <MobileScannerPortal
          transferManager={transferManager}
          initialTargetPeer={initialPeer}
          onClose={() => setShowMobileScanner(false)}
        />
      )}

      {/* Extension Modal (File System Access 1-Click Unpacker) */}
      <ExtensionModal
        isOpen={showExtensionModal}
        onClose={() => setShowExtensionModal(false)}
        receiverBaseUrl={receiverBaseUrl}
      />

      {/* Modern Liquid Glass Sky Blue Light Footer */}
      <footer className="border-t border-sky-200/80 bg-white/70 backdrop-blur-md py-4 px-6 text-center text-xs text-slate-600 shadow-[0_-4px_20px_rgba(2,132,199,0.04)]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-slate-700 font-semibold">BeamDrop Liquid Glass v1.6.0 Pro</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500">Zero Cloud Storage & Database</span>
          </div>

          <div className="flex items-center space-x-4 text-[11px]">
            <button
              onClick={() => setShowExtensionModal(true)}
              className="text-sky-600 hover:text-sky-800 transition-colors cursor-pointer font-mono font-semibold"
            >
              Chrome Extension Unpacker (v1.6.0)
            </button>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600">AES-GCM-256 E2EE</span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-600 font-semibold">512KB LAN AIMD</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <TransferProvider>
      <MainApp />
    </TransferProvider>
  );
}
