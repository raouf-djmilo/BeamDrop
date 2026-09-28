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
  // Synchronously evaluate URL params BEFORE initial render
  const urlSearchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialPeer = urlSearchParams ? (urlSearchParams.get('peer') || (window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '')) : '';
  const initialName = urlSearchParams ? decodeURIComponent(urlSearchParams.get('name') || urlSearchParams.get('file') || '') : '';
  const initialSize = urlSearchParams ? parseInt(urlSearchParams.get('size') || '0', 10) : 0;
  const initialMime = urlSearchParams ? decodeURIComponent(urlSearchParams.get('mime') || '') : '';
  const initialMode = urlSearchParams ? urlSearchParams.get('mode') : null;
  const pathIsDownload = typeof window !== 'undefined' && (window.location.pathname.startsWith('/download') || window.location.pathname.startsWith('/dl'));

  const isDirectDownload = Boolean(initialPeer && initialMode !== 'app' && initialMode !== 'full');

  const [activeTab, setActiveTab] = useState<'sender' | 'receiver' | 'extension' | 'simulator'>('sender');
  const [peerId, setPeerId] = useState<string>('');
  const [urlPeerId, setUrlPeerId] = useState<string>(initialPeer);
  const [urlFileName, setUrlFileName] = useState<string>(initialName);
  const [urlFileSize, setUrlFileSize] = useState<number>(initialSize);
  const [urlFileMime, setUrlFileMime] = useState<string>(initialMime);
  const [isDirectDownloadMode, setIsDirectDownloadMode] = useState<boolean>(isDirectDownload || pathIsDownload);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing WebRTC...');

  // Single shared instance of P2PTransferManager for the main web app
  const transferManager = useMemo(() => new P2PTransferManager(), []);

  useEffect(() => {
    // If not in direct download mode, initialize web app peer
    if (!isDirectDownloadMode) {
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
    }
  }, [transferManager, isDirectDownloadMode]);

  const receiverBaseUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : 'https://beam-drop-mu.vercel.app';

  // DIRECT DOWNLOAD GATEWAY:
  // If user opened a QR code or /download link, show ONLY the pure direct file download card!
  // No header, no tabs, no website navigation, no website footer.
  if (isDirectDownloadMode && urlPeerId) {
    return (
      <DirectDownloadPortal
        peerId={urlPeerId}
        expectedFileName={urlFileName}
        expectedFileSize={urlFileSize}
        expectedFileMime={urlFileMime}
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
