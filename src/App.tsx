/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { P2PTransferManager } from './utils/p2p';
import { Header } from './components/Header';
import { SenderView } from './components/SenderView';
import { ReceiverView } from './components/ReceiverView';
import { ExtensionHub } from './components/ExtensionHub';
import { SplitSimulator } from './components/SplitSimulator';
import { DirectDownloadPortal } from './components/DirectDownloadPortal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'sender' | 'receiver' | 'extension' | 'simulator'>('sender');
  const [peerId, setPeerId] = useState<string>('');
  const [urlPeerId, setUrlPeerId] = useState<string>('');
  const [urlFileName, setUrlFileName] = useState<string>('');
  const [urlFileSize, setUrlFileSize] = useState<number>(0);
  const [urlFileMime, setUrlFileMime] = useState<string>('');
  const [isDirectDownloadMode, setIsDirectDownloadMode] = useState<boolean>(false);
  const [forceFullApp, setForceFullApp] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing WebRTC...');

  // Single shared instance of P2PTransferManager for the main web app
  const transferManager = useMemo(() => new P2PTransferManager(), []);

  useEffect(() => {
    // 1. Detect URL params from QR scan or direct link
    const params = new URLSearchParams(window.location.search);
    const peerParam = params.get('peer') || (window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '');
    const nameParam = params.get('name') || params.get('file') || '';
    const sizeParam = parseInt(params.get('size') || '0', 10);
    const mimeParam = params.get('mime') || '';
    const modeParam = params.get('mode');
    const pathIsDownload = window.location.pathname.startsWith('/download') || window.location.pathname.startsWith('/dl');

    if (peerParam) {
      setUrlPeerId(peerParam);
      setUrlFileName(nameParam);
      setUrlFileSize(sizeParam);
      setUrlFileMime(mimeParam);

      // If user scanned a QR code to download a file, enter Direct Download mode immediately!
      // This bypasses the full website interface completely, giving a direct download dialog.
      if (modeParam !== 'app' && modeParam !== 'full' && (pathIsDownload || nameParam || params.has('peer'))) {
        setIsDirectDownloadMode(true);
        return;
      }

      if (modeParam === 'receive') {
        setActiveTab('receiver');
      }
    } else if (modeParam === 'receive' || pathIsDownload) {
      setActiveTab('receiver');
    }

    // 2. Initialize P2P Peer for the main website sender/receiver
    transferManager.onStatusChange = (status) => {
      setStatusMessage(status);
    };

    transferManager.init().then((id) => {
      setPeerId(id);
    }).catch((err) => {
      console.error('Failed to init peer:', err);
    });

    return () => {
      transferManager.destroy();
    };
  }, [transferManager]);

  const receiverBaseUrl = typeof window !== 'undefined'
    ? (window.location.hostname.includes('vercel.app') || window.location.hostname === 'localhost'
        ? `${window.location.protocol}//${window.location.host}`
        : 'https://beam-drop-mu.vercel.app')
    : 'https://beam-drop-mu.vercel.app';

  // DIRECT DOWNLOAD GATEWAY:
  // When a user scans the QR code on mobile, this screen is displayed directly.
  // It gives an immediate direct download prompt and progress card, without loading the website UI.
  if (isDirectDownloadMode && urlPeerId && !forceFullApp) {
    return (
      <DirectDownloadPortal
        peerId={urlPeerId}
        expectedFileName={urlFileName}
        expectedFileSize={urlFileSize}
        expectedFileMime={urlFileMime}
        onSwitchToFullApp={() => setForceFullApp(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        transferManager={transferManager}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'sender' && (
          <SenderView
            transferManager={transferManager}
            receiverBaseUrl={receiverBaseUrl}
          />
        )}

        {activeTab === 'receiver' && (
          <ReceiverView
            transferManager={transferManager}
            initialTargetPeerId={urlPeerId}
          />
        )}

        {activeTab === 'extension' && (
          <ExtensionHub
            receiverBaseUrl={receiverBaseUrl}
          />
        )}

        {activeTab === 'simulator' && (
          <SplitSimulator />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>BeamDrop P2P Engine</span>
            <span>•</span>
            <span>Zero Cloud Storage & Database</span>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setActiveTab('extension')}
              className="hover:text-cyan-400 transition-colors cursor-pointer"
            >
              Chrome Extension Source (Manifest V3)
            </button>
            <span>•</span>
            <button
              onClick={() => setActiveTab('simulator')}
              className="hover:text-cyan-400 transition-colors cursor-pointer"
            >
              Split-Screen Test
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
