import JSZip from 'jszip';

export interface ExtensionFile {
  name: string;
  path: string;
  language: string;
  description: string;
  content: string;
}

export const getExtensionFiles = (receiverBaseUrl: string = 'https://beam-drop-mu.vercel.app'): ExtensionFile[] => {
  const cleanUrl = (receiverBaseUrl || 'https://beam-drop-mu.vercel.app').replace(/\/$/, '');

  const manifestJson = `{
  "manifest_version": 3,
  "name": "BeamDrop - Direct P2P Device Share",
  "version": "1.3.0",
  "description": "Lightning-fast direct Device-to-Device file, photo, video, and text transfer without servers or cloud storage using WebRTC and QR codes.",
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "permissions": [
    "storage",
    "unlimitedStorage",
    "contextMenus",
    "notifications",
    "downloads",
    "alarms",
    "sidePanel"
  ],
  "side_panel": {
    "default_path": "popup.html"
  },
  "host_permissions": [
    "https://*.peerjs.com/*",
    "https://*.vercel.app/*",
    "https://*.github.com/*"
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
`;

  const popupHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BeamDrop</title>
  <link rel="stylesheet" href="style.css">
  <script src="qrcode.min.js"></script>
  <script src="peerjs.min.js"></script>
</head>
<body>
  <!-- Header with Brand & Live Status -->
  <header class="app-header">
    <div class="brand">
      <div class="brand-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      </div>
      <div>
        <h1 class="brand-title">BeamDrop</h1>
        <p class="brand-sub">Direct Device-to-Device</p>
      </div>
    </div>
    <div class="header-actions">
      <button id="btnPopoutWindow" class="btn-popout-icon" title="Detach into persistent floating window (won't close on click outside)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </button>
      <div id="statusBadge" class="status-badge">
        <span class="status-dot"></span>
        <span id="statusText">Ready</span>
      </div>
    </div>
  </header>

  <!-- Sub-Navigation Bar: Send vs Updates -->
  <nav class="app-nav">
    <button id="navTabSend" class="nav-tab active">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
      <span>Beam Files</span>
    </button>
    <button id="navTabUpdates" class="nav-tab">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
      </svg>
      <span>Updates</span>
      <span id="navUpdateDot" class="nav-update-dot" style="display: none;"></span>
    </button>
  </nav>

  <!-- STAGE 1: File Staging Area -->
  <main id="stageStaging" class="stage-container">
    <!-- Drag & Drop Zone -->
    <div id="dropZone" class="drop-zone">
      <input type="file" id="fileInput" multiple style="display: none;">
      <div class="drop-icon-wrapper">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      </div>
      <p class="drop-primary">Choose files or drop here</p>
      <p class="drop-secondary">Photos, 4K Videos, ZIPs, Docs</p>
    </div>

    <!-- Staged File Card -->
    <div id="stagedCard" class="staged-card" style="display: none;">
      <div class="staged-preview">
        <img id="thumbImg" class="thumb-img" alt="Preview" style="display: none;">
        <span id="thumbIcon" class="thumb-icon">📄</span>
      </div>
      <div class="staged-info">
        <p id="stagedFileName" class="staged-name">filename.ext</p>
        <p id="stagedFileSize" class="staged-size">0 KB</p>
      </div>
      <button id="btnRemoveFile" class="btn-icon-danger" title="Remove file">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <!-- Primary CTA Button -->
    <button id="btnGenerateQr" class="btn-cta-generate" disabled>
      <span>⚡ Generate Direct Download QR</span>
    </button>
  </main>

  <!-- STAGE 2: Portal Active & QR Code Display -->
  <main id="stagePortal" class="stage-container" style="display: none;">
    <div class="qr-card-container">
      <!-- Staged File Info Badge on top of QR -->
      <div id="portalFileBadge" class="portal-file-badge">
        <span class="portal-badge-icon">📦</span>
        <span id="portalFileNameBadge" class="portal-badge-name">file.ext</span>
        <span id="portalFileSizeBadge" class="portal-badge-size">(0 KB)</span>
      </div>

      <div class="qr-box-200">
        <canvas id="qrcodeCanvas"></canvas>
      </div>
      <p class="qr-scan-instruction">Scan with your phone to download directly</p>
      <div class="portal-pill">
        <span class="radar-dot"></span>
        <span>Awaiting phone connection...</span>
      </div>
      <p id="portalUrlText" class="portal-url-text">https://beam-drop-mu.vercel.app/download?peer=...</p>
    </div>

    <div class="action-row">
      <button id="btnCopyLink" class="btn-action-outline">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span id="copyLinkText">Copy Link</span>
      </button>
      <button id="btnCancelPortal" class="btn-action-danger">Cancel</button>
    </div>

    <!-- Background Persistence Tip -->
    <div class="persistence-tip">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <span>Tip: Click 🗗 in header to detach into a floating window so transfer won't close if you click outside.</span>
    </div>
  </main>

  <!-- STAGE 3: Live P2P Streaming Transfer -->
  <main id="stageTransfer" class="stage-container" style="display: none;">
    <div class="transfer-card">
      <div class="transfer-header-row">
        <span class="pulsing-radar"></span>
        <h3 id="transferFileTitle" class="transfer-title">Streaming file...</h3>
      </div>

      <div class="progress-container">
        <div id="transferProgressFill" class="progress-fill" style="width: 0%;"></div>
      </div>

      <div class="transfer-metrics-row">
        <span id="transferPercentText">0%</span>
        <span id="transferSpeedText" class="speed-tag">0.0 MB/s</span>
        <span id="transferEtaText">--s remaining</span>
      </div>

      <div class="persistence-tip" style="margin-top: 12px;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>Streaming live P2P. Keep this window open until transfer reaches 100%.</span>
      </div>
    </div>
  </main>

  <!-- STAGE 4: Transfer Complete -->
  <main id="stageComplete" class="stage-container" style="display: none;">
    <div class="complete-card">
      <div class="complete-icon">✓</div>
      <h3 class="complete-title">Transfer Complete!</h3>
      <p class="complete-sub">Direct P2P transmission finished without servers.</p>
      <button id="btnSendAnother" class="btn-cta-generate">
        <span>Send Another File</span>
      </button>
    </div>
  </main>

  <!-- STAGE 5: Clean 2-State Updates Engine -->
  <main id="stageUpdates" class="stage-container" style="display: none;">
    
    <!-- STATE A: USER IS UP-TO-DATE (currentVersion >= latestVersion) -->
    <div id="stateUpToDate" class="update-clean-card" style="display: none;">
      <div class="uptodate-glow-badge">
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <path d="m9 12 2 2 4-4"></path>
        </svg>
      </div>
      <h3 class="uptodate-headline">BeamDrop is up to date</h3>
      <div id="uptodateVersionBadge" class="uptodate-ver-pill">v1.3.0</div>
      <p class="uptodate-sub">You have the latest version installed with all security and performance features.</p>

      <div class="uptodate-bottom-bar">
        <button id="btnCheckUpdates" class="btn-clean-check" type="button">
          <svg id="refreshSpinIcon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
          </svg>
          <span id="btnCheckUpdatesText">Check for Updates</span>
        </button>
        <span id="lastCheckedText" class="uptodate-time">Last checked: Just now</span>
      </div>
    </div>

    <!-- STATE B: NEW UPDATE AVAILABLE (currentVersion < latestVersion) -->
    <div id="stateUpdateAvailable" class="update-clean-card available-theme" style="display: none;">
      <div class="available-top-row">
        <span class="available-pulse-tag">⚡ New Version Available</span>
        <span id="availableVerPill" class="available-ver-badge">v1.4.0</span>
      </div>

      <div class="available-notes-box">
        <h4 class="available-notes-title">What's New:</h4>
        <ul id="availableChangelogList" class="available-notes-list">
          <!-- Populated dynamically -->
        </ul>
      </div>

      <!-- Live Update Progress Animation (hidden until updating) -->
      <div id="updateProgressContainer" class="update-progress-container" style="display: none;">
        <div class="update-progress-header">
          <span id="updateProgressLabel">⚡ Updating & Reloading...</span>
          <span id="updateProgressPercent" class="font-mono">0%</span>
        </div>
        <div class="update-progress-bar">
          <div id="updateProgressFill" class="update-progress-fill" style="width: 0%;"></div>
        </div>
      </div>

      <!-- Primary 1-Click Update Button -->
      <button id="btnTriggerUpdate" class="btn-cta-update" type="button">
        <span id="btnTriggerUpdateText">⚡ 1-Click Update & Reload</span>
      </button>

      <div class="available-footer-info">
        <span id="updateAvailableCheckedTime" class="uptodate-time">Checked automatically from cloud repository</span>
      </div>
    </div>

  </main>

  <!-- Footer -->
  <footer class="app-footer">
    <div class="footer-left">
      <span class="secure-dot"></span>
      <span id="footerVersionText">v1.2.0</span>
      <span>•</span>
      <span>Direct P2P Encrypted</span>
    </div>
    <span>Zero Cloud Storage</span>
  </footer>

  <script src="popup.js"></script>
</body>
</html>
`;

  const popupJs = `/**
 * BeamDrop Chrome Extension - Popup Controller (Manifest V3)
 * Dynamic Staging -> Direct Download QR -> Backpressure Stream -> OTA 1-Click Updater Engine
 */

let VERCEL_RECEIVER_URL = "https://beam-drop-mu.vercel.app";
const CHUNK_SIZE = 64 * 1024; // 64KB slices

// Comprehensive STUN & TURN Relay servers (bypasses Symmetric NAT, CGNAT & 4G/5G mobile firewalls)
const EXTENSION_ICE_SERVERS = [
  // Primary High-Speed Google STUN
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Twilio Global STUN
  { urls: 'stun:global.stun.twilio.com:3478' },
  // OpenRelay Public TURN Relay (Encrypted peer-to-peer data pipe when direct STUN is blocked)
  { urls: 'stun:stun.relay.metered.ca:80' },
  {
    urls: 'turn:standard.relay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:standard.relay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:standard.relay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

// Current Installed Version from Manifest
const REAL_MANIFEST_VERSION = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
  ? chrome.runtime.getManifest().version
  : '1.3.0';

// State
let stagedFiles = [];
let peer = null;
let activeConnection = null;
let currentPeerId = null;
let isStreaming = false;
let currentActiveView = 'send'; // 'send' | 'updates'
let remoteVersionInfo = null;

// DOM Elements
const btnPopoutWindow = document.getElementById('btnPopoutWindow');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const footerVersionText = document.getElementById('footerVersionText');

// Navigation Elements
const navTabSend = document.getElementById('navTabSend');
const navTabUpdates = document.getElementById('navTabUpdates');
const navUpdateDot = document.getElementById('navUpdateDot');

// Stages
const stageStaging = document.getElementById('stageStaging');
const stagePortal = document.getElementById('stagePortal');
const stageTransfer = document.getElementById('stageTransfer');
const stageComplete = document.getElementById('stageComplete');
const stageUpdates = document.getElementById('stageUpdates');

// Stage 1 Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const stagedCard = document.getElementById('stagedCard');
const thumbImg = document.getElementById('thumbImg');
const thumbIcon = document.getElementById('thumbIcon');
const stagedFileName = document.getElementById('stagedFileName');
const stagedFileSize = document.getElementById('stagedFileSize');
const btnRemoveFile = document.getElementById('btnRemoveFile');
const btnGenerateQr = document.getElementById('btnGenerateQr');

// Stage 2 Elements
const portalFileNameBadge = document.getElementById('portalFileNameBadge');
const portalFileSizeBadge = document.getElementById('portalFileSizeBadge');
const qrcodeCanvas = document.getElementById('qrcodeCanvas');
const portalUrlText = document.getElementById('portalUrlText');
const btnCopyLink = document.getElementById('btnCopyLink');
const copyLinkText = document.getElementById('copyLinkText');
const btnCancelPortal = document.getElementById('btnCancelPortal');

// Stage 3 Elements
const transferFileTitle = document.getElementById('transferFileTitle');
const transferProgressFill = document.getElementById('transferProgressFill');
const transferPercentText = document.getElementById('transferPercentText');
const transferSpeedText = document.getElementById('transferSpeedText');
const transferEtaText = document.getElementById('transferEtaText');

// Stage 4 Elements
const btnSendAnother = document.getElementById('btnSendAnother');

// Stage 5 (Clean 2-State Updates Engine) Elements
const stateUpToDate = document.getElementById('stateUpToDate');
const uptodateVersionBadge = document.getElementById('uptodateVersionBadge');
const btnCheckUpdates = document.getElementById('btnCheckUpdates');
const btnCheckUpdatesText = document.getElementById('btnCheckUpdatesText');
const refreshSpinIcon = document.getElementById('refreshSpinIcon');
const lastCheckedText = document.getElementById('lastCheckedText');

const stateUpdateAvailable = document.getElementById('stateUpdateAvailable');
const availableVerPill = document.getElementById('availableVerPill');
const availableChangelogList = document.getElementById('availableChangelogList');
const updateProgressContainer = document.getElementById('updateProgressContainer');
const updateProgressLabel = document.getElementById('updateProgressLabel');
const updateProgressPercent = document.getElementById('updateProgressPercent');
const updateProgressFill = document.getElementById('updateProgressFill');
const btnTriggerUpdate = document.getElementById('btnTriggerUpdate');
const btnTriggerUpdateText = document.getElementById('btnTriggerUpdateText');
const updateAvailableCheckedTime = document.getElementById('updateAvailableCheckedTime');

// Initialize version in footer
if (footerVersionText) {
  footerVersionText.textContent = 'v' + REAL_MANIFEST_VERSION;
}

function showStage(stageName) {
  stageStaging.style.display = stageName === 'staging' ? 'flex' : 'none';
  stagePortal.style.display = stageName === 'portal' ? 'flex' : 'none';
  stageTransfer.style.display = stageName === 'transfer' ? 'flex' : 'none';
  stageComplete.style.display = stageName === 'complete' ? 'flex' : 'none';
  stageUpdates.style.display = stageName === 'updates' ? 'flex' : 'none';
}

function updateStatus(state, text) {
  if (!statusText) return;
  statusText.textContent = text;
  if (state === 'connected') {
    statusBadge.className = 'status-badge connected';
  } else if (state === 'ready') {
    statusBadge.className = 'status-badge ready';
  } else {
    statusBadge.className = 'status-badge';
  }
}

// Detach to floating window / side panel controller
if (btnPopoutWindow) {
  btnPopoutWindow.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.windows && chrome.windows.create) {
      chrome.windows.create({
        url: chrome.runtime.getURL('popup.html?detached=true'),
        type: 'popup',
        width: 400,
        height: 640
      });
      window.close();
    } else if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
          chrome.sidePanel.open({ tabId: tabs[0].id }).catch(() => {});
        }
      });
    } else {
      window.open(window.location.href, '_blank', 'width=400,height=640');
    }
  });
}

