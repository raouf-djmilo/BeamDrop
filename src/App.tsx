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
import { ReceiverView } from './components/ReceiverView';
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

  const isDirectDownload = Boolean(initialPeer && initialMode !== 'app' && initialMode !== 'full');

  // Streamlined 4-Tab Navigation: Direct Beam, Mesh Radar, Workspaces, Receiver
  const [activeTab, setActiveTab] = useState<MainTab>('sender');
  const [targetedPeer, setTargetedPeer] = useState<any>(null);

  // Modals & PWA state
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white relative overflow-x-hidden">
      {/* Background Soft Ambient Light Spheres (Liquid Glass Backdrop) */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-slow" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-slow" />

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
        setActiveTab={setActiveTab}
        onOpenExtensionModal={() => setShowExtensionModal(true)}
        showArchitectureModal={showArchitectureModal}
        setShowArchitectureModal={setShowArchitectureModal}
      />

      {/* Main Dual-Pane / View Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-4">
        {activeTab === 'sender' && (
          <SenderView
            transferManager={transferManager}
            receiverBaseUrl={receiverBaseUrl}
            targetedPeer={targetedPeer}
          />
        )}

        {activeTab === 'radar' && (
          <SpiderRadarView
            onDirectBeamTarget={(peer) => {
              setTargetedPeer(peer);
              setActiveTab('sender');
            }}
          />
        )}

        {activeTab === 'workspaces' && (
          <WorkspacesView />
        )}

        {activeTab === 'receiver' && (
          <ReceiverView
            transferManager={transferManager}
            initialTargetPeerId={initialPeer}
          />
        )}
      </main>

      {/* Extension Modal (File System Access 1-Click Unpacker) */}
      <ExtensionModal
        isOpen={showExtensionModal}
        onClose={() => setShowExtensionModal(false)}
        receiverBaseUrl={receiverBaseUrl}
      />

      {/* Modern Minimal Glass Footer */}
      <footer className="border-t border-white/5 bg-slate-950/60 backdrop-blur-md py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-400 font-semibold">BeamDrop Liquid Glass v1.6.0 Pro</span>
            <span>•</span>
            <span>Zero Cloud Storage & Database</span>
          </div>

          <div className="flex items-center space-x-4 text-[11px]">
            <button
              onClick={() => setShowExtensionModal(true)}
              className="text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer font-mono"
            >
              Chrome Extension Unpacker (v1.6.0)
            </button>
            <span>•</span>
            <span className="text-slate-400">AES-GCM-256 E2EE</span>
            <span>•</span>
            <span className="text-emerald-400 font-medium">512KB LAN AIMD</span>
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