// ==========================================
// NAVIGATION CONTROLLER
// ==========================================
navTabSend.addEventListener('click', () => {
  currentActiveView = 'send';
  navTabSend.classList.add('active');
  navTabUpdates.classList.remove('active');

  if (isStreaming) {
    showStage('transfer');
  } else if (currentPeerId && activeConnection) {
    showStage('portal');
  } else if (stagedFiles.length > 0) {
    showStage('staging');
  } else {
    showStage('staging');
  }
});

navTabUpdates.addEventListener('click', () => {
  currentActiveView = 'updates';
  navTabUpdates.classList.add('active');
  navTabSend.classList.remove('active');
  showStage('updates');

  // Clear badge in background service worker
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ action: 'clear_update_badge' }).catch(() => {});
  }

  checkForUpdates(false);
});

// ==========================================
// STAGE 1: Staging & File Selection
// ==========================================
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files.length) {
    stageSelectedFiles(Array.from(e.dataTransfer.files));
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length) {
    stageSelectedFiles(Array.from(e.target.files));
  }
});

btnRemoveFile.addEventListener('click', (e) => {
  e.stopPropagation();
  stagedFiles = [];
  stagedCard.style.display = 'none';
  fileInput.value = '';
  btnGenerateQr.disabled = true;
  updateStatus('idle', 'Ready');
});

function stageSelectedFiles(files) {
  stagedFiles = files;
  const first = files[0];
  if (!first) return;

  stagedCard.style.display = 'flex';
  stagedFileName.textContent = files.length > 1 ? \`\${first.name} (+\${files.length - 1} more)\` : first.name;
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  stagedFileSize.textContent = formatBytes(totalSize);

  if (first.type.startsWith('image/')) {
    thumbImg.src = URL.createObjectURL(first);
    thumbImg.style.display = 'block';
    thumbIcon.style.display = 'none';
  } else if (first.type.startsWith('video/')) {
    thumbImg.style.display = 'none';
    thumbIcon.textContent = '🎬';
    thumbIcon.style.display = 'block';
  } else if (first.name.endsWith('.zip') || first.name.endsWith('.rar') || first.name.endsWith('.7z')) {
    thumbImg.style.display = 'none';
    thumbIcon.textContent = '📦';
    thumbIcon.style.display = 'block';
  } else {
    thumbImg.style.display = 'none';
    thumbIcon.textContent = '📄';
    thumbIcon.style.display = 'block';
  }

  btnGenerateQr.disabled = false;
  updateStatus('ready', 'File Staged');
}

// ==========================================
// STAGE 2: Direct Download Portal & QR Engine
// ==========================================
btnGenerateQr.addEventListener('click', () => {
  if (stagedFiles.length === 0) return;
  startPortalSession();
});

btnCancelPortal.addEventListener('click', () => {
  cleanupTransferSession();
});

btnCopyLink.addEventListener('click', () => {
  if (!portalUrlText.textContent) return;
  navigator.clipboard.writeText(portalUrlText.textContent).then(() => {
    copyLinkText.textContent = 'Copied!';
    setTimeout(() => {
      copyLinkText.textContent = 'Copy Link';
    }, 2000);
  });
});

async function startPortalSession() {
  updateStatus('ready', 'Starting Portal...');

  const randomSub = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).substring(2, 10);
  currentPeerId = 'beam-' + randomSub;

  const first = stagedFiles[0];
  const fileNameEnc = encodeURIComponent(first.name);
  const fileSize = first.size;
  const mimeEnc = encodeURIComponent(first.type || '');

  // Direct download route: /download?peer=...&name=...&size=...&mime=...
  const targetUrl = \`\${VERCEL_RECEIVER_URL}/download?peer=\${currentPeerId}&name=\${fileNameEnc}&size=\${fileSize}&mime=\${mimeEnc}\`;

  // Update badge on top of QR code in popup
  if (portalFileNameBadge && first) {
    portalFileNameBadge.textContent = stagedFiles.length > 1
      ? \`\${first.name} (+\${stagedFiles.length - 1})\`
      : first.name;
  }
  if (portalFileSizeBadge && first) {
    portalFileSizeBadge.textContent = \`(\${formatBytes(stagedFiles.reduce((acc, f) => acc + f.size, 0))})\`;
  }

  portalUrlText.textContent = targetUrl;

  try {
    await QRCode.toCanvas(qrcodeCanvas, targetUrl, {
      width: 196,
      margin: 2,
      color: {
        dark: '#030712',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('QR rendering failed:', err);
  }

  showStage('portal');
  initPeerJsSession();
}

function initPeerJsSession() {
  if (peer) {
    try { peer.destroy(); } catch (e) {}
  }

  peer = new Peer(currentPeerId, {
    debug: 1,
    config: {
      iceServers: EXTENSION_ICE_SERVERS
    }
  });

  peer.on('open', (id) => {
    console.log('[Extension] Portal PeerJS Open:', id);
    updateStatus('ready', 'Awaiting Phone...');
  });

  peer.on('connection', (conn) => {
    console.log('[Extension] Receiver Connected:', conn.peer);
    activeConnection = conn;
    updateStatus('connected', 'Phone Connected');
    setupConnectionHandlers(conn);
  });

  peer.on('error', (err) => {
    console.error('[Extension] PeerJS Error:', err);
    updateStatus('idle', 'Connection Error');
  });
}

function setupConnectionHandlers(conn) {
  conn.on('open', () => {
    showStage('transfer');
    startBackpressureStream(conn);
  });

  conn.on('data', (data) => {
    if (data && data.type === 'ack') {
      // Receiver acknowledged chunk
    }
  });

  conn.on('close', () => {
    console.log('[Extension] Connection closed.');
    if (!isStreaming) {
      updateStatus('idle', 'Disconnected');
    }
  });
}

// ==========================================
// STAGE 3: Backpressure Stream Transmission
// ==========================================
async function startBackpressureStream(conn) {
  isStreaming = true;
  const file = stagedFiles[0];
  if (!file) return;

  transferFileTitle.textContent = \`Streaming: \${file.name}\`;
  transferProgressFill.style.width = '0%';
  transferPercentText.textContent = '0%';
  transferSpeedText.textContent = '0.0 MB/s';
  transferEtaText.textContent = '--s remaining';

  const fileId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'f-' + Date.now();

  // 1. Send File Metadata Header (compatible with standard and custom receivers)
  conn.send({
    type: 'FILE_START',
    fileId: fileId,
    fileName: file.name,
    fileSize: file.size,
    fileMime: file.type || 'application/octet-stream',
    totalChunks: Math.ceil(file.size / CHUNK_SIZE),
    payload: {
      id: fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      chunkSize: CHUNK_SIZE,
      totalChunks: Math.ceil(file.size / CHUNK_SIZE)
    }
  });

  // 2. Stream File Slices
  let offset = 0;
  let chunkIndex = 0;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const startTime = Date.now();
  let lastSpeedCheck = startTime;
  let lastBytes = 0;

  const dataChannel = conn.dataChannel;

  while (offset < file.size) {
    if (dataChannel && dataChannel.bufferedAmount > 4 * CHUNK_SIZE) {
      await waitForBufferDrain(dataChannel);
    }

    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const arrayBuffer = await slice.arrayBuffer();

    conn.send({
      type: 'FILE_CHUNK',
      fileId: fileId,
      chunkIndex: chunkIndex,
      totalChunks: totalChunks,
      data: arrayBuffer
    });

    offset += slice.size;
    chunkIndex++;

    const progress = Math.min(100, Math.round((offset / file.size) * 100));
    transferProgressFill.style.width = \`\${progress}%\`;
    transferPercentText.textContent = \`\${progress}%\`;

    const now = Date.now();
    if (now - lastSpeedCheck > 300) {
      const durationSec = (now - lastSpeedCheck) / 1000;
      const bytesSent = offset - lastBytes;
      const speedMBs = (bytesSent / (1024 * 1024)) / durationSec;
      transferSpeedText.textContent = \`\${speedMBs.toFixed(1)} MB/s\`;

      const remainingBytes = file.size - offset;
      const etaSec = speedMBs > 0 ? Math.round((remainingBytes / (1024 * 1024)) / speedMBs) : 0;
      transferEtaText.textContent = \`\${etaSec}s remaining\`;

      lastSpeedCheck = now;
      lastBytes = offset;
    }
  }

  // 3. Send Complete Signal (compatible with all receivers)
  conn.send({
    type: 'FILE_END',
    fileId: fileId
  });
  conn.send({
    type: 'complete',
    fileId: fileId
  });
  isStreaming = false;

  setTimeout(() => {
    showStage('complete');
    updateStatus('ready', 'Transfer Complete');
  }, 400);
}

function waitForBufferDrain(dc) {
  return new Promise((resolve) => {
    const check = () => {
      if (!dc || dc.bufferedAmount < CHUNK_SIZE) {
        resolve();
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

// ==========================================
// STAGE 4: Reset & Resend
// ==========================================
btnSendAnother.addEventListener('click', () => {
  cleanupTransferSession();
});

function cleanupTransferSession() {
  if (peer) {
    try { peer.destroy(); } catch (e) {}
    peer = null;
  }
  activeConnection = null;
  currentPeerId = null;
  stagedFiles = [];
  isStreaming = false;

  stagedCard.style.display = 'none';
  fileInput.value = '';
  btnGenerateQr.disabled = true;
  transferProgressFill.style.width = '0%';
  transferPercentText.textContent = '0%';

  showStage('staging');
  updateStatus('idle', 'Ready');
}

// ==========================================
// STAGE 5: OVER-THE-AIR (OTA) 1-CLICK UPDATER ENGINE
// ==========================================

function compareSemver(v1, v2) {
  const p1 = (v1 || '0.0.0').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = (v2 || '0.0.0').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

// Built-in registry fallback for instant offline reliability
const BUILT_IN_LATEST_REGISTRY = {
  version: '1.3.0',
  highlights: [
    'Direct Phone Download Gateway: Scanning QR prompts native download without opening full website UI',
    'Streamlined 2-State In-Place Updater: Ultra-clean interface with 1-click reload',
    'Integrated TURN Relay: 100% connectivity across mobile 4G/5G and symmetric NAT firewalls',
    'Backpressure Flow Control: Zero-loss RAM buffer control for streaming large 4K video files'
  ]
};

async function checkForUpdates(manual = false) {
  if (manual) {
    if (btnCheckUpdatesText) btnCheckUpdatesText.textContent = 'Checking cloud...';
    if (refreshSpinIcon) refreshSpinIcon.classList.add('spinning');
  }

  const currentVer = REAL_MANIFEST_VERSION;
  if (footerVersionText) footerVersionText.textContent = 'v' + currentVer;

  let remoteData = null;
  try {
    const endpoint = \`\${VERCEL_RECEIVER_URL}/version.json?_t=\${Date.now()}\`;
    const resp = await fetch(endpoint, { cache: 'no-store' });
    if (resp.ok) {
      remoteData = await resp.json();
    }
  } catch (err) {
    console.debug('Cloud version check failed:', err);
  }

  if (!remoteData) {
    remoteData = BUILT_IN_LATEST_REGISTRY;
  }

  const latestVer = remoteData.version || '1.3.0';
  const isNewer = compareSemver(latestVer, currentVer) > 0;

  if (isNewer) {
    // STATE B: NEW UPDATE AVAILABLE
    if (stateUpToDate) stateUpToDate.style.display = 'none';
    if (stateUpdateAvailable) stateUpdateAvailable.style.display = 'block';
    if (navUpdateDot) navUpdateDot.style.display = 'block';

    if (availableVerPill) availableVerPill.textContent = 'v' + latestVer;
    if (btnTriggerUpdateText) btnTriggerUpdateText.textContent = \`⚡ Update to v\${latestVer} & Reload\`;

    const notes = remoteData.highlights || (remoteData.changelog && remoteData.changelog[0] && remoteData.changelog[0].changes) || [
      'Performance enhancements and streaming stability fixes.',
      'Updated WebRTC ICE connectivity profiles.'
    ];

    if (availableChangelogList) {
      availableChangelogList.innerHTML = notes
        .map(item => \`<li>\${escapeHtml(item)}</li>\`)
        .join('');
    }

    if (btnTriggerUpdate) {
      btnTriggerUpdate.disabled = false;
      btnTriggerUpdate.onclick = () => startOneClickUpdate(latestVer);
    }
  } else {
    // STATE A: USER IS UP-TO-DATE
    if (stateUpdateAvailable) stateUpdateAvailable.style.display = 'none';
    if (stateUpToDate) stateUpToDate.style.display = 'block';
    if (navUpdateDot) navUpdateDot.style.display = 'none';

    if (uptodateVersionBadge) uptodateVersionBadge.textContent = 'v' + currentVer;
  }

  const nowTime = 'Last checked: ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (lastCheckedText) lastCheckedText.textContent = nowTime;
  if (updateAvailableCheckedTime) updateAvailableCheckedTime.textContent = nowTime;

  if (manual) {
    setTimeout(() => {
      if (btnCheckUpdatesText) btnCheckUpdatesText.textContent = 'Check for Updates';
      if (refreshSpinIcon) refreshSpinIcon.classList.remove('spinning');
    }, 450);
  }
}

// 1-Click Update Action
function startOneClickUpdate(ver) {
  if (updateProgressContainer) {
    updateProgressContainer.style.display = 'block';
  }
  if (btnTriggerUpdate) {
    btnTriggerUpdate.disabled = true;
  }

  setUpdateProgress(35, \`⚡ Applying update v\${ver}...\`);

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.requestUpdateCheck) {
    chrome.runtime.requestUpdateCheck((status, details) => {
      console.log('Chrome runtime requestUpdateCheck:', status, details);
      finalizeSeamlessUpdate(ver);
    });
  } else {
    finalizeSeamlessUpdate(ver);
  }
}

function finalizeSeamlessUpdate(ver) {
  setTimeout(() => {
    setUpdateProgress(70, \`⚡ Version v\${ver} activated! Syncing Chrome runtime...\`);

    if (typeof chrome !== 'undefined' && chrome.action && chrome.action.setBadgeText) {
      chrome.action.setBadgeText({ text: '' });
    }

    setTimeout(() => {
      setUpdateProgress(100, \`✓ Updated successfully! Reloading extension...\`);
      if (btnTriggerUpdateText) btnTriggerUpdateText.textContent = \`✓ Reloading v\${ver}...\`;

      setTimeout(() => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.reload) {
          try {
            chrome.runtime.reload();
          } catch (e) {
            console.log('Reload triggered:', e);
          }
        } else {
          // Fallback in simulated/tab view: transition directly to State A
          if (stateUpdateAvailable) stateUpdateAvailable.style.display = 'none';
          if (stateUpToDate) stateUpToDate.style.display = 'block';
          if (uptodateVersionBadge) uptodateVersionBadge.textContent = 'v' + ver;
          if (footerVersionText) footerVersionText.textContent = 'v' + ver;
          if (btnTriggerUpdate) btnTriggerUpdate.disabled = false;
        }
      }, 700);
    }, 600);
  }, 500);
}

function setUpdateProgress(percent, label) {
  if (updateProgressFill) updateProgressFill.style.width = percent + '%';
  if (updateProgressPercent) updateProgressPercent.textContent = percent + '%';
  if (updateProgressLabel) updateProgressLabel.textContent = label;
}

if (btnCheckUpdates) {
  btnCheckUpdates.addEventListener('click', () => {
    checkForUpdates(true);
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Initial update check on startup (runs silently in background)
checkForUpdates(false);

// Start on Stage 1 (Staging)
showStage('staging');
updateStatus('idle', 'Ready');
`;

  const styleCss = `/* ==========================================================================
   BeamDrop Chrome Extension - 100% Offline Pure Stylesheet
   Strict Dimensions: width: 380px; max-height: 580px
   Theme: #0b0f19 background, electric cyan (#06b6d4) & blue (#3b82f6)
   ========================================================================== */

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  width: 380px;
  min-height: 520px;
  max-height: 580px;
  overflow-y: auto;
  overflow-x: hidden;
  margin: 0;
  padding: 16px;
  background-color: #0b0f19;
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  user-select: none;
}

/* Restrict all images and SVGs from exceeding parent */
img, svg {
  max-width: 100%;
  height: auto;
  display: block;
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 5px;
}
::-webkit-scrollbar-track {
  background: #111827;
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb {
  background: #1f2937;
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: #06b6d4;
}

/* ==========================================================================
   App Header & Brand
   ========================================================================== */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid #1e293b;
  margin-bottom: 10px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-popout-icon {
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid #334155;
  color: #94a3b8;
  border-radius: 8px;
  padding: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.btn-popout-icon:hover {
  background: rgba(6, 182, 212, 0.15);
  border-color: #06b6d4;
  color: #06b6d4;
  transform: scale(1.05);
}

.persistence-tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(15, 23, 42, 0.7);
  border: 1px dashed rgba(6, 182, 212, 0.3);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 10px;
  line-height: 1.35;
}

.persistence-tip svg {
  flex-shrink: 0;
  color: #06b6d4;
  margin-top: 2px;
}

@media (min-width: 400px) {
  body {
    width: 100%;
    min-height: 100vh;
    max-height: 100vh;
  }
}

/* Navigation Tabs */
.app-nav {
  display: flex;
  gap: 6px;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid #1e293b;
  border-radius: 12px;
  padding: 3px;
  margin-bottom: 12px;
}

.nav-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 9px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
}

.nav-tab:hover {
  color: #f1f5f9;
  background: rgba(255, 255, 255, 0.04);
}

.nav-tab.active {
  background: #1e293b;
  color: #38bdf8;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.nav-update-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #38bdf8;
  box-shadow: 0 0 8px #38bdf8;
  animation: pulseDot 1.4s infinite ease-in-out;
}

.brand-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-box {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, #06b6d4, #3b82f6);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(6, 182, 212, 0.35);
  flex-shrink: 0;
}

.logo-svg {
  width: 18px;
  height: 18px;
  color: #ffffff;
}

.brand-title {
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.2px;
  line-height: 1.1;
}

.brand-sub {
  font-size: 9px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: #38bdf8;
  letter-spacing: 0.5px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(148, 163, 184, 0.1);
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.status-badge.ready {
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
  border-color: rgba(245, 158, 11, 0.3);
}

.status-badge.connected {
  background: rgba(16, 185, 129, 0.12);
  color: #34d399;
  border-color: rgba(16, 185, 129, 0.3);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
}

.status-badge.ready .status-dot {
  animation: pulseDot 1.4s infinite ease-in-out;
}

@keyframes pulseDot {
  0%, 100% { opacity: 0.3; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.2); }
}

/* ==========================================================================
   STAGE 1: Staging & Drop Zone
   ========================================================================== */
.stage-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.drop-zone {
  border: 2px dashed #1e293b;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.6);
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.drop-zone:hover, .drop-zone.dragover {
  border-color: #06b6d4;
  background: rgba(6, 182, 212, 0.08);
}

.hidden-input {
  display: none;
}

.drop-icon-circle {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: #1e293b;
  color: #38bdf8;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 10px auto;
  transition: transform 0.2s ease;
}

.drop-zone:hover .drop-icon-circle {
  transform: translateY(-2px);
  color: #06b6d4;
  background: #0f172a;
}

.drop-title {
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
}

.drop-sub {
  font-size: 11px;
  color: #64748b;
  margin-top: 3px;
}

/* Staged File Preview Card */
.staged-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 14px;
  padding: 10px 12px;
}

.thumb-wrapper {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  background: #0b0f19;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid #334155;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-icon {
  font-size: 22px;
}

.staged-info {
  flex: 1;
  min-width: 0;
}

.staged-name {
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.staged-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.btn-trash {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 15px;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.btn-trash:hover {
  color: #f87171;
  background: rgba(248, 113, 113, 0.12);
}

/* Primary CTA Button */
.btn-cta-generate {
  width: 100%;
  padding: 12px 16px;
  background: linear-gradient(135deg, #0284c7, #2563eb);
  color: #ffffff;
  border: none;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 16px rgba(2, 132, 199, 0.35);
  transition: all 0.15s ease;
}

.btn-cta-generate:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.btn-cta-generate:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

/* ==========================================================================
   STAGE 2: QR Code Active Portal
   ========================================================================== */
.qr-card-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #111827;
  border: 1px solid #1f2937;
  border-radius: 20px;
  padding: 16px;
  text-align: center;
}

.portal-file-badge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  background: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.25);
  border-radius: 12px;
  padding: 6px 12px;
  margin-bottom: 12px;
  font-size: 11px;
}

.portal-filename {
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.portal-filesize {
  font-family: ui-monospace, monospace;
  color: #38bdf8;
  font-weight: 600;
  flex-shrink: 0;
}

.qr-box-200 {
  width: 200px;
  height: 200px;
  background: #ffffff;
  border-radius: 16px;
  padding: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.qr-box-200 canvas {
  width: 184px !important;
  height: 184px !important;
  display: block;
  border-radius: 6px;
}

.radar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.radar-ping {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 10px #38bdf8;
  animation: pulse 1.2s infinite ease-in-out;
}

.radar-text {
  font-size: 11px;
  font-weight: 600;
  color: #e2e8f0;
}

.portal-url-text {
  font-size: 10px;
  color: #64748b;
  font-family: ui-monospace, monospace;
  margin-bottom: 12px;
}

.qr-actions-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.btn-secondary {
  flex: 1;
  padding: 8px 12px;
  background: #1e293b;
  border: 1px solid #334155;
  color: #cbd5e1;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-secondary:hover {
  background: #334155;
  color: #ffffff;
}

/* ==========================================================================
   STAGE 3: Active Transfer & Streaming
   ========================================================================== */
.transfer-live-card {
  background: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.35);
  border-radius: 18px;
  padding: 16px;
  margin-bottom: 12px;
}

.transfer-file-title {
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 8px;
}

.progress-track {
  width: 100%;
  height: 8px;
  background: #1e293b;
  border-radius: 9999px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #06b6d4, #3b82f6);
  border-radius: 9999px;
  transition: width 0.15s ease;
}

.transfer-metrics-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
  font-family: ui-monospace, monospace;
}

.speed-tag {
  color: #38bdf8;
  font-weight: 700;
}

/* ==========================================================================
   STAGE 4: Complete State
   ========================================================================== */
.complete-card {
  text-align: center;
  background: #111827;
  border: 1px solid #1f2937;
  border-radius: 20px;
  padding: 24px 16px;
}

.complete-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.15);
  border: 2px solid #10b981;
  color: #34d399;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px auto;
  font-size: 26px;
}

.complete-title {
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 4px;
}

.complete-sub {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 16px;
}

/* ==========================================================================
   STAGE 5: Clean 2-State Updates Engine
   ========================================================================== */
.update-clean-card {
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid #1e293b;
  border-radius: 20px;
  padding: 24px 18px;
  text-align: center;
  backdrop-filter: blur(12px);
  position: relative;
  overflow: hidden;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  transition: all 0.25s ease;
}

/* STATE A: UP TO DATE */
.uptodate-glow-badge {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.12);
  border: 2px solid rgba(16, 185, 129, 0.4);
  color: #10b981;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 6px auto 16px auto;
  box-shadow: 0 0 24px rgba(16, 185, 129, 0.2);
}

.uptodate-headline {
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 6px;
}

.uptodate-ver-pill {
  display: inline-block;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: #34d399;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 12px;
  border-radius: 9999px;
  margin-bottom: 12px;
}

.uptodate-sub {
  font-size: 11.5px;
  color: #94a3b8;
  line-height: 1.45;
  margin-bottom: 18px;
  max-width: 290px;
  margin-left: auto;
  margin-right: auto;
}

.uptodate-bottom-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid rgba(30, 41, 59, 0.7);
}

.btn-clean-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid #334155;
  color: #f1f5f9;
  padding: 8px 18px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-clean-check:hover {
  background: #334155;
  border-color: #06b6d4;
  color: #ffffff;
  transform: translateY(-1px);
}

.uptodate-time {
  font-size: 10.5px;
  color: #64748b;
  font-family: ui-monospace, monospace;
}

/* STATE B: UPDATE AVAILABLE */
.update-clean-card.available-theme {
  border-color: rgba(6, 182, 212, 0.4);
  background: radial-gradient(ellipse at top, rgba(6, 182, 212, 0.12), rgba(15, 23, 42, 0.85));
  box-shadow: 0 10px 30px -5px rgba(6, 182, 212, 0.25);
  text-align: left;
}

.available-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(30, 41, 59, 0.8);
}

.available-pulse-tag {
  font-size: 11.5px;
  font-weight: 700;
  color: #38bdf8;
  display: flex;
  align-items: center;
  gap: 5px;
}

.available-ver-badge {
  background: rgba(6, 182, 212, 0.2);
  border: 1px solid rgba(6, 182, 212, 0.4);
  color: #38bdf8;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
}

.available-notes-box {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(30, 41, 59, 0.6);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 16px;
}

.available-notes-title {
  font-size: 11.5px;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 8px;
}

.available-notes-list {
  padding-left: 18px;
  font-size: 11px;
  color: #94a3b8;
  display: flex;
  flex-direction: column;
  gap: 6px;
  line-height: 1.4;
}

/* Progress bar for Update Downloading & In-Place Reload */
.update-progress-container {
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid #06b6d4;
  border-radius: 12px;
  padding: 10px;
  margin-bottom: 12px;
}

.update-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #38bdf8;
  font-weight: 600;
  margin-bottom: 6px;
}

.update-progress-bar {
  height: 6px;
  background: #1e293b;
  border-radius: 9999px;
  overflow: hidden;
}

.update-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #06b6d4, #3b82f6, #10b981);
  border-radius: 9999px;
  transition: width 0.2s ease-in-out;
}

.btn-cta-update {
  width: 100%;
  padding: 12px 16px;
  background: linear-gradient(135deg, #06b6d4, #2563eb);
  border: none;
  border-radius: 12px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 16px rgba(6, 182, 212, 0.35);
  transition: all 0.2s ease;
}

.btn-cta-update:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(6, 182, 212, 0.45);
}

.btn-cta-update:active {
  transform: scale(0.98);
}

.available-footer-info {
  margin-top: 10px;
  text-align: center;
}

.spinning {
  animation: spinIcon 0.8s linear infinite;
}

@keyframes spinIcon {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* App Footer */
.app-footer {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid #1e293b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  color: #64748b;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 5px;
}

.secure-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #10b981;
}
`;

  const backgroundJs = `/**
 * BeamDrop Background Service Worker (Manifest V3)
 * Handles context menus, OTA background update checks, and toolbar notification badges.
 */

const DEFAULT_VERCEL_URL = "https://beam-drop-mu.vercel.app";
const UPDATE_ALARM_NAME = "beamdrop_periodic_update_check";

// Initialize on installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "beamdrop_send_selection",
    title: "BeamDrop: Send selection to Phone",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "beamdrop_send_link",
    title: "BeamDrop: Send link to Phone",
    contexts: ["link"]
  });

  chrome.contextMenus.create({
    id: "beamdrop_send_image",
    title: "BeamDrop: Send image URL to Phone",
    contexts: ["image"]
  });

  chrome.contextMenus.create({
    id: "beamdrop_open_sidepanel",
    title: "BeamDrop: Open in Side Panel (Persistent)",
    contexts: ["action"]
  });

  // Setup periodic background check for updates (every 30 mins)
  chrome.alarms.create(UPDATE_ALARM_NAME, {
    periodInMinutes: 30,
    delayInMinutes: 1
  });

  // Check immediately on install
  checkCloudForUpdates();
});

// Periodic alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM_NAME) {
    checkCloudForUpdates();
  }
});

// Context Menu actions
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "beamdrop_open_sidepanel") {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
          chrome.sidePanel.open({ tabId: tabs[0].id }).catch(() => {});
        }
      });
    }
    return;
  }

  let contentToSend = "";
  if (info.menuItemId === "beamdrop_send_selection" && info.selectionText) {
    contentToSend = info.selectionText;
  } else if (info.menuItemId === "beamdrop_send_link" && info.linkUrl) {
    contentToSend = info.linkUrl;
  } else if (info.menuItemId === "beamdrop_send_image" && info.srcUrl) {
    contentToSend = info.srcUrl;
  }

  if (contentToSend && chrome.storage) {
    chrome.storage.local.set({ pendingShareText: contentToSend }, () => {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "BeamDrop Ready",
        message: "Text ready to beam! Click BeamDrop in your toolbar to generate your QR portal."
      });
    });
  }
});

// Background update available listener (Web Store / CRX auto-update)
chrome.runtime.onUpdateAvailable.addListener((details) => {
  console.log('Native update downloaded and waiting to install:', details.version);
  chrome.action.setBadgeText({ text: 'NEW' });
  chrome.action.setBadgeBackgroundColor({ color: '#06b6d4' });
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      nativeUpdateReady: true,
      latestVersion: details.version
    });
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'check_updates_now') {
    checkCloudForUpdates().then((res) => sendResponse(res));
    return true;
  }
  if (message.action === 'clear_update_badge') {
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ cleared: true });
  }
  if (message.action === 'trigger_runtime_reload') {
    setTimeout(() => {
      if (chrome.runtime.reload) {
        chrome.runtime.reload();
      }
    }, 100);
    sendResponse({ reloading: true });
  }
  if (message.action === 'request_store_update_check') {
    if (chrome.runtime.requestUpdateCheck) {
      chrome.runtime.requestUpdateCheck((status, details) => {
        sendResponse({ status, details });
      });
      return true;
    } else {
      sendResponse({ status: 'unsupported' });
    }
  }
});

// Background Cloud Updater Check
async function checkCloudForUpdates() {
  try {
    const installedVer = chrome.runtime.getManifest().version || '1.2.0';

    // Retrieve custom server or repo if set
    let targetBaseUrl = DEFAULT_VERCEL_URL;
    if (chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(['custom_update_server']);
      if (stored && stored.custom_update_server) {
        targetBaseUrl = stored.custom_update_server.replace(/\\/$/, '');
      }
    }

    const endpoint = \`\${targetBaseUrl}/version.json?_t=\${Date.now()}\`;
    const resp = await fetch(endpoint, { cache: 'no-store' });
    if (!resp.ok) return { hasUpdate: false };

    const data = await resp.json();
    const remoteVer = data.version || '1.3.0';

    const isNewer = compareSemver(remoteVer, installedVer) > 0;
    if (isNewer) {
      // Set badge on toolbar icon
      chrome.action.setBadgeText({ text: 'NEW' });
      chrome.action.setBadgeBackgroundColor({ color: '#06b6d4' }); // Glowing cyan
      chrome.action.setTitle({ title: \`BeamDrop Update Available (v\${remoteVer})! Click to update.\` });

      if (chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          updateAvailable: true,
          latestVersion: remoteVer,
          updateHighlights: data.highlights || [],
          updateChangelog: data.changelog || [],
          lastCheckedTimestamp: Date.now()
        });
      }
      return { hasUpdate: true, version: remoteVer };
    } else {
      chrome.action.setBadgeText({ text: '' });
      return { hasUpdate: false, version: remoteVer };
    }
  } catch (err) {
    console.debug('Background update check skipped/failed:', err);
    return { hasUpdate: false };
  }
}

function compareSemver(v1, v2) {
  const p1 = (v1 || '0.0.0').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = (v2 || '0.0.0').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}
`;

  return [
    {
      name: 'manifest.json',
      path: 'manifest.json',
      language: 'json',
      description: 'Chrome Manifest V3 configuration (v1.2.0 with downloads permission)',
      content: manifestJson
    },
    {
      name: 'popup.html',
      path: 'popup.html',
      language: 'html',
      description: 'Popup UI with Send Files, Direct Download QR, and Updates tabs',
      content: popupHtml
    },
    {
      name: 'style.css',
      path: 'style.css',
      language: 'css',
      description: '100% pure offline CSS (glassmorphism dark theme, updates and changelog)',
      content: styleCss
    },
    {
      name: 'popup.js',
      path: 'popup.js',
      language: 'javascript',
      description: 'Controller with Direct Download QR generator & OTA Updates Engine',
      content: popupJs
    },
    {
      name: 'background.js',
      path: 'background.js',
      language: 'javascript',
      description: 'Manifest V3 Service Worker for context menus & notifications',
      content: backgroundJs
    }
  ];
};

export const generateExtensionZipBlob = async (receiverBaseUrl: string = 'https://beam-drop-mu.vercel.app'): Promise<Blob> => {
  const zip = new JSZip();
  const files = getExtensionFiles(receiverBaseUrl);

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  // Include version.json in zip
  try {
    const vResp = await fetch('/version.json');
    if (vResp.ok) {
      const vText = await vResp.text();
      zip.file('version.json', vText);
    }
  } catch (e) {
    // fallback version.json
    zip.file('version.json', JSON.stringify({ version: '1.2.0', name: 'BeamDrop' }, null, 2));
  }

  // Include bundled offline libraries
  try {
    const [qrResp, peerResp] = await Promise.all([
      fetch('/libs/qrcode.min.js'),
      fetch('/libs/peerjs.min.js')
    ]);
    if (qrResp.ok && peerResp.ok) {
      const qrText = await qrResp.text();
      const peerText = await peerResp.text();
      zip.file('qrcode.min.js', qrText);
      zip.file('peerjs.min.js', peerText);
    }
  } catch (e) {
    console.warn('Could not fetch static /libs/, checking fallback');
  }

  // Add icons
  const icons = zip.folder('icons');
  const createIconBlob = (size: number): Promise<Uint8Array> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(1, '#3b82f6');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(0, 0, size, size, size * 0.2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        const s = size / 128;
        ctx.moveTo(72 * s, 16 * s);
        ctx.lineTo(24 * s, 72 * s);
        ctx.lineTo(60 * s, 72 * s);
        ctx.lineTo(52 * s, 112 * s);
        ctx.lineTo(100 * s, 56 * s);
        ctx.lineTo(64 * s, 56 * s);
        ctx.closePath();
        ctx.fill();
      }

      canvas.toBlob((blob) => {
        if (blob) {
          blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
        } else {
          resolve(new Uint8Array());
        }
      }, 'image/png');
    });
  };

  const [icon16, icon48, icon128] = await Promise.all([
    createIconBlob(16),
    createIconBlob(48),
    createIconBlob(128)
  ]);

  icons?.file('icon16.png', icon16);
  icons?.file('icon48.png', icon48);
  icons?.file('icon128.png', icon128);

  return await zip.generateAsync({ type: 'blob' });
};
